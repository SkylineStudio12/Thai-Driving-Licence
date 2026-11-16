// Self-check: runs core.js against the real bank in node (no browser needed).
// Usage, from the repo root:  node check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = __dirname;
const mem = {}; const storage = {getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }};
const ctx = {console, storage}; vm.createContext(ctx);
for (const f of ['bank.js', 'signs.js', 'core.js', 'icons.js', 'art/art.js'])
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
/* options are reshuffled every draw: the right answer survives, position varies, pinned stay last */
const shuf = run(`(() => {
  const written = BANK.filter(q => !q.sign);
  const keep = written.map(q => q.o[q.a][1]);
  const pos = {}; let lost = 0, pinOk = true;
  for (let t = 0; t < 200; t++) {
    freshen(written);
    written.forEach((q, i) => {
      if (q.o[q.a][1] !== keep[i]) lost++;
      (pos[q.id] = pos[q.id] || new Set()).add(q.a);
      q.o.forEach((o, k) => { if (PINNED_OPT.test(o[1]) && k !== q.o.length - 1) pinOk = false; });
    });
  }
  const fixed = written.filter(q => pos[q.id].size === 1 && !q.o.some(o => PINNED_OPT.test(o[1]) && o === q.o[q.a])).length;
  return {lost, pinOk, fixed, n: written.length};
})()`);
ok(shuf.lost === 0, `shuffling changed the right answer ${shuf.lost} times`);
ok(shuf.pinOk, '"None/All of the above" options must stay last');
ok(shuf.fixed === 0, `${shuf.fixed} written questions never moved their answer in 200 shuffles`);
/* export -> import round-trips; a foreign file is refused */
run(`var st2 = freshState(); st2.profile.name = 'T'; record(st2, 4, true, Date.now()); st2.bookmarks.push(7, 99999);`);
ok(run('(() => { const r = parseImport(exportState(st2)); return r.profile.name === "T" && r.q[4].right === 1 && r.bookmarks.length === 1; })()'), 'export/import round-trip');
ok(run('(() => { try { parseImport("{\\"a\\":1}"); return false; } catch (e) { return true; } })()'), 'import must refuse a foreign file');
/* auto-next defaults, including for states saved before the setting existed */
ok(run('freshState().autoNext === false && freshState().autoNextAsk === 0'), 'auto-next defaults');
mem['thai-moto-v2'] = JSON.stringify({v:1, profile:{name:'A', onboarded:true}, goal:10, days:{}, q:{}, bookmarks:[], attempts:[]});
ok(run('loadState(storage).autoNext') === false, 'old saved state gets autoNext = false');
delete mem['thai-moto-v2'];
/* Key numbers: the 34 rows carried over from the original app, and the ten traps */
ok(run('NUMBER_GROUPS.flatMap(g => g.rows).length') === 34 && run('TRAPS.length') === 10, 'Key numbers lost rows');
/* content moved from the original app: every sign family in exactly one group, phrases, handbook on disk */
const fams = run('SIGN_GROUPS.flatMap(g => g.fams)');
ok(fams.length === 24 && new Set(fams).size === 24 && run('SIGNS.every(s => SIGN_GROUPS.some(g => g.fams.includes(s.fam)))'), 'sign gallery groups');
ok(run('PHRASES.length') >= 18, 'phrases missing');
ok(fs.existsSync(path.join(root, run('RES.pdf'))), 'handbook PDF missing beside index.html');
/* artwork listed in the manifest exists on disk */
const art = run('ART');
Object.values(art).forEach(f => ok(fs.existsSync(path.join(__dirname, 'art', f)), `art file missing: ${f}`));
run('UNUSED').forEach(f => ok(fs.existsSync(path.join(__dirname, 'art', f)), `stored art file missing: ${f}`));
const onDisk = fs.readdirSync(path.join(__dirname, 'art')).filter(f => f.endsWith('.webp'));
onDisk.forEach(f => ok(Object.values(art).includes(f) || run('UNUSED').includes(f), `art file not listed in art.js: ${f}`));

console.log(errs.length ? 'FAIL\n' + errs.join('\n') : `PASS — ${run('BANK.length')} questions, 100 papers, scoring, streak, mistakes, bookmarks, import, art`);
process.exit(errs.length ? 1 : 0);
