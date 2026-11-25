// The Together host's keys and signed commands (web/together/host.js). Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHost, signer, verify, hasHost, newCode, validCode, cleanRules, refusal } from '../web/together/host.js';
import { newToken, validToken } from '../web/together/session.js';

test('a host token ends with the fingerprint of the host key', async () => {
  const h = await makeHost(), token = newToken() + h.tag;
  assert.ok(validToken(token)); assert.ok(hasHost(token)); assert.equal(hasHost(newToken()), false);
  const sign = await signer(token, h.jwk), cmd = await sign({ k: 'mute', pid: 'p1', at: 5 });
  assert.equal(await verify(token, h.pub, cmd), true);
  assert.equal(await verify(token, h.pub, { ...cmd, pid: 'p2' }), false, 'changed after signing');
  const other = await makeHost(), fake = await (await signer(token, other.jwk))({ k: 'mute', pid: 'p1', at: 5 });
  assert.equal(await verify(token, other.pub, fake), false, 'someone else claiming to be host');
  assert.equal(await verify(newToken() + other.tag, h.pub, cmd), false, 'another session');
  assert.equal(await verify(token, 'garbage', cmd), false);
});

test('join codes are six digits', () => {
  for (let i = 0; i < 50; i++) assert.ok(validCode(newCode()));
  assert.equal(validCode('12345'), false); assert.equal(validCode('12a456'), false);
});

test('rules: removed people and, when locked, newcomers are refused', () => {
  const r = cleanRules({ v: 2, locked: true, allow: ['a', 'b'], banned: ['c', 5] });
  assert.deepEqual(r.banned, ['c']);
  assert.equal(refusal(r, 'a'), ''); assert.equal(refusal(r, 'c'), 'removed'); assert.equal(refusal(r, 'd'), 'locked');
  assert.equal(refusal(cleanRules({ v: 1 }), 'd'), ''); assert.equal(refusal(null, 'x'), '');
});
