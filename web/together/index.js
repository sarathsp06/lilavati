// Together: explore a page with other people. You start a session and share its link (?join=<token>);
// everyone who opens it chats in one room and sees the same picture: a slider moved, an arrow dragged
// or a button pressed by one person happens for everyone on that page.
//
// No server of our own (the same approach as Toy City, docs/TOGETHER.md): browsers find each other on
// public Nostr relays over WebSocket (Trystero), then talk directly over WebRTC data channels. A tiny
// Cloudflare Worker hands out TURN relay credentials for networks that block direct connections.
//
// What is shared on a page: every input, select and textarea in <main> (by position), clicks on its
// buttons and preset links, and what the page gives share() (share.js). Mark anything that must stay
// personal with data-local (copy buttons, sound). Loaded by concepts.js on every page.
import { createSession, newToken, validToken, cleanName } from './session.js';
import { createVoice } from './voice.js';
import { hasHost, tagOfToken, makeHost, signer, verify, newCode, validCode, cleanRules, refusal } from './host.js';
import { hooks, room as pageRoom } from './share.js';
import { bySlug } from '../concepts.js';

const CONFIG = {
  appId: 'lilavati',
  // the same relays as Toy City (checked there 2026-11-20); everyone in a session must use the same list
  relays: ['wss://relay.primal.net', 'wss://nostr.data.haus', 'wss://nos.lol', 'wss://nostr.sathoarder.com', 'wss://yabu.me/v2'],
  iceUrl: 'https://toycity-turn.sarathsp.workers.dev/',
  iceTimeout: 3000,
  sendEvery: 80,          // ms between state updates while dragging
};
const KEY = 'lilavati.join', NAME = 'lilavati.name';
const slug = document.body.dataset.concept || '';      // '' on the home page: chat only
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

let token = new URLSearchParams(location.search).get('join');
token = validToken(token) ? token : validToken(sessionStorage.getItem(KEY)) ? sessionStorage.getItem(KEY) : null;
if (token && sessionStorage.getItem(KEY + '.out') === token) token = null;   // removed from it in this tab
let myName = cleanName(localStorage.getItem(NAME)) || 'Guest ' + (100 + Math.floor(Math.random() * 900));
let session = null, room = null, sendRaw = null, unread = 0, status = '', farewell = '';
// the join code: in the link (?code=, only if the host shared it that way), else typed in, kept for this tab
let code = new URLSearchParams(location.search).get('code') || sessionStorage.getItem(KEY + '.code') || '';
if (!validCode(code)) code = '';
// me, for this browser tab: survives moving between pages (the connection id does not)
const pid = sessionStorage.getItem(KEY + '.pid') || Math.random().toString(36).slice(2, 12);
sessionStorage.setItem(KEY + '.pid', pid);
// the host: who started the session; only their tab holds the private key (host.js)
let host = null, sign = null, rules = null, rulesSigned = null, lastMute = 0;
try { const h = JSON.parse(sessionStorage.getItem(KEY + '.host') || 'null'); if (h && token && h.tag === tagOfToken(token)) host = h; } catch {}
const amHost = () => !!host && !!token && host.tag === tagOfToken(token);

// ---------- the button and the panel ----------
const button = el('button', { type: 'button', className: 'together-btn', title: 'Explore this page with other people' });
const panel = el('aside', { className: 'together', hidden: true });
panel.setAttribute('aria-label', 'Together');
document.body.append(panel);
const spot = $('.topbar a.gh') || $('.home-nav .navlinks a.gh');
spot?.before(button);
button.addEventListener('click', () => { panel.hidden = !panel.hidden; if (session) sessionStorage.setItem(KEY + '.collapsed', panel.hidden ? '1' : '0'); if (!panel.hidden) { unread = 0; render(); $('.tg-say input', panel)?.focus(); } else render(); });

const root = new URL(slug ? '../' : './', location.href);
const linkFor = s => { const u = new URL(s ? `${s}/` : '', root); u.search = '?join=' + token; return u.href; };
const inviteLink = () => { const u = new URL(location.href); u.search = '?join=' + token; u.hash = ''; return u.href; };

