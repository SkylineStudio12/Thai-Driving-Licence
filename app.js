/* v2 app: router, chrome and screens. Data and rules live in core.js. */

const S = loadState(localStorage);
const persist = () => saveState(localStorage, S);
const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $ = (q, r = document) => r.querySelector(q);
const THAI_LETTERS = ['ก','ข','ค','ง'];
const ART_ROOT = '';      // where bank/signs/handbook live relative to this page
const initials = n => (n || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
/* avatar content: initials, or a person glyph when no name is set */
const avatarFace = () => initials(S.profile.name) ? esc(initials(S.profile.name))
  : ART.avatar ? `<img class="face-img" src="art/${ART.avatar}" alt="">` : lucide('user', 'face');
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = () => reduceMotion() ? 'auto' : 'smooth';
/* empty state: icon tile, title, one line of help and an optional action */
function emptyState(icon, title, text, action, fn){
  const e = el(`<div class="card empty"><span class="ei">${lucide(icon)}</span><b>${title}</b><p>${text}</p>
    ${action ? `<button class="btn sm">${action} ${lucide('chevron-right')}</button>` : ''}</div>`);
  if (action) e.querySelector('button').onclick = fn;
  return e;
}
const chev = () => lucide('chevron-right', 'chev');
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const daysUntil = d => d ? Math.ceil((new Date(d + 'T00:00') - new Date(dayKey(Date.now()) + 'T00:00')) / 864e5) : null;

/* artwork slot: the user's image when listed in art/art.js, otherwise a tinted Lucide tile */
const art = (slot, icon, cls = '') => ART[slot]
  ? `<span class="art ${cls}"><img src="art/${ART[slot]}" alt=""></span>`
  : `<span class="art icon ${cls}">${lucide(icon)}</span>`;

/* ================= navigation =================
   Each screen is a history entry {tab, sub, key, i, d}; d = depth, Back hides at 0. */
const TABS = [['overview','Overview','gauge'], ['theory','Theory','book-open'],
              ['practice','Practice','pencil-line'], ['progress','My Progress','chart-spline']];
let tab = 'overview';
let quiz = null;                       // the running or finished test, see startQuiz()
const nav = () => history.state || {tab, d:0};
const hashOf = s => '#' + [s.tab, s.sub, s.key, s.i].filter(x => x !== undefined && x !== null).join('/');
function go(k){
  closeSheet();
  if (k === tab && !nav().sub) { scrollTo({top:0, behavior:smooth()}); return; }
  const s = {tab:k, d:nav().d + 1};
  history.pushState(s, '', hashOf(s)); tab = k; render(); scrollTo(0, 0);
}
function open(sub, key, extra = {}){
  closeSheet();
  const s = {tab, sub, key, ...extra, d:nav().d + 1};
  history.pushState(s, '', hashOf(s)); render(); scrollTo(0, 0);
}
function back(){
  if (nav().d > 0) history.back();
  else { history.replaceState({tab, d:0}, '', '#' + tab); render(); scrollTo(0, 0); }
}
addEventListener('popstate', e => {
  closeSheet();
  const s = e.state || {tab:'overview', d:0};
  /* a running test is left only through its quit button */
  if (quiz && !quiz.done && s.sub !== 'quiz') { history.pushState({...s, sub:'quiz', d:s.d + 1}, '', '#quiz'); return; }
  tab = s.tab; render(); scrollTo(0, 0);
});

/* ================= chrome ================= */
const backBtn = $('#backBtn');
backBtn.innerHTML = lucide('chevron-left');
backBtn.onclick = back;
function chrome({title = '', sub = '', large = false, right = [], bare = false, tabs = true}){
  document.body.classList.toggle('bare', bare);
  document.body.classList.toggle('no-tabs', !tabs);
  $('#topbar').hidden = bare;
  $('#topbar').classList.toggle('large', large);
  $('#title').textContent = title;
  $('#topbar').classList.toggle('two-line', !!sub);
  if (sub) $('#title').appendChild(el(`<small>${esc(sub)}</small>`));
  document.title = `${title || 'Theory Trainer'} · Thai Moto Licence`;
  backBtn.hidden = large;
  const r = $('#tbRight'); r.innerHTML = '';
  right.forEach(b => r.appendChild(b));
  const t = $('#tabs'); t.innerHTML = '';
  TABS.forEach(([k, label, icon]) => {
    const b = el(`<button>${lucide(icon)}<span>${label}</span></button>`);
    if (k === tab) b.setAttribute('aria-current', 'page');
    b.onclick = () => go(k);
    t.appendChild(b);
  });
}
const avatarBtn = () => { const b = el(`<button class="avatar${initials(S.profile.name) ? '' : ' empty'}" aria-label="Profile and settings">${avatarFace()}</button>`); b.onclick = openProfile; return b; };
const circleBtn = (icon, label, fn) => { const b = el(`<button class="circle" aria-label="${label}">${lucide(icon)}</button>`); b.onclick = fn; return b; };

let tick = null;
function render(){
  clearInterval(tick);
  if (quiz && quiz.autoT) { clearTimeout(quiz.autoT); quiz.autoT = null; }   // never auto-advance a stale screen
  const v = $('#view'); v.innerHTML = '';
  if (!S.profile.onboarded) return viewOnboarding(v);
  const s = nav();
  if (s.sub === 'quiz' && quiz && !quiz.done) return viewQuiz(v);
  if (s.sub === 'result' && quiz && quiz.done) return viewResult(v);
  if (s.sub === 'review' && quiz && quiz.done) return viewReview(v);
  if (['quiz', 'result', 'review'].includes(s.sub)) { history.replaceState({tab, d:s.d}, '', '#' + tab); return render(); }
  if (s.sub === 'group' && TOPIC_GROUPS.some(g => g.key === s.key)) return viewGroup(v, s.key);
  if (s.sub === 'cat' && CATS[s.key]) return viewTestOptions(v, s.key);
  if (s.sub === 'book' && CATS[s.key]) return viewBook(v, s.key);
  if (s.sub === 'rules') return viewRules(v);
  if (s.sub === 'numbers') return viewNumbers(v);
  if (s.sub === 'process') return viewProcess(v);
  if (s.sub === 'phrases') return viewPhrases(v);
  if (s.sub === 'gallery') return viewGallery(v);
  if (s.sub === 'sgroup' && SIGN_GROUPS.some(g => g.key === s.key)) return viewSignGroupList(v, s.key);
  if (s.sub === 'fam' && FAM_TITLE[s.key]) return viewSignFamily(v, s.key);
  if (s.sub === 'list' && ['mistakes', 'bookmarks'].includes(s.key)) return viewList(v, s.key);
  ({overview:viewOverview, theory:viewTheory, practice:viewPractice, progress:viewProgress})[tab](v);
}

/* ================= dialogs and the profile sheet ================= */
const dlg = $('#dlg');
function dialog(html, wire){
  dlg.innerHTML = html;
  wire && wire(dlg);
  dlg.showModal();
}
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

function editGoal(){
  dialog(`<h2>Daily goal</h2><p>How many questions do you want to answer each day?</p>
    <div class="goal-grid">${GOALS.map(g => `<button class="choice" data-g="${g}" aria-pressed="${g === S.goal}"><b>${g}</b><small>questions a day</small></button>`).join('')}</div>`,
    d => d.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { S.goal = +b.dataset.g; persist(); d.close(); render(); refreshSheet(); }));
}
function editDetails(){
  dialog(`<h2>Personal details</h2><p>Stored on this device only.</p>
    <div class="field">${lucide('user')}<div class="grow"><label for="nm">Name</label><input id="nm" autocomplete="given-name" value="${esc(S.profile.name)}" placeholder="Your name"></div></div>
    <div class="field">${lucide('calendar')}<div class="grow"><label for="ed">Exam date</label><input id="ed" type="date" value="${esc(S.profile.examDate)}"></div></div>
    <button class="btn" id="ok" style="margin-top:8px">Save</button>`,
    d => d.querySelector('#ok').onclick = () => { S.profile.name = d.querySelector('#nm').value.trim(); S.profile.examDate = d.querySelector('#ed').value; persist(); d.close(); render(); refreshSheet(); });
}
/* van and truck have no question bank yet, so they are shown but cannot be picked */
const VEHICLES = [['moto', 'Motorcycle', 'motorbike', 'The motorcycle paper (car-only questions left out)'],
                  ['car', 'Car', 'car', 'Includes the car-only questions too'],
                  ['truck', 'Truck', 'truck', 'Coming soon: no questions for this licence yet', true],
                  ['van', 'Van / minibus', 'bus', 'Coming soon: no questions for this licence yet', true]];
