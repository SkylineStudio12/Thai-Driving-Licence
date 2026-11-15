/* v2 core: data and rules, no DOM. Loaded after ../bank.js and ../signs.js, and by check.js in node.
   The paper-building and sign-option logic is copied from ../index.html on purpose, so the live
   app is not refactored by this experiment. */

const CATS = {
  veh:  ['Vehicle law',   'กฎหมายว่าด้วยรถยนต์'],
  trf:  ['Traffic law',   'กฎหมายว่าด้วยจราจรทางบก'],
  sign: ['Road signs',    'เครื่องหมายจราจร'],
  mark: ['Road markings', 'เครื่องหมายจราจรบนพื้นทาง'],
  alco: ['Alcohol & drugs', 'แอลกอฮอล์และยาเสพติด'],
  fit:  ['Fitness to ride', 'ความพร้อมของผู้ขับขี่'],
  aid:  ['First aid',       'การปฐมพยาบาล'],
  etq:  ['Etiquette',     'มารยาทและจิตสำนึก'],
  safe: ['Safe riding',   'เทคนิคการขับขี่อย่างปลอดภัย'],
  maint:['Maintenance',   'การบำรุงรักษารถ'],
  moto: ['Motorcycle',    'รถจักรยานยนต์'],
  proc: ['Exam & process','ขั้นตอนการสอบ']
};
const CAT_ICON = {veh:'scale', trf:'route', sign:'triangle-alert', mark:'road', alco:'wine', fit:'heart-pulse',
  aid:'briefcase-medical', etq:'handshake', safe:'shield-check', maint:'wrench', moto:'motorbike', proc:'list-checks'};
const CAT_DESC = {veh:'Licences, documents, registration and fines', trf:'Right of way, overtaking, parking and speed',
  sign:'What every Thai road sign means', mark:'Lines, arrows and words painted on the road',
  alco:'Limits, testing and penalties', fit:'Whether a condition or medicine stops you riding',
  aid:'What to do first at a crash', etq:'Courtesy and conduct on the road', safe:'Braking, cornering and hazards',
  maint:'Daily checks: tyres, brakes, lights, oil', moto:'Riding a motorcycle specifically', proc:'Documents and steps at the DLT office'};
/* Theory hub: the 12 categories in four groups */
const TOPIC_GROUPS = [
  {key:'signs',  title:'Road signs',            icon:'signpost',     cats:['sign','mark']},
  {key:'law',    title:'Traffic & vehicle law', icon:'scale',        cats:['trf','veh','etq']},
  {key:'riding', title:'Riding & safety',       icon:'motorbike',    cats:['safe','moto','maint']},
  {key:'health', title:'Health & process',      icon:'heart-pulse',  cats:['alco','fit','aid','proc']}
];
const QUOTA = {veh:7, trf:9, sign:8, mark:3, etq:5, safe:4, maint:4, moto:3, proc:2, alco:2, fit:2, aid:1};
const PASS = 45, TOTAL = 50, MINUTES = 60;
const PRACTICE_PASS = 0.8;                 // practice tests: 80%; the exam itself needs 90%
const GOALS = [10, 15, 25, 40];
const STORE_KEY = 'thai-moto-v2', LEGACY_KEY = 'thai-moto-progress';

