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
  days:{}, q:{}, bookmarks:[], attempts:[], lastCat:null, showThai:true,
  autoNext:false, autoNextAsk:0});   // auto-next after a right answer; autoNextAsk = streak at which to offer it again
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


/* ---- Key numbers (content copied from the classic app's Key numbers page), grouped by kind ---- */
const NUMBER_GROUPS = [
  {title:'Time limits', icon:'calendar', rows:[
    ['7 days','ticket fine payment · change of vehicle colour'],
    ['15 days','replacement licence · vehicle transfer · appeal a suspension'],
    ['1 month','how recent the medical certificate must be'],
    ['90 days','window to retake a failed theory test'],
    ['6 months','how far ahead a 5-year licence can be renewed'],
    ['2 years','validity of the temporary licence you will be issued'],
    ['3 years','expired beyond this = retake theory AND practical'],
    ['5 years','private licence validity · motorcycle inspection age'],
    ['7 years','car inspection age']]},
  {title:'Distances', icon:'route', rows:[
    ['25 cm','maximum distance from the kerb when parking'],
    ['1 m','lateral gap to keep from parked and moving vehicles'],
    ['2.50 m','maximum load overhang at the REAR'],
    ['3 m','no parking on, or within this distance of, a pedestrian crossing'],
    ['5 m','STOP this far short of a railway track when a train is coming'],
    ['10 m','no parking at, or within this distance of, a junction'],
    ['15 m','no PARKING within this distance of a railway crossing (not the same as the 5 m stop)'],
    ['30 m','signal before a turn'],
    ['60 m','turn signal must be visible from this far · no overtaking below this visibility'],
    ['150 m','head and tail lights must be visible from this far']]},
  {title:'Speed and the engine', icon:'gauge', rows:[
    ['60 km/h','motorcycle speed in a built-up area (bank answer)'],
    ['90 km/h','speed outside Bangkok / Pattaya / a municipality (bank answer)'],
    ['80–95 °C','normal engine operating temperature']]},
  {title:'Alcohol', icon:'wine', rows:[
    ['50 mg%','the alcohol limit for an ordinary driver'],
    ['20 mg%','the limit on a TEMPORARY licence, under 20, or with no licence: this is you']]},
  {title:'Fines', icon:'scale', rows:[
    ['1,000 baht','no licence · no plate · no lights in poor visibility · excessive noise'],
    ['2,000 baht','EXPIRED licence: heavier than having none'],
    ['200 baht','crossing outside a zebra within 100 m of one (pedestrian)'],
    ['5,000–20,000 baht','over the alcohol limit, plus up to 1 year and a 6-month suspension'],
    ['1% per month','surcharge on late road tax']]},
  {title:'The test and training', icon:'clipboard-check', rows:[
    ['50 / 45 / 60','questions / needed to pass / minutes'],
    ['5 stations','the motorcycle practical test: plank, Z bend, S bend, obstacle, signs'],
    ['5 hours','the DLT training course for a first-time applicant'],
    ['15 hours','an accredited private driving-school course'],
    ['15 / 18','minimum age: 15 for a motorcycle up to 110 cc, 18 for anything else']]}
];
const TRAPS = [
  {title:'Give way to the LEFT, not the right', hot:true, text:'Two vehicles reach an unsignalised junction at the same time, nobody already in it: the vehicle on your <b>left</b> goes first (Land Traffic Act s.71(2); DLT English book p.45). Many Thai practice sites print "give way to the right" here and are wrong. In a <i>roundabout</i> the answer really is "right", for a different reason: give way to whoever is <b>already in</b> the junction (s.71(1)).'},
  {title:'No licence vs expired licence', text:'No licence = 1 month / 1,000 baht. Expired = 2,000 baht. The heavier penalty is for the expired one.'},
  {title:'Flashing red vs flashing amber', text:'Red = come to a full stop, then go when safe. Amber = slow down and proceed. Different answers, adjacent questions.'},
  {title:'30 m vs 60 m vs 150 m', text:'Signal 30 m before turning; the signal must be visible from 60 m; head and tail lights from 150 m. 60 m is also the visibility below which overtaking is banned.'},
  {title:"The officer's arms", text:'Left arm extended sideways = traffic <b>behind</b> stops. Right forearm raised, palm up = traffic <b>in front</b> stops.'},
  {title:'"First" after a crash', text:'If the question mentions an injured person, the first act is <b>first aid</b>. If it does not, the first act is <b>warning other traffic</b>. Read the stem.'},
  {title:'The 5 m / 15 m railway pair', text:'STOP at least 5 m short of the track when a train is coming. Never PARK within 15 m of the crossing.'},
  {title:'Solid vs broken lines', text:'<b>Solid = prohibited, broken = permitted.</b> White separates lanes going the same way, yellow separates opposing directions. On a solid-plus-broken pair, the line on <i>your</i> side governs you.'},
  {title:'Negative stems', text:'"ข้อใดไม่ใช่" / "which is NOT" / "which should you not do" appears often. Slow down and re-read; this is where most failures happen.'},
  {title:'Etiquette questions', text:'The correct answer is always the longest, calmest, most other-regarding option. Never the one with the horn, high beam or acceleration.'}
];

if (typeof module !== 'undefined') module.exports = {};