const vehicleChoices = cur => VEHICLES.map(([k, t, ic, sub, soon]) =>
  `<button class="choice" data-v="${k}" aria-pressed="${cur === k}" ${soon ? 'disabled' : ''}>${lucide(ic)}<span>${t}<small>${sub}</small></span></button>`).join('');
function editVehicle(){
  dialog(`<h2>Vehicle type</h2><p>Decides which questions appear in tests and exams.</p>
    ${vehicleChoices(S.profile.vehicle)}`,
    d => d.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { S.profile.vehicle = b.dataset.v; persist(); d.close(); render(); refreshSheet(); }));
}

const sheetWrap = $('#sheetWrap');
function openProfile(){ refreshSheet(); sheetWrap.hidden = false; requestAnimationFrame(() => sheetWrap.classList.add('open')); }
function closeSheet(){ if (sheetWrap.hidden) return; sheetWrap.classList.remove('open'); setTimeout(() => { sheetWrap.hidden = true; }, 250); }
$('#scrim').onclick = closeSheet;
addEventListener('keydown', e => { if (e.key === 'Escape' && !sheetWrap.hidden) closeSheet(); });
function refreshSheet(){
  const sh = $('#sheet'), left = daysUntil(S.profile.examDate);
  const row = (icon, label, end, fn, cls = '') => { const b = el(`<button class="item ${cls}"><span class="ico">${lucide(icon)}</span>
      <span class="txt"><b>${label}</b></span><span class="end">${end ? `<span class="val">${end}</span>` : ''}${chev()}</span></button>`); b.onclick = fn; return b; };
  const link = (icon, label, href) => el(`<a class="item" href="${href}"><span class="ico">${lucide(icon)}</span>
      <span class="txt"><b>${label}</b></span><span class="end">${lucide('external-link', 'chev')}</span></a>`);
  sh.innerHTML = `<button class="circle close" aria-label="Close">${lucide('x')}</button>
    <div class="profile-head"><span class="big-avatar${initials(S.profile.name) ? '' : ' empty'}" aria-hidden="true">${avatarFace()}</span>
      <h2>${esc(S.profile.name || 'Rider')}</h2>
      <span>${left === null ? 'No exam date set' : left > 0 ? `Exam in ${left} day${left > 1 ? 's' : ''}` : left === 0 ? 'Exam today' : 'Exam date passed'}</span></div>
    <div class="label">Personalize</div><div class="list boxed" id="g1"></div>
    <div class="label">Need help?</div><div class="list boxed" id="g2"></div>
    <div class="label">Data</div><div class="list boxed" id="g3"></div>`;
  sh.querySelector('.close').onclick = closeSheet;
  const g1 = sh.querySelector('#g1');
  g1.append(row('user', 'Personal details', '', editDetails),
            row(S.profile.vehicle === 'car' ? 'car' : 'motorbike', 'Vehicle type', S.profile.vehicle === 'car' ? 'Car' : 'Motorcycle', editVehicle),
            row('target', 'Daily goal', `${S.goal} a day`, editGoal));
  const th = el(`<label class="item"><span class="ico">${lucide('languages')}</span><span class="txt"><b>Show Thai text</b></span>
    <span class="switch"><input type="checkbox" ${S.showThai ? 'checked' : ''}><i></i></span></label>`);
  th.querySelector('input').onchange = e => { S.showThai = e.target.checked; persist(); render(); };
  g1.append(th);
  const an = el(`<label class="item"><span class="ico">${lucide('zap')}</span><span class="txt"><b>Auto-next</b><span>Move on after a right answer</span></span>
    <span class="switch"><input type="checkbox" ${S.autoNext ? 'checked' : ''}><i></i></span></label>`);
  an.querySelector('input').onchange = e => { S.autoNext = e.target.checked; persist(); };
  g1.append(an);
  sh.querySelector('#g2').append(row('sparkles', 'Tips: sign shapes and colours', '', () => { tab = 'theory'; open('rules'); }),
    row('list-checks', 'The licence process', '', () => open('process')),
    row('languages', 'Thai phrases for the office', '', () => open('phrases')),
    row('hash', 'Key numbers', '', () => open('numbers')));
  sh.querySelector('#g3').append(row('rotate-ccw', 'Reset all progress', '', () => {
    if (!confirm('Delete your answers, streak, bookmarks and test history on this device?')) return;
    const p = S.profile; Object.assign(S, freshState(), {profile:p}); persist(); closeSheet(); render();
  }, 'bad'));
  sh.querySelector('#g3').prepend(
    row('download', 'Export progress', '', exportProgress),
    row('upload', 'Import progress', '', importProgress));
}
function exportProgress(){
  const blob = new Blob([exportState(S)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `thai-moto-progress-${dayKey(Date.now())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function importProgress(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    f.text().then(t => {
      let st; try { st = parseImport(t); } catch (e) { alert(e.message); return; }
      const n = Object.keys(st.q).length, a = st.attempts.length;
      if (!confirm(`Replace the progress on this device with this file?\n${st.profile.name || 'Rider'} · ${n} questions answered · ${a} tests`)) return;
      Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); persist();
      closeSheet(); history.replaceState({tab:'overview', d:0}, '', '#overview'); tab = 'overview'; render(); scrollTo(0, 0);
    });
  };
  inp.click();
}

/* ================= onboarding ================= */
let onbStep = 0;
function viewOnboarding(v){
  chrome({bare:true, tabs:false});
  const steps = `<div class="steps">${[0,1,2].map(k => `<i class="${k <= onbStep ? 'on' : ''}"></i>`).join('')}</div>`;
  const veh = S.profile.vehicle;
  const body = [
    () => `<div class="pic">${art('onboarding', 'user', '')}</div>
      <h2>And who are you?</h2><p class="lead">Tell us about yourself to plan your study around your exam date.</p>
      <div class="field">${lucide('user')}<div class="grow"><label for="nm">Name</label><input id="nm" autocomplete="given-name" value="${esc(S.profile.name)}" placeholder="Your name"></div></div>
      <div class="field">${lucide('calendar')}<div class="grow"><label for="ed">Exam date (optional)</label><input id="ed" type="date" value="${esc(S.profile.examDate)}"></div></div>`,
    () => `<div class="pic">${ART[veh] ? `<img src="art/${ART[veh]}" alt="">` : art(veh, veh === 'car' ? 'car' : 'motorbike')}</div>
      <h2>Vehicle category</h2><p class="lead">Each test is built for the licence you are sitting.</p>
      ${vehicleChoices(veh)}`,
    () => `<div class="pic">${art('goal', 'flame')}</div>
      <h2>Daily goal</h2><p class="lead">A little every day beats cramming. You can change this later.</p>
      <div class="goal-grid">${GOALS.map(g => `<button class="choice" data-g="${g}" aria-pressed="${g === S.goal}"><b>${g}</b><small>questions a day</small></button>`).join('')}</div>`
  ][onbStep]();
  const page = el(`<div class="onb">
    <div class="bar"><button class="circle" id="ob" aria-label="Back" ${onbStep ? '' : 'style="visibility:hidden"'}>${lucide('chevron-left')}</button>${steps}<button class="textbtn" id="skip">Skip</button></div>
    <div class="grow">${body}</div>
    <div class="cta"><button class="btn" id="next">${onbStep < 2 ? 'Continue' : 'Start learning'}</button></div></div>`);
  v.appendChild(page);
  const keep = () => { const n = $('#nm', page), d = $('#ed', page); if (n) S.profile.name = n.value.trim(); if (d) S.profile.examDate = d.value; };
  page.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { S.profile.vehicle = b.dataset.v; render(); });
  page.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { S.goal = +b.dataset.g; render(); });
  $('#ob', page).onclick = () => { keep(); onbStep--; render(); };
  const finish = () => { S.profile.onboarded = true; persist(); history.replaceState({tab:'overview', d:0}, '', '#overview'); tab = 'overview'; render(); scrollTo(0, 0); };
  $('#skip', page).onclick = () => { keep(); finish(); };
  $('#next', page).onclick = () => { keep(); if (onbStep < 2) { onbStep++; render(); } else finish(); };
}

/* ================= Overview ================= */
const exploreItems = () => {
  const m = mistakes(S).length, b = S.bookmarks.length;
  return [
    {icon:'dices', title:'Quiz', sub:'10 random questions, a quick check', run: () => startQuiz({kind:'random', n:10})},
    {icon:'pencil', title:'Mistakes', sub: m ? `${m} question${m > 1 ? 's' : ''} to review` : 'Questions you got wrong land here', run: () => open('list', 'mistakes')},
    {icon:'bookmark', title:'Bookmarks', sub: b ? `${b} saved question${b > 1 ? 's' : ''}` : 'Save questions while you practise', run: () => open('list', 'bookmarks')},
    {icon:'medal', title:'Marathon', sub:`Every question, ${pool(S).length} in all`, run: () => startQuiz({kind:'marathon'})}
  ];
};
function listGroup(items){
  const g = el('<div class="list"></div>');
  items.forEach(it => { const b = el(`<button class="item"><span class="ico">${lucide(it.icon)}</span>
    <span class="txt"><b>${it.title}</b><span>${it.sub}</span></span>${chev()}</button>`); b.onclick = it.run; g.appendChild(b); });
  return g;
}
function viewOverview(v){
  const name = S.profile.name.split(' ')[0];
  chrome({title: name ? `Hey, ${name}` : 'Hey there', large:true, right:[avatarBtn()]});
  const left = daysUntil(S.profile.examDate);
  if (left !== null && left >= 0) v.appendChild(el(`<div class="exam-chip">${lucide('calendar')} ${left ? `Exam in ${left} day${left > 1 ? 's' : ''}` : 'Exam today, good luck'}</div>`));
  const st = streak(S, Date.now()), wk = weekStrip(S, Date.now()), today = S.days[dayKey(Date.now())] || 0;
  const sc = el(`<div class="card streak"><div class="row between" style="align-items:flex-start">
      <div><b style="font-size:17px">${st ? `${st}-day streak` : 'Start your streak'}</b>
      <div class="muted small">${S.goal} questions daily · ${Math.min(today, S.goal)}/${S.goal} today</div></div>
      <button class="btn sm secondary chipbtn" id="eg">Edit goal ${lucide('chevron-right')}</button></div>
    <div class="days">${wk.map(d => `<div class="day ${d.met ? 'met' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}"><b>${d.date}</b><span>${d.dow}</span></div>`).join('')}</div></div>`);
  sc.querySelector('#eg').onclick = editGoal;
  v.appendChild(sc);

  const c = S.lastCat && CATS[S.lastCat] ? S.lastCat : Object.keys(CATS).find(k => !catStats(S, k).done) || 'trf';
  const cs = catStats(S, c);
  v.appendChild(el(`<div class="h2">${S.lastCat ? 'Continue learning' : 'Start learning'}</div>`));
  const cc = el(`<button class="card continue">${art(ART['cat-' + c] ? 'cat-' + c : 'continue', CAT_ICON[c])}<div class="grow"><h3>${CATS[c][0]}</h3>
    <p>${CAT_DESC[c]}</p><div class="row cmeta"><div class="progress" style="flex:1"><i style="width:${pct(cs.seen, cs.n)}%"></i></div>
    <b class="small">${pct(cs.seen, cs.n)}%</b></div></div>${chev()}</button>`);
  cc.onclick = () => { tab = 'theory'; open('cat', c); };
  v.appendChild(cc);
  v.appendChild(el('<div class="h2">More to explore</div>'));
  v.appendChild(listGroup(exploreItems()));
}

/* ================= Theory ================= */
function viewTheory(v){
  chrome({title:'Theory', large:true, right:[avatarBtn()]});
  const h = el(`<div class="card hero"><div class="grow"><h2>Sign shapes and colours</h2>
    <p>The logic that lets you answer signs you have never seen.</p>
    <button class="btn sm outline">Explore ${lucide('chevron-right')}</button></div>${art('theory-hero', 'layers')}</div>`);
  h.querySelector('button').onclick = () => open('rules');
  v.appendChild(h);
  const g = el('<div class="grid2"></div>');
  TOPIC_GROUPS.forEach(t => {
    const done = t.cats.filter(c => catStats(S, c).done).length;
    const seen = t.cats.reduce((a, c) => a + catStats(S, c).seen, 0), all = t.cats.reduce((a, c) => a + catStats(S, c).n, 0);
    const b = el(`<button class="card tile">${art('group-' + t.key, t.icon)}<h3><span>${t.title}</span></h3>
      <div class="meta"><span>Topics</span><b>${done}/${t.cats.length}</b></div>
      <div class="progress"><i style="width:${pct(seen, all)}%"></i></div></button>`);
    b.onclick = () => open('group', t.key);
    g.appendChild(b);
  });
  v.appendChild(g);
  v.appendChild(el('<div class="h2">Quick reference</div>'));
  v.appendChild(listGroup([
    {icon:'hash', title:'Key numbers', sub:'Distances, time limits, fines and the traps', run: () => open('numbers')},
    {icon:'signpost', title:'Sign gallery', sub:`All ${SIGNS.length} signs, by group and family`, run: () => open('gallery')},
    {icon:'list-checks', title:'The licence process', sub:'Documents, the four steps, the riding test', run: () => open('process')},
    {icon:'languages', title:'Thai phrases', sub:'What to say at the DLT counter', run: () => open('phrases')}]));
}
function viewGroup(v, key){
  const t = TOPIC_GROUPS.find(x => x.key === key);
  const st = t.cats.map(c => catStats(S, c));
  const n = st.reduce((a, x) => a + x.n, 0), seen = st.reduce((a, x) => a + x.seen, 0), sp = pct(seen, n);
  chrome({title:t.title, right:[el(ring(sp, `${sp}% of this group's questions seen`))]});
  v.appendChild(el(`<div class="stats">${[['Topics', t.cats.length], ['Questions', n], ['Seen', seen], ['Not seen', n - seen]]
    .map(([l, x]) => `<div class="stat"><span>${l}</span><b>${x}</b></div>`).join('')}</div>`));
  t.cats.forEach((c, k) => {
    const s = st[k];
    const b = el(`<button class="card topic">${art('cat-' + c, CAT_ICON[c])}<div class="grow"><h3>${CATS[c][0]}</h3>
      <p>${S.showThai ? CATS[c][1] : CAT_DESC[c]}</p>
      ${s.done ? `<span class="qcount done"><i class="dot ok">${lucide('check')}</i>Completed</span>`
               : `<span class="qcount"><i class="dot q">${lucide('circle-help')}</i>${s.seen}/${s.n} Questions</span>`}</div>${chev()}</button>`);
    b.onclick = () => open('cat', c);
    v.appendChild(b);
  });
}
let optMistakesOnly = false, optShuffle = true;
/* small progress ring for the top bar: share of the category's questions seen */
const ring = (p, label) => `<span class="ring" role="img" aria-label="${label}"><svg viewBox="0 0 44 44" aria-hidden="true">
  <circle cx="22" cy="22" r="19"/>${p ? `<circle class="on" cx="22" cy="22" r="19" pathLength="100" stroke-dasharray="${p} 100"/>` : ''}</svg><b>${p}%</b></span>`;
function viewTestOptions(v, c){
  const s = catStats(S, c), seen = pct(s.seen, s.n);
  chrome({title:'Practice', sub:'Test options', tabs:false, right:[el(ring(seen, `${seen}% of this topic's questions seen`))]});
  v.appendChild(el(`<div class="opt-head">${art('cat-' + c, CAT_ICON[c])}<h2>${CATS[c][0]}</h2>
    <button class="link" id="book">Theory book ${lucide('chevron-right')}</button></div>`));
  v.querySelector('#book').onclick = () => open('book', c);
  const sheet = el(`<section class="opt-sheet"><div class="label">Your answers</div><div class="triple">
    <div><span><i class="dot q">${lucide('circle-help')}</i>Questions</span><b>${s.n}</b></div>
    <div><span><i class="dot ok">${lucide('check')}</i>Correct</span><b>${s.right}</b></div>
    <div><span><i class="dot bad">${lucide('x')}</i>Incorrect</span><b>${s.wrong}</b></div></div>
    <div class="label">Additional settings</div>
    <div class="settings">
    <label class="setting">Show only mistaken questions<span class="switch"><input type="checkbox" role="switch" id="om" ${optMistakesOnly ? 'checked' : ''}><i></i></span></label>
    <label class="setting">Shuffle questions<span class="switch"><input type="checkbox" role="switch" id="sh" ${optShuffle ? 'checked' : ''}><i></i></span></label>
    <label class="setting">Show Thai text<span class="switch"><input type="checkbox" role="switch" id="th" ${S.showThai ? 'checked' : ''}><i></i></span></label></div></section>`);
  v.appendChild(sheet);
  const startBtn = el(`<div class="sticky-cta"><button class="btn">Start test</button></div>`);
  const upd = () => { const none = optMistakesOnly && !s.wrong; startBtn.firstChild.disabled = none; startBtn.firstChild.textContent = none ? 'No mistakes to practise' : 'Start test'; };
  sheet.querySelector('#om').onchange = e => { optMistakesOnly = e.target.checked; upd(); };
  sheet.querySelector('#sh').onchange = e => { optShuffle = e.target.checked; };
  sheet.querySelector('#th').onchange = e => { S.showThai = e.target.checked; persist(); };
  startBtn.firstChild.onclick = () => startQuiz({kind:'cat', cat:c, onlyMistakes:optMistakesOnly, shuffled:optShuffle});
  v.appendChild(startBtn); upd();
  S.lastCat = c; persist();
}
function viewNumbers(v){
  chrome({title:'Key numbers', tabs:true});
  v.appendChild(el(`<div class="card hero"><div class="grow"><h2>Learn the numbers</h2>
    <p style="margin:0">Most of what you can lose marks on is a number. Learn these and the traps below; the rest is common sense plus the sign shapes.</p></div>${art('numbers', 'hash')}</div>`));
  NUMBER_GROUPS.forEach(g => {
    v.appendChild(el(`<div class="h2">${g.title}</div>`));
    const box = el('<div class="card numbers"></div>');
    g.rows.forEach(([n, d]) => box.appendChild(el(`<div class="num-row"><b class="num">${esc(n)}</b><span>${esc(d)}</span></div>`)));
    v.appendChild(box);
  });
  v.appendChild(el('<div class="h2">The traps</div>'));
  TRAPS.forEach((t, k) => v.appendChild(el(`<div class="card trap ${t.hot ? 'hot' : ''}"><span class="trap-n">${k + 1}</span>
    <div><h3>${t.title}</h3><p>${t.text}</p></div></div>`)));
}
/* ---- pages moved from the classic app ---- */
const officialCard = () => `<div class="card prose"><h3>Official material</h3>
  <p><a href="${ART_ROOT}${RES.pdf}" download>Download the DLT English exam handbook (PDF)</a><br>
  <span class="muted small">The source behind the road markings, junction rules and parking distances here.</span></p>
  <p style="margin-bottom:0"><a href="${RES.video}" target="_blank" rel="noopener">Watch: the motorcycle driving test, by the DLT (YouTube)</a><br>
  <span class="muted small">Thai audio. Opens in a new tab and needs internet.</span></p></div>`;
function viewProcess(v){
  chrome({title:'The licence process'});
  v.innerHTML = `${officialCard()}
  <div class="card prose"><p><b>Bangkok offices.</b> Chatuchak (Area 1, ตลาดนัดจตุจักร / Phahonyothin) and Bang Khun Thian (Area 3)
    are the two that regularly deal with foreigners; Area 2 (Taling Chan) and Area 4 (Nong Khaem) also issue licences.
    Book a slot on <b>DLT Smart Queue</b>: the <i>DLT Smart Queue</i> app or <a href="https://gecc.dlt.go.th" target="_blank" rel="noopener">gecc.dlt.go.th</a>.
    Walk-ins are possible but you may be turned away by 09:00.</p></div>
  <div class="card prose note"><p><b>Phone the office before you go</b> and ask two things: (1) is the theory test terminal
    available in English today, and (2) which proof of address they will accept from you. Both vary by office and by who is on
    the desk. This one call is worth more than anything else on this page.</p></div>
  <div class="h2">What you need to bring</div>
  <div class="card prose">
    <p><b>Passport</b>: original plus a photocopy of the photo page and of your current visa / entry stamp. Sign every copy.</p>
    <p><b>Proof of address in Thailand</b>: any ONE of a <i>Certificate of Residence</i> from Immigration (Chaeng Watthana; small fee,
      sometimes same-day, sometimes a week), a residence letter from your embassy, a valid <i>work permit</i>, a <i>pink ID card</i>,
      or a <i>yellow house book</i> (ทะเบียนบ้านเหลือง). A work permit is the smoothest if you have one.</p>
    <p><b>Medical certificate</b> (ใบรับรองแพทย์): issued within the last <b>1 month</b>, on the 5-disease form. Any clinic,
      100–200 baht, 15 minutes. Do not get it weeks early.</p>
    <p><b>Two passport photos</b>: some offices photograph you on site, some still want prints. Bring them.</p>
    <p><b>Money</b>: cash. The motorcycle licence fee is about 105 baht, plus small charges for the test and the card.</p></div>
  <div class="h2">The four steps, in order</div>
  <div class="card prose steps">
    <p><span class="step-n">1</span><b>Physical / ability test</b> (ทดสอบสมรรถภาพร่างกาย): four short machine tests: colour recognition
      (red / amber / green), depth perception (line up two poles at a distance), peripheral vision, and brake reaction time.
      No Thai needed; the staff will mime it. If you wear glasses, wear them.</p>
    <p><span class="step-n">2</span><b>The 5-hour theory course</b> (อบรม 5 ชั่วโมง): mandatory for a first-time licence. Held at the
      office, usually one full morning-to-afternoon block, or online through the DLT e-learning system. <b>It is delivered in Thai.</b>
      You must be present for all five hours; they check. Bring something to read, and do not leave early: no certificate, no test.</p>
    <p><span class="step-n">3</span><b>The written theory test</b>: 50 questions on a touchscreen, 60 minutes, delivered as two blocks
      of 25. You need 45 right. English is normally selectable at the terminal in Bangkok. Fail and you can usually retry the next
      working day, and within 90 days without repeating the course.</p>
    <p><span class="step-n">4</span><b>The practical riding test</b>: five stations, in this order: balance along a narrow raised plank
      without putting a foot down, a Z bend, an S bend, obstacle avoidance, and riding a short circuit while obeying the signs,
      signals and indicators. Bring your own bike if you can, or use theirs. <b>The plank is what fails people.</b> Look up and far
      ahead, stay in a high enough gear to avoid stalling, feather the clutch, and do not look down at the plank.</p></div>
  <div class="h2">What you get</div>
  <div class="card prose"><p>A <b>2-year temporary licence</b> (ใบอนุญาตขับรถชั่วคราว). After that you convert it to the 5-year private
    licence, a much shorter appointment: no theory test, no practical, just a 1-hour refresher and the ability test. You can start
    that conversion up to 6 months before it expires.</p></div>
  <div class="card prose note"><p><b>One correction worth knowing.</b> If you hold a home-country licence <i>with a motorcycle
    category</i>, or an International Driving Permit covering motorcycles, the DLT can waive both the written and the practical
    test. A car-only licence buys you nothing here: a Thai motorcycle licence is a separate class and must be earned separately.</p></div>`;
}
function viewPhrases(v){
  chrome({title:'Thai phrases'});
  v.appendChild(el(`<div class="card prose"><p>The desk staff will get you through this even with no shared language, but these
    lines remove almost all of the friction. End every sentence with the polite particle: <b>ครับ (khrap)</b> if you are a man,
    <b>ค่ะ (kha)</b> if you are a woman. The phrases below use ผม (phom, "I", male); a woman says ดิฉัน (di-chan) or ฉัน (chan).</p></div>`));
  const box = el('<div class="card phrases"></div>');
  PHRASES.forEach(([t, r, e]) => box.appendChild(el(`<div class="phrase"><b lang="th">${esc(t)}</b><i>${esc(r)}</i><span>${esc(e)}</span></div>`)));
  v.appendChild(box);
}
/* sign gallery: groups -> families -> every sign (including the recognise-only ones) */
function viewGallery(v){
  chrome({title:'Sign gallery'});
  v.appendChild(el(`<p class="muted" style="margin:6px 2px 0">All ${SIGNS.length} signs as the real DLT artwork, grouped the way the exam confuses them on purpose.</p>`));
  const g = el('<div class="list boxed" style="margin-top:12px"></div>');
  SIGN_GROUPS.forEach(x => {
    const n = x.fams.reduce((a, f) => a + famSigns(f).length, 0);
    const img = x.img ? `signs/${x.img}.png` : famSigns(x.fams[0])[0].img;
    const b = el(`<button class="item"><span class="ico pic"><img src="${ART_ROOT}${img}" alt=""></span>
      <span class="txt"><b>${x.title}</b><span>${S.showThai ? x.th : x.desc}</span></span><span class="end">${n}${chev()}</span></button>`);
    b.onclick = () => x.fams.length === 1 ? open('fam', x.fams[0]) : open('sgroup', x.key);
    g.appendChild(b);
  });
  v.appendChild(g);
}
function viewSignGroupList(v, key){
  const x = SIGN_GROUPS.find(y => y.key === key);
  chrome({title:x.title});
  v.appendChild(el(`<p class="muted" style="margin:6px 2px 0">${S.showThai ? x.th + ' · ' : ''}${x.desc}</p>`));
  const g = el('<div class="list boxed" style="margin-top:12px"></div>');
  x.fams.forEach(f => { const fs = famSigns(f);
    const b = el(`<button class="item"><span class="ico pic"><img src="${ART_ROOT}${fs[0].img}" alt=""></span>
      <span class="txt"><b>${famName(f)}</b>${S.showThai ? `<span>${FAM_TITLE[f][1]}</span>` : ''}</span><span class="end">${fs.length}${chev()}</span></button>`);
    b.onclick = () => open('fam', f);
    g.appendChild(b); });
  v.appendChild(g);
}
function viewSignFamily(v, f){
  chrome({title:famName(f)});
  const fs = famSigns(f);
  v.appendChild(el(`<p class="muted" style="margin:6px 2px 0">${famGroup(f).title} · ${S.showThai ? FAM_TITLE[f][1] + ' · ' : ''}${fs.length} signs</p>`));
  fs.forEach(s => v.appendChild(el(`<div class="card sign-card"><img src="${ART_ROOT}${s.img}" alt="Thai road sign ${esc(s.code)}">
    <div><b>${esc(s.en)}</b> <span class="pill">${esc(s.code)}</span>${s.gallery ? ' <span class="pill">recognise only</span>' : ''}
      <div class="muted" lang="th" style="margin:2px 0 6px">${esc(s.th)}</div><p>${esc(s.w)}</p></div></div>`)));
}
function viewRules(v){
  chrome({title:'Sign shapes & colours'});
  v.appendChild(el(`<div class="card hero rules-hero"><div class="grow"><h2>All ${SIGNS.length} signs</h2>
    <p style="margin:0">As the real DLT artwork: <b>บ-</b> regulatory, <b>ต-</b> warning, <b>ตก-</b> roadworks pictograms, <b>ตค-</b> roadworks text, <b>น-</b> guide. Signs are the cheapest marks on the paper: they are pictures, so the language barrier does not apply.</p></div></div>`));
  v.appendChild(el('<div class="h2">Learn the logic first</div>'));
  SIGN_RULES.forEach(r => v.appendChild(el(`<div class="card rule"><div class="imgs ${r.imgs.length > 2 ? 'three' : ''}">${r.imgs.map(i => `<img src="${ART_ROOT}signs/${i}.png" alt="">`).join('')}</div>
    <div style="flex:1;min-width:0"><div class="top"><h3>${r.title}</h3><span class="pill">${r.badge}</span></div>
    <p>${S.showThai && r.th ? r.th + '. ' : ''}${r.text}</p></div></div>`)));
  const b = el(`<div class="rules-cta"><button class="btn">Practise road signs ${lucide('chevron-right')}</button></div>`);
  b.firstChild.onclick = () => open('cat', 'sign');
  v.appendChild(b);
}

/* Theory book: answers and reasons, one swipeable card at a time; viewing marks a question seen */
const signPic = q => q.img ? `<div class="media"><img class="sign" src="${ART_ROOT}${q.img}" alt="Thai road sign ${esc(q.code || '')}"></div>` : '';
function qCard(q, picked, opts = {}){
  const status = picked === undefined ? '' : picked === null ? ['skip', 'Not answered'] : picked === q.a ? ['ok', 'Correct'] : ['bad', 'Wrong'];
  const c = el(`<article class="card qcard-r">
    ${opts.n ? `<div class="qmeta"><span>Question ${opts.n}</span>${status ? `<span class="pill ${status[0]}">${status[1]}</span>` : ''}</div>` : ''}
    ${signPic(q)}
    <h3 class="qtext">${esc(q.en)}</h3>
    ${S.showThai ? `<p class="th">${esc(q.th)}</p>` : ''}
    <div class="o"></div>
    <div class="why"><b>Why:</b> ${esc(q.w)}</div>
    ${q.note ? `<p class="small" style="color:var(--warning);margin:8px 0 0"><b>Heads up:</b> ${esc(q.note)}</p>` : ''}
    ${q.src ? `<p class="small muted" style="margin:8px 0 0">Official source: ${esc(q.src)}</p>` : ''}</article>`);
  const box = c.querySelector('.o');
  q.o.forEach((o, k) => box.appendChild(el(`<div class="ans-opt ${k === q.a ? 'right' : k === picked ? 'wrong' : ''}">
    <span class="k">${THAI_LETTERS[k]}</span><span class="t">${esc(o[1])}${S.showThai ? `<small>${esc(o[0])}</small>` : ''}</span>
    ${k === q.a ? lucide('check', 'mk') : k === picked ? lucide('x', 'mk') : ''}</div>`)));
  return c;
}
let deck = null;
function viewBook(v, c){
  chrome({title:CATS[c][0], sub:'Theory book', tabs:false});
  const all = pool(S).filter(q => q.c === c), n = all.length;
  let i = Math.min(Math.max(0, (+nav().i || 1) - 1), n - 1);
  const wrap = el(`<div class="book"><div class="deck-nav"><div class="pos-wrap"><b class="pos" aria-live="polite"></b><span>Swipe or use the arrows</span></div>
      <span class="deck-btns"><button class="circle" id="dp" aria-label="Previous question">${lucide('chevron-left')}</button>
      <button class="circle" id="dn" aria-label="Next question">${lucide('chevron-right')}</button></span></div>
    <div class="progress thin deck-prog"><i></i></div>
    <div class="deck"><div class="deck-track" tabindex="0" aria-roledescription="carousel"></div></div></div>`);
  v.appendChild(wrap);
  const box = $('.deck', wrap), track = $('.deck-track', wrap);
  all.forEach((q, k) => { const sl = el(`<div class="slide" aria-label="${k+1} of ${n}"></div>`); sl.appendChild(qCard(q)); track.appendChild(sl); });
  const slides = [...track.children];
  const sync = () => {
    const h = slides[i].offsetHeight; if (h) box.style.height = h + 'px';
    $('.pos', wrap).textContent = `Question ${i+1} of ${n}`;
    $('.progress i', wrap).style.width = pct(i + 1, n) + '%';
    $('#dp', wrap).disabled = i === 0; $('#dn', wrap).disabled = i === n - 1;
    slides.forEach((s, k) => s.setAttribute('aria-hidden', k !== i));
    markSeen(S, all[i].id); persist();
    history.replaceState({...nav(), i:i + 1}, '', `#theory/book/${c}/${i + 1}`);
  };
  const goTo = (k, smooth) => { i = Math.min(Math.max(0, k), n - 1); track.scrollTo({left:i * track.clientWidth, behavior:smooth && !reduceMotion() ? 'smooth' : 'auto'}); sync(); };
  let raf = 0;
  track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
    const k = Math.round(track.scrollLeft / track.clientWidth); if (k !== i && k >= 0 && k < n) { i = k; sync(); } }); }, {passive:true});
  $('#dp', wrap).onclick = () => goTo(i - 1, true);
  $('#dn', wrap).onclick = () => goTo(i + 1, true);
  track.querySelectorAll('img').forEach(im => im.addEventListener('load', () => sync(), {once:true}));
  deck = {prev:() => goTo(i - 1, true), next:() => goTo(i + 1, true)};
  requestAnimationFrame(() => goTo(i, false));
}
addEventListener('keydown', e => {
  if (nav().sub !== 'book' || !deck || dlg.open) return;
  if (e.key === 'ArrowLeft') deck.prev(); else if (e.key === 'ArrowRight') deck.next();
});

