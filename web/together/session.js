// A Together session without the network or the page: who is in it, the chat, and who answers a
// newcomer. Pure, so tests/together.test.mjs runs it in Node. index.js feeds it messages.
//
//   const s = createSession({ self, name, slug, since, send })
//   s.receive(msg, from)   a message from another browser; returns what happened (see below)
//   s.joined(id)           a browser connected: say hello to it
//   s.left(id)             it went away
//   s.say(text)            a chat message from me; returns it
//   s.rename(name)
//   s.members              Map id -> { id, name, slug, since }   (others only)
//   s.chat                 [{ id, from, name, text, at }] oldest first
//
// Messages (one object each, t says which):
//   hi    { name, slug, since }    on connecting; since = when I opened this page (ms)
//   name  { name }
//   chat  { m: { id, name, text, at } }
//   hist  { msgs: [...] }          recent chat for a newcomer
//   state { slug, s }              the picture's state (index.js snapshot())
//   click { slug, i }              a button press, by its position on the page
//   app   { slug, d }              the page's own message (share.js room.send)
//   mic   { on, muted }            my microphone is on (voice.js) or off, and whether I muted it
//   typing {}                      I am writing a chat message
//   lead  { slug, k, f }           where the host is: page, section k, fraction f through it
//   host  { d }                    a signed command from the host (host.js): rules or mute
//   refused { why }                you may not be in this session ('removed' or 'locked')
//
// receive() returns { type, ... }: 'join' (a hello, with answerState/answerChat when I should send
// the newcomer the picture/the chat), 'name', 'chat', 'hist', 'state', 'click', 'app', 'leave', or null.
export const LIMITS = { name: 24, text: 500, chat: 200 };

export const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, LIMITS.name);
const cleanText = s => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, LIMITS.text);
const cleanSlug = s => (typeof s === 'string' && /^[a-z0-9-]{1,40}$/.test(s) ? s : '');
const isId = s => typeof s === 'string' && s.length > 0 && s.length <= 40;

// a random join token: 10 letters and digits (about 52 bits)
export function newToken(rand = n => crypto.getRandomValues(new Uint8Array(n))) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(rand(10), b => abc[b % abc.length]).join('');
}
export const validToken = t => typeof t === 'string' && /^[a-z0-9]{6,32}$/.test(t);