function render() {
  const n = session ? session.members.size + 1 : 0;
  button.textContent = session ? `${voice?.on ? '🎤' : '💬'} Together · ${n}` : 'Invite';
  if (unread && panel.hidden) button.append(el('span', { className: 'badge', textContent: unread }));
  button.classList.toggle('on', !!session);
  // in a session the panel is a column on the right of the page (a sheet at the bottom on phones)
  const docked = !!session && !panel.hidden;
  if (document.body.classList.contains('tg-docked') !== docked) { document.body.classList.toggle('tg-docked', docked); requestAnimationFrame(() => dispatchEvent(new Event('resize'))); }
  if (panel.hidden) return;
  // keep what is being typed (and where) across a redraw
  const typed = {}, focus = panel.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
  for (const i of panel.querySelectorAll('input:not([readonly])')) typed[i.getAttribute('aria-label')] = i.value;
  build();
  for (const i of panel.querySelectorAll('input:not([readonly])')) if (i.getAttribute('aria-label') in typed) i.value = typed[i.getAttribute('aria-label')];
  if (focus) { const f = panel.querySelector(`[aria-label="${focus}"]`); f?.focus(); if (f?.setSelectionRange && f.type !== 'button') f.setSelectionRange(f.value.length, f.value.length); }
}
// a person as a round badge with their initials; it pulses while they talk
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#b91c1c', '#4f46e5'];
const colorOf = id => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = n => (n.match(/\p{L}|\d/gu) || ['?']).slice(0, 1).concat((n.split(/\s+/)[1] || '').match(/\p{L}|\d/u) || []).join('').toUpperCase();
function badge(id, name, key = id) { const b = el('span', { className: 'tg-face', textContent: initials(name) }); b.style.background = colorOf(id); b.dataset.voice = key; return b; }
const typing = new Map();   // id -> until (ms)
let invOpen = null;          // the invite section, opened or closed by hand (null: open while alone)

