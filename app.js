
/* Vragen herschreven naar duidelijke examenstijl: geen vage verwijzingen zoals "dit" of "deze regel". */
let QUESTIONS=[];

/* Basisvariabelen en helpers - nodig omdat de vragen nu extern in questions.json staan. */
let current=[];
let index=0;
let selected=null;
let mode='Oefenmodus';
let accessValid=false;
let questionTimer=null;
let questionStartedAt=0;
let locked=false;
const FREE_LIMIT=10;
const QUESTION_TIME=20;

let progress={};
let streak=0;
try{
  progress=JSON.parse(localStorage.getItem('rijbewijs_progress')||'{}') || {};
}catch(e){ progress={}; }
try{
  streak=parseInt(localStorage.getItem('rijbewijs_streak')||'0',10) || 0;
}catch(e){ streak=0; }

function save(){
  try{
    localStorage.setItem('rijbewijs_progress', JSON.stringify(progress));
    localStorage.setItem('rijbewijs_streak', String(streak));
  }catch(e){}
  updateStats();
}

function hasTestAccess(){
  const params=new URLSearchParams(location.search);
  const test=params.get('testtoegang');
  return test==='maxinelouis2026' || test==='true' || localStorage.getItem('rijbewijs_test_access')==='true';
}

function checkMaintenanceMode(){
  const params=new URLSearchParams(location.search);
  const screen=document.getElementById('maintenanceScreen');
  const forced=params.get('maintenance')==='1';
  if(screen) screen.style.display = forced ? 'flex' : 'none';
  return forced;
}


function cats(){return [...new Set(QUESTIONS.map(q=>q.category))].sort();}
function init(){document.getElementById('totalCount').textContent=QUESTIONS.length; const sel=document.getElementById('category'); cats().forEach(c=>{let o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)}); document.getElementById('chips').innerHTML=cats().map(c=>`<span class="chip">${c}</span>`).join(''); updateStats();}
function startPractice(){mode='Oefenmodus'; current=[...QUESTIONS]; index=0; openApp(); render();}
function startExam(){mode='Examenmodus'; current=[...QUESTIONS].sort(()=>Math.random()-.5).slice(0,50); index=0; openApp(); render();}
function showAll(){mode='Alle vragen'; current=[...QUESTIONS]; index=0; openApp(); render();}
function openApp(){document.getElementById('app').style.display='block';document.getElementById('app').scrollIntoView({behavior:'smooth'});}
function filterQuestions(){let c=document.getElementById('category').value, s=document.getElementById('search').value.toLowerCase(); current=QUESTIONS.filter(q=>(c==='all'||q.category===c)&&(`${q.question} ${q.topic||''} ${q.category} ${q.explanation}`.toLowerCase().includes(s))); index=0; render();}
function shuffleCurrent(){current=current.sort(()=>Math.random()-.5); index=0; render();}

function clearQuestionTimer(){
  if(questionTimer){clearInterval(questionTimer); questionTimer=null;}
}
function startQuestionTimer(){
  clearQuestionTimer();
  questionStartedAt=Date.now();
  const fill=document.getElementById('timerFill');
  const txt=document.getElementById('timerText');
  if(fill) fill.style.width='100%';
  if(txt) txt.textContent=QUESTION_TIME+' s';
  questionTimer=setInterval(()=>{
    if(locked){clearQuestionTimer(); return;}
    const elapsed=(Date.now()-questionStartedAt)/1000;
    const left=Math.max(0, QUESTION_TIME-elapsed);
    if(fill) fill.style.width=(left/QUESTION_TIME*100)+'%';
    if(txt) txt.textContent=Math.ceil(left)+' s';
    if(left<=0){
      clearQuestionTimer();
      showTimeoutAnswer();
    }
  },150);
}
function explanationHtml(s){
  return '<span class="lines">'+escapeHtml(s).replace(/\n/g,'<br>')+'</span>';
}

function showTimeoutAnswer(){
  if(locked)return;
  locked=true;
  progress[selected.id]={ok:false,repeat:false,timedOut:true};
  streak=0;
  save();
  [...document.querySelectorAll('.option')].forEach((b,idx)=>{
    b.disabled=true;
    if(idx===selected.answer)b.classList.add('correct');
  });
  const fb=document.getElementById('feedback');
  fb.style.display='block';
  fb.innerHTML='<b>Tijd voorbij.</b><br>Het juiste antwoord is aangeduid. Je kan deze vraag nu niet meer beantwoorden.<br><br>'+explanationHtml(selected.explanation);
  document.getElementById('nextBtn').style.display='inline-block';
}

