// The host of a Together session: whoever started it. They hold a private key (in their browser tab
// only); its fingerprint is the end of the invite token, so everyone can check that a command really
// comes from the host. Pure apart from crypto.subtle, so tests/host.test.mjs runs it in Node.
//
// Token:  10 random characters + 12-character fingerprint of the host's public key (22 in all).
//         Older 10-character tokens have no host.
// Rules:  { k: 'rules', v, locked, allow: [pid], banned: [pid] }, signed: who may be in the session.
//         Everyone keeps the newest valid rules and passes them on with their hello, so they hold
//         even while the host is away. pid: a person's id for this browser tab (it survives moving
//         between pages, unlike the connection id).
// Mute:   { k: 'mute', pid, at }, signed: that person's microphone is muted.
//
// What this protects: only the host can make commands. What it can't: someone who edits the site's
// code in their own browser can ignore a command aimed at them. The join code is the real lock: without
// it a browser can't even make a connection (it encrypts the connection set-up).
const ABC = 'abcdefghijkmnpqrstuvwxyz23456789';
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const enc = s => new TextEncoder().encode(s);
const ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIGN = { name: 'ECDSA', hash: 'SHA-256' };

export const hasHost = token => typeof token === 'string' && token.length === 22;
export const tagOfToken = token => (hasHost(token) ? token.slice(10) : '');

export async function tagOf(pubB64) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', unb64(pubB64)));
  return Array.from(h.slice(0, 12), b => ABC[b % 32]).join('');
}
// a new host: a key pair; keep jwk (the private key) in this tab only
export async function makeHost() {
  const kp = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const pub = b64(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  return { pub, tag: await tagOf(pub), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
}
// the six-digit join code
export const newCode = (rand = n => crypto.getRandomValues(new Uint32Array(n))) => String(rand(1)[0] % 1e6).padStart(6, '0');
export const validCode = c => typeof c === 'string' && /^\d{6}$/.test(c);

const body = (token, cmd) => { const { sig, ...rest } = cmd; return enc(token + '|' + JSON.stringify(rest)); };
export async function signer(token, jwk) {
  const key = await crypto.subtle.importKey('jwk', jwk, ALG, false, ['sign']);
  return async cmd => ({ ...cmd, sig: b64(new Uint8Array(await crypto.subtle.sign(SIGN, key, body(token, cmd)))) });
}
// is pub really this session's host key, and did it sign cmd?
export async function verify(token, pub, cmd) {
  try {
    if (!hasHost(token) || typeof pub !== 'string' || !cmd || typeof cmd.sig !== 'string') return false;
    if (await tagOf(pub) !== tagOfToken(token)) return false;
    const key = await crypto.subtle.importKey('raw', unb64(pub), ALG, false, ['verify']);
    return await crypto.subtle.verify(SIGN, key, unb64(cmd.sig), body(token, cmd));
  } catch { return false; }
}

const ids = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length <= 40).slice(0, 200) : []);
export const cleanRules = r => ({ k: 'rules', v: Number.isInteger(r?.v) ? r.v : 0, locked: r?.locked === true, allow: ids(r?.allow), banned: ids(r?.banned) });
// why this person may not be in the session under these rules ('removed', 'locked'), or '' if they may
export function refusal(rules, pid) {
  if (!rules) return '';
  if (rules.banned.includes(pid)) return 'removed';
  if (rules.locked && !rules.allow.includes(pid)) return 'locked';
  return '';
}