function build() {
  panel.replaceChildren();
  panel.classList.toggle('big', !!session);
  const close = el('button', { type: 'button', className: 'tg-x', textContent: '×', title: 'Close' });
  close.setAttribute('aria-label', 'Close'); close.onclick = () => { panel.hidden = true; if (session) sessionStorage.setItem(KEY + '.collapsed', '1'); render(); };
  if (session) { close.textContent = '»'; close.title = 'Hide the panel (the Together button brings it back)'; close.setAttribute('aria-label', 'Hide'); }
  const n = session ? session.members.size + 1 : 0;
  panel.append(el('header', {}, el('strong', { textContent: session ? `Together · ${n} ${n === 1 ? 'person' : 'people'}` : 'Together' }), close));
  if (!session) {
    if (farewell) panel.append(el('p', { className: 'tg-farewell', textContent: farewell }));
    if (token && hasHost(token) && !code) {
      // the link has no code: ask for it
      const inp = el('input', { inputMode: 'numeric', maxLength: 6, placeholder: '6 digits', autocomplete: 'off' }), go = el('button', { type: 'submit', textContent: 'Join' });
      inp.setAttribute('aria-label', 'Join code');
      const f = el('form', { className: 'tg-row' }, inp, go);
      f.onsubmit = e => { e.preventDefault(); const c = inp.value.replace(/\D/g, ''); if (!validCode(c)) { inp.setCustomValidity('Six digits'); inp.reportValidity(); return; } code = c; connect(); };
      panel.append(el('p', { textContent: "You've been invited to explore together. Enter the join code the host gave you:" }), f);
      requestAnimationFrame(() => inp.focus());
      return;
    }
    if (token) { panel.append(el('p', { textContent: 'Joining…' })); return; }
    const start = el('button', { type: 'button', textContent: 'Start a session' });
    start.onclick = async () => { farewell = ''; host = await makeHost(); token = newToken() + host.tag; code = newCode(); sessionStorage.setItem(KEY + '.host', JSON.stringify(host)); await connect(); };
    panel.append(el('p', { textContent: "Explore with friends. You'll be the host: you get a link and a join code to give people, and you can mute people, remove them, or lock the session. Everyone in it can chat and talk, and sees the same picture." }), start);
    return;
  }
  const section = (title, ...kids) => el('section', { className: 'tg-sec' }, ...(title ? [el('h5', { textContent: title })] : []), ...kids);
  if (status) panel.append(el('p', { className: 'tg-hint tg-status', textContent: status }));

  // voice: the first thing you see, so everyone knows they can talk
  const vbox = el('div', { className: 'tg-voice' });
  if (!voice?.on) {
    const b = el('button', { type: 'button', className: 'tg-join', textContent: '🎤 Join voice' }); b.onclick = startVoice;
    const talking = [...session.members.values()].filter(m => m.mic).map(m => m.name);
    vbox.append(b, el('p', { className: 'tg-hint', textContent: talking.length ? `${talking.join(', ')} ${talking.length === 1 ? 'is' : 'are'} talking. Join to hear and talk; your browser asks for the microphone.` : 'Talk instead of typing. Your browser will ask to use your microphone.' }));
  } else {
    const mute = el('button', { type: 'button', className: voice.muted ? 'tg-muted' : 'outline', textContent: voice.muted ? '🔇 Unmute' : '🎤 Mute' });
    mute.onclick = () => { voice.mute(!voice.muted); session.setMic(true, voice.muted); render(); };
    const off = el('button', { type: 'button', className: 'secondary outline', textContent: 'Leave voice' }); off.onclick = stopVoice;
    const pick = el('select'); pick.setAttribute('aria-label', 'Microphone');
    pick.append(new Option('Default microphone', ''));
    voice.devices().then(ds => { for (const d of ds) if (d.deviceId && d.deviceId !== 'default') pick.append(new Option(d.label || 'Microphone', d.deviceId)); pick.value = voice.device; });
    pick.onchange = async () => { await voice.use(pick.value); render(); };
    vbox.append(el('div', { className: 'tg-row' }, mute, off), el('label', { className: 'tg-mic' }, 'Microphone', pick),
      el('p', { className: 'tg-hint', textContent: voice.muted ? 'You are muted: the others can’t hear you.' : 'You’re on voice: everyone in the session hears you.' }));
  }
  if (voice?.blocked) { const s = el('button', { type: 'button', className: 'tg-sound', textContent: '🔈 Tap to hear the others' }); s.onclick = () => voice.unblock?.(); vbox.append(s); }
  panel.append(section('', vbox));

  // people: one row each, with what they are doing
  const name = el('input', { value: myName, maxLength: 24 });
  name.setAttribute('aria-label', 'Your name'); name.title = 'Your name: click to change it';
  name.onchange = () => { myName = cleanName(name.value) || myName; name.value = myName; localStorage.setItem(NAME, myName); session.rename(myName); pageRoom.emit({ type: 'people' }); render(); };
  const people = el('ul', { className: 'tg-people' },
    el('li', { className: 'me' }, badge(session.me.id, myName, 'me'), el('div', { className: 'tg-who' }, name,
      el('small', { textContent: [amHost() ? '👑 host' : '', 'you', voice?.on ? (voice.muted ? '🔇 muted' : '🎤 on voice') : ''].filter(Boolean).join(' · ') }))));
  for (const m of session.members.values()) {
    const where = m.slug === slug ? 'here' : null;
    const bits = [rules?.host && m.pid === rules.host ? '👑 host' : '', (typing.get(m.id) || 0) > Date.now() ? '✍️ typing…' : '', m.mic ? (m.muted ? '🔇 muted' : voice?.hears(m.id) ? '🎤 on voice' : '🎤 connecting…') : ''].filter(Boolean);
    const info = el('small', { textContent: bits.join(' · ') });
    if (!where) info.append(bits.length ? ' · ' : '', el('a', { href: linkFor(m.slug), textContent: m.slug ? `on ${bySlug[m.slug]?.name || m.slug}` : 'on the home page' }));
    const tools = [];
    if (amHost()) {
      if (m.mic && !m.muted) { const b = el('button', { type: 'button', className: 'tg-mini', textContent: 'mute' }); b.onclick = () => hostMute(m); tools.push(b); }
      const k = el('button', { type: 'button', className: 'tg-mini danger', textContent: 'remove' }); k.onclick = () => { if (confirm(`Remove ${m.name} from this session?`)) setRules({ banned: [...(rules?.banned || []), m.pid], allow: (rules?.allow || []).filter(x => x !== m.pid) }); }; tools.push(k);
    }
    people.append(el('li', {}, badge(m.id, m.name), el('div', { className: 'tg-who' }, el('span', { textContent: m.name }), info), ...(tools.length ? [el('span', { className: 'tg-tools' }, ...tools)] : [])));
  }
  panel.append(section(`People · ${n}`, people));

  // the chat, as speech bubbles
  const log = el('div', { className: 'tg-log' });
  log.setAttribute('aria-live', 'polite');
  for (const m of session.chat) {
    const me = m.from === session.me.id;
    log.append(el('div', { className: 'tg-msg' + (me ? ' mine' : '') }, ...(me ? [] : [badge(m.from, m.name)]), el('p', {}, ...(me ? [] : [el('b', { textContent: m.name })]), el('span', { textContent: m.text }))));
  }
  if (!session.chat.length) log.append(el('p', { className: 'muted tg-empty', textContent: session.members.size ? 'Say hello 👋' : 'Nobody else is here yet. Send them the invite link below.' }));
  const say = el('input', { placeholder: 'Message everyone…', maxLength: 500 }), send = el('button', { type: 'submit', textContent: 'Send' });
  say.setAttribute('aria-label', 'Message');
  let lastTyped = 0;
  say.oninput = () => { if (Date.now() - lastTyped > 2500 && say.value) { lastTyped = Date.now(); sendRaw?.({ t: 'typing' }); } };
  const form = el('form', { className: 'tg-say tg-row' }, say, send);
  form.onsubmit = e => { e.preventDefault(); if (session.say(say.value)) { say.value = ''; saveChat(); render(); } };
  panel.append(el('section', { className: 'tg-sec tg-chat' }, el('h5', { textContent: 'Chat' }), log, form));

  // inviting, the host's switches, following, leaving: at the bottom, folded once others are here
  const inv = el('details', { className: 'tg-sec tg-invite', open: invOpen ?? !session.members.size });
  inv.ontoggle = () => { invOpen = inv.open; };
  inv.append(el('summary', { textContent: 'Invite people and settings' }));
  const link = el('input', { readOnly: true, value: inviteLink() }), cp = el('button', { type: 'button', className: 'outline', textContent: 'Copy link' });
  link.setAttribute('aria-label', 'Invite link'); link.onfocus = () => link.select(); cp.onclick = () => copy(inviteLink(), cp);
  inv.append(el('div', { className: 'tg-row' }, link, cp));
  if (hasHost(token)) {
    const both = el('button', { type: 'button', className: 'tg-mini', textContent: 'copy link with code' }); both.onclick = () => copy(inviteLink() + '&code=' + code, both);
    inv.append(el('p', { className: 'tg-code' }, 'Join code ', el('b', { textContent: code.slice(0, 3) + ' ' + code.slice(3) }), ' ', both));
    if (amHost()) {
      const lock = el('button', { type: 'button', className: 'tg-mini' + (rules?.locked ? ' on' : ''), textContent: rules?.locked ? '🔒 locked: nobody new can join' : '🔓 lock the session' });
      lock.onclick = () => setRules({ locked: !rules?.locked, allow: rules?.locked ? [] : [pid, ...[...session.members.values()].map(m => m.pid)] });
      inv.append(el('p', { className: 'tg-hint' }, '👑 You are the host. Everyone following you goes where you go. ', lock));
    } else {
      if (rules?.locked) inv.append(el('p', { className: 'tg-hint', textContent: '🔒 The host has locked this session.' }));
      if (rules?.host) {
        const f = el('button', { type: 'button', className: 'tg-mini' + (following ? ' on' : ''), textContent: following ? '👀 following the host' : 'follow the host' });
        f.title = 'Go to the page the host is on and scroll with them';
        f.onclick = () => { following = !following; sessionStorage.setItem(KEY + '.follow', following ? '1' : '0'); if (following) sendRaw?.({ t: 'where' }); render(); };
        inv.append(el('p', { className: 'tg-hint' }, f));
      }
    }
  }
  const leave = el('button', { type: 'button', className: 'secondary outline tg-leave', textContent: 'Leave session' });
  leave.onclick = disconnect;
  inv.append(leave);
  panel.append(inv);
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}

