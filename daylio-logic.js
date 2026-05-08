// ── NAVIGATION ───────────────────────────────────────────────────────────────
function go(view) { state.view=view; render(); window.scrollTo(0,0); }
function setTab(t) { state.tab=t; state.aiResponse=''; render(); }
function saveKey() {
  const k=document.getElementById('key-input');
  if(k){ state.geminiKey=k.value.trim(); localStorage.setItem('mdp_gemini',state.geminiKey); }
  alert('Chave salva!');
}

// ── EVENTS ───────────────────────────────────────────────────────────────────
function attachEvents() {
  // sync text area
  const ta=document.getElementById('ci-text');
  if(ta) ta.addEventListener('input',e=>state.text=e.target.value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ── VOICE RECORDING ──────────────────────────────────────────────────────────
let recognition=null, isRecording=false;
function toggleMic() {
  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){
    alert('Reconhecimento de voz não suportado neste navegador. Use texto.'); return;
  }
  if(isRecording){ recognition&&recognition.stop(); return; }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();
  recognition.lang='pt-BR'; recognition.continuous=false; recognition.interimResults=true;
  const btn=document.getElementById('mic-btn');
  const status=document.getElementById('mic-status');
  const preview=document.getElementById('voice-preview');
  recognition.onstart=()=>{
    isRecording=true;
    if(btn){btn.classList.add('recording');btn.textContent='⏹';}
    if(status) status.textContent='Gravando... fale agora';
  };
  recognition.onresult=e=>{
    const transcript=[...e.results].map(r=>r[0].transcript).join('');
    state.text=transcript;
    if(preview){preview.style.display='block';preview.textContent=transcript;}
  };
  recognition.onend=()=>{
    isRecording=false;
    if(btn){btn.classList.remove('recording');btn.textContent='🎙️';}
    if(status) status.textContent='Gravação concluída. Você pode salvar.';
  };
  recognition.onerror=e=>{
    isRecording=false;
    if(status) status.textContent='Erro: '+e.error+'. Tente novamente.';
    if(btn){btn.classList.remove('recording');btn.textContent='🎙️';}
  };
  recognition.start();
}

// ── CHECKIN SUBMIT ────────────────────────────────────────────────────────────
async function submitCheckin() {
  if(state.mood===null){ alert('Selecione um emoji de humor primeiro!'); return; }
  const text=state.text.trim()||(state.inputMode==='voice'?state.text:'');
  state.aiLoading=true; state.aiResponse=''; render();
  const record={
    id: Date.now(),
    date: new Date().toISOString(),
    mood: state.mood,
    energy: state.energy,
    sleep: state.sleep,
    text: text,
    risk: 0,
    aiAnalysis: null
  };
  // AI Analysis
  if(state.geminiKey&&text) {
    try {
      const analysis=await analyzeWithGemini(text, record);
      record.risk=clampRisk(analysis.risk_level);
      record.aiAnalysis=analysis;
      state.aiResponse=analysis.ai_response||'Obrigado por compartilhar. Seu registro foi salvo.';
    } catch(e) {
      record.risk=quickRiskEstimate(text);
      state.aiResponse=getLocalResponse(record.mood, record.risk);
    }
  } else {
    record.risk=quickRiskEstimate(text);
    state.aiResponse=getLocalResponse(record.mood, record.risk);
  }
  if(record.risk>=4){ state.records.push(record); save(); state.aiLoading=false; go('emergency'); return; }
  state.records.push(record); save();
  state.aiLoading=false; state.mood=null; state.text=''; state.energy=5; state.sleep=7;
  render();
}

// ── QUICK LOCAL RISK ESTIMATE (sem API) ──────────────────────────────────────
function quickRiskEstimate(text) {
  if(!text) return 0;
  const t=text.toLowerCase();
  const crisis=['suicídio','me matar','não quero viver','acabar com tudo','quero morrer','não aguento mais','não vejo saída','me machucar'];
  const high=['desesperado','sem esperança','inútil','ninguém se importa','para sempre','nunca vai melhorar'];
  const med=['triste','ansioso','nervoso','esgotado','exausto','isolado','sozinho'];
  if(crisis.some(w=>t.includes(w))) return 4;
  if(high.filter(w=>t.includes(w)).length>=2) return 3;
  if(med.filter(w=>t.includes(w)).length>=2) return 2;
  if(med.some(w=>t.includes(w))) return 1;
  return 0;
}

function clampRisk(value) {
  const n=Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0,Math.min(4,Math.round(n)));
}

function getLocalResponse(mood, risk) {
  const responses={
    0: ['Que bom que você está bem! Continue assim. 🌿','Ótimo ouvir isso! Cada dia bem vivido conta muito.'],
    1: ['Obrigado por compartilhar. É normal ter dias assim. O que pode fazer de gentil por você agora?','Percebo que não foi fácil. A Dra. Aline estará aqui para conversar na próxima sessão.'],
    2: ['Estou aqui com você. Quando o peso fica pesado, respirar fundo por 4 segundos pode ajudar agora. Lembre: a Dra. Aline está disponível.','Obrigado por confiar aqui. Se sentir que precisa de apoio antes da próxima sessão, pode falar com a Dra. Aline.'],
    3: ['Você fez bem em registrar. Isso importa. Por favor, abra o plano de segurança e lembre do CVV: 188, 24h, gratuito. A Dra. Aline foi notificada.'],
  };
  const arr=responses[Math.min(risk,3)];
  return arr[Math.floor(Math.random()*arr.length)];
}

