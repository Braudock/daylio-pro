// ── SCREEN BUILDERS ─────────────────────────────────────────────────────────

function buildLoginScreen() {
  return `<div id="screen-login" class="screen ${state.view==='login'?'active':''}">
    <div class="login-logo"><div class="icon">🧠</div><h1>Meu<span>Daylio</span> Pro</h1></div>
    <p class="login-sub">Apoio terapêutico inteligente com IA companion</p>
    <div class="login-cards">
      <div class="profile-card patient">
        <div class="avatar">🌿</div>
        <h3>${state.patientName}</h3>
        <p>Check-in diário, análise emocional e acompanhamento com IA</p>
        <button class="btn-select" onclick="go('patient')">Entrar como Paciente</button>
      </div>
      <div class="profile-card therapist">
        <div class="avatar">👩‍⚕️</div>
        <h3>Dra. Aline Chen</h3>
        <p>Dashboard clínico, alertas de risco e resumos semanais por paciente</p>
        <button class="btn-select" onclick="go('therapist')">Entrar como Terapeuta</button>
      </div>
    </div>
    <div style="margin-top:32px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;max-width:400px;width:100%">
      <p style="font-size:.75rem;color:var(--text3);margin-bottom:8px">🔑 Chave Gemini API (opcional)</p>
      <input id="key-input" class="input-field" placeholder="AIza..." value="${state.geminiKey}" style="font-size:.8rem"/>
      <button onclick="saveKey()" style="margin-top:8px;background:var(--sage-dim);border:1px solid var(--sage);color:var(--sage);padding:6px 16px;border-radius:6px;font-size:.8rem">Salvar</button>
    </div>
  </div>`;
}

function buildPatientScreen() {
  if(state.view!=='patient') return `<div id="screen-patient" class="screen"></div>`;
  const today = new Date().toISOString().slice(0,10);
  const todayDone = state.records.some(r=>r.date.slice(0,10)===today);
  return `<div id="screen-patient" class="screen active" style="flex-direction:column">
    <header class="app-header">
      <div class="logo"><div class="dot"></div> MeuDaylio Pro</div>
      <div class="header-right">
        <span style="font-size:.8rem;color:var(--text2)">👤 ${state.patientName}</span>
        <button class="btn-switch" onclick="go('login')">← Trocar</button>
        <button class="btn btn-danger" style="padding:6px 12px;font-size:.75rem" onclick="go('emergency')">🆘 SOS</button>
      </div>
    </header>
    <div class="app-main fade-in">
      ${buildStreak()}
      <div class="tabs mt-16" style="margin-bottom:16px">
        <button class="tab ${state.tab==='checkin'?'active':''}" onclick="setTab('checkin')">📝 Check-in</button>
        <button class="tab ${state.tab==='history'?'active':''}" onclick="setTab('history')">📅 Histórico</button>
        <button class="tab ${state.tab==='stats'?'active':''}" onclick="setTab('stats')">📊 Stats</button>
        <button class="tab ${state.tab==='safeplan'?'active':''}" onclick="setTab('safeplan')">🛡️ Plano</button>
      </div>
      ${state.tab==='checkin'?buildCheckin(todayDone):''}
      ${state.tab==='history'?buildHistory():''}
      ${state.tab==='stats'?buildStats():''}
      ${state.tab==='safeplan'?buildSafePlan():''}
    </div>
  </div>`;
}

function buildStreak() {
  const days=30, now=new Date();
  let streak=0, dots='';
  for(let i=days-1;i>=0;i--){
    const d=new Date(now); d.setDate(d.getDate()-i);
    const ds=d.toISOString().slice(0,10);
    const done=state.records.some(r=>r.date.slice(0,10)===ds);
    const isToday=i===0;
    if(done) streak++;
    dots+=`<div class="streak-dot ${done?'done':'missed'}" title="${ds}">${done?'✓':isToday?'·':'×'}</div>`;
  }
  return `<div class="card" style="margin-bottom:0">
    <div class="card-title">🔥 Sequência — <span style="color:var(--sage);margin-left:4px">${streak} dias</span></div>
    <div class="streak-row">${dots}</div>
  </div>`;
}