// ---------- voice ----------
let voice = null;
async function startVoice() {
  if (!voice) return;
  const ok = await voice.start();
  if (!ok) { status = 'Could not use your microphone. Check that this site may use it.'; render(); return; }
  session.setMic(true); render();
}
function stopVoice() { voice?.stop(); session?.setMic(false); render(); }
// the rings: how loud each person is, measured 12 times a second; a ring fades over about half a
// second, so even a short word shows
const loud = new Map();
setInterval(() => {
  if (!voice || !session) return;
  for (const id of ['me', ...session.members.keys()]) loud.set(id, Math.max(voice.level(id), (loud.get(id) || 0) * 0.8));
  for (const f of document.querySelectorAll('.tg-face[data-voice]')) {
    const l = loud.get(f.dataset.voice) || 0;
    f.classList.toggle('speaking', l > 0.08); f.style.setProperty('--ring', `${Math.round(3 + l * 9)}px`);
  }
  button.classList.toggle('speaking', [...session.members.keys()].some(id => (loud.get(id) || 0) > 0.08));
}, 80);

async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1400); }
  catch { prompt('Copy this link:', text); }
}
function toast(text) {
  const t = el('div', { className: 'tg-toast', textContent: text });
  document.body.append(t); setTimeout(() => t.remove(), 3500);
}
const saveChat = () => { try { sessionStorage.setItem(KEY + '.chat', JSON.stringify(session.history())); } catch {} };