/* ================= Practice ================= */
function viewPractice(v){
  chrome({title:'Practice', large:true, right:[avatarBtn()]});
  const p = pool(S), done = p.filter(q => S.q[q.id] && S.q[q.id].seen).length;
  const signs = p.filter(q => q.c === 'sign'), sdone = signs.filter(q => S.q[q.id] && S.q[q.id].seen).length;
  const g = el('<div class="grid2"></div>');
  [['practice-theory', 'book-open', 'Theory', 'Questions', done, p.length, () => startQuiz({kind:'random', n:20})],
   ['practice-signs', 'signpost', 'Road signs', 'Signs', sdone, signs.length, () => { tab = 'theory'; open('cat', 'sign'); }]]
    .forEach(([slot, icon, t, l, a, b, fn]) => { const x = el(`<button class="card tile">${art(slot, icon)}<h3><span>${t}</span></h3>
      <div class="meta"><span>${l}</span><b>${a}/${b}</b></div><div class="progress"><i style="width:${pct(a, b)}%"></i></div></button>`); x.onclick = fn; g.appendChild(x); });
  v.appendChild(g);
  const m = el(`<button class="card continue">${art('mock', 'trophy')}<div class="grow"><h3>Mock exam</h3>
    <p>${TOTAL} questions, ${MINUTES} minutes, ${PASS} to pass. Marked at the end, like the real test.</p></div>${chev()}</button>`);
  m.onclick = () => startQuiz({kind:'exam'});
  v.appendChild(m);
  v.appendChild(el('<div class="h2">More to explore</div>'));
  const items = exploreItems(); items[0] = {icon:'dices', title:'Random questions', sub:'20 mixed questions with instant feedback', run: () => startQuiz({kind:'random', n:20})};
  v.appendChild(listGroup(items));
}
function viewList(v, kind){
  const ids = kind === 'mistakes' ? mistakes(S) : S.bookmarks.filter(id => BY_ID[id]);
  const mk = kind === 'mistakes';
  chrome({title: mk ? 'Mistakes' : 'Bookmarks'});
  if (!ids.length) {
    v.appendChild(mk
      ? emptyState('circle-check', 'No mistakes yet', 'Every question you answer wrongly waits here until you get it right.', 'Take a quick quiz', () => startQuiz({kind:'random', n:10}))
      : emptyState('bookmark', 'No bookmarks yet', 'Tap the bookmark button on any question during a test to save it here.', 'Start practising', () => startQuiz({kind:'random', n:20})));
    return;
  }
  v.appendChild(el(`<p class="muted list-lead">${mk ? `${ids.length} question${ids.length > 1 ? 's' : ''} you answered wrongly last time. Get one right and it leaves this list.`
                                                   : `${ids.length} saved question${ids.length > 1 ? 's' : ''}.`}</p>`));
  const g = el('<div class="list boxed qlist"></div>');
  ids.forEach(id => { const q = BY_ID[id];
    g.appendChild(el(`<div class="item"><span class="ico ${q.img ? 'pic' : ''}">${q.img ? `<img src="${ART_ROOT}${q.img}" alt="">` : lucide(CAT_ICON[q.c])}</span>
      <span class="txt"><b>${esc(q.sign ? q.sign.en : q.en)}</b><span>${CATS[q.c][0]}</span></span></div>`)); });
  const b = el(`<button class="btn list-cta">Practise these ${ids.length} ${lucide('play', 'fill')}</button>`);
  b.onclick = () => startQuiz({kind, ids});
  v.append(b, g);
}

