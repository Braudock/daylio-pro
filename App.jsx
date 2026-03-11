import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Loader2, Activity, Brain, Battery, Calendar, Clock, AlertCircle, CheckCircle2, Download, Stethoscope, Copy, UserPlus, Edit2, PlusCircle, X, ChevronDown, Sparkles, TrendingUp, Heart, Zap, Wind, BarChart2, Shield } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const apiKey = "";

export default function App() {
    const [user, setUser] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showClinicalPanel, setShowClinicalPanel] = useState(false);
    const [patientIdInput, setPatientIdInput] = useState('');
    const [activePatientId, setActivePatientId] = useState('');
    const [editingAnalysisId, setEditingAnalysisId] = useState(null);
    const [analysisText, setAnalysisText] = useState('');
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [ripple, setRipple] = useState(null);
    const [toasts, setToasts] = useState([]);

    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

    const targetUid = activePatientId || (user ? user.uid : null);
    const isTherapistMode = activePatientId && user && activePatientId !== user.uid;

    // --- Toast system ---
    const addToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // --- AUTENTICAÇÃO ---
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (e) {
                setError("Não foi possível conectar ao sistema.");
            }
        };
        initAuth();
        const unsub = onAuthStateChanged(auth, setUser);
        return () => unsub();
    }, []);

    // --- FIREBASE DATA ---
    useEffect(() => {
        if (!targetUid) return;
        const logsRef = collection(db, 'artifacts', appId, 'users', targetUid, 'daily_logs');
        const unsub = onSnapshot(query(logsRef), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => b.timestamp - a.timestamp);
            setLogs(data);
        }, () => setError("Erro ao carregar histórico."));
        return () => unsub();
    }, [targetUid]);

    // --- RECONHECIMENTO DE VOZ ---
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;
        recognitionRef.current = new SR();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'pt-BR';
        recognitionRef.current.onresult = (e) => {
            let t = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) t += e.results[i][0].transcript;
            setTranscript(t);
        };
        recognitionRef.current.onerror = (e) => {
            setIsRecording(false);
            if (e.error !== 'no-speech') setError("Erro ao acessar o microfone.");
        };
        recognitionRef.current.onend = () => setIsRecording(false);
    }, []);

    const toggleRecording = () => {
        if (!recognitionRef.current) { setError("Voz não suportada. Digite seu relato."); return; }
        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            setTranscript(''); setError('');
            try { recognitionRef.current.start(); setIsRecording(true); } catch (e) { }
        }
    };

    // --- IA + SAVE ---
    const processAndSaveLog = async () => {
        if (!transcript.trim()) { setError("Fale ou digite algo antes de registrar."); return; }
        setIsProcessing(true); setError('');
        try {
            const now = new Date();
            const currentDate = now.toLocaleDateString('pt-BR');
            const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const payload = {
                contents: [{ parts: [{ text: `Relato do usuário: "${transcript}"` }] }],
                systemInstruction: {
                    parts: [{
                        text: `Você é um assistente de registro pessoal. Extraia informações em JSON.
          - data: formato DD/MM/AAAA. Atual: ${currentDate}
          - hora: formato HH:MM. Atual: ${currentTime}
          - evento: resumo curto do que aconteceu.
          - atividade: contexto (trabalho, estudo, lazer).
          - humor: exatamente uma de: "Muito baixo","Baixo","Estável","Bom","Muito bom". Padrão: "Estável".
          - energia: exatamente uma de: "Baixa","Média","Alta". Padrão: "Média".
          - estresse: exatamente uma de: "Baixo","Médio","Alto". Padrão: "Baixo".
          - pensamentos: resumo dos pensamentos.
          - observacoes: relato original ou detalhes extras.` }]
                },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: { data: { type: "STRING" }, hora: { type: "STRING" }, evento: { type: "STRING" }, atividade: { type: "STRING" }, humor: { type: "STRING" }, energia: { type: "STRING" }, estresse: { type: "STRING" }, pensamentos: { type: "STRING" }, observacoes: { type: "STRING" } },
                        required: ["data", "hora", "evento", "atividade", "humor", "energia", "estresse", "pensamentos", "observacoes"]
                    }
                }
            };

            let result;
            const delays = [1000, 2000, 4000, 8000, 16000];
            for (let i = 0; i <= 5; i++) {
                try {
                    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!r.ok) throw new Error(`API ${r.status}`);
                    result = await r.json(); break;
                } catch (err) {
                    if (i === 5) throw new Error("IA temporariamente indisponível. Tente novamente em breve.");
                    await new Promise(res => setTimeout(res, delays[i]));
                }
            }

            if (!result?.candidates) throw new Error("Resposta vazia do servidor.");
            const structured = JSON.parse(result.candidates[0].content.parts[0].text);

            if (user) {
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'daily_logs'), { ...structured, timestamp: Date.now(), rawTranscript: transcript });
                setTranscript('');
                addToast("Registro salvo com sucesso! ✨");
            }
        } catch (err) {
            setError(err.message || "Erro ao processar. Tente novamente.");
        } finally {
            setIsProcessing(false);
        }
    };

    const saveClinicalAnalysis = async (logId) => {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'users', targetUid, 'daily_logs', logId), { analiseTerapeuta: analysisText });
            setEditingAnalysisId(null); setAnalysisText('');
            addToast("Análise clínica atualizada.");
        } catch { setError("Não foi possível salvar a análise."); }
    };

    const copyPatientId = () => {
        if (!user) return;
        navigator.clipboard.writeText(user.uid).then(() => addToast("Código copiado! Envie para sua terapeuta. 📋")).catch(() => setError("Falha ao copiar. Selecione manualmente."));
    };

    const connectToPatient = () => {
        if (!patientIdInput.trim()) return;
        setActivePatientId(patientIdInput.trim());
        setShowClinicalPanel(false);
        addToast("Conectado ao painel do paciente. 🔗");
    };

    const disconnectPatient = () => {
        setActivePatientId(''); setPatientIdInput('');
        addToast("Desconectado do modo terapeuta.", "info");
    };

    const exportToCSV = () => {
        if (!logs.length) return;
        const headers = ['Data', 'Hora', 'Evento', 'Atividade', 'Humor', 'Energia', 'Estresse', 'Pensamentos', 'Observações', 'Transcrição', 'Análise Terapeuta'];
        const rows = logs.map(l => [l.data, l.hora, l.evento, l.atividade, l.humor, l.energia, l.estresse, l.pensamentos, l.observacoes, l.rawTranscript, l.analiseTerapeuta || ''].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
        const csv = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
        const a = document.createElement('a'); a.href = encodeURI(csv); a.download = `registros_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    // --- COMPUTED STATS ---
    const recentLogs = logs.slice(0, 7);
    const avgMoodScore = recentLogs.length ? recentLogs.reduce((acc, l) => {
        const s = { 'muito baixo': 1, 'baixo': 2, 'estável': 3, 'bom': 4, 'muito bom': 5 };
        return acc + (s[l.humor?.toLowerCase()] || 3);
    }, 0) / recentLogs.length : 0;

    const moodTrend = avgMoodScore >= 4 ? 'positivo' : avgMoodScore >= 3 ? 'estável' : 'atenção';

    // --- COLOR HELPERS ---
    const getMoodGradient = (mood) => {
        switch (mood?.toLowerCase()) {
            case 'muito bom': return 'from-emerald-400 to-teal-500';
            case 'bom': return 'from-green-400 to-emerald-500';
            case 'estável': return 'from-blue-400 to-indigo-500';
            case 'baixo': return 'from-amber-400 to-orange-500';
            case 'muito baixo': return 'from-rose-400 to-red-500';
            default: return 'from-slate-400 to-slate-500';
        }
    };

    const getMoodBg = (mood) => {
        switch (mood?.toLowerCase()) {
            case 'muito bom': return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
            case 'bom': return 'bg-green-50 text-green-700 ring-1 ring-green-200';
            case 'estável': return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
            case 'baixo': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
            case 'muito baixo': return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
            default: return 'bg-slate-50 text-slate-700 ring-1 ring-slate-200';
        }
    };

    const getMoodEmoji = (mood) => ({ 'muito bom': '🤩', 'bom': '😊', 'estável': '😌', 'baixo': '😔', 'muito baixo': '😢' }[mood?.toLowerCase()] || '😶');
    const getMoodScore = (mood) => ({ 'muito bom': 100, 'bom': 80, 'estável': 60, 'baixo': 35, 'muito baixo': 15 }[mood?.toLowerCase()] || 60);
    const getEnergyScore = (e) => ({ 'alta': 100, 'média': 60, 'baixa': 25 }[e?.toLowerCase()] || 60);
    const getStressScore = (s) => ({ 'baixo': 15, 'médio': 55, 'alto': 95 }[s?.toLowerCase()] || 15);
    const getStressColor = (s) => ({ 'baixo': 'from-emerald-400 to-teal-400', 'médio': 'from-amber-400 to-orange-400', 'alto': 'from-rose-400 to-red-500' }[s?.toLowerCase()] || 'from-slate-300 to-slate-400');
    const getEnergyColor = (e) => ({ 'alta': 'from-yellow-400 to-amber-500', 'média': 'from-blue-400 to-indigo-500', 'baixa': 'from-slate-300 to-slate-400' }[e?.toLowerCase()] || 'from-slate-300 to-slate-400');

    return (
        <div className="min-h-screen bg-[#0f0e17] font-sans text-white" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

            {/* Global Styles Injection */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        * { box-sizing: border-box; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        .glass {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .glass-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
        }

        .glass-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .glow-indigo { box-shadow: 0 0 40px rgba(99,102,241,0.25); }
        .glow-purple { box-shadow: 0 0 40px rgba(168,85,247,0.25); }

        .gradient-text {
          background: linear-gradient(135deg, #a78bfa, #60a5fa, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .pulse-ring {
          animation: pulseRing 1.5s ease-out infinite;
        }

        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          100% { box-shadow: 0 0 0 20px rgba(239,68,68,0); }
        }

        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .slide-down {
          animation: slideDown 0.35s cubic-bezier(0.4,0,0.2,1);
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px) scaleY(0.95); }
          to { opacity: 1; transform: translateY(0) scaleY(1); }
        }

        .progress-bar {
          transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
        }

        .mic-btn {
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
        }

        .mic-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .mic-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .toast-enter {
          animation: toastIn 0.4s cubic-bezier(0.4,0,0.2,1);
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        textarea {
          background: rgba(255,255,255,0.04) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: white !important;
          resize: none;
        }

        textarea::placeholder {
          color: rgba(255,255,255,0.3) !important;
        }

        textarea:focus {
          border-color: rgba(99,102,241,0.5) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important;
          outline: none !important;
        }

        input {
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: white !important;
        }

        input::placeholder { color: rgba(255,255,255,0.35) !important; }
        input:focus { border-color: rgba(99,102,241,0.5) !important; outline: none !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }

        .stat-number {
          font-feature-settings: 'tnum';
          font-variant-numeric: tabular-nums;
        }
      `}</style>

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', top: '40%', right: '20%', width: '30%', height: '30%', background: 'radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
            </div>

            {/* Toast Notifications */}
            <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '400px', padding: '0 16px', pointerEvents: 'none' }}>
                {toasts.map(toast => (
                    <div key={toast.id} className="toast-enter" style={{ width: '100%', background: toast.type === 'info' ? 'rgba(99,102,241,0.9)' : 'rgba(16,185,129,0.9)', backdropFilter: 'blur(16px)', borderRadius: '14px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', pointerEvents: 'auto' }}>
                        <CheckCircle2 size={16} style={{ flexShrink: 0, color: 'white' }} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>{toast.msg}</span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <header className="glass sticky top-0 z-30" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ maxWidth: '780px', margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: isTherapistMode ? 'linear-gradient(135deg,#9333ea,#db2777)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isTherapistMode ? '0 4px 20px rgba(147,51,234,0.4)' : '0 4px 20px rgba(99,102,241,0.4)' }}>
                            {isTherapistMode ? <Stethoscope size={20} color="white" /> : <Sparkles size={20} color="white" />}
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 800, letterSpacing: '-0.3px', background: isTherapistMode ? 'linear-gradient(135deg,#c084fc,#f472b6)' : 'linear-gradient(135deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.2 }}>
                                {isTherapistMode ? 'Painel Clínico' : 'Meu Daylio Pro'}
                            </h1>
                            {isTherapistMode && <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Modo Terapeuta</span>}
                            {!isTherapistMode && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>Registro Inteligente de Saúde Mental</span>}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isTherapistMode ? (
                            <button onClick={disconnectPatient} style={{ fontSize: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}
                                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.14)'}
                                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
                            >
                                Sair do Paciente
                            </button>
                        ) : (
                            <button onClick={() => setShowClinicalPanel(!showClinicalPanel)} style={{ fontSize: '12px', background: showClinicalPanel ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.07)', border: showClinicalPanel ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.1)', color: showClinicalPanel ? '#c084fc' : 'rgba(255,255,255,0.7)', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                                <Stethoscope size={13} /> Acesso Clínico
                                <ChevronDown size={12} style={{ transform: showClinicalPanel ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Clinical Panel Dropdown */}
                {showClinicalPanel && !isTherapistMode && (
                    <div className="slide-down" style={{ maxWidth: '780px', margin: '0 auto', padding: '16px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                        {/* Patient Share */}
                        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '16px', padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UserPlus size={14} color="#818cf8" />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#a5b4fc' }}>Compartilhar com Terapeuta</span>
                            </div>
                            <p style={{ fontSize: '11px', color: 'rgba(165,180,252,0.6)', marginBottom: '12px', lineHeight: 1.5 }}>Envie seu código de acesso para que sua terapeuta possa acompanhar seus registros.</p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input readOnly value={user?.uid || 'Aguarde...'} style={{ flex: 1, fontSize: '11px', padding: '8px 12px', borderRadius: '10px', fontFamily: 'monospace' }} />
                                <button onClick={copyPatientId} style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                                    <Copy size={13} /> Copiar
                                </button>
                            </div>
                        </div>

                        {/* Therapist Connect */}
                        <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '16px', padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Shield size={14} color="#c084fc" />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#c084fc' }}>Sou a Terapeuta</span>
                            </div>
                            <p style={{ fontSize: '11px', color: 'rgba(192,132,252,0.6)', marginBottom: '12px', lineHeight: 1.5 }}>Cole o código do paciente para acessar o histórico completo e adicionar análises clínicas.</p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input value={patientIdInput} onChange={e => setPatientIdInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && connectToPatient()} placeholder="Código do paciente..." style={{ flex: 1, fontSize: '11px', padding: '8px 12px', borderRadius: '10px' }} />
                                <button onClick={connectToPatient} disabled={!patientIdInput.trim()} style={{ padding: '8px 14px', background: 'rgba(168,85,247,0.4)', border: '1px solid rgba(168,85,247,0.4)', color: '#e9d5ff', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s', opacity: patientIdInput.trim() ? 1 : 0.4 }}>
                                    Acessar
                                </button>
                            </div>
                        </div>

                    </div>
                )}
            </header>

            <main style={{ maxWidth: '780px', margin: '0 auto', padding: '24px 20px 80px' }}>

                {/* Stats Bar */}
                {logs.length > 0 && (
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {[
                            { label: 'Registros', value: logs.length, icon: <BarChart2 size={16} />, color: '#818cf8', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
                            { label: 'Humor Médio', value: avgMoodScore ? ['', '😢', '😔', '😌', '😊', '🤩'][Math.round(avgMoodScore)] + ' ' + ['', 'Atenção', 'Baixo', 'Estável', 'Bom', 'Ótimo'][Math.round(avgMoodScore)] : '—', icon: <Heart size={16} />, color: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.2)' },
                            { label: 'Tendência', value: moodTrend === 'positivo' ? '↑ Positivo' : moodTrend === 'estável' ? '→ Estável' : '↓ Atenção', icon: <TrendingUp size={16} />, color: moodTrend === 'positivo' ? '#34d399' : moodTrend === 'estável' ? '#60a5fa' : '#fbbf24', bg: moodTrend === 'positivo' ? 'rgba(52,211,153,0.1)' : moodTrend === 'estável' ? 'rgba(96,165,250,0.1)' : 'rgba(251,191,36,0.1)', border: moodTrend === 'positivo' ? 'rgba(52,211,153,0.2)' : moodTrend === 'estável' ? 'rgba(96,165,250,0.2)' : 'rgba(251,191,36,0.2)' }
                        ].map((s, i) => (
                            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `rgba(${s.bg.replace(/[^\d,]/g, '').split(',').slice(0, 3).join(',')},0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}>
                                    <span style={{ color: s.color }}>{s.icon}</span>
                                </div>
                                <div>
                                    <div className="stat-number" style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>{s.value}</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                {!isTherapistMode && (
                    <div className="glass-card fade-in" style={{ padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
                        {/* Subtle gradient accent */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)', borderRadius: '20px 20px 0 0' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Brain size={16} color="#a78bfa" />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'white', letterSpacing: '-0.2px' }}>Novo Registro</h2>
                                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Fale ou escreva — a IA irá estruturar tudo</p>
                            </div>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <textarea
                                ref={textareaRef}
                                style={{ width: '100%', height: '120px', padding: '16px 60px 16px 16px', borderRadius: '14px', fontSize: '14px', lineHeight: 1.6, fontFamily: 'inherit' }}
                                placeholder='Ex: "Acordei tardinho, tomei café tranquilo. Humor ok, mas energia baixinha. Pensando no prazo da semana."'
                                value={transcript}
                                onChange={e => setTranscript(e.target.value)}
                                disabled={isProcessing}
                            />

                            {/* Mic Button */}
                            <button
                                onClick={toggleRecording}
                                disabled={isProcessing}
                                className="mic-btn"
                                style={{ position: 'absolute', bottom: '14px', right: '14px', width: '42px', height: '42px', borderRadius: '12px', border: 'none', cursor: isProcessing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRecording ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: isRecording ? '0 4px 20px rgba(239,68,68,0.5)' : '0 4px 20px rgba(99,102,241,0.4)', transition: 'all 0.2s', opacity: isProcessing ? 0.5 : 1 }}
                            >
                                {isRecording ? <MicOff size={18} color="white" /> : <Mic size={18} color="white" />}
                            </button>
                        </div>

                        {/* Status & Send */}
                        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isRecording ? (
                                    <>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 0 rgba(239,68,68,0.5)', animation: 'pulseRing 1.5s ease-out infinite', display: 'inline-block' }} />
                                        <span style={{ color: '#f87171', fontWeight: 500 }}>Ouvindo... Fale agora</span>
                                    </>
                                ) : (
                                    <span>🎙️ Clique no microfone ou digite acima</span>
                                )}
                            </div>

                            <button
                                onClick={processAndSaveLog}
                                disabled={isProcessing || !transcript.trim()}
                                style={{ padding: '10px 22px', borderRadius: '12px', border: 'none', cursor: (isProcessing || !transcript.trim()) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', background: (isProcessing || !transcript.trim()) ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: (isProcessing || !transcript.trim()) ? 'rgba(255,255,255,0.3)' : 'white', boxShadow: (!isProcessing && transcript.trim()) ? '0 4px 20px rgba(99,102,241,0.4)' : 'none', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                            >
                                {isProcessing ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analisando...</> : <><Sparkles size={15} /> Salvar com IA</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#fca5a5' }}>
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                        {error}
                        <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '2px' }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* History */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Histórico
                                {isTherapistMode && <span style={{ fontSize: '10px', background: 'rgba(168,85,247,0.2)', color: '#c084fc', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Visão Paciente</span>}
                            </h2>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{logs.length} registros • Ordenado do mais recente</p>
                        </div>
                        <button onClick={exportToCSV} disabled={!logs.length} style={{ padding: '8px 14px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', borderRadius: '20px', cursor: logs.length ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: logs.length ? 1 : 0.4, transition: 'all 0.2s' }}>
                            <Download size={13} /> Exportar CSV
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {logs.length === 0 ? (
                            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <Brain size={28} color="rgba(99,102,241,0.5)" />
                                </div>
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>{isTherapistMode ? 'Paciente sem registros ainda.' : 'Nenhum registro ainda.'}</p>
                                {!isTherapistMode && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Comece gravando seu primeiro momento do dia!</p>}
                            </div>
                        ) : (
                            logs.map((log, idx) => {
                                const isExpanded = expandedLogId === log.id;
                                const moodScore = getMoodScore(log.humor);
                                const energyScore = getEnergyScore(log.energia);
                                const stressScore = getStressScore(log.estresse);

                                return (
                                    <div key={log.id} className="glass-card fade-in" style={{ padding: 0, overflow: 'hidden', animationDelay: `${idx * 0.05}s` }}>
                                        {/* Color top strip based on mood */}
                                        <div style={{ height: '3px', background: `linear-gradient(90deg, var(--mood-a), var(--mood-b))`, '--mood-a': log.humor?.toLowerCase() === 'muito bom' ? '#34d399' : log.humor?.toLowerCase() === 'bom' ? '#4ade80' : log.humor?.toLowerCase() === 'estável' ? '#60a5fa' : log.humor?.toLowerCase() === 'baixo' ? '#fbbf24' : '#f87171', '--mood-b': log.humor?.toLowerCase() === 'muito bom' ? '#06b6d4' : log.humor?.toLowerCase() === 'bom' ? '#34d399' : log.humor?.toLowerCase() === 'estável' ? '#818cf8' : log.humor?.toLowerCase() === 'baixo' ? '#f97316' : '#ef4444' }} />

                                        {/* Card summary (always visible) */}
                                        <div style={{ padding: '18px 20px', cursor: 'pointer' }} onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '22px', lineHeight: 1 }}>{getMoodEmoji(log.humor)}</span>
                                                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'white', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{log.evento}</h3>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} />{log.data}</span>
                                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} />{log.hora}</span>
                                                        {log.atividade && <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '20px' }}>{log.atividade}</span>}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }} className={getMoodBg(log.humor)}>
                                                        {log.humor}
                                                    </span>
                                                    <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }} />
                                                </div>
                                            </div>

                                            {/* Mini progress bars */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '14px' }}>
                                                {[
                                                    { label: 'Humor', score: moodScore, gradient: getMoodGradient(log.humor), icon: <Heart size={10} /> },
                                                    { label: 'Energia', score: energyScore, gradient: getEnergyColor(log.energia), icon: <Zap size={10} /> },
                                                    { label: 'Estresse', score: stressScore, gradient: getStressColor(log.estresse), icon: <Wind size={10} /> }
                                                ].map((m, i) => (
                                                    <div key={i}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{m.icon}{m.label}</span>
                                                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{m.score}%</span>
                                                        </div>
                                                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <div className="progress-bar" style={{ height: '100%', width: `${m.score}%`, background: `linear-gradient(90deg, ${m.gradient.replace('from-', '').replace('to-', '')})`, borderRadius: '4px', background: i === 0 ? (log.humor?.toLowerCase() === 'muito bom' ? 'linear-gradient(90deg,#34d399,#06b6d4)' : log.humor?.toLowerCase() === 'bom' ? 'linear-gradient(90deg,#4ade80,#34d399)' : log.humor?.toLowerCase() === 'estável' ? 'linear-gradient(90deg,#60a5fa,#818cf8)' : log.humor?.toLowerCase() === 'baixo' ? 'linear-gradient(90deg,#fbbf24,#f97316)' : 'linear-gradient(90deg,#f87171,#ef4444)') : i === 1 ? (log.energia?.toLowerCase() === 'alta' ? 'linear-gradient(90deg,#fbbf24,#f59e0b)' : log.energia?.toLowerCase() === 'média' ? 'linear-gradient(90deg,#60a5fa,#6366f1)' : 'linear-gradient(90deg,#94a3b8,#64748b)') : (log.estresse?.toLowerCase() === 'baixo' ? 'linear-gradient(90deg,#34d399,#06b6d4)' : log.estresse?.toLowerCase() === 'médio' ? 'linear-gradient(90deg,#fbbf24,#f97316)' : 'linear-gradient(90deg,#f87171,#ef4444)') }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="fade-in" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '18px 20px', background: 'rgba(0,0,0,0.15)' }}>

                                                {log.pensamentos && (
                                                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>💭 Pensamentos</span>
                                                        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{log.pensamentos}</p>
                                                    </div>
                                                )}

                                                {log.observacoes && (
                                                    <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>📝 Nota do Paciente</span>
                                                        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{log.observacoes}</p>
                                                    </div>
                                                )}

                                                {/* Therapist Area */}
                                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
                                                    {log.analiseTerapeuta ? (
                                                        editingAnalysisId === log.id ? (
                                                            <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '12px', padding: '14px' }}>
                                                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#c084fc', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                                                    <Stethoscope size={12} /> Editando Análise
                                                                </span>
                                                                <textarea style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.6, fontFamily: 'inherit', minHeight: '80px' }} value={analysisText} onChange={e => setAnalysisText(e.target.value)} rows={3} />
                                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                                                    <button onClick={() => setEditingAnalysisId(null)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>Cancelar</button>
                                                                    <button onClick={() => saveClinicalAnalysis(log.id)} style={{ padding: '7px 16px', background: 'linear-gradient(135deg,rgba(168,85,247,0.6),rgba(219,39,119,0.4))', border: '1px solid rgba(168,85,247,0.4)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Atualizar</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#c084fc', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <Stethoscope size={12} /> Análise Clínica
                                                                    </span>
                                                                    <button onClick={() => { setEditingAnalysisId(log.id); setAnalysisText(log.analiseTerapeuta); }} style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(168,85,247,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                </div>
                                                                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(216,180,254,0.9)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.analiseTerapeuta}</p>
                                                            </div>
                                                        )
                                                    ) : (
                                                        editingAnalysisId === log.id ? (
                                                            <div className="fade-in" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '12px', padding: '14px' }}>
                                                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#c084fc', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                                                    <Stethoscope size={12} /> Novo Comentário Clínico
                                                                </span>
                                                                <textarea style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.6, fontFamily: 'inherit', minHeight: '80px' }} value={analysisText} onChange={e => setAnalysisText(e.target.value)} placeholder="Adicione observações, insights ou direcionamentos terapêuticos..." rows={3} autoFocus />
                                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                                                    <button onClick={() => setEditingAnalysisId(null)} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>Cancelar</button>
                                                                    <button onClick={() => saveClinicalAnalysis(log.id)} disabled={!analysisText.trim()} style={{ padding: '7px 16px', background: 'linear-gradient(135deg,rgba(168,85,247,0.6),rgba(219,39,119,0.4))', border: '1px solid rgba(168,85,247,0.4)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, opacity: analysisText.trim() ? 1 : 0.4 }}>Salvar</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => { setEditingAnalysisId(log.id); setAnalysisText(''); }} style={{ background: 'transparent', border: '1px dashed rgba(168,85,247,0.25)', borderRadius: '10px', padding: '8px 14px', color: 'rgba(192,132,252,0.7)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center', transition: 'all 0.2s' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.08)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.4)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.25)'; }}
                                                            >
                                                                <PlusCircle size={13} /> Adicionar Comentário Clínico
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