// ---------- the network ----------
async function iceServers() {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), CONFIG.iceTimeout);
  try {
    const r = await fetch(CONFIG.iceUrl, { signal: ac.signal }); if (!r.ok) return null;
    const d = await r.json();
    // only a few relay addresses: each is tried before an offer goes out, so a long list is slow
    return d?.iceServers?.map(s => ({ ...s, urls: [].concat(s.urls).filter(u => /^stun:.*:3478$|^turn:.*:3478\?transport=udp$|^turns:.*:443\?transport=tcp$/.test(u)) })) || null;
  } catch { return null; } finally { clearTimeout(t); }
}

async function connect() {
  sessionStorage.setItem(KEY, token); if (code) sessionStorage.setItem(KEY + '.code', code);
  // the address bar keeps the link without the code
  const u = new URL(location.href); u.searchParams.set('join', token); u.searchParams.delete('code'); history.replaceState(history.state, '', u);
  if (amHost()) {
    sign = await signer(token, host.jwk);
    if (!rules) { rulesSigned = await sign({ k: 'rules', v: 1, host: pid, pub: host.pub, locked: false, allow: [], banned: [] }); rules = { ...cleanRules(rulesSigned), host: pid }; }
  }
  status = 'Looking for the others…'; render();
  const [{ joinRoom, selfId }, ice] = await Promise.all([import('./trystero-nostr.js'), iceServers()]);
  session = createSession({ self: selfId, name: myName, slug, since: Date.now(), send: (msg, to) => sendRaw?.(msg, to), extra: () => ({ pid, ...(rulesSigned ? { rules: rulesSigned } : {}) }) });
  try { session.receive({ t: 'hist', msgs: JSON.parse(sessionStorage.getItem(KEY + '.chat') || '[]') }, '_saved'); } catch {}
  room = joinRoom({ appId: CONFIG.appId, relayUrls: CONFIG.relays, relayRedundancy: CONFIG.relays.length, password: hasHost(token) ? token + ':' + code : token, ...(ice ? { rtcConfig: { iceServers: ice } } : {}) }, token);
  const [send, receive] = room.makeAction('m');
  sendRaw = (msg, to) => { send(msg, to).catch(() => {}); };
  voice = createVoice(room, { onChange: () => render() });
  voice.unblock = () => dispatchEvent(new Event('pointerdown'));
  room.onPeerJoin(id => { if (!session) return; status = ''; session.joined(id); voice.joined(id); });
  room.onPeerLeave(id => { if (!session) return; voice?.left(id); const r = session.left(id); if (r) { toast(`${r.member.name} left`); render(); pageRoom.emit({ type: 'people' }); } });
  receive((msg, from) => { if (session) handle(session.receive(msg, from), from); });
  Object.assign(pageRoom, {
    active: true, self: selfId,
    people: () => session ? [{ id: selfId, name: myName, me: true }, ...session.on(slug).map(m => ({ id: m.id, name: m.name, me: false }))] : [],
    send: (d, to) => { if (session && slug) sendRaw({ t: 'app', slug, d }, to); },
  });
  pageRoom.emit({ type: 'people' });
  panel.hidden = sessionStorage.getItem(KEY + '.collapsed') === '1';
  render();
  // while nobody else is here, say whether the meeting points (Nostr relays) can be reached at all
  const relays = (await import('./trystero-nostr.js')).getRelaySockets;
  setTimeout(() => {
    if (!session || session.members.size || !status) return;
    const open = Object.values(relays()).filter(s => s.readyState === 1).length;
    status = open === 0 ? "Can't reach the meeting servers. Your network, a VPN or a blocker may be stopping them; try another network."
      : hasHost(token) && !amHost() ? 'Nobody found yet. If the host is online, check the join code with them.' : 'Nobody else is here yet. Send them the link and the code.';
    render();
  }, 10000);
}
// ---------- the host ----------
async function setRules(change) {
  if (!amHost() || !sign) return;
  const next = { k: 'rules', v: (rules?.v || 0) + 1, host: pid, pub: host.pub, locked: false, allow: [], banned: [], ...(rules ? { locked: rules.locked, allow: rules.allow, banned: rules.banned } : {}), ...change };
  rulesSigned = await sign(next); rules = { ...cleanRules(rulesSigned), host: pid };
  sendRaw?.({ t: 'host', d: rulesSigned }); enforce(); render();
}
async function hostMute(m) { if (!sign) return; sendRaw?.({ t: 'host', d: await sign({ k: 'mute', pid: m.pid, pub: host.pub, at: Date.now() }) }, m.id); toast(`You muted ${m.name}`); }
// a signed command from the host, perhaps passed on by someone else
async function fromHost(cmd) {
  if (!cmd || !(await verify(token, cmd.pub, cmd))) return;
  if (cmd.k === 'rules') {
    const c = { ...cleanRules(cmd), host: typeof cmd.host === 'string' ? cmd.host : '' };
    if (rules && c.v <= rules.v) return;
    rules = c; rulesSigned = cmd; enforce(); render();
  } else if (cmd.k === 'mute' && cmd.pid === pid && Number.isFinite(cmd.at) && cmd.at > lastMute) {
    lastMute = cmd.at;
    if (voice?.on && !voice.muted) { voice.mute(true); session?.setMic(true, true); toast('The host muted you. You can unmute yourself.'); render(); }
  }
}
// apply the rules: leave if they exclude me; stop listening to anyone they exclude
function enforce() {
  if (!session || !rules) return;
  const why = refusal(rules, pid);
  if (why) {
    const t = token;
    disconnect();
    farewell = why === 'removed' ? 'The host removed you from this session.' : 'This session is locked: the host is not letting anyone new in.';
    sessionStorage.setItem(KEY + '.out', t); panel.hidden = false; render(); return;
  }
  for (const m of [...session.members.values()]) if (refusal(rules, m.pid)) { voice?.left(m.id); session.block(m.id); if (amHost()) toast(`${m.name} ${rules.banned.includes(m.pid) ? 'was removed' : 'can’t join: locked'}`); }
  pageRoom.emit({ type: 'people' });
}