/* ================= quiz runner (practice tests and the mock exam) ================= */
function questionsFor(cfg){
  switch (cfg.kind) {
    case 'exam': return buildPaper(S);
    case 'cat': return catSet(S, cfg.cat, cfg);
    case 'random': return randomSet(S, cfg.n || 10);
    case 'marathon': return marathonSet(S);
    default: return idSet(cfg.ids || []);
  }
}
const quizTitle = cfg => ({exam:'Mock exam', cat: cfg.cat && CATS[cfg.cat][0], random:'Quiz', marathon:'Marathon',
                            mistakes:'Mistakes', bookmarks:'Bookmarks'})[cfg.kind];
function startQuiz(given, replace){
  const {qs: same, ...cfg} = given;          // Restart passes the same questions; the cfg itself never keeps them
  const qs = same ? freshen(same.slice()) : questionsFor(cfg);
  if (!qs.length) return;
  quiz = {cfg, mode: cfg.kind === 'exam' ? 'exam' : 'practice', title: quizTitle(cfg), qs, pick: new Array(qs.length).fill(null),
          i:0, start:Date.now(), deadline: cfg.kind === 'exam' ? Date.now() + MINUTES * 60000 : null, done:false};
  closeSheet();
  const s = {tab, sub:'quiz', d: nav().d + (replace ? 0 : 1)};
  if (replace) history.replaceState(s, '', '#quiz'); else history.pushState(s, '', '#quiz');
  render(); scrollTo(0, 0);
}
function quitQuiz(){
  if (quiz.mode === 'exam') {
    if (!confirm('Cancel this exam? Your answers will be lost.')) return;
    quiz = null; tab = 'progress';
    history.replaceState({tab:'progress', d:nav().d}, '', '#progress'); render(); scrollTo(0, 0); return;
  }
  const answered = quiz.pick.some(p => p !== null);
  if (answered && !confirm('Quit this test? The answers you gave are already saved.')) return;
  quiz.done = true; quiz.result = null; back();
}
function finishQuiz(){
  clearInterval(tick);
  const r = score(quiz.qs, quiz.pick);
  if (quiz.mode === 'exam') quiz.qs.forEach((q, k) => { if (quiz.pick[k] !== null) record(S, q.id, quiz.pick[k] === q.a); });
  const a = {when:new Date().toISOString(), mode:quiz.mode, kind:quiz.cfg.kind, cat:quiz.cfg.cat || null, score:r.score, of:r.of, byCat:r.byCat};
  S.attempts.push(a); persist();
  quiz.done = true; quiz.result = r; quiz.attempt = a;
  history.replaceState({...nav(), sub:'result'}, '', '#result');
  render(); scrollTo(0, 0);
}
function viewQuiz(v){
  chrome({bare:true, tabs:false});
  const z = quiz, q = z.qs[z.i], n = z.qs.length, picked = z.pick[z.i], locked = z.mode === 'practice' && picked !== null;
  const isLast = z.i === n - 1, bm = S.bookmarks.includes(q.id);
  const page = el(`<div class="quiz">
    <div class="qhead"><button class="circle" id="quit" aria-label="${z.mode === 'exam' ? 'Cancel exam' : 'Quit test'}">${lucide('power')}</button>
      <div class="mid"><b id="clock">--:--</b><span>${esc(z.title)} · ${n} questions${z.mode === 'practice' && S.autoNext ? ' <em class="auto-pill">Auto</em>' : ''}</span></div>
      <div class="tb-r"><button class="circle" id="menu" aria-label="More">${lucide('ellipsis')}</button></div></div>
    <div class="chips" id="chips" role="list" aria-label="Questions"></div>
    <section class="qsheet" aria-label="Question ${z.i + 1} of ${n}">
      ${signPic(q)}
      <h2 class="qtext">${esc(q.en)}</h2>${S.showThai ? `<p class="th">${esc(q.th)}</p>` : ''}
      <div id="opts"></div><div id="why" aria-live="polite"></div>
      <div class="qfoot"><div id="offer"></div><button class="circle flat" id="prev" aria-label="Previous question" ${z.i ? '' : 'disabled'}>${lucide('chevron-left')}</button>
        <button class="circle flat ${S.showThai ? 'on' : ''}" id="thai" aria-label="${S.showThai ? 'Hide' : 'Show'} Thai text" aria-pressed="${S.showThai}">${lucide('languages')}</button>
        <button class="circle flat ${bm ? 'on' : ''}" id="bm" aria-label="Bookmark" aria-pressed="${bm}">${lucide(bm ? 'bookmark-check' : 'bookmark')}</button>
        <button class="btn next" id="next">${isLast ? (z.mode === 'exam' ? 'Submit' : 'Finish') : 'Next'} ${lucide(isLast ? 'check' : 'play', isLast ? '' : 'fill')}</button></div>
    </section></div>`);
  v.appendChild(page);
  /* number strip */
  const chips = $('#chips', page);
  z.qs.forEach((x, k) => {
    const p = z.pick[k], cls = k === z.i ? 'cur' : p === null ? '' : z.mode === 'exam' ? 'ans' : p === x.a ? 'right' : 'wrong';
    const state = {cur:', current', ans:', answered', right:', correct', wrong:', wrong'}[cls] || '';
    const c = el(`<button class="chip ${cls}" role="listitem" aria-label="Question ${k + 1}${state}" ${k === z.i ? 'aria-current="step"' : ''}>${k + 1}</button>`);
    c.onclick = () => { z.flow = 0; z.i = k; render(); };
    chips.appendChild(c);
  });
  /* The strip is rebuilt on every render, so restore where it was scrolled to instantly, then
     glide only if the current chip is out of view (otherwise it animated from chip 1 each time). */
  chips.style.scrollBehavior = 'auto';
  chips.scrollLeft = z.chipScroll || 0;
  chips.addEventListener('scroll', () => { z.chipScroll = chips.scrollLeft; }, {passive:true});
  requestAnimationFrame(() => {
    const cur = chips.children[z.i]; if (!cur) return;
    const l = cur.offsetLeft, r = l + cur.offsetWidth, pad = 16;
    if (l - pad >= chips.scrollLeft && r + pad <= chips.scrollLeft + chips.clientWidth) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    chips.scrollTo({left: l - chips.clientWidth / 2 + cur.offsetWidth / 2, behavior: reduce || z.chipScroll === undefined ? 'auto' : 'smooth'});
  });
  /* options */
  const box = $('#opts', page);
  q.o.forEach((o, k) => {
    const cls = locked ? (k === q.a ? 'right' : k === picked ? 'wrong' : '') : '';
    const b = el(`<button class="ans-opt ${cls}" aria-pressed="${!locked && picked === k}" ${locked ? 'disabled' : ''}>
      <span class="k">${THAI_LETTERS[k]}</span><span class="t">${esc(o[1])}${S.showThai ? `<small>${esc(o[0])}</small>` : ''}</span>
      ${locked && k === q.a ? lucide('check', 'mk') : locked && k === picked ? lucide('x', 'mk') : ''}</button>`);
    b.onclick = () => {
      z.pick[z.i] = k;
      if (z.mode === 'practice') { record(S, q.id, k === q.a); persist(); z.justAnswered = z.i; }
      render();
      /* auto-next: a right answer shows green briefly, then moves on; a wrong one waits for Next */
      if (z.mode === 'practice' && S.autoNext) {
        if (k === q.a) {
          const at = z.i, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
          quiz.autoT = setTimeout(() => { quiz.autoT = null; if (quiz === z && !z.done && z.i === at) goNext(true); }, reduce ? 700 : 500);
        } else {
          const nx = $('#next'); if (nx) { nx.classList.remove('pulse'); void nx.offsetWidth; nx.classList.add('pulse'); }
        }
      }
    };
    box.appendChild(b);
  });
  if (locked) $('#why', page).appendChild(el(`<div class="why"><b>${picked === q.a ? 'Correct.' : 'Not quite.'}</b> ${esc(q.w)}</div>`));
  /* controls */
  $('#quit', page).onclick = quitQuiz;
  $('#menu', page).onclick = () => dialog(`<h2>${esc(z.title)}</h2><p>${z.pick.filter(x => x !== null).length} of ${n} answered.</p>
      ${z.mode === 'practice' ? `<label class="setting dlg-setting"><span>Auto-next after a right answer</span><span class="switch"><input type="checkbox" id="an" ${S.autoNext ? 'checked' : ''}><i></i></span></label>` : ''}
      <button class="btn secondary" id="fin" style="margin-bottom:10px">${z.mode === 'exam' ? 'Submit paper now' : 'Finish and see results'}</button>
      <button class="btn secondary" id="cx" style="color:var(--destructive)">${z.mode === 'exam' ? 'Cancel exam' : 'Quit test'}</button>`,
    d => { d.querySelector('#fin').onclick = () => { d.close(); finishQuiz(); }; d.querySelector('#cx').onclick = () => { d.close(); quitQuiz(); };
      const an = d.querySelector('#an'); if (an) an.onchange = e => { S.autoNext = e.target.checked; persist(); d.close(); render(); }; });
  $('#prev', page).onclick = () => { z.flow = 0; z.i--; render(); };
  $('#thai', page).onclick = () => { S.showThai = !S.showThai; persist(); render(); };
  $('#bm', page).onclick = () => { toggleBookmark(S, q.id); persist(); render(); };
  /* Next (also used by auto-next). Answer-then-Next taps in a row build z.flow; after enough of
     them a banner offers auto-next. */
  function goNext(auto){
    if (!auto && z.mode === 'practice') z.flow = z.justAnswered === z.i ? (z.flow || 0) + 1 : 0;
    if (z.i < n - 1) { z.i++; render(); scrollTo(0, 0); return; }
    const left = z.pick.filter(x => x === null).length;
    if (left && !confirm(`${left} question${left > 1 ? 's are' : ' is'} unanswered and will count as wrong. Finish anyway?`)) return;
    finishQuiz();
  }
  $('#next', page).onclick = () => goNext(false);
  if (z.mode === 'practice' && !S.autoNext && (z.flow || 0) >= (S.autoNextAsk || 5)) {
    const offer = el(`<div class="autonext-banner" role="status">${lucide('zap')}
      <span>Answering quickly? Move on automatically after a right answer.</span>
      <div class="row"><button class="btn sm" id="anOn">Turn on</button><button class="btn sm ghost" id="anNo">Not now</button></div></div>`);
    offer.querySelector('#anOn').onclick = () => { S.autoNext = true; persist(); render(); };
    offer.querySelector('#anNo').onclick = () => { S.autoNextAsk = (z.flow || 0) + 20; persist(); offer.remove(); };
    $('#offer', page).appendChild(offer);
  }
  /* clock: countdown for the exam, elapsed time for practice */
  const clock = $('#clock', page);
  const paint = () => {
    const ms = z.deadline ? z.deadline - Date.now() : Date.now() - z.start;
    if (z.deadline && ms <= 0) { finishQuiz(); return; }
    const s = Math.floor(ms / 1000);
    clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    clock.classList.toggle('low', !!z.deadline && s < 300);
  };
  paint(); tick = setInterval(paint, 1000);
}
function viewResult(v){
  const z = quiz, r = z.result, a = z.attempt, ok = passed(a), mark = z.mode === 'exam' ? 90 : PRACTICE_PASS * 100, p = pct(r.score, r.of);
  const restart = el(`<button class="textbtn">Restart</button>`);
  restart.onclick = () => startQuiz({...z.cfg, qs:z.qs}, true);
  chrome({title:'Results', right:[restart], tabs:false});
  v.appendChild(el(`<div class="result">${art(ok ? 'result-pass' : 'result-fail', ok ? 'trophy' : 'target')}
    <h2>${ok ? (z.mode === 'exam' ? 'Exam passed!' : 'Test passed!') : 'Not passed yet'}</h2>
    <p>${r.score} of ${r.of} correct. ${ok ? 'Nice work, keep the streak going.' : `You need ${Math.ceil(r.of * mark / 100)} to pass. Review the mistakes and try again.`}</p>
    <div class="scale"><div class="ends"><span>0</span><b>${p}%</b><span>100</span></div>
      <div class="track ${ok ? '' : 'fail'}" role="img" aria-label="Score ${p}%, pass mark ${mark}%"><i style="width:${Math.max(p, 3)}%"></i><span class="mark" style="left:calc(5px + (100% - 10px) * ${mark / 100})"></span></div>
      <div class="cap">${z.mode === 'exam' ? 'Exam' : 'Practice'} pass mark: ${mark}%</div></div></div>`));
  const two = el(`<div class="two pinned"><button class="btn secondary" id="rv">Review answers</button><button class="btn" id="nx">Next test</button></div>`);
  two.querySelector('#rv').onclick = () => open('review');
  two.querySelector('#nx').onclick = () => startQuiz(z.cfg, true);
  v.appendChild(two);
}
function viewReview(v){
  const z = quiz, wrong = z.qs.map((q, k) => [q, z.pick[k], k]).filter(([q, p]) => p !== q.a);
  chrome({title:'Review answers', sub:`${z.result.score} of ${z.result.of} correct`, tabs:false});
  v.appendChild(el(`<p class="muted review-lead">${wrong.length ? `${wrong.length} to learn from. Each one is also in Mistakes until you get it right.` : 'Every answer was right.'}</p>`));
  wrong.forEach(([q, p, k]) => v.appendChild(qCard(q, p, {n:k + 1})));
}

