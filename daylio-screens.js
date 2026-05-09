// ── SCREEN BUILDERS ─────────────────────────────────────────────────────────

function buildLoginScreen() {
  return `<div id="screen-login" class="screen ${state.view==='login'?'active':''}">
    <div class="login-logo"><div class="icon">🧠</div><h1>Meu<span>Daylio</span> Pro</h1></div>
    <p class="login-sub">Apoio terapêutico inteligente com IA companion</p>
    <div class="login-cards">
      <div class="profile-card patient">
        <div class="avatar">🌿</div>
        <h3>${escapeHtml(state.patientName)}</h3>
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
      <input id="key-input" class="input-field" placeholder="AIza..." value="${escapeHtml(state.geminiKey)}" style="font-size:.8rem"/>
      <button onclick="saveKey()" style="margin-top:8px;background:var(--sage-dim);border:1px solid var(--sage);color:var(--sage);padding:6px 16px;border-radius:6px;font-size:.8rem">Salvar</button>
      <div class="divider"></div>
      <p style="font-size:.75rem;color:var(--text3);margin-bottom:8px">Convite terapêutico</p>
      <div style="display:flex;gap:8px;align-items:center">
        <code style="flex:1;background:var(--bg3);border-radius:6px;padding:8px 10px;font-size:.78rem;color:var(--text2)">${escapeHtml(state.inviteCode)}</code>
        <button class="btn btn-invite" style="padding:8px 12px;font-size:.78rem" onclick="copyInvite()">Copiar</button>
      </div>
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
        <span style="font-size:.8rem;color:var(--text2)">👤 ${escapeHtml(state.patientName)}</span>
        <button class="btn-switch" onclick="cycleTheme()">🎨 Tema</button>
        <button class="btn-switch" onclick="go('login')">← Trocar</button>
        <button class="btn btn-danger" style="padding:6px 12px;font-size:.75rem" onclick="requestEmergency()">🆘 SOS</button>
      </div>
    </header>
    <div class="app-main fade-in">
      ${buildStreak()}
      ${buildPatientInvite()}
      ${buildSessionAlert()}
      ${buildTherapistNoteForPatient()}
      ${buildPatientActivities()}
      ${buildInfoAlerts()}
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

function buildPatientInvite() {
  return `<div class="card mt-16">
    <div class="card-title">🔗 Meu convite</div>
    <div style="display:flex;gap:8px;align-items:center">
      <code style="flex:1;background:var(--bg3);border-radius:6px;padding:9px 10px;font-size:.8rem;color:var(--text2)">${escapeHtml(state.inviteCode)}</code>
      <button class="btn btn-invite" style="padding:8px 12px;font-size:.78rem" onclick="copyInvite()">Copiar</button>
    </div>
  </div>`;
}

function buildSessionAlert() {
  if(!state.sessionDate) return '';
  const today=new Date().toISOString().slice(0,10);
  const isToday=state.sessionDate===today;
  return `<div class="card mt-16">
    <div class="card-title">${isToday?'📅 Sessão hoje':'📅 Próxima sessão'}</div>
    <div class="info-alert" style="${isToday?'border-left-color:var(--terracota);background:var(--terra-dim)':''}">
      ${isToday?'Hoje é dia de sessão com a Dra. Aline. Leve suas observações e atividades concluídas.':`Sessão agendada para ${new Date(state.sessionDate+'T12:00:00').toLocaleDateString('pt-BR')}.`}
    </div>
  </div>`;
}

function buildTherapistNoteForPatient() {
  const note=state.therapistNotes.luis;
  if(!note) return '';
  return `<div class="card mt-16">
    <div class="card-title">📝 Observação da Dra. Aline</div>
    <div class="info-alert">${escapeHtml(note)}</div>
  </div>`;
}

function buildPatientActivities() {
  if(!state.activities.length) return '';
  const pct=activityEngagement();
  return `<div class="card mt-16">
    <div class="card-title">✅ Atividades combinadas</div>
    <div style="font-size:.78rem;color:var(--text2)">Concluídas: <strong style="color:var(--blue)">${pct}%</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="mt-12">
      ${state.activities.map(a=>`<div class="activity-row ${a.done?'done':''}">
        <input type="checkbox" ${a.done?'checked':''} onchange="toggleActivity('${a.id}')"/>
        <span class="activity-title">${escapeHtml(a.title)}</span>
        <span class="tag">${a.done?'finalizada':'pendente'}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

function buildInfoAlerts() {
  const risk=state.records.length ? (state.records[state.records.length-1].risk||0) : 0;
  const engagement=engagementPercent(state.records);
  const message=risk>=3
    ? 'Seu último registro pede atenção. Revise o plano de segurança e procure apoio se o desconforto aumentar.'
    : engagement<40
      ? 'Manter alguns check-ins por semana ajuda a Dra. Aline a perceber mudanças de padrão com mais clareza.'
      : 'Seu acompanhamento está ativo. Continue registrando humor, sono e energia com honestidade.';
  return `<div class="card mt-16">
    <div class="card-title">🔔 Alerta informativo</div>
    <div class="info-alert">${message}</div>
    <div style="margin-top:12px;font-size:.78rem;color:var(--text2)">Engajamento 14 dias: <strong style="color:var(--blue)">${engagement}%</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${engagement}%"></div></div>
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
      <textarea id="ci-text" class="input-field" rows="4" placeholder="Como foi seu dia? O que está sentindo agora?">${escapeHtml(state.text)}</textarea>
    `:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px">
        <button id="mic-btn" class="mic-btn" onclick="toggleMic()">🎙️</button>
        <p id="mic-status" style="font-size:.8rem;color:var(--text3)">Pressione para gravar</p>
        <div id="voice-preview" class="ai-bubble" style="width:100%;display:none"></div>
      </div>
    `}
    <div class="divider"></div>
    <div style="margin-bottom:16px">
      <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">Observação livre para a próxima sessão</p>
      <textarea id="patient-observation" class="note-box" placeholder="Algo que você quer lembrar de conversar com a Dra. Aline...">${escapeHtml(state.patientObservation)}</textarea>
      <button class="btn btn-ghost mt-12" style="padding:8px 14px;font-size:.78rem" onclick="savePatientObservation()">Salvar observação</button>
    </div>
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
    ${state.aiResponse&&!state.aiLoading?`<div class="ai-bubble fade-in"><span class="ai-label">🤖 Companion IA</span>${escapeHtml(state.aiResponse)}</div>`:''}
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
        <div class="tl-text">${escapeHtml(r.text||'(sem texto)')}</div>
        ${r.aiAnalysis?`<div style="margin-top:8px">${(r.aiAnalysis.themes||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`:''}
      </div>
      <span class="badge badge-${r.risk||0}">${['Ótimo','Leve','Atenção','Alto','Crise'][r.risk||0]}</span>
    </div>`).join('')}
  </div>`;
}

function buildStats() {
  if(state.records.length<2) return `<div class="card"><div class="empty"><span class="empty-icon">📊</span>Registre pelo menos 2 dias para ver estatísticas.</div></div>`;
  const avg=(arr,key,fallback=5)=>arr.length?Math.round(arr.reduce((s,r)=>s+(r[key]??fallback),0)/arr.length):0;
  const last7=state.records.slice(-7);
  const moodAvg=avg(last7,'mood',2);
  const energyAvg=avg(last7,'energy');
  const sleepAvg=avg(last7,'sleep');
  const engagement=engagementPercent(state.records);
  const moodColors=['#e05252','#e07c3a','#e8b84b','#7eb89a','#4caf7d'];
  const bars=last7.map(r=>{
    const mood=r.mood??2;
    const h=Math.max(8,(mood/4)*100);
    return `<div class="chart-bar" style="background:${moodColors[mood]};height:${h}%" title="${new Date(r.date).toLocaleDateString('pt-BR')}"></div>`;
  }).join('');
  return `<div>
    <div class="grid-2">
      <div class="stat-mini"><span class="num" style="color:var(--sage)">${moodAvg+1}/5</span><span class="lbl">Humor médio (7d)</span></div>
      <div class="stat-mini"><span class="num" style="color:var(--lavender)">${energyAvg}/10</span><span class="lbl">Energia média (7d)</span></div>
      <div class="stat-mini"><span class="num" style="color:var(--terracota)">${sleepAvg}h</span><span class="lbl">Sono médio (7d)</span></div>
      <div class="stat-mini"><span class="num" style="color:var(--blue)">${engagement}%</span><span class="lbl">Engajamento (14d)</span></div>
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
    ${sp.signals.map(s=>`<div class="safe-plan-item" style="border-color:var(--terracota)">${escapeHtml(s)}</div>`).join('')}
    <div class="divider"></div>
    <p style="font-size:.78rem;font-weight:600;color:var(--sage);margin-bottom:8px">🌿 O que me acalma</p>
    ${sp.calm.map(s=>`<div class="safe-plan-item">${escapeHtml(s)}</div>`).join('')}
    <div class="divider"></div>
    <p style="font-size:.78rem;font-weight:600;color:var(--lavender);margin-bottom:8px">📞 Quem posso ligar</p>
    ${sp.contacts.map(s=>`<div class="safe-plan-item" style="border-color:var(--lavender)">${escapeHtml(s)}</div>`).join('')}
    <div class="divider"></div>
    <p style="font-size:.78rem;font-weight:600;color:var(--yellow);margin-bottom:8px">💛 Razões para continuar</p>
    ${sp.reasons.map(s=>`<div class="safe-plan-item" style="border-color:var(--yellow)">${escapeHtml(s)}</div>`).join('')}
    <div class="divider"></div>
    <button class="btn btn-sos" onclick="requestEmergency()">🆘 Preciso de ajuda agora</button>
  </div>`;
}

function makeDemoRecords(days, moodBase, riskBase, themes) {
  const now=new Date();
  return days.map((offset,i)=>{
    const d=new Date(now); d.setDate(d.getDate()-offset);
    return {
      id: Number(`${offset}${i}`),
      date: d.toISOString(),
      mood: Math.max(0,Math.min(4,moodBase + (i%3===0?-1:i%3===1?0:1))),
      energy: Math.max(1,Math.min(10,5 + moodBase - riskBase + (i%2))),
      sleep: Math.max(2,Math.min(12,7 - riskBase + (i%2))),
      text: themes[0] || 'Registro breve',
      risk: riskBase,
      aiAnalysis: { themes }
    };
  });
}

function getTherapistPatients() {
  const day=state.demoDay || new Date().toISOString().slice(0,10);
  const situations=[
    {text:'Sono irregular e queda de energia',risk:2,themes:['sono','energia','rotina'],mood:2},
    {text:'Conflito familiar com aumento de ansiedade',risk:2,themes:['família','ansiedade','limites'],mood:1},
    {text:'Isolamento social e baixa resposta a mensagens',risk:3,themes:['isolamento','rede de apoio','humor'],mood:1},
    {text:'Boa adesão a autocuidado e caminhada',risk:0,themes:['autocuidado','atividade física','social'],mood:4},
    {text:'Pressão no trabalho e exaustão',risk:2,themes:['trabalho','cansaço','sono'],mood:2},
    {text:'Semana estável com melhora de rotina',risk:1,themes:['rotina','sono','organização'],mood:3}
  ];
  const ana=seededPick(situations,day+'ana');
  const carlos=seededPick(situations,day+'carlos');
  const marina=seededPick(situations,day+'marina');
  const joao=seededPick(situations,day+'joao');
  return [
    {
      id:'luis',
      name:'Luís Braud',
      emoji:'🧑',
      records:state.records,
      lastRisk:state.records.length?state.records[state.records.length-1].risk||0:0,
      situation:state.records.length?'Paciente ativo no app':'Aguardando novos registros',
      invite:state.inviteCode
    },
    {
      id:'ana',
      name:'Ana S.',
      emoji:'👩',
      records:makeDemoRecords([0,1,2,4,6,8,10,12],ana.mood,ana.risk,ana.themes),
      lastRisk:ana.risk,
      situation:ana.text,
      invite:'MDP-ANA24'
    },
    {
      id:'carlos',
      name:'Carlos M.',
      emoji:'🧔',
      records:makeDemoRecords([0,2,3,5,7,9,11],carlos.mood,carlos.risk,carlos.themes),
      lastRisk:carlos.risk,
      situation:carlos.text,
      invite:'MDP-CAR77'
    },
    {
      id:'marina',
      name:'Marina P.',
      emoji:'👩‍💼',
      records:makeDemoRecords([1,2,5,9],marina.mood,marina.risk,marina.themes),
      lastRisk:marina.risk,
      situation:marina.text,
      invite:'MDP-MAR19'
    },
    {
      id:'joao',
      name:'João R.',
      emoji:'👨',
      records:makeDemoRecords([0,1,3,4,6,7,8,10,11,12,13],joao.mood,joao.risk,joao.themes),
      lastRisk:joao.risk,
      situation:joao.text,
      invite:'MDP-JOA52'
    }
  ].map(p=>({...p, engagement:engagementPercent(p.records)}));
}

function buildTherapistSessionManager() {
  const today=new Date().toISOString().slice(0,10);
  return `<div class="card mt-16">
    <div class="card-title">📅 Sessão do paciente</div>
    <div class="grid-2">
      <div>
        <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">Data da próxima sessão</p>
        <input id="session-date" class="input-field" type="date" value="${escapeHtml(state.sessionDate)}"/>
      </div>
      <div class="stat-mini">
        <span class="num" style="color:${state.sessionDate===today?'var(--terracota)':'var(--blue)'}">${state.sessionDate===today?'Hoje':state.sessionDate?'Agendada':'-'}</span>
        <span class="lbl">Alerta no paciente</span>
      </div>
    </div>
    <button class="btn btn-ghost mt-12" style="padding:8px 14px;font-size:.78rem" onclick="saveSessionDate()">Salvar sessão</button>
  </div>`;
}

function buildTherapistActivityManager() {
  const pct=activityEngagement();
  return `<div class="card mt-16">
    <div class="card-title">✅ Atividades prescritas</div>
    <div class="grid-2">
      <div>
        <input id="new-activity-title" class="input-field" placeholder="Ex.: caminhada de 10 min, respiração 4-7-8"/>
        <button class="btn btn-primary mt-12" style="padding:8px 14px;font-size:.78rem" onclick="addActivity()">Adicionar atividade</button>
      </div>
      <div class="stat-mini">
        <span class="num" style="color:var(--blue)">${pct}%</span>
        <span class="lbl">Finalizadas pelo paciente</span>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    <div class="mt-12">
      ${state.activities.length?state.activities.map(a=>`<div class="activity-row ${a.done?'done':''}">
        <input type="checkbox" ${a.done?'checked':''} onchange="toggleActivity('${a.id}')"/>
        <span class="activity-title">${escapeHtml(a.title)}</span>
        <button class="btn btn-ghost" style="padding:6px 10px;font-size:.72rem" onclick="removeActivity('${a.id}')">Remover</button>
      </div>`).join(''):'<p style="font-size:.82rem;color:var(--text2)">Nenhuma atividade adicionada ainda.</p>'}
    </div>
  </div>`;
}

function buildTherapistScreen() {
  if(state.view!=='therapist') return `<div id="screen-therapist" class="screen"></div>`;
  const allPatients=getTherapistPatients();
  const sorted=[...allPatients].sort((a,b)=>b.lastRisk-a.lastRisk);
  const openRequests=state.emergencyRequests.filter(r=>r.status!=='resolvido');
  const highPatients=sorted.filter(p=>p.lastRisk>=3);
  const riskLabel=['Normal','Atenção Leve','Atenção','Risco Alto','CRISE'];
  return `<div id="screen-therapist" class="screen active" style="flex-direction:column">
    <header class="app-header">
      <div class="logo"><div class="dot" style="background:var(--lavender)"></div> Painel Clínico</div>
      <div class="header-right">
        <span style="font-size:.8rem;color:var(--text2)">👩‍⚕️ Dra. Aline Chen</span>
        <button class="btn-switch" onclick="cycleTheme()">🎨 Tema</button>
        <button class="btn-switch" onclick="go('login')">← Trocar</button>
      </div>
    </header>
    <div class="app-main fade-in">
      <div class="grid-2" style="margin-bottom:16px">
        <div class="stat-mini"><span class="num">${sorted.filter(p=>p.lastRisk>=3).length}</span><span class="lbl">⚠️ Em alerta</span></div>
        <div class="stat-mini"><span class="num">${sorted.length}</span><span class="lbl">👥 Pacientes</span></div>
        <div class="stat-mini"><span class="num" style="color:var(--blue)">${Math.round(sorted.reduce((s,p)=>s+p.engagement,0)/sorted.length)}%</span><span class="lbl">Engajamento médio</span></div>
        <div class="stat-mini"><span class="num" style="color:var(--terracota)">${sorted.filter(p=>p.engagement<50).length}</span><span class="lbl">Baixa atividade</span></div>
      </div>
      
      <div style="display:flex;gap:8px;margin-bottom:16px">
         <button class="btn btn-ghost" style="flex:1;font-size:.8rem" onclick="document.getElementById('import-file').click()">
           📥 Importar Paciente (.json)
         </button>
         <button class="btn btn-invite" style="flex:1;font-size:.8rem" onclick="copyInvite()">
           🔗 Copiar convite de Luís
         </button>
         <button class="btn btn-primary" style="flex:1;font-size:.8rem;justify-content:center" onclick="generateDailyInfo()">
           ✨ Gerar dia
         </button>
         <input type="file" id="import-file" style="display:none" accept=".json" onchange="importData(event)">
      </div>

      ${buildTherapistSessionManager()}
      ${buildTherapistActivityManager()}

      <div class="card mt-16" style="background:var(--blue-dim);border-color:rgba(111,168,220,0.28)">
        <div class="card-title" style="color:var(--blue)">🔔 Alerta informativo</div>
        <p style="font-size:.82rem;color:var(--text2);line-height:1.7">
          Priorize pacientes com risco alto ou engajamento abaixo de 50%. Observações salvas aqui ficam neste navegador e servem como apoio rápido antes da sessão.
        </p>
      </div>

      <div class="card mt-16" style="border-color:rgba(224,82,82,0.25)">
        <div class="card-title" style="color:var(--red)">🆘 Seção emergencial</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${openRequests.map(r=>`<div class="info-alert" style="border-left-color:var(--red);background:var(--red-dim)">
            <strong style="color:var(--text)">${escapeHtml(r.patient)}</strong> solicitou apoio · ${new Date(r.date).toLocaleString('pt-BR')}
            <button class="btn btn-ghost mt-12" style="padding:7px 12px;font-size:.75rem" onclick="resolveEmergency('${r.id}')">Marcar acolhido</button>
          </div>`).join('')}
          ${highPatients.map(p=>`<div class="info-alert" style="border-left-color:var(--red);background:var(--red-dim)">
            <strong style="color:var(--text)">${escapeHtml(p.name)}</strong> · ${riskLabel[p.lastRisk]} · ${p.engagement}% de engajamento
          </div>`).join('')}
          ${!openRequests.length&&!highPatients.length?'<p style="font-size:.82rem;color:var(--text2)">Nenhum paciente em risco alto neste momento.</p>':''}
        </div>
      </div>

      <div class="card-title" style="margin-bottom:12px">📥 Inbox — priorizado por risco</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${sorted.map(p=>`
          <div class="patient-row ${p.lastRisk===4?'urgent':p.lastRisk===3?'high':''}">
            <div class="patient-avatar">${p.emoji}</div>
            <div>
              <div style="font-size:.9rem;font-weight:600">${escapeHtml(p.name)}</div>
              <div style="font-size:.78rem;color:var(--text2);margin-top:2px">${escapeHtml(p.situation)} · ${p.records.length} registros · convite ${escapeHtml(p.invite)}</div>
              <div style="margin-top:8px;font-size:.75rem;color:var(--text2)">Atividade: <strong style="color:var(--blue)">${p.engagement}%</strong></div>
              <div class="progress-track"><div class="progress-fill" style="width:${p.engagement}%"></div></div>
              ${p.records.length?`<div style="margin-top:6px">${(p.records[p.records.length-1].aiAnalysis?.themes||[]).slice(0,3).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`:''}
              <textarea id="note-${p.id}" class="note-box mt-12" placeholder="Observação da terapeuta para este paciente...">${escapeHtml(state.therapistNotes[p.id]||'')}</textarea>
              <button class="btn btn-ghost mt-12" style="padding:7px 12px;font-size:.75rem" onclick="saveTherapistNote('${p.id}')">Salvar observação</button>
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
  const avgMood=last7.reduce((s,r)=>s+(r.mood??2),0)/last7.length;
  const highRisk=last7.filter(r=>(r.risk||0)>=3).length;
  const themes=[...new Set(last7.flatMap(r=>r.aiAnalysis?.themes||[]))].slice(0,5);
  return `
    <div class="grid-2" style="margin-bottom:12px">
      <div class="stat-mini"><span class="num" style="color:var(--sage)">${(avgMood+1).toFixed(1)}/5</span><span class="lbl">Humor médio (7d)</span></div>
      <div class="stat-mini"><span class="num" style="color:${highRisk>0?'var(--orange)':'var(--green)'}">${highRisk}</span><span class="lbl">Alertas nível 3+</span></div>
    </div>
    <p style="font-size:.78rem;color:var(--text2);margin-bottom:6px">Temas recorrentes:</p>
    <div>${themes.length?themes.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(''):'<span style="font-size:.8rem;color:var(--text3)">Sem dados suficientes</span>'}</div>
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