function disconnect() {
  voice?.close(); voice = null;
  room?.leave(); room = null; session = null; sendRaw = null; token = null; status = '';
  Object.assign(pageRoom, { active: false, self: '', people: () => [], send() {} }); pageRoom.emit({ type: 'people' });
  for (const k of ['', '.chat', '.code', '.host', '.collapsed']) sessionStorage.removeItem(KEY + k);
  host = null; sign = null; rules = null; rulesSigned = null; code = '';
  const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(history.state, '', u);
  render();
}

// ---------- follow the host: their page and where they are on it ----------
// The host sends where they are (page, the section at the top of their screen and how far through it)
// as they scroll; followers go there. Sections, not pixels, so a phone follows a wide screen.
let following = sessionStorage.getItem(KEY + '.follow') !== '0';
const TOPBAR = 70;
const anchors = () => [...document.querySelectorAll('main > header, main > section, main .step, main nav.home-nav ~ *')];
function where() {
  const a = anchors(); let k = 0;
  for (let i = 0; i < a.length; i++) if (a[i].getBoundingClientRect().top <= TOPBAR + 1) k = i;
  const r = a[k]?.getBoundingClientRect();
  return { k, f: r && r.height ? Math.max(0, Math.min(1, (TOPBAR - r.top) / r.height)) : 0 };
}
let leadT = null;
function lead(to) {
  if (!amHost() || !session) return;
  clearTimeout(leadT);
  leadT = setTimeout(() => { const w = where(); sendRaw?.({ t: 'lead', slug, k: w.k, f: Math.round(w.f * 1000) / 1000 }, to); }, to ? 0 : 120);
}
addEventListener('scroll', () => lead(), { passive: true });
function follow(m, from) {
  if (!following || amHost() || !rules?.host || session.member(from)?.pid !== rules.host) return;
  if (m.slug !== slug) {   // the host went to another page: go there too
    if (m.slug === '' || bySlug[m.slug]?.status === 'live') { toast('Following the host…'); location.href = linkFor(m.slug); }
    return;
  }
  const a = anchors()[m.k]; if (!a) return;
  const r = a.getBoundingClientRect();
  scrollTo({ top: Math.max(0, r.top + scrollY + m.f * r.height - TOPBAR), behavior: Math.abs(r.top - TOPBAR) > innerHeight * 2 ? 'auto' : 'smooth' });
}