/* ================= My Progress ================= */
let progTab = 'theory', progFilter = 'all', progMonth = null;
/* Catmull-Rom curve through the points; control points are clamped to [lo, hi] so it never leaves the 0-100 band */
function smoothPath(pts, lo = -Infinity, hi = Infinity){
  if (pts.length < 2) return '';
  const c = v => Math.min(hi, Math.max(lo, v));
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[k - 1] || pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6},${c(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`;
  }
  return d;
}
/* W follows the card width so the axis text stays the same size on wide screens */
function chartSvg(points, passMark, W = 320){
  const H = 196, L = 34, R = 10, T = 10, B = 8, y = v => T + (100 - v) / 100 * (H - T - B);
  const xs = points.length > 1 ? points.map((_, k) => L + 6 + k * (W - L - R - 12) / (points.length - 1)) : [L + (W - L - R) / 2];
  const pts = points.map((p, k) => [xs[k], y(p)]);
  const line = smoothPath(pts, y(100), y(0));
  if (pts.length === 1) { const [cx, cy] = pts[0], v = points[0];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="One test this month: ${v}%, pass mark ${passMark}%">
      ${[0, 20, 40, 60, 80, 100].map(g => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 10}" y="${y(g) + 4}" text-anchor="end">${g}</text>`).join('')}
      <line class="pass" x1="${L}" x2="${W - R}" y1="${y(passMark)}" y2="${y(passMark)}"/><text class="pass-l" x="${W - R}" y="${y(passMark) - 5}" text-anchor="end">pass ${passMark}</text>
      <line class="line" x1="${cx - 36}" x2="${cx + 36}" y1="${cy}" y2="${cy}"/>
      <circle class="dot big" cx="${cx}" cy="${cy}" r="5"/>
      <text class="val" x="${cx}" y="${cy - 12}" text-anchor="middle">${v}%</text></svg>`; }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scores over time, pass mark ${passMark}%">
    <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="f0"/><stop offset="1" class="f1"/></linearGradient></defs>
    ${[0, 20, 40, 60, 80, 100].map(g => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 10}" y="${y(g) + 4}" text-anchor="end">${g}</text>`).join('')}
    <line class="pass" x1="${L}" x2="${W - R}" y1="${y(passMark)}" y2="${y(passMark)}"/><text class="pass-l" x="${W - R}" y="${y(passMark) - 5}" text-anchor="end">pass ${passMark}</text>
    ${line ? `<path class="area" fill="url(#chartFill)" d="${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z"/><path class="line" d="${line}"/>` : ''}
    ${pts.map(([a, b]) => `<circle class="dot" cx="${a}" cy="${b}" r="3.5"/>`).join('')}</svg>`;
}
function viewProgress(v){
  chrome({title:'My Progress', large:true, right:[avatarBtn()]});
  const seg = el(`<div class="seg">${[['theory', 'Theory'], ['practice', 'Practice'], ['exam', 'Exam']].map(([k, l]) =>
    `<button data-k="${k}" aria-pressed="${progTab === k}">${l}</button>`).join('')}</div>`);
  seg.querySelectorAll('button').forEach(b => b.onclick = () => { progTab = b.dataset.k; progFilter = 'all'; render(); });
  v.appendChild(seg);
  const opts = progTab === 'theory' ? [['all', 'All topics'], ...Object.keys(CATS).map(c => [c, CATS[c][0]])]
             : progTab === 'practice' ? [['all', 'All practice'], ['random', 'Quiz & random'], ['mistakes', 'Mistakes'], ['bookmarks', 'Bookmarks'], ['marathon', 'Marathon']]
             : [['all', 'All mock papers']];
  const att = S.attempts.filter(a => progTab === 'exam' ? a.mode === 'exam'
      : progTab === 'theory' ? a.mode === 'practice' && a.kind === 'cat' && (progFilter === 'all' || a.cat === progFilter)
      : a.mode === 'practice' && a.kind !== 'cat' && (progFilter === 'all' || a.kind === progFilter));
  const now = new Date(), cur = progMonth || new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = att.filter(a => { const d = new Date(a.when); return d.getFullYear() === cur.getFullYear() && d.getMonth() === cur.getMonth(); });
  /* short month; the year only when it is not the current one */
  const mName = d => d.toLocaleDateString('en-GB', d.getFullYear() === now.getFullYear() ? {month:'short'} : {month:'short', year:'numeric'});
  const mLong = d => d.toLocaleDateString('en-GB', {month:'long', year:'numeric'});
  const prevM = new Date(cur.getFullYear(), cur.getMonth() - 1, 1), nextM = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  const head = el(`<div class="row between" style="margin:18px 2px 8px"><b style="font-size:18px">${{theory:'Theory', practice:'Practice', exam:'Exam'}[progTab]} progress</b>
    <select class="sel" aria-label="Filter">${opts.map(([k, l]) => `<option value="${k}" ${k === progFilter ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`);
  head.querySelector('select').onchange = e => { progFilter = e.target.value; render(); };
  v.appendChild(head);
  const passMark = progTab === 'exam' ? 90 : PRACTICE_PASS * 100;
  const card = el(`<div class="card chart-card"><div class="chart-top"><span>Tests taken: <b>${inMonth.length}</b></span>
    ${inMonth.length ? `<span class="chip-stat">Passed: <b>${pct(inMonth.filter(passed).length, inMonth.length)}%</b></span>` : ''}</div>
    ${inMonth.length ? chartSvg(inMonth.map(a => pct(a.score, a.of)), passMark, Math.max(260, Math.min(608, v.clientWidth - 64)))
                     : `<div class="chart-empty"><span class="ei">${lucide('chart-spline')}</span>
                        <b>No ${progTab === 'exam' ? 'mock papers' : 'tests'} in ${mLong(cur).replace(' ' + now.getFullYear(), '')}</b>
                        <p>Take a test and your scores will chart here.</p>
                        <button class="btn sm" id="go">Start a test ${lucide('chevron-right')}</button></div>`}
    <div class="months"><button id="pm" aria-label="Previous month, ${mLong(prevM)}">${lucide('chevron-left')} ${mName(prevM)}</button><b aria-live="polite">${mName(cur)}</b>
      <button id="nm" aria-label="Next month, ${mLong(nextM)}" ${nextM > now ? 'disabled' : ''}>${mName(nextM)} ${lucide('chevron-right')}</button></div></div>`);
  card.querySelector('#pm').onclick = () => { progMonth = prevM; render(); };
  card.querySelector('#nm').onclick = () => { progMonth = nextM; render(); };
  const goBtn = card.querySelector('#go');
  if (goBtn) goBtn.onclick = () => progTab === 'exam' ? startQuiz({kind:'exam'})
    : progTab === 'practice' ? startQuiz({kind:'random', n:20})
    : open('cat', progFilter !== 'all' ? progFilter : S.lastCat && CATS[S.lastCat] ? S.lastCat : 'trf');
  v.appendChild(card);
  if (progTab === 'theory') {
    v.appendChild(el('<div class="h2">Mastered by topic</div>'));
    const c = el('<div class="card bars"></div>');
    Object.keys(CATS).forEach(k => { const s = catStats(S, k), m = pct(s.right, s.n);
      c.appendChild(el(`<div class="bar-row"><div class="bar-top"><span>${CATS[k][0]}</span><b>${m}%</b></div><div class="progress thin"><i style="width:${m}%"></i></div></div>`)); });
    v.appendChild(c);
  } else {
    const recent = att.slice(-8).reverse();
    v.appendChild(el('<div class="h2">Recent</div>'));
    v.appendChild(recent.length ? (() => { const g = el('<div class="list boxed"></div>');
      recent.forEach(a => g.appendChild(el(`<div class="item"><span class="ico plain">${lucide(passed(a) ? 'circle-check' : 'circle-x', passed(a) ? 'ok' : 'bad')}</span>
        <span class="txt"><b>${a.score}/${a.of} · ${pct(a.score, a.of)}%</b><span>${new Date(a.when).toLocaleString('en-GB', {dateStyle:'medium', timeStyle:'short'})}${a.imported ? ' · from the classic app' : ''}</span></span></div>`)));
      return g; })() : emptyState('history', 'Nothing here yet', `Your finished ${progTab === 'exam' ? 'mock papers' : 'tests'} will be listed here.`));
  }
}

/* ================= boot ================= */
(function boot(){
  const [t, sub, key, i] = location.hash.slice(1).split('/');
  if (TABS.some(([k]) => k === t)) tab = t;
  const keep = ['group', 'cat', 'book', 'rules', 'list', 'numbers', 'process', 'phrases', 'gallery', 'sgroup', 'fam'].includes(sub);
  const s = {tab, d:0, ...(keep ? {sub, key, i: i ? +i : undefined} : {})};
  history.replaceState(s, '', hashOf(s));
  render();
})();
