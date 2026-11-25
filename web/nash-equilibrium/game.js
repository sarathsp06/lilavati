// One table of the guessing game, without the page or the network: rounds, hidden guesses, the reveal
// and the results. Pure apart from crypto.subtle, so tests/game.test.mjs runs it in Node.
//
// Hidden guesses: locking in sends only a fingerprint of the guess (SHA-256 of round, guess and a
// random salt). When everyone has locked in (or someone presses Reveal), each browser sends its guess
// and salt, and the others check it matches the fingerprint. So nobody sees a guess early, and nobody
// can change theirs after seeing the others.
//
//   const g = createGame({ self, send, score, computers })
//     send(msg)                         to everyone else at the table
//     score(values) -> { avg, target, win: [indices] }   (Rust, games.rs)
//     computers(n, round, lastAvg) -> [guesses]           (Rust, games.rs; the same in every browser)
//   g.setPeople([{ id, name }])         who is at the table now (me included); g.setSelf(id) on joining a session
//   g.setComputers(n)                   computer players in the next results
//   await g.lock(value)  g.reveal()  g.next()  await g.receive(msg, from)
//   g.state -> { round, phase: 'guess' | 'reveal' | 'done', mine, locked: [ids], history }
//   g.onChange(f)
//
// Messages: { k: 'lock', r, h } { k: 'reveal', r } { k: 'show', r, v, s, c } { k: 'next', r }
// (c: how many computer players that browser has; every browser uses the one from the smallest id,
// so all of them score the same table even if their settings differ for a moment)
export const P = 2 / 3;
const REVEAL_WAIT = 4000;   // ms to wait for everyone's guess once the reveal has started