function handle(r, from) {
  if (!r) return;
  if (r.type === 'lead') { follow(r, from); return; }
  if (r.type === 'where') { if (amHost()) lead(from); return; }
  if (r.type === 'host') { fromHost(r.data); return; }
  if (r.type === 'join') {
    if (r.rules) fromHost(r.rules);
    if (rules && refusal(rules, r.member.pid)) { voice?.left(from); session.block(from); return; }
    if (r.isNew) toast(`${r.member.name} joined${r.member.slug && r.member.slug !== slug ? ' (on another page)' : ''}`);
    if (r.answerState) whenReady(() => sendRaw({ t: 'state', slug, s: snapshot() }, from));
    if (r.answerChat) sendRaw({ t: 'hist', msgs: session.history() }, from);
    if (amHost()) lead(from);   // a newcomer (or someone arriving on a new page) learns where the host is
  }
  if (r.type === 'chat') { typing.delete(from); saveChat(); if (panel.hidden) { unread++; toast(`${r.message.name}: ${r.message.text}`); } }
  if (r.type === 'typing') { typing.set(from, Date.now() + 4000); setTimeout(render, 4100); }
  if (r.type === 'mic') { if (!r.member.mic) voice?.silent(from); if (r.changed) toast(`${r.member.name} ${r.member.mic ? 'joined' : 'left'} voice`); }
  if (r.type === 'hist') saveChat();
  if (r.type === 'state') whenReady(() => applyState(r.state));
  if (r.type === 'click') whenReady(() => replayClick(r.index));
  if (r.type === 'app') whenReady(() => pageRoom.emit({ type: 'message', data: r.data, from }));
  if (r.type === 'join' || r.type === 'leave' || r.type === 'name') pageRoom.emit({ type: 'people' });
  if (r.type !== 'state' && r.type !== 'click' && r.type !== 'app') render();
}

