// v2 self-check: runs core.js against the real bank in node (no browser needed).
// Usage, from the repo root:  node v2/check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const mem = {}; const storage = {getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }};
const ctx = {console, storage}; vm.createContext(ctx);
for (const f of ['bank.js', 'signs.js', 'v2/core.js', 'v2/icons.js', 'v2/art/art.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
const run = code => vm.runInContext(code, ctx);
const errs = [], ok = (c, m) => { if (!c) errs.push(m); };

/* papers */
run('var st = freshState()');
for (let t = 0; t < 100; t++) {
  const r = run(`(() => { const p = buildPaper(st); return {n:p.length, ids:new Set(p.map(q=>q.id)).size, car:p.some(q=>q.car),
    sign:p.every(q => !q.sign || q.o[q.a][1] === q.sign.en)}; })()`);
  ok(r.n === 50, `paper ${t}: ${r.n} questions`); ok(r.ids === r.n, `paper ${t}: duplicate`);
  ok(!r.car, `paper ${t}: car-only question on the motorcycle paper`); ok(r.sign, `paper ${t}: sign lost its answer`);
}
ok(run(`(() => { st.profile.vehicle = 'car'; const n = pool(st).length; st.profile.vehicle = 'moto'; return n > pool(st).length; })()`), 'car pool should be larger');
/* scoring and the 45/50 gate; unanswered counts as wrong */
for (const nWrong of [0, 5, 6, 50]) {
  const r = run(`(() => { const qs = buildPaper(st), picks = qs.map(q => q.a);
    for (let i = 0; i < ${nWrong}; i++) picks[i] = (qs[i].a + 1) % 4; const r = score(qs, picks);
    return {s:r.score, w:r.wrong.length, pass:passed({mode:'exam', ...r})}; })()`);
  ok(r.s === 50 - nWrong && r.w === nWrong, `score with ${nWrong} wrong: ${r.s}`);
  ok(r.pass === (nWrong <= 5), `pass gate with ${nWrong} wrong`);
}
ok(run(`(() => { const qs = buildPaper(st), picks = qs.map(q => q.a); picks[0] = null; return score(qs, picks).score; })()`) === 49, 'unanswered must count as wrong');
ok(run(`passed({mode:'practice', score:8, of:10}) && !passed({mode:'practice', score:7, of:10})`), 'practice pass mark is 80%');
/* answers, mistakes, bookmarks */
run(`st = freshState(); record(st, 3, false, Date.now()); record(st, 4, true, Date.now()); record(st, 5, false, Date.now()); record(st, 5, true, Date.now());`);
ok(JSON.stringify(run('mistakes(st).sort()')) === '[3]', 'mistakes: only q3 (q5 was corrected last)');
ok(run('toggleBookmark(st, 7) && !toggleBookmark(st, 7) && st.bookmarks.length === 0'), 'bookmark toggles');
/* streak across days */
run(`st = freshState(); st.goal = 2; var T = new Date(2026, 10, 14, 12);
  [[0,2],[1,3],[2,2],[4,5]].forEach(([back, n]) => { const d = new Date(T); d.setDate(T.getDate() - back); st.days[dayKey(d)] = n; });`);
ok(run('streak(st, T)') === 3, 'streak: today + 2 days before, then a gap');
ok(run('(() => { const d = new Date(T); d.setDate(d.getDate() + 1); return streak(st, d); })()') === 3, 'streak survives an unfinished today');
ok(run('weekStrip(st, T).length === 7 && weekStrip(st, T)[0].dow === "Mon" && weekStrip(st, T).filter(d => d.today).length === 1'), 'week strip Mon..Sun with today');
/* legacy import */
mem['thai-moto-progress'] = JSON.stringify([{when:'2026-11-01T10:00:00Z', score:46, of:50, byCat:{}}]);
ok(run('loadState(storage).attempts.length') === 1, 'imports attempts from the classic app');
/* category stats and topic groups cover every category exactly once */
const cats = run('TOPIC_GROUPS.flatMap(g => g.cats)');
ok(cats.length === 12 && new Set(cats).size === 12 && cats.every(c => run(`!!CATS['${c}']`)), 'topic groups cover the 12 categories once');
ok(run(`Object.keys(CATS).every(c => CAT_ICON[c] && LUCIDE[CAT_ICON[c]] && CAT_DESC[c])`), 'every category has an icon and a description');
/* artwork listed in the manifest exists on disk */
const art = run('ART');
Object.values(art).forEach(f => ok(fs.existsSync(path.join(__dirname, 'art', f)), `art file missing: ${f}`));

console.log(errs.length ? 'FAIL\n' + errs.join('\n') : `PASS — ${run('BANK.length')} questions, 100 papers, scoring, streak, mistakes, bookmarks, import, art`);
process.exit(errs.length ? 1 : 0);