const shuffle = a => { for (let i=a.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };

/* ---- sign questions (same rules as the main app: distractors from the same family first) ---- */
const FAM_GROUP = {gradient:'road', surface:'road', uturn:'laneflow', endzone:'prohibit', rail:'aheadwarn', divert:'workwarn'};
const gkey = s => FAM_GROUP[s.fam] || s.fam;
const SIGN_GRP = {};
SIGNS.forEach(s => (SIGN_GRP[gkey(s)] = SIGN_GRP[gkey(s)] || []).push(s));
function signOpts(s){
  const sibs  = shuffle(SIGN_GRP[gkey(s)].filter(x => x.en !== s.en));
  const wider = shuffle(SIGNS.filter(x => gkey(x) !== gkey(s) && x.en !== s.en));
  const picks = [], seen = new Set([s.en]);
  for (const c of sibs.concat(wider)){
    if (picks.length === 3) break;
    if (seen.has(c.en)) continue;
    seen.add(c.en); picks.push(c);
  }
  const opts = shuffle([s].concat(picks));
  return {o: opts.map(x => [x.th, x.en]), a: opts.indexOf(s)};
}
SIGNS.filter(s => !s.gallery).forEach(s => {
  const q = {c:'sign', img:s.img, code:s.code, sign:s, w:s.w,
             en:'What does this sign mean?', th:'เครื่องหมายนี้หมายความว่าอย่างไร'};
  Object.assign(q, signOpts(s));
  BANK.push(q);
});
BANK.forEach((q,i) => q.id = i);
const BY_ID = Object.fromEntries(BANK.map(q => [q.id, q]));
const freshen = qs => { qs.forEach(q => { if (q.sign) Object.assign(q, signOpts(q.sign)); }); return qs; };

const SIGN_RULES = [
  {imgs:['bo-04','bo-01','bo-02'], title:'Red ring, octagon or triangle', th:'ป้ายบังคับ', text:'Enforceable: you must, or must not.', badge:'Rule'},
  {imgs:['bo-44'], title:'Blue disc, white symbol', th:'ป้ายบังคับ', text:'Also enforceable, but a command: <i>do this</i>.', badge:'Command'},
  {imgs:['bo-29','bo-30'], title:'Blue disc with a red ring', text:'One slash = no parking, a cross = no stopping.', badge:'Restriction'},
  {imgs:['to-38'], title:'Yellow diamond', th:'ป้ายเตือน', text:'A warning only, no command attached.', badge:'Warning'},
  {imgs:['tg-03'], title:'Orange', text:'Temporary roadworks. Nearly all of these print their English on the sign, so they are free marks once you know orange means "works", not "danger".', badge:'Roadworks'}
];

/* ---- store ---- */
const freshState = () => ({v:1, profile:{name:'', examDate:'', vehicle:'moto', onboarded:false}, goal:15,
  days:{}, q:{}, bookmarks:[], attempts:[], lastCat:null, showThai:true});
function loadState(storage){
  let s = null;
  try { s = JSON.parse(storage.getItem(STORE_KEY)); } catch (e) {}
  if (!s || s.v !== 1) {
    s = freshState();
    /* carry over mock papers sat in the current app (same origin, so its history is readable) */
    try {
      const old = JSON.parse(storage.getItem(LEGACY_KEY)) || [];
      old.forEach(a => s.attempts.push({when:a.when, mode:'exam', score:a.score, of:a.of, byCat:a.byCat || {}, imported:true}));
    } catch (e) {}
  }
  return Object.assign(freshState(), s);
}
function saveState(storage, s){ try { storage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {} }

const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
const qs0 = () => ({seen:0, right:0, wrong:0, last:null});

/* an answered question: counts toward today's goal and the question's record */
function record(s, id, correct, when){
  const r = s.q[id] = Object.assign(qs0(), s.q[id]);
  r.seen++; if (correct) r.right++; else r.wrong++;
  r.last = correct ? 'right' : 'wrong';
  const k = dayKey(when || Date.now());
  s.days[k] = (s.days[k] || 0) + 1;
}
/* read in the Theory book: seen, but not answered */
function markSeen(s, id){ const r = s.q[id] = Object.assign(qs0(), s.q[id]); if (!r.seen) r.seen = 1; }
const isMistake = r => !!r && (r.last === 'wrong' || r.wrong > r.right);
const mistakes = s => Object.keys(s.q).filter(id => isMistake(s.q[id]) && BY_ID[id]).map(Number);
function toggleBookmark(s, id){
  const i = s.bookmarks.indexOf(id);
  if (i >= 0) s.bookmarks.splice(i, 1); else s.bookmarks.push(id);
  return i < 0;
}

/* Monday-first week containing `today`, each day flagged met / today / future */
function weekStrip(s, today){
  const t = new Date(today); t.setHours(12,0,0,0);
  const monday = new Date(t); monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  return Array.from({length:7}, (_, k) => {
    const d = new Date(monday); d.setDate(monday.getDate() + k);
    const key = dayKey(d), n = s.days[key] || 0;
    return {key, date:d.getDate(), dow:d.toLocaleDateString('en-GB', {weekday:'short'}), n,
            met: n >= s.goal, today: key === dayKey(t), future: d > t};
  });
}
/* consecutive goal-met days ending today (or yesterday, if today is not done yet) */
function streak(s, today){
  const d = new Date(today); d.setHours(12,0,0,0);
  if ((s.days[dayKey(d)] || 0) < s.goal) d.setDate(d.getDate() - 1);
  let n = 0;
  while ((s.days[dayKey(d)] || 0) >= s.goal) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---- question sets ---- */
const pool = s => BANK.filter(q => s.profile.vehicle === 'car' || !q.car);
function buildPaper(s){
  const p = pool(s), out = [];
  for (const c in QUOTA) out.push(...shuffle(p.filter(q => q.c === c)).slice(0, QUOTA[c]));
  const rest = shuffle(p.filter(q => !out.includes(q)));
  while (out.length < TOTAL && rest.length) out.push(rest.pop());
  return freshen(shuffle(out).slice(0, TOTAL));
}
function catSet(s, c, {onlyMistakes = false, shuffled = true} = {}){
  let qs = pool(s).filter(q => q.c === c);
  if (onlyMistakes) qs = qs.filter(q => isMistake(s.q[q.id]));
  return freshen(shuffled ? shuffle(qs.slice()) : qs.slice());
}
const randomSet = (s, n) => freshen(shuffle(pool(s).slice()).slice(0, n));
const idSet = ids => freshen(shuffle(ids.map(id => BY_ID[id]).filter(Boolean)));
const marathonSet = s => freshen(shuffle(pool(s).slice()));

function score(qs, picks){
  const wrong = [], byCat = {};
  qs.forEach((q, i) => {
    const b = byCat[q.c] = byCat[q.c] || {n:0, ok:0};
    b.n++;
    if (picks[i] === q.a) b.ok++; else wrong.push(q.id);
  });
  return {score: qs.length - wrong.length, of: qs.length, wrong, byCat};
}
const passed = a => a.mode === 'exam' ? a.score >= (a.of === TOTAL ? PASS : Math.ceil(a.of * 0.9))
                                      : a.score / a.of >= PRACTICE_PASS;

/* per-category numbers for the Theory screens */
function catStats(s, c){
  const qs = pool(s).filter(q => q.c === c);
  let seen = 0, right = 0, wrong = 0;
  qs.forEach(q => { const r = s.q[q.id]; if (r && r.seen) seen++; if (r && r.last === 'right') right++; if (isMistake(r)) wrong++; });
  return {n: qs.length, seen, right, wrong, done: qs.length > 0 && seen === qs.length};
}

if (typeof module !== 'undefined') module.exports = {};