// ---------- the page: what is shared and how ----------
const outside = e => !e || e.closest('.together, [data-local]') || !e.closest('main');
const controls = () => slug ? [...document.querySelectorAll('main input, main select, main textarea')].filter(e => !outside(e) && e.type !== 'file') : [];
const CLICKABLE = 'button, a[data-preset]';
const clickables = () => slug ? [...document.querySelectorAll('main button, main a[data-preset]')].filter(e => !outside(e)) : [];
const isBox = e => e.type === 'checkbox' || e.type === 'radio';
const round = (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);

let pending = [];
function whenReady(f) { if (hooks.ready) f(); else pending.push(f); }
hooks.onReady = () => { const p = pending; pending = []; for (const f of p) f(); lastSent = JSON.stringify(snapshot(), round); };

function snapshot() {
  return { v: controls().map(e => (isBox(e) ? e.checked : e.value)), p: hooks.get ? hooks.get() : null };
}
let lastSent = '', timer = null, lastAt = 0, dragging = false;
function push() {
  if (!session || !slug || !hooks.ready) return;
  const s = snapshot(), json = JSON.stringify(s, round);
  if (json === lastSent) return;
  lastSent = json; sendRaw({ t: 'state', slug, s: JSON.parse(json) });
}
function schedule() {
  if (!session || timer) return;
  timer = setTimeout(() => { timer = null; lastAt = performance.now(); push(); }, Math.max(0, CONFIG.sendEvery - (performance.now() - lastAt)));
}
function applyState(s) {
  const els = controls();
  if (Array.isArray(s.v)) s.v.forEach((val, i) => {
    const e = els[i]; if (!e || (typeof val !== 'string' && typeof val !== 'boolean')) return;
    if (isBox(e) ? e.checked === !!val : e.value === String(val)) return;
    if (isBox(e)) e.checked = !!val; else e.value = String(val);
    // the page reacts as if the person had done it here (these events are not trusted, so not sent on)
    e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (s.p != null && hooks.set) { try { hooks.set(s.p); } catch (err) { console.warn('[together] could not apply the shared state', err); } }
  lastSent = JSON.stringify(snapshot(), round);
}
function replayClick(i) {
  const e = clickables()[i]; if (!e || e.disabled) return;
  // a "Try this" button scrolls its own page up to the picture; it must not scroll anybody else's
  const scroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = () => {};
  try { e.click(); } finally { Element.prototype.scrollIntoView = scroll; }
  lastSent = JSON.stringify(snapshot(), round);
}

// only what a person did here is sent (isTrusted): changes that arrive are applied without echoing back
for (const type of ['input', 'change']) document.addEventListener(type, e => { if (e.isTrusted && !outside(e.target)) schedule(); }, true);
document.addEventListener('pointerdown', e => { if (e.isTrusted && e.target instanceof HTMLCanvasElement && !outside(e.target)) dragging = true; }, true);
document.addEventListener('pointermove', e => { if (dragging && e.isTrusted) schedule(); }, true);
for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, e => { if (dragging && e.isTrusted) { dragging = false; schedule(); } }, true);
document.addEventListener('click', e => {
  if (!session || !e.isTrusted) return;
  const b = e.target.closest?.(CLICKABLE); if (!b || outside(b)) return;
  const i = clickables().indexOf(b);
  if (i >= 0) sendRaw({ t: 'click', slug, i });
}, true);

window.__together = { get voice() { return voice; }, get session() { return session; }, get rules() { return rules; }, get following() { return following; }, get amHost() { return amHost(); }, pid };   // for tests and debugging
render();
if (token && (!hasHost(token) || code)) connect();
else if (token) { panel.hidden = false; render(); }   // invited: ask for the code
