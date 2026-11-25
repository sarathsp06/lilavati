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
let myName = cleanName(localStorage.getItem(NAME)) || 'Guest ' + (100 + Math.floor(Math.random() * 900));
let session = null, room = null, sendRaw = null, unread = 0, status = '';

// ---------- the button and the panel ----------
const button = el('button', { type: 'button', className: 'together-btn', title: 'Explore this page with other people' });
const panel = el('aside', { className: 'together', hidden: true });
panel.setAttribute('aria-label', 'Together');
document.body.append(panel);
const spot = $('.topbar a.gh') || $('.home-nav .navlinks a.gh');
spot?.before(button);
button.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) { unread = 0; render(); $('.tg-say input', panel)?.focus(); } else render(); });

const root = new URL(slug ? '../' : './', location.href);
const linkFor = s => { const u = new URL(s ? `${s}/` : '', root); u.search = '?join=' + token; return u.href; };
const inviteLink = () => { const u = new URL(location.href); u.search = '?join=' + token; u.hash = ''; return u.href; };

function render() {
  const n = session ? session.members.size + 1 : 0;
  button.textContent = session ? `Together · ${n}` : 'Invite';
  if (unread && panel.hidden) button.append(el('span', { className: 'badge', textContent: unread }));
  button.classList.toggle('on', !!session);
  if (panel.hidden) return;
  // keep what is being typed (and where) across a redraw
  const typed = {}, focus = panel.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
  for (const i of panel.querySelectorAll('input:not([readonly])')) typed[i.getAttribute('aria-label')] = i.value;
  build();
  for (const i of panel.querySelectorAll('input:not([readonly])')) if (i.getAttribute('aria-label') in typed) i.value = typed[i.getAttribute('aria-label')];
  if (focus) { const f = panel.querySelector(`[aria-label="${focus}"]`); f?.focus(); if (f?.setSelectionRange && f.type !== 'button') f.setSelectionRange(f.value.length, f.value.length); }
}
function build() {
  panel.replaceChildren();
  const close = el('button', { type: 'button', className: 'tg-x', textContent: '×', title: 'Close' });
  close.setAttribute('aria-label', 'Close'); close.onclick = () => { panel.hidden = true; render(); };
  panel.append(el('header', {}, el('strong', { textContent: 'Together' }), close));
  if (!session) {
    if (token) { panel.append(el('p', { textContent: 'Joining…' })); return; }
    const start = el('button', { type: 'button', textContent: 'Start and copy the invite link' });
    start.onclick = async () => { token = newToken(); await connect(); copy(inviteLink(), start); };
    panel.append(el('p', { textContent: 'Explore with friends. Everyone who opens your link can chat, and sees the same picture: when one of you moves something, it moves for all of you.' }), start);
    return;
  }
  // the link
  const link = el('input', { readOnly: true, value: inviteLink() }), cp = el('button', { type: 'button', className: 'outline', textContent: 'Copy' });
  link.setAttribute('aria-label', 'Invite link'); link.onfocus = () => link.select(); cp.onclick = () => copy(inviteLink(), cp);
  panel.append(el('p', { className: 'tg-hint', textContent: 'Anyone with this link can join:' }), el('div', { className: 'tg-row' }, link, cp));
  // people
  const name = el('input', { value: myName, maxLength: 24 });
  name.setAttribute('aria-label', 'Your name');
  name.onchange = () => { myName = cleanName(name.value) || myName; name.value = myName; localStorage.setItem(NAME, myName); session.rename(myName); pageRoom.emit({ type: 'people' }); };
  const people = el('ul', { className: 'tg-people' }, el('li', {}, el('span', { className: 'dot me' }), name, el('span', { className: 'muted', textContent: ' (you)' })));
  for (const m of session.members.values()) {
    const where = m.slug === slug ? el('span', { className: 'muted', textContent: ' here' })
      : el('a', { href: linkFor(m.slug), textContent: m.slug ? ` on ${bySlug[m.slug]?.name || m.slug}` : ' on the home page' });
    people.append(el('li', {}, el('span', { className: 'dot' }), el('span', { textContent: m.name }), where));
  }
  panel.append(people);
  if (status) panel.append(el('p', { className: 'tg-hint', textContent: status }));
  // the chat
  const log = el('div', { className: 'tg-log' });
  log.setAttribute('aria-live', 'polite');
  for (const m of session.chat) log.append(el('p', { className: m.from === session.me.id ? 'mine' : '' }, el('b', { textContent: m.name + ' ' }), el('span', { textContent: m.text })));
  if (!session.chat.length) log.append(el('p', { className: 'muted', textContent: 'No messages yet.' }));
  const say = el('input', { placeholder: 'Say something…', maxLength: 500 }), send = el('button', { type: 'submit', textContent: 'Send' });
  say.setAttribute('aria-label', 'Message');
  const form = el('form', { className: 'tg-say tg-row' }, say, send);
  form.onsubmit = e => { e.preventDefault(); if (session.say(say.value)) { say.value = ''; saveChat(); render(); } };
  const leave = el('button', { type: 'button', className: 'secondary outline tg-leave', textContent: 'Leave' });
  leave.onclick = disconnect;
  panel.append(log, form, leave);
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}
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
  sessionStorage.setItem(KEY, token);
  const u = new URL(location.href); u.searchParams.set('join', token); history.replaceState(history.state, '', u);
  status = 'Looking for the others…'; render();
  const [{ joinRoom, selfId }, ice] = await Promise.all([import('./trystero-nostr.js'), iceServers()]);
  session = createSession({ self: selfId, name: myName, slug, since: Date.now(), send: (msg, to) => sendRaw?.(msg, to) });
  try { session.receive({ t: 'hist', msgs: JSON.parse(sessionStorage.getItem(KEY + '.chat') || '[]') }, '_saved'); } catch {}
  room = joinRoom({ appId: CONFIG.appId, relayUrls: CONFIG.relays, relayRedundancy: CONFIG.relays.length, password: token, ...(ice ? { rtcConfig: { iceServers: ice } } : {}) }, token);
  const [send, receive] = room.makeAction('m');
  sendRaw = (msg, to) => { send(msg, to).catch(() => {}); };
  room.onPeerJoin(id => { status = ''; session.joined(id); });
  room.onPeerLeave(id => { const r = session.left(id); if (r) { toast(`${r.member.name} left`); render(); pageRoom.emit({ type: 'people' }); } });
  receive((msg, from) => handle(session.receive(msg, from), from));
  Object.assign(pageRoom, {
    active: true, self: selfId,
    people: () => session ? [{ id: selfId, name: myName, me: true }, ...session.on(slug).map(m => ({ id: m.id, name: m.name, me: false }))] : [],
    send: (d, to) => { if (session && slug) sendRaw({ t: 'app', slug, d }, to); },
  });
  pageRoom.emit({ type: 'people' });
  render();
  setTimeout(() => { if (session && !session.members.size && status) { status = 'Nobody else is here yet. Send them the link.'; render(); } }, 8000);
}
function disconnect() {
  room?.leave(); room = null; session = null; sendRaw = null; token = null; status = '';
  Object.assign(pageRoom, { active: false, self: '', people: () => [], send() {} }); pageRoom.emit({ type: 'people' });
  sessionStorage.removeItem(KEY); sessionStorage.removeItem(KEY + '.chat');
  const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(history.state, '', u);
  render();
}

function handle(r, from) {
  if (!r) return;
  if (r.type === 'join') {
    if (r.isNew) toast(`${r.member.name} joined${r.member.slug && r.member.slug !== slug ? ' (on another page)' : ''}`);
    if (r.answerState) whenReady(() => sendRaw({ t: 'state', slug, s: snapshot() }, from));
    if (r.answerChat) sendRaw({ t: 'hist', msgs: session.history() }, from);
  }
  if (r.type === 'chat') { saveChat(); if (panel.hidden) { unread++; toast(`${r.message.name}: ${r.message.text}`); } }
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

render();
if (token) connect();