const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export async function fingerprint(round, value, salt) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${round}|${value}|${salt}`)));
}
export const cleanGuess = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(100, v)) * 10) / 10 : null);

export function createGame({ self: me = 'me', send = () => {}, score, computers, wait = REVEAL_WAIT, timers = globalThis }) {
  let self = me, round = 1, phase = 'guess', mine = null, salt = '', nComputers = 7, people = [{ id: self, name: 'You' }];
  let locked = new Map(), shown = new Map(), names = new Map(), comp = new Map(), timer = null;
  const history = [], subs = new Set();
  const changed = () => { for (const f of subs) f(); };
  const present = () => people.map(p => p.id);

  function go(r) {
    round = r; phase = 'guess'; mine = null; salt = '';
    locked = new Map(); shown = new Map(); names = new Map(); comp = new Map();
    if (timer) { timers.clearTimeout(timer); timer = null; }
    changed();
  }
  // everyone at the table has locked in: reveal by itself
  function check() {
    if (phase === 'guess' && present().length && present().every(id => locked.has(id))) startReveal();
    else if (phase === 'reveal' && [...locked.keys()].filter(id => present().includes(id)).every(id => shown.has(id))) finish();
  }
  function startReveal() {
    if (phase !== 'guess') return;
    phase = 'reveal';
    if (mine !== null) { shown.set(self, mine); comp.set(self, nComputers); send({ k: 'show', r: round, v: mine, s: salt, c: nComputers }); }
    timer = timers.setTimeout(() => { timer = null; finish(); }, wait);
    changed(); check();
  }
  function finish() {
    if (phase !== 'reveal') return;
    if (timer) { timers.clearTimeout(timer); timer = null; }
    const last = history.length ? history[history.length - 1].avg : -1;
    // people sorted by id so every browser lists them in the same order
    const entries = [...shown].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, v]) => ({ id, name: names.get(id) || 'Someone', v }));
    const ids = [...comp.keys()].sort(), n = ids.length ? comp.get(ids[0]) : nComputers;
    const cpu = n > 0 ? computers(n, round, last) : [];
    cpu.forEach((v, i) => entries.push({ id: 'cpu' + i, name: 'Computer ' + (i + 1), v, cpu: true }));
    const res = entries.length ? score(entries.map(e => e.v)) : { avg: 0, target: 0, win: [] };
    history.push({ round, entries, avg: res.avg, target: res.target, win: [...res.win] });
    if (history.length > 30) history.shift();
    phase = 'done'; changed();
  }

  const game = {
    get state() { return { round, phase, mine, locked: [...locked.keys()], shown: [...shown.keys()], history, computers: nComputers }; },
    onChange(f) { subs.add(f); return () => subs.delete(f); },
    setPeople(list) {
      people = list.length ? list : [{ id: self, name: 'You' }];
      for (const p of people) if (locked.has(p.id) && !names.has(p.id)) names.set(p.id, p.name);
      changed(); check();
    },
    // my id changes when I join a session (from 'me' to my network id)
    setSelf(id) {
      if (!id || id === self) return;
      for (const m of [locked, shown, names, comp]) if (m.has(self)) { m.set(id, m.get(self)); m.delete(self); }
      self = id;
    },
    get self() { return self; },
    setComputers(n) { nComputers = Math.max(0, Math.min(30, n | 0)); changed(); },
    async lock(value) {
      const v = cleanGuess(value);
      if (phase !== 'guess' || v === null || mine !== null) return false;
      mine = v; salt = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const r = round, h = await fingerprint(r, v, salt);
      if (r !== round) return false;
      locked.set(self, h); names.set(self, people.find(p => p.id === self)?.name || 'You');
      send({ k: 'lock', r, h });
      changed(); check();
      return true;
    },
    reveal() { if (phase !== 'guess' || !locked.size) return; send({ k: 'reveal', r: round }); startReveal(); },
    next() { if (phase !== 'done') return; send({ k: 'next', r: round + 1 }); go(round + 1); },
    async receive(m, from) {
      if (!m || typeof m !== 'object' || typeof from !== 'string' || from === self || !Number.isInteger(m.r)) return;
      if (m.k === 'next') { if (m.r > round) go(m.r); return; }
      if (m.r !== round) return;
      if (m.k === 'lock' && phase === 'guess' && typeof m.h === 'string' && /^[0-9a-f]{64}$/.test(m.h) && !locked.has(from)) {
        locked.set(from, m.h); names.set(from, people.find(p => p.id === from)?.name || 'Someone'); changed(); check();
      } else if (m.k === 'reveal') startReveal();
      else if (m.k === 'show' && phase !== 'done' && locked.has(from) && !shown.has(from)) {
        const v = cleanGuess(m.v);
        if (v === null || typeof m.s !== 'string' || m.s.length > 64) return;
        if (await fingerprint(m.r, v, m.s) !== locked.get(from)) { console.warn('[game] a guess did not match its fingerprint; left out'); return; }
        if (m.r !== round || phase === 'done') return;
        shown.set(from, v); comp.set(from, Number.isInteger(m.c) ? Math.max(0, Math.min(30, m.c)) : nComputers);
        if (phase === 'guess') startReveal(); else { changed(); check(); }
      }
    },
    // for a newcomer: the rounds so far, never anyone's hidden guess
    snapshot: () => ({ round, done: phase === 'done', history: history.slice(-12) }),
    adopt(s) {
      if (!s || !Number.isInteger(s.round) || s.round < 1 || !Array.isArray(s.history)) return false;
      const ok = s.history.every(h => h && Number.isInteger(h.round) && Number.isFinite(h.avg) && Number.isFinite(h.target) && Array.isArray(h.win) && Array.isArray(h.entries)
        && h.entries.length <= 60 && h.entries.every(e => e && cleanGuess(e.v) !== null && typeof e.name === 'string'));
      if (!ok) return false;
      const newer = s.round > round || (s.round === round && s.done && phase !== 'done');
      if (!newer) return false;
      history.length = 0;
      for (const h of s.history.slice(-12)) history.push({ round: h.round, avg: h.avg, target: h.target, win: h.win.filter(Number.isInteger),
        entries: h.entries.map(e => ({ id: String(e.id ?? '').slice(0, 40), name: e.name.slice(0, 24), v: cleanGuess(e.v), cpu: !!e.cpu })) });
      go(s.round);
      if (s.done) { phase = 'done'; changed(); }
      return true;
    },
  };
  return game;
}
