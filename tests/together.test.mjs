// The Together session logic (web/together/session.js) with a pretend network. Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, newToken, validToken, cleanName } from '../web/together/session.js';

// a network in memory: messages queue until flush(), like a real one
function net() {
  const nodes = new Map(), queue = [];
  return {
    add(id, opts) {
      const s = createSession({ self: id, ...opts, send: (msg, to) => {
        const copy = JSON.parse(JSON.stringify(msg));
        for (const [other, n] of nodes) if (other !== id && (!to || to === other)) queue.push(() => n.log.push(n.s.receive(copy, id)));
      } });
      nodes.set(id, { s, log: [] }); return nodes.get(id);
    },
    connect(a, b) { nodes.get(a).s.joined(b); nodes.get(b).s.joined(a); },
    flush() { while (queue.length) queue.shift()(); },
  };
}

test('tokens are random, short and checked', () => {
  const a = newToken(), b = newToken();
  assert.ok(validToken(a) && validToken(b)); assert.notEqual(a, b); assert.equal(a.length, 10);
  for (const bad of ['', 'abc', 'ABC123defg', 'abc 123def', null, 'x'.repeat(40), '<script>']) assert.equal(validToken(bad), false);
});

test('names are cleaned and kept short', () => {
  assert.equal(cleanName('  Ana\u0007 '), 'Ana');
  assert.equal(cleanName('x'.repeat(50)).length, 24);
});

test('only the one who was on the page first sends a newcomer the picture', () => {
  const n = net();
  const a = n.add('a', { name: 'Ana', slug: 'svd', since: 100 });
  const b = n.add('b', { name: 'Ben', slug: 'svd', since: 200 });
  n.connect('a', 'b'); n.flush();
  assert.equal(a.log[0].type, 'join'); assert.equal(a.log[0].answerState, true);
  assert.equal(b.log[0].answerState, false);
  // a third arrives: a answers, b (also older than c) does not
  const c = n.add('c', { name: 'Cy', slug: 'svd', since: 300 });
  n.connect('a', 'c'); n.connect('b', 'c'); n.flush();
  assert.equal(a.log.at(-1).answerState, true);
  assert.equal(b.log.at(-1).answerState, false);
  assert.ok(c.log.every(r => !r.answerState));
});

test('someone on another page is not sent this picture', () => {
  const n = net();
  const a = n.add('a', { slug: 'svd', since: 100 }), b = n.add('b', { slug: 'orbits', since: 200 });
  n.connect('a', 'b'); n.flush();
  assert.equal(a.log[0].answerState, false);
  assert.equal(a.s.member('b').slug, 'orbits');
});

test('chat reaches everyone once; a newcomer gets the history from the longest-present', () => {
  const n = net();
  const a = n.add('a', { name: 'Ana', slug: 'svd', since: 100 }), b = n.add('b', { name: 'Ben', slug: '', since: 150 });
  n.connect('a', 'b'); n.flush();
  a.s.say('hello'); b.s.say('hi Ana'); n.flush();
  assert.deepEqual(a.s.chat.map(m => m.text), ['hello', 'hi Ana']);
  assert.deepEqual(b.s.chat.map(m => m.text), ['hello', 'hi Ana']);
  const c = n.add('c', { name: 'Cy', slug: 'orbits', since: 300 });
  n.connect('a', 'c'); n.connect('b', 'c'); n.flush();
  const answers = [a, b].map(x => x.log.at(-1));
  assert.deepEqual(answers.map(r => r.answerChat), [true, false]);
  c.s.receive({ t: 'hist', msgs: a.s.history() }, 'a');
  c.s.receive({ t: 'hist', msgs: a.s.history() }, 'a');   // twice: no duplicates
  assert.deepEqual(c.s.chat.map(m => [m.name, m.text]), [['Ana', 'hello'], ['Ben', 'hi Ana']]);
});

test('bad messages are ignored', () => {
  const s = createSession({ self: 'a', slug: 'svd', since: 1 });
  for (const m of [null, 'x', 42, { t: 'nope' }, { t: 'chat' }, { t: 'chat', m: { id: 'x', text: '   ' } }, { t: 'click', slug: 'svd', i: -1 }, { t: 'click', slug: 'svd', i: 1.5 },
    { t: 'click', slug: 'orbits', i: 1 }, { t: 'state', slug: 'orbits', s: {} }, { t: 'state', slug: 'svd', s: null }, { t: 'hist', msgs: 'x' }])
    assert.equal(s.receive(m, 'b'), null);
  assert.equal(s.receive({ t: 'hi' }, 'a'), null, 'my own echo');
  assert.equal(s.receive({ t: 'click', slug: 'svd', i: 3 }, 'b').index, 3);
  const long = s.receive({ t: 'chat', m: { id: 'm1', name: 'N', text: 'y'.repeat(900), at: 5 } }, 'b');
  assert.equal(long.message.text.length, 500);
});

test('who has their microphone on is known to everyone, including newcomers', () => {
  const n = net();
  const a = n.add('a', { name: 'Ana', slug: 'svd', since: 1 }), b = n.add('b', { name: 'Ben', slug: 'svd', since: 2 });
  n.connect('a', 'b'); n.flush();
  assert.equal(b.s.member('a').mic, false);
  a.s.setMic(true); n.flush();
  assert.equal(b.s.member('a').mic, true); assert.equal(b.log.at(-1).type, 'mic');
  const c = n.add('c', { slug: 'svd', since: 3 }); n.connect('a', 'c'); n.flush();
  assert.equal(c.s.member('a').mic, true);
  a.s.setMic(true, true); n.flush();
  assert.equal(b.s.member('a').mic, true); assert.equal(b.s.member('a').muted, true); assert.equal(b.log.at(-1).changed, false);
  a.s.setMic(false); n.flush();
  assert.equal(b.s.member('a').mic, false);
  assert.equal(b.s.receive({ t: 'mic', on: 'yes' }, 'a').member.mic, false);
});