function render(){if(!current.length){document.getElementById('question').textContent='Geen vragen gevonden.';return} clearQuestionTimer(); locked=false; selected=current[index]; document.getElementById('meta').textContent=`Vraag ${index+1} van ${current.length} • ${selected.category}`; document.getElementById('mode').textContent=mode; document.getElementById('bar').style.width=((index+1)/current.length*100)+'%'; const vis=document.getElementById('visual'); const hasSupport=!selected.image && signImagesForQuestion(selected).length>0; vis.className='visual'+(selected.image?' photo':'')+(hasSupport?' sign-support':''); vis.innerHTML=visualSVG(selected); document.getElementById('question').textContent=selected.question; document.getElementById('options').innerHTML=selected.options.map((o,i)=>`<button class="option" onclick="answer(${i})"><span class="letter">${String.fromCharCode(65+i)}</span>${escapeHtml(o)}</button>`).join(''); document.getElementById('feedback').style.display='none'; document.getElementById('nextBtn').style.display='none'; renderList(); startQuestionTimer();}
function answer(i){
  if(locked)return;
  if(!mayAnswer()){showPaywall(); return;}

  locked=true;
  clearQuestionTimer();
  let ok=i===selected.answer;
  progress[selected.id]={ok,repeat:false};
  streak=ok?streak+1:0;

  let usedNow=freeUsed();
  if(!accessValid && !hasTestAccess()){
    usedNow=Math.min(FREE_LIMIT, usedNow+1);
    setFreeUsed(usedNow);
  }

  [...document.querySelectorAll('.option')].forEach((b,idx)=>{
    if(idx===selected.answer)b.classList.add('correct');
    if(idx===i&&!ok)b.classList.add('wrong');
  });
  let fb=document.getElementById('feedback');
  save();

  if(ok){
    fb.style.display='none';
    setTimeout(()=>nextQuestion(true), 350);
  } else {
    fb.style.display='block';
    fb.innerHTML='<b>Nog niet juist.</b><br>'+explanationHtml(selected.explanation);
    document.getElementById('nextBtn').style.display='inline-block';
  }

  // Na de 10de gratis vraag meteen het betalingsscherm tonen, behalve wanneer de foutuitleg nog gelezen wordt.
  if(!accessValid && !hasTestAccess() && usedNow>=FREE_LIMIT && ok){
    setTimeout(showPaywall, 900);
  }
}
function nextQuestion(auto=false){
  clearQuestionTimer();
  if(!mayAnswer() && !auto){showPaywall(); return;}
  if(index<current.length-1) index++; else index=0;
  render();
}
function markRepeat(){progress[selected.id]={...(progress[selected.id]||{}),repeat:true}; save(); alert('Vraag toegevoegd aan herhalen.');}
function resetProgress(){if(confirm('Alle voortgang wissen?')){progress={};streak=0;save();render();}}
function updateStats(){let vals=Object.values(progress), answered=vals.length, good=vals.filter(v=>v.ok).length; document.getElementById('answeredCount').textContent=answered; document.getElementById('scoreCount').textContent=answered?Math.round(good/answered*100)+'%':'0%'; document.getElementById('streakCount').textContent=streak;}
function renderList(){document.getElementById('questionList').innerHTML=current.slice(0,120).map((q,i)=>`<div class="row" onclick="index=${i};render()"><span>${q.id}. ${q.topic||q.category}</span><span>${progress[q.id]?.ok?'✓':progress[q.id]?'×':''}</span></div>`).join('');}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}

