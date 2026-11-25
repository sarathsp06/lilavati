// The guessing game's table (web/nash-equilibrium/game.js) with a pretend network. Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, fingerprint, P } from '../web/nash-equilibrium/game.js';

const score = vs => { const avg = vs.reduce((a, b) => a + b, 0) / vs.length, target = P * avg, d = vs.map(v => Math.abs(v - target)), best = Math.min(...d); return { avg, target, win: d.flatMap((x, i) => (x === best ? [i] : [])) }; };
const computers = (n, round, last) => Array.from({ length: n }, (_, i) => (last < 0 ? 30 : last * P) + i);
const settle = () => new Promise(r => setTimeout(r, 5));

function table(ids, opts = {}) {
  const games = {}, inbox = [];
  for (const id of ids) games[id] = createGame({ self: id, score, computers, wait: 50, send: m => { for (const o of ids) if (o !== id) inbox.push([o, JSON.parse(JSON.stringify(m)), id]); }, ...opts });
  const people = ids.map(id => ({ id, name: id.toUpperCase() }));
  for (const id of ids) games[id].setPeople(people);
  const flush = async () => { while (inbox.length) { const [to, m, from] = inbox.shift(); await games[to].receive(m, from); } await settle(); };
  return { games, flush, inbox };
}

test('alone: locking in reveals at once, with the computer players', async () => {
  const g = createGame({ self: 'me', score, computers });
  g.setComputers(3);
  assert.equal(await g.lock(40), true);
  const h = g.state.history[0];
  assert.equal(g.state.phase, 'done');
  assert.deepEqual(h.entries.map(e => e.v), [40, 30, 31, 32]);
  assert.ok(Math.abs(h.avg - 33.25) < 1e-9);
  g.next(); assert.equal(g.state.round, 2); assert.equal(g.state.phase, 'guess');
  await g.lock(10);
  assert.deepEqual(g.state.history[1].entries.slice(1).map(e => +e.v.toFixed(3)), [22.167, 23.167, 24.167].map(v => +v.toFixed(3)));
});

test('guesses stay hidden until everyone has locked in, then everyone gets the same result', async () => {
  const { games: { a, b, c }, flush, inbox } = table(['a', 'b', 'c']);
  for (const g of [a, b, c]) g.setComputers(0);
  await a.lock(50); await flush();
  await b.lock(20); await flush();
  // nothing sent so far carries a guess
  assert.equal(a.state.phase, 'guess'); assert.deepEqual(b.state.locked.sort(), ['a', 'b']);
  await c.lock(5); await flush();
  for (const g of [a, b, c]) assert.equal(g.state.phase, 'done');
  const r = [a, b, c].map(g => JSON.stringify(g.state.history[0]));
  assert.equal(r[0], r[1]); assert.equal(r[1], r[2]);
  assert.deepEqual(a.state.history[0].entries.map(e => [e.name, e.v]), [['A', 50], ['B', 20], ['C', 5]]);
  assert.deepEqual(a.state.history[0].win, [1]);   // average 25, target 16.7: B's 20 is 3.3 away, C's 5 is 11.7
});

test('the closest guess wins', async () => {
  const { games: { a, b }, flush } = table(['a', 'b']);
  a.setComputers(0); b.setComputers(0);
  await a.lock(30); await b.lock(60); await flush();
  assert.deepEqual(a.state.history[0].win, [0]);   // with two players the lower guess always wins
});

test('Reveal leaves out whoever has not locked in; Next moves everyone on', async () => {
  const { games: { a, b, c }, flush } = table(['a', 'b', 'c']);
  for (const g of [a, b, c]) g.setComputers(0);
  await a.lock(40); await b.lock(10); await flush();
  a.reveal(); await flush();
  for (const g of [a, b, c]) { assert.equal(g.state.phase, 'done'); assert.deepEqual(g.state.history[0].entries.map(e => e.id), ['a', 'b']); }
  assert.equal(await c.lock(3), false, 'too late for this round');
  b.next(); await flush();
  for (const g of [a, b, c]) { assert.equal(g.state.round, 2); assert.equal(g.state.phase, 'guess'); }
});

test('a changed guess does not match its fingerprint and is left out', async () => {
  const { games: { a, b }, flush } = table(['a', 'b']);
  a.setComputers(0); b.setComputers(0);
  // b's reveal is changed on its way to a: it claims 20 instead of the 70 it locked in
  const receive = a.receive;
  a.receive = (m, from) => receive(from === 'b' && m.k === 'show' ? { ...m, v: 20 } : m, from);
  await a.lock(40); await b.lock(70); await flush();
  await new Promise(r => setTimeout(r, 80));   // a waits for a valid reveal, then goes on without it
  assert.deepEqual(a.state.history[0].entries.map(e => [e.id, e.v]), [['a', 40]]);
  assert.equal(await fingerprint(1, 70, 'x') === await fingerprint(1, 20, 'x'), false);
});

test('everyone scores the same table even if their computer settings differ', async () => {
  const { games: { a, b }, flush } = table(['a', 'b']);
  a.setComputers(0); b.setComputers(3);
  await a.lock(30); await b.lock(60); await flush();
  assert.equal(JSON.stringify(a.state.history[0]), JSON.stringify(b.state.history[0]));
  assert.equal(a.state.history[0].entries.length, 2);   // a has the smallest id: no computers
});

test('someone who leaves before revealing does not hold the round up', async () => {
  const { games: { a, b }, flush, inbox } = table(['a', 'b']);
  a.setComputers(0); b.setComputers(0);
  await a.lock(40); await b.lock(20);
  inbox.length = 0;                              // b's messages never arrive
  a.setPeople([{ id: 'a', name: 'A' }]);         // b went away
  await settle();
  // a had not seen b's lock: everyone present has locked in, so a reveals alone
  assert.equal(a.state.phase, 'done');
});

test('a newcomer takes over the rounds so far, never a hidden guess', async () => {
  const g = createGame({ self: 'me', score, computers }); g.setComputers(2);
  await g.lock(40); g.next(); await g.lock(20);
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  assert.ok(!JSON.stringify(s).includes('"mine"'));
  const n = createGame({ self: 'new', score, computers });
  assert.equal(n.adopt(s), true);
  assert.equal(n.state.round, 2); assert.equal(n.state.phase, 'done'); assert.equal(n.state.history.length, 2);
  assert.equal(n.adopt(s), false, 'nothing newer');
  assert.equal(n.adopt({ round: 9, history: [{ round: 1, avg: 'x' }] }), false, 'bad data');
});