export function createSession({ self, name = '', slug = '', since = 0, send = () => {}, extra = () => ({}) }) {
  const members = new Map(), chat = [], seen = new Set(), blocked = new Set();
  let me = { id: self, name: cleanName(name), slug, since, mic: false, muted: false };

  // the browser that has been on a page longest answers for it (ties: the smaller id)
  const older = (a, b) => a.since < b.since || (a.since === b.since && a.id < b.id);
  function longest(except, onSlug) {
    let best = null;
    for (const m of [me, ...members.values()]) {
      if (m.id === except || (onSlug !== undefined && m.slug !== onSlug)) continue;
      if (!best || older(m, best)) best = m;
    }
    return best;
  }
  function add(m) {
    if (!m || seen.has(m.id)) return false;
    seen.add(m.id); chat.push(m); chat.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    while (chat.length > LIMITS.chat) seen.delete(chat.shift().id);
    return true;
  }
  function message(raw, from) {
    if (!raw || typeof raw !== 'object' || !isId(raw.id)) return null;
    const text = cleanText(raw.text); if (!text) return null;
    const at = Number.isFinite(raw.at) ? raw.at : Date.now();
    return { id: raw.id.slice(0, 40), from, name: cleanName(raw.name) || 'Someone', text, at };
  }
  // extra(): what index.js adds to my hello (pid, the host key, the newest signed rules)
  const hello = () => ({ t: 'hi', name: me.name, slug: me.slug, since: me.since, mic: me.mic, muted: me.muted, ...extra() });

  return {
    members, chat,
    get me() { return me; },
    joined(id) { send(hello(), id); },
    left(id) { const m = members.get(id); members.delete(id); return m ? { type: 'leave', member: m } : null; },
    rename(n) { me.name = cleanName(n); send({ t: 'name', name: me.name }); },
    setMic(on, muted = false) { me.mic = !!on; me.muted = me.mic && !!muted; send({ t: 'mic', on: me.mic, muted: me.muted }); },
    say(text) {
      const m = { id: self + '.' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), from: self, name: me.name, text: cleanText(text), at: Date.now() };
      if (!m.text) return null;
      add(m); send({ t: 'chat', m: { id: m.id, name: m.name, text: m.text, at: m.at } });
      return m;
    },
    receive(msg, from) {
      if (!msg || typeof msg !== 'object' || !isId(from) || from === self || blocked.has(from)) return null;
      switch (msg.t) {
        case 'hi': {
          const m = { id: from, name: cleanName(msg.name) || 'Someone', slug: cleanSlug(msg.slug), since: Number.isFinite(msg.since) ? msg.since : Date.now(), mic: msg.mic === true, muted: msg.muted === true,
            pid: typeof msg.pid === 'string' ? msg.pid.slice(0, 40) : from, hk: typeof msg.hk === 'string' && msg.hk.length < 200 ? msg.hk : '' };
          const isNew = !members.has(from); members.set(from, m);
          // answer only someone who arrived after me: they get my picture (same page) and the chat
          const page = longest(from, m.slug), all = longest(from);
          return { type: 'join', member: m, isNew, rules: msg.rules && typeof msg.rules === 'object' ? msg.rules : null,
            answerState: !!m.slug && m.slug === me.slug && page?.id === self && older(me, m),
            answerChat: all?.id === self && older(me, m) && chat.length > 0 };
        }
        case 'name': { const m = members.get(from); if (!m) return null; m.name = cleanName(msg.name) || m.name; return { type: 'name', member: m }; }
        case 'chat': { const m = message(msg.m, from); return m && add(m) ? { type: 'chat', message: m } : null; }
        case 'hist': {
          if (!Array.isArray(msg.msgs)) return null;
          const fresh = msg.msgs.slice(-LIMITS.chat).map(r => message(r, typeof r?.from === 'string' ? r.from : from)).filter(m => m && add(m));
          return fresh.length ? { type: 'hist', messages: fresh } : null;
        }
        case 'state': return msg.slug === me.slug && msg.s && typeof msg.s === 'object' ? { type: 'state', state: msg.s, from } : null;
        case 'click': return msg.slug === me.slug && Number.isInteger(msg.i) && msg.i >= 0 && msg.i < 10000 ? { type: 'click', index: msg.i, from } : null;
        case 'typing': { const m = members.get(from); return m ? { type: 'typing', member: m } : null; }
        case 'mic': { const m = members.get(from); if (!m) return null; const was = m.mic; m.mic = msg.on === true; m.muted = m.mic && msg.muted === true; return { type: 'mic', member: m, changed: was !== m.mic }; }
        case 'where': return { type: 'where', from };
        case 'lead': return Number.isInteger(msg.k) && msg.k >= 0 && msg.k < 500 && Number.isFinite(msg.f) && (msg.slug === '' || cleanSlug(msg.slug)) ? { type: 'lead', slug: msg.slug, k: msg.k, f: Math.max(0, Math.min(1, msg.f)), from } : null;
        case 'host': return msg.d && typeof msg.d === 'object' ? { type: 'host', data: msg.d, from } : null;
        case 'refused': return { type: 'refused', why: msg.why === 'locked' ? 'locked' : 'removed', from };
        case 'app': return msg.slug === me.slug && msg.d !== undefined && members.has(from) ? { type: 'app', data: msg.d, from } : null;
        default: return null;
      }
    },
    history: () => chat.slice(-50),
    member: id => members.get(id),
    // stop listening to someone (removed by the host, or not let in)
    block(id) { blocked.add(id); const m = members.get(id); members.delete(id); return m; },
    blocked: id => blocked.has(id),
    // the others on a page, oldest first
    on: page => [...members.values()].filter(m => m.slug === page).sort((a, b) => (older(a, b) ? -1 : 1)),
  };
}