function freeUsed(){return parseInt(localStorage.getItem('rijbewijs_free_used')||'0',10)}
function setFreeUsed(n){localStorage.setItem('rijbewijs_free_used',String(n)); updateAccessUI();}
function mayAnswer(){return accessValid || hasTestAccess() || freeUsed()<FREE_LIMIT;}
function showPaywall(){document.getElementById('paywall').style.display='flex';}
function closePaywall(){document.getElementById('paywall').style.display='none';}
function updateAccessUI(){
  const fb=document.getElementById('freeBadge'), ab=document.getElementById('accessBadge');
  if(accessValid || hasTestAccess()){ab.style.display='inline-block'; fb.textContent='Onbeperkt oefenen actief';}
  else {ab.style.display='none'; fb.textContent=Math.max(0,FREE_LIMIT-freeUsed())+' gratis vragen over';}
}
async function verifyAccess(){
  const params=new URLSearchParams(location.search);
  const token=params.get('access') || localStorage.getItem('rijbewijs_access_token');
  if(!token){updateAccessUI(); return false;}
  try{
    const res=await fetch('/api/check-access?access='+encodeURIComponent(token));
    const text=await res.text();
    let data={};
    try{ data=text ? JSON.parse(text) : {}; }catch(parseError){ throw new Error('API gaf geen JSON terug. Controleer of Cloudflare Functions actief zijn.'); }
    if(data.valid){
      accessValid=true;
      localStorage.setItem('rijbewijs_access_token',token);
      if(data.expiresAt) localStorage.setItem('rijbewijs_access_until',data.expiresAt);
    } else { accessValid=false; }
  }catch(e){ accessValid=false; }
  updateAccessUI();
  return accessValid;
}
async function startPayment(){
  const btn=document.getElementById('payBtn'), status=document.getElementById('payStatus');
  const consent=document.getElementById('withdrawalConsent');
  if(!consent || !consent.checked){ status.textContent='Vink eerst aan dat je akkoord gaat met de voorwaarden en onmiddellijke digitale toegang.'; return; }
  btn.disabled=true; btn.textContent='Betaling voorbereiden...'; status.textContent='Even geduld. Je wordt doorgestuurd naar Mollie.';
  try{
    const res=await fetch('/api/create-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'rijbewijs-b-7-dagen', withdrawalConsent:true, termsAccepted:true})});
    const text=await res.text();
    let data={};
    try{ data=text ? JSON.parse(text) : {}; }catch(parseError){ throw new Error('De API gaf geen geldig JSON-antwoord. Meestal betekent dit dat de functions-map niet juist gedeployed is of dat de route /api/create-payment niet bestaat. HTTP-status: '+res.status); }
    if(!res.ok || !data.checkoutUrl) throw new Error(data.error||data.details?.detail||'Geen betaallink ontvangen. HTTP-status: '+res.status);
    location.href=data.checkoutUrl;
  }catch(e){
    status.textContent='Betaling kon niet gestart worden: '+e.message;
    btn.disabled=false; btn.textContent='Betalen en 7 dagen toegang activeren – €4,95';
  }
}


const SIGN_IMAGE_MAP={
  "A15":["/images/borden/a15-en-d10.jpg"],
  "D10":["/images/borden/d10.jpg","/images/borden/d10-versie2.jpg","/images/borden/d10-gedeeld-fiets-voetgangers.jpg"],
  "A21":["/images/borden/a21.jpg"],
  "A23":["/images/borden/a23.jpg"],
  "A41":["/images/borden/a41.jpg"],
  "B15":["/images/borden/b15.jpg","/images/borden/b15-en-f87.jpg"],
  "B19":["/images/borden/b19-en-f49.jpg"],
  "F49":["/images/borden/f49.jpg","/images/borden/b19-en-f49.jpg"],
  "F87":["/images/borden/b15-en-f87.jpg"],
  "C1":["/images/borden/c1-en-c11.jpg"],
  "C11":["/images/borden/c1-en-c11.jpg"],
  "C25":["/images/borden/c25.jpg"],
  "C3":["/images/borden/c3-en-f45b.jpg"],
  "F45B":["/images/borden/c3-en-f45b.jpg"],
  "F45":["/images/borden/f45.jpg","/images/borden/f45-versie2.jpg","/images/borden/f45-doodlopende-straat.jpg"],
  "F19":["/images/borden/f19.jpg","/images/borden/f19-uitgezonderd-fietsers-bromfietsers.jpg"],
  "F4A":["/images/borden/f4a.jpg","/images/borden/f4a-zone-30.jpg"],
  "F4B":["/images/borden/f4b-einde-zone-30.jpg"],
  "E9A":["/images/borden/e9a.jpg"]
};
function signImagesForQuestion(q){
  const combined = [
    q.article||'', q.topic||'', q.question||'', q.explanation||'',
    ...(Array.isArray(q.options)?q.options:[]),
    ...(Array.isArray(q.signs)?q.signs:[])
  ].join(' ').toUpperCase();
  const found=[];
  Object.keys(SIGN_IMAGE_MAP).forEach(code=>{
    const re=new RegExp('(^|[^A-Z0-9])'+code+'([^A-Z0-9]|$)');
    if(re.test(combined)){
      SIGN_IMAGE_MAP[code].forEach(src=>{ if(!found.includes(src)) found.push(src); });
    }
  });
  return found.slice(0,3);
}

function visualSVG(qOrType){
  const q = (qOrType && typeof qOrType === 'object') ? qOrType : { visual: String(qOrType || 'Algemene wegcode'), signs: [] };
  if(q.image){
    const alt = escapeHtml(q.imageAlt || 'Verkeerssituatie met foto');
    return `<img src="${escapeHtml(q.image)}" alt="${alt}" loading="lazy" onerror="this.outerHTML='<div class=&quot;image-error&quot;>Foto kon niet geladen worden. Controleer of de map /images aanwezig is in GitHub.</div>'">`;
  }
  const supportImages = signImagesForQuestion(q);
  if(supportImages.length){
    return `<div class="sign-support-grid">${supportImages.map((src,idx)=>`<img src="${escapeHtml(src)}" alt="Verkeersbord bij deze vraag" loading="lazy">`).join('')}<div class="sign-support-caption">Officiële bordfoto ter ondersteuning van deze vraag.</div></div>`;
  }
  const type = String(q.visual || q.category || q.topic || 'Algemene wegcode');
  const signs = Array.isArray(q.signs) ? q.signs.filter(Boolean).map(s => String(s).trim()) : [];
  const esc = escapeHtml;

  // We tonen geen verkeersbordcodes en maken geen eigen verkeersborden na.
  // Een vraag wordt zo geformuleerd dat er geen bordcode of afbeelding nodig is,
  // tenzij later een officieel gecontroleerde bordafbeelding wordt toegevoegd.
  if(signs.length){
    return `<svg viewBox="0 0 520 190" width="100%" height="100%" role="img" aria-label="Verkeerssituatie">
      <rect width="520" height="190" rx="0" fill="#17213f"/>
      <rect x="42" y="36" width="436" height="118" rx="22" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.22)"/>
      <text x="260" y="84" text-anchor="middle" fill="white" font-size="22" font-weight="900">Verkeerssituatie</text>
      <text x="260" y="122" text-anchor="middle" fill="#c6cee8" font-size="14">De vraag is zo gesteld dat geen bordcode nodig is.</text>
    </svg>`;
  }

  const label = esc(type);
  return `<svg viewBox="0 0 520 180" width="100%" height="100%" role="img" aria-label="${label}">
    <rect width="520" height="180" fill="#17213f"/>
    <rect x="44" y="42" width="432" height="96" rx="22" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.22)"/>
    <text x="260" y="86" text-anchor="middle" fill="white" font-size="24" font-weight="900">${label}</text>
    <text x="260" y="116" text-anchor="middle" fill="#c6cee8" font-size="14">Oefenvraag op basis van de Belgische wegcode</text>
  </svg>`;
}

async function loadQuestions(){
  try{
    const response = await fetch('questions.json?v=' + Date.now(), {cache: 'no-store'});
    if(!response.ok) throw new Error('questions.json kon niet geladen worden. HTTP-status: ' + response.status);
    const data = await response.json();
    if(!Array.isArray(data)) throw new Error('questions.json moet een JSON-array met vragen zijn.');
    QUESTIONS = data;
    document.getElementById('totalCount').textContent = QUESTIONS.length;
  }catch(err){
    console.error('Fout bij laden van questions.json:', err);
    document.getElementById('question').textContent = 'De vragen konden niet geladen worden. Controleer of questions.json geldig is.';
    return;
  }

  try{
    if(!checkMaintenanceMode()){ init(); verifyAccess(); }
  }catch(err){
    console.error('Fout bij opstarten van de quiz:', err);
    document.getElementById('question').textContent = 'De vragen zijn geladen, maar de quiz kon niet starten. Controleer of app.js volledig is geüpload.';
  }
}
loadQuestions();