function buildCheckin(todayDone) {
  const moods=[['😞','Muito mal'],['😔','Mal'],['😐','Neutro'],['🙂','Bem'],['😄','Ótimo']];
  return `<div class="card">
    <div class="card-title">✨ Check-in de hoje</div>
    ${todayDone?`<div style="text-align:center;padding:20px;color:var(--sage)">✅ Você já registrou hoje! <button class="btn btn-ghost" style="margin-top:12px" onclick="state.records.splice(state.records.findIndex(r=>r.date.slice(0,10)===new Date().toISOString().slice(0,10)),1);save();render()">Refazer</button></div>`:`
    <p style="font-size:.85rem;color:var(--text2);margin-bottom:16px">Como você está <strong>agora</strong>?</p>
    <div class="mood-grid" style="margin-bottom:20px">
      ${moods.map((m,i)=>`<button class="mood-btn ${state.mood===i?'selected':''}" onclick="state.mood=${i};render()" title="${m[1]}">${m[0]}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="tab ${state.inputMode==='text'?'active':''}" onclick="state.inputMode='text';render()" style="flex:none;padding:6px 14px">✍️ Texto</button>
      <button class="tab ${state.inputMode==='voice'?'active':''}" onclick="state.inputMode='voice';render()" style="flex:none;padding:6px 14px">🎙️ Voz</button>
    </div>
    ${state.inputMode==='text'?`
      <textarea id="ci-text" class="input-field" rows="4" placeholder="Como foi seu dia? O que está sentindo agora?">${state.text}</textarea>
    `:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px">
        <button id="mic-btn" class="mic-btn" onclick="toggleMic()">🎙️</button>
        <p id="mic-status" style="font-size:.8rem;color:var(--text3)">Pressione para gravar</p>
        <div id="voice-preview" class="ai-bubble" style="width:100%;display:none"></div>
      </div>
    `}
    <div class="divider"></div>
    <div class="grid-2" style="margin-bottom:16px">
      <div>
        <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">⚡ Energia — <strong id="en-val">${state.energy}</strong>/10</p>
        <input type="range" min="1" max="10" value="${state.energy}" oninput="state.energy=+this.value;document.getElementById('en-val').textContent=this.value"/>
        <div class="slider-labels"><span>Exausto</span><span>Cheio</span></div>
      </div>
      <div>
        <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">🌙 Sono — <strong id="sl-val">${state.sleep}</strong>h</p>
        <input type="range" min="2" max="12" value="${state.sleep}" oninput="state.sleep=+this.value;document.getElementById('sl-val').textContent=this.value"/>
        <div class="slider-labels"><span>2h</span><span>12h</span></div>
      </div>
    </div>
    <button class="btn btn-primary" style="width:100%" onclick="submitCheckin()" ${state.mood===null?'disabled':''}>
      ✨ Salvar e analisar com IA
    </button>
    `}
    ${state.aiLoading?`<div class="ai-bubble"><span class="ai-label">🤖 Companion IA</span><div class="typing"><span></span><span></span><span></span></div></div>`:''}
    ${state.aiResponse&&!state.aiLoading?`<div class="ai-bubble fade-in"><span class="ai-label">🤖 Companion IA</span>${state.aiResponse}</div>`:''}
  </div>`;
}

function buildHistory() {
  if(!state.records.length) return `<div class="card"><div class="empty"><span class="empty-icon">📭</span>Nenhum registro ainda.<br>Faça seu primeiro check-in!</div></div>`;
  const moods=['😞','😔','😐','🙂','😄'];
  const sorted=[...state.records].reverse();
  return `<div class="timeline">
    ${sorted.map(r=>`<div class="tl-item fade-in">
      <div class="tl-emoji">${moods[r.mood]||'😐'}</div>
      <div>
        <div class="tl-date">${new Date(r.date).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</div>
        <div class="tl-text">${r.text||'(sem texto)'}</div>
        ${r.aiAnalysis?`<div style="margin-top:8px">${(r.aiAnalysis.themes||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div>`:''}
      </div>
      <span class="badge badge-${r.risk||0}">${['Ótimo','Leve','Atenção','Alto','Crise'][r.risk||0]}</span>
    </div>`).join('')}
  </div>`;
}

function buildStats() {
  if(state.records.length<2) return `<div class="card"><div class="empty"><span class="empty-icon">📊</span>Registre pelo menos 2 dias para ver estatísticas.</div></div>`;
  const avg=(arr,key)=>arr.length?Math.round(arr.reduce((s,r)=>s+(r[key]||5),0)/arr.length):0;
  const last7=state.records.slice(-7);
  const moodAvg=avg(last7,'mood');
  const energyAvg=avg(last7,'energy');
  const sleepAvg=avg(last7,'sleep');
  const moodColors=['#e05252','#e07c3a','#e8b84b','#7eb89a','#4caf7d'];
  const bars=last7.map(r=>{
    const h=Math.max(8,((r.mood||2)/4)*100);
    return `<div class="chart-bar" style="background:${moodColors[r.mood||2]};height:${h}%" title="${new Date(r.date).toLocaleDateString('pt-BR')}"></div>`;
  }).join('');
  return `<div>
    <div class="grid-2">
      <div class="stat-mini"><span class="num" style="color:var(--sage)">${moodAvg+1}/5</span><span class="lbl">Humor médio (7d)</span></div>
      <div class="stat-mini"><span class="num" style="color:var(--lavender)">${energyAvg}/10</span><span class="lbl">Energia média (7d)</span></div>
      <div class="stat-mini"><span class="num" style="color:var(--terracota)">${sleepAvg}h</span><span class="lbl">Sono médio (7d)</span></div>
      <div class="stat-mini"><span class="num">${state.records.length}</span><span class="lbl">Total de registros</span></div>
    </div>
    <div class="card mt-12">
      <div class="card-title">📈 Humor — últimos 7 dias</div>
      <div class="chart-wrap">${bars||'<p style="color:var(--text3);font-size:.8rem">Sem dados</p>'}</div>
      <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text3);margin-top:4px">
        ${last7.map(r=>`<span>${new Date(r.date).toLocaleDateString('pt-BR',{weekday:'short'})}</span>`).join('')}
      </div>
    </div>
    <button class="btn btn-ghost mt-16" style="width:100%" onclick="exportData()">
      📤 Exportar dados para a Dra. Aline
    </button>
  </div>`;
}

function buildSafePlan() {
  const sp=state.safePlan;
  return `<div class="card">
    <div class="card-title">🛡️ Meu Plano de Segurança</div>
    <p style="font-size:.8rem;color:var(--text2);margin-bottom:16px">Construído com a Dra. Aline Chen. Em momentos difíceis, leia devagar.</p>
    <p style="font-size:.78rem;font-weight:600;color:var(--terracota);margin-bottom:8px">⚠️ Meus sinais de alerta</p>
    ${sp.signals.map(s=>`<div class="safe-plan-item" style="border-color:var(--terracota)">${s}</div>`).join('')}
    <div class="divider"></div>
    <p style="font-size:.78rem;font-weight:600;color:var(--sage);margin-bottom:8px">🌿 O que me acalma</p>
    ${sp.calm.map(s=>`<div class="safe-plan-item">${s}</div>`).join('')}
    <div class="divider"></div>
    <p style="font-size:.78rem;font-weight:600;color:var(--lavender);margin-bottom:8px">📞 Quem posso ligar</p>
    ${sp.contacts.map(s=>`<div class="safe-plan-item" style="border-color:var(--lavender)">${s}</div>`).join('')}
    <div class="divider"></div>
    <p style="font-size:.78rem;font-weight:600;color:var(--yellow);margin-bottom:8px">💛 Razões para continuar</p>
    ${sp.reasons.map(s=>`<div class="safe-plan-item" style="border-color:var(--yellow)">${s}</div>`).join('')}
    <div class="divider"></div>
    <button class="btn btn-sos" onclick="go('emergency')">🆘 Preciso de ajuda agora</button>
  </div>`;
}

function buildTherapistScreen() {
  if(state.view!=='therapist') return `<div id="screen-therapist" class="screen"></div>`;
  const allPatients=[
    {name:'Luís Braud',emoji:'🧑',records:state.records,lastRisk:state.records.length?state.records[state.records.length-1].risk||0:0},
    {name:'Ana S.',emoji:'👩',records:[],lastRisk:2,note:'Queda de humor há 4 dias'},
    {name:'Carlos M.',emoji:'🧔',records:[],lastRisk:1,note:'Estável, sono melhorando'},
  ];
  const sorted=[...allPatients].sort((a,b)=>b.lastRisk-a.lastRisk);
  const riskLabel=['Normal','Atenção Leve','Atenção','Risco Alto','CRISE'];
  return `<div id="screen-therapist" class="screen active" style="flex-direction:column">
    <header class="app-header">
      <div class="logo"><div class="dot" style="background:var(--lavender)"></div> Painel Clínico</div>
      <div class="header-right">
        <span style="font-size:.8rem;color:var(--text2)">👩‍⚕️ Dra. Aline Chen</span>
        <button class="btn-switch" onclick="go('login')">← Trocar</button>
      </div>
    </header>
    <div class="app-main fade-in">
      <div class="grid-2" style="margin-bottom:16px">
        <div class="stat-mini"><span class="num">${sorted.filter(p=>p.lastRisk>=3).length}</span><span class="lbl">⚠️ Em alerta</span></div>
        <div class="stat-mini"><span class="num">${sorted.length}</span><span class="lbl">👥 Pacientes</span></div>
      </div>
      
      <div style="display:flex;gap:8px;margin-bottom:16px">
         <button class="btn btn-ghost" style="flex:1;font-size:.8rem" onclick="document.getElementById('import-file').click()">
           📥 Importar Paciente (.json)
         </button>
         <input type="file" id="import-file" style="display:none" accept=".json" onchange="importData(event)">
      </div>

      <div class="card-title" style="margin-bottom:12px">📥 Inbox — priorizado por risco</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${sorted.map(p=>`
          <div class="patient-row ${p.lastRisk===4?'urgent':p.lastRisk===3?'high':''}">
            <div class="patient-avatar">${p.emoji}</div>
            <div>
              <div style="font-size:.9rem;font-weight:600">${p.name}</div>
              <div style="font-size:.78rem;color:var(--text2);margin-top:2px">${p.note||`${p.records.length} registros · último check-in hoje`}</div>
              ${p.records.length?`<div style="margin-top:6px">${(p.records[p.records.length-1].aiAnalysis?.themes||[]).slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')}</div>`:''}
            </div>
            <span class="badge badge-${p.lastRisk}">${riskLabel[p.lastRisk]}</span>
          </div>
        `).join('')}
      </div>
      ${state.records.length?`
      <div class="card" style="margin-top:16px">
        <div class="card-title">📋 Resumo Semanal — ${allPatients[0].name}</div>
        ${buildTherapistSummary()}
      </div>`:''}
      <div class="card mt-16" style="background:var(--lav-dim);border-color:rgba(155,142,196,0.2)">
        <div class="card-title" style="color:var(--lavender)">💡 Lembretes clínicos</div>
        <p style="font-size:.82rem;color:var(--text2);line-height:1.7">
          • Esta plataforma é de apoio — não substitui o prontuário oficial.<br>
          • Alertas nível 3+ requerem contato ativo com o paciente.<br>
          • IA sinaliza, você decide. Toda análise é auxiliar.
        </p>
      </div>
    </div>
  </div>`;
}

function buildTherapistSummary() {
  if(!state.records.length) return '<p style="color:var(--text3);font-size:.85rem">Sem dados</p>';
  const last7=state.records.slice(-7);
  const avgMood=last7.reduce((s,r)=>s+(r.mood||2),0)/last7.length;
  const highRisk=last7.filter(r=>(r.risk||0)>=3).length;
  const themes=[...new Set(last7.flatMap(r=>r.aiAnalysis?.themes||[]))].slice(0,5);
  return `
    <div class="grid-2" style="margin-bottom:12px">
      <div class="stat-mini"><span class="num" style="color:var(--sage)">${(avgMood+1).toFixed(1)}/5</span><span class="lbl">Humor médio (7d)</span></div>
      <div class="stat-mini"><span class="num" style="color:${highRisk>0?'var(--orange)':'var(--green)'}">${highRisk}</span><span class="lbl">Alertas nível 3+</span></div>
    </div>
    <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">Temas recorrentes:</p>
    <div>${themes.length?themes.map(t=>`<span class="tag">${t}</span>`).join(''):'<span style="font-size:.8rem;color:var(--text3)">Sem dados suficientes</span>'}</div>
    <div class="divider"></div>
    <p style="font-size:.8rem;color:var(--text2);line-height:1.6">
      ${last7.length} check-ins nos últimos 7 dias. 
      ${highRisk>1?`<strong style="color:var(--orange)">Atenção: ${highRisk} dias com risco elevado.</strong>`:'Evolução dentro do esperado.'}
    </p>`;
}

function buildEmergencyScreen() {
  return `<div id="screen-emergency" class="screen ${state.view==='emergency'?'active':''}">
    <div class="emer-pulse">🆘</div>
    <h2 class="emer-title">Você não está sozinho</h2>
    <p class="emer-sub">Este é um momento difícil.<br>Há pessoas que se importam com você e estão aqui.</p>
    <a href="tel:188" class="emer-btn emer-cvv">
      <div class="emer-icon">📞</div>
      <div style="text-align:left"><div style="font-weight:700">CVV — 188</div><div style="font-size:.8rem;opacity:.7">Gratuito, 24h, sigiloso</div></div>
    </a>
    <a href="tel:192" class="emer-btn emer-samu">
      <div class="emer-icon">🚑</div>
      <div style="text-align:left"><div style="font-weight:700">SAMU — 192</div><div style="font-size:.8rem;opacity:.7">Emergência médica</div></div>
    </a>
    <button class="emer-btn emer-plan" onclick="state.tab='safeplan';go('patient')">
      <div class="emer-icon">🛡️</div>
      <div style="text-align:left"><div style="font-weight:700">Meu Plano de Segurança</div><div style="font-size:.8rem;opacity:.7">Ver o que me acalma</div></div>
    </button>
    <button class="emer-back" onclick="go(state.view==='emergency'?'patient':'patient')">← Voltar ao app</button>
  </div>`;
}