// ── GEMINI API ───────────────────────────────────────────────────────────────
async function analyzeWithGemini(text, record) {
  const recent=state.records.slice(-5).map(r=>`[${r.date.slice(0,10)}] humor:${r.mood}/4, risco:${r.risk}, texto:"${(r.text||'').slice(0,80)}"`).join('\n');
  const baseline=state.records.length?Math.round(state.records.reduce((s,r)=>s+(r.mood??2),0)/state.records.length):2;
  const prompt=`Você é um analisador clínico assistente para um app de saúde mental supervisionado pela Dra. Aline Chen (psicóloga).
Analise o check-in do paciente ${state.patientName} e retorne APENAS um JSON válido, curto, sem markdown.

CHECK-IN:
Texto: "${text}"
Humor autorrelatado: ${record.mood}/4
Energia: ${record.energy}/10  
Sono: ${record.sleep}h
Baseline médio do paciente: ${baseline}/4

HISTÓRICO RECENTE:
${recent||'Primeiro registro'}

RETORNE ESTE JSON EXATO:
{
  "risk_level": <0-4>,
  "risk_signals": [<até 3 sinais observados>],
  "primary_emotions": [<até 3 emoções em português>],
  "themes": [<até 3 temas: trabalho, família, sono, ansiedade, etc>],
  "baseline_deviation": "<abaixo_significativo|abaixo_leve|dentro|acima_leve|acima_significativo>",
  "ai_response": "<resposta empática em português, no máximo 240 caracteres, sem diagnóstico, sem jargão clínico>",
  "alert_therapist": <true|false>,
  "crisis_indicators": {
    "ideacao_suicida": <bool>,
    "desesperanca_intensa": <bool>,
    "automutilacao": <bool>
  }
}

ESCALA DE RISCO:
0=Normal, 1=Atenção leve, 2=Atenção moderada, 3=Risco alto, 4=Crise iminente
EM DÚVIDA, escale para o nível MAIOR.
Se ideacao_suicida=true → risk_level mínimo 3.
ai_response NUNCA menciona diagnóstico, classificação de risco, ou termos clínicos.`;

  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}],
      generationConfig:{
        temperature:0.2,
        maxOutputTokens:2048,
        responseMimeType:"application/json",
        responseSchema:{
          type:"object",
          properties:{
            risk_level:{type:"integer"},
            risk_signals:{type:"array",items:{type:"string"}},
            primary_emotions:{type:"array",items:{type:"string"}},
            themes:{type:"array",items:{type:"string"}},
            baseline_deviation:{type:"string"},
            ai_response:{type:"string"},
            alert_therapist:{type:"boolean"},
            crisis_indicators:{
              type:"object",
              properties:{
                ideacao_suicida:{type:"boolean"},
                desesperanca_intensa:{type:"boolean"},
                automutilacao:{type:"boolean"}
              }
            }
          },
          required:["risk_level","risk_signals","primary_emotions","themes","baseline_deviation","ai_response","alert_therapist","crisis_indicators"]
        }
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    })
  });
  if(!res.ok) throw new Error('API erro '+res.status);
  const data=await res.json();
  const raw=data.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!raw) throw new Error('Resposta vazia da IA');
  return parseGeminiJson(raw);
}

function parseGeminiJson(raw) {
  const clean=raw.replace(/```json|```/g,'').trim();
  try {
    return JSON.parse(clean);
  } catch(e) {
    const start=clean.indexOf('{');
    const end=clean.lastIndexOf('}');
    if(start!==-1&&end>start) {
      try { return JSON.parse(clean.slice(start,end+1)); } catch(_) {}
    }
    const risk=clean.match(/"risk_level"\s*:\s*([0-4])/);
    if(risk) {
      return {
        risk_level:Number(risk[1]),
        risk_signals:[],
        primary_emotions:[],
        themes:[],
        baseline_deviation:'dentro',
        ai_response:'Registro salvo. A análise completa não ficou disponível agora, mas seu check-in foi considerado no acompanhamento.',
        alert_therapist:Number(risk[1])>=3,
        crisis_indicators:{ideacao_suicida:false,desesperanca_intensa:false,automutilacao:false}
      };
    }
    throw new Error('Resposta incompleta da IA');
  }
}

// ── EXPORT / IMPORT ─────────────────────────────────────────────────────────
function exportData() {
  if(!state.records.length){ alert('Você não tem registros para exportar.'); return; }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.records));
  const el = document.createElement('a');
  el.setAttribute("href", dataStr);
  el.setAttribute("download", `daylio_luis_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(el);
  el.click();
  el.remove();
}

function importData(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if(Array.isArray(imported)) {
        state.records = imported; // Update state records with the imported patient
        save();
        render();
        alert('Dados importados com sucesso!');
      } else {
        alert('Formato de arquivo inválido.');
      }
    } catch(err) {
      alert('Erro ao ler o arquivo.');
    }
    // reset input
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
render();
