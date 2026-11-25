// Voice for Together: my microphone to everyone in the session, and theirs to me, over the same
// WebRTC connections as the chat (Trystero room.addStream). Everyone sends to everyone, so it suits
// a handful of people (about 6 to 8); a bigger group would need a voice server.
//
// Lessons from Toy City's voice (web/mp/voice.js there): a stream can arrive before its audio track;
// Chrome only plays WebRTC audio reliably through a media element; a browser may refuse to play sound
// until the person has clicked something here, so that is reported (blocked) and retried on a click.
//
//   const v = createVoice(room, { onChange })     room: the Trystero room
//   await v.start()  v.stop()  v.mute(bool)
//   v.on  v.muted  v.blocked                      v.blocked: sound from others is waiting for a click
//   v.joined(id)  v.left(id)                      a browser came or went: send it my microphone
//   v.level(id)  v.level('me')                    how loud they are right now, 0..1
const log = (...a) => console.log('[voice]', ...a);

export function createVoice(room, { onChange = () => {} } = {}) {
  let mic = null, muted = false, blocked = false, ctx = null;
  const heard = new Map();   // id -> { el, meter }
  const audio = () => (ctx ||= new AudioContext());

  // a level meter: the loudness of a stream, read when asked (no timers of its own)
  function meter(stream) {
    try {
      const c = audio(), src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 2048; src.connect(an);
      const buf = new Float32Array(an.fftSize);
      return { read() { an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; return Math.min(1, Math.sqrt(s / buf.length) * 6); }, close() { src.disconnect(); } };
    } catch { return { read: () => 0, close() {} }; }
  }
  function play(el) {
    el.play().then(() => { if (blocked) { blocked = false; onChange(); } }).catch(e => {
      log('playback waits for a click', e.name);
      if (!blocked) { blocked = true; onChange(); }
    });
  }
  const unblock = () => { if (!blocked) return; audio().resume(); for (const h of heard.values()) play(h.el); };
  addEventListener('pointerdown', unblock); addEventListener('keydown', unblock);

  room.onPeerStream((stream, id) => {
    const take = () => {
      if (!stream.getAudioTracks().length) { stream.addEventListener('addtrack', take, { once: true }); return; }
      drop(id);
      const el = new Audio(); el.autoplay = true; el.srcObject = stream;
      const h = { el, meter: meter(stream), stream }; heard.set(id, h);
      const ended = () => { if (heard.get(id) === h) { drop(id); onChange(); } };
      stream.addEventListener('removetrack', ended); stream.getAudioTracks()[0].addEventListener('ended', ended);
      play(el); log('hearing', id.slice(0, 6)); onChange();
    };
    take();
  });
  function drop(id) { const h = heard.get(id); if (!h) return; h.el.srcObject = null; h.meter.close(); heard.delete(id); }

  const v = {
    get on() { return !!mic; }, get muted() { return muted; }, get blocked() { return blocked; },
    async start() {
      if (mic) return true;
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { log('no microphone', e.name); onChange(e); return false; }
      mic.meter = meter(mic); muted = false; audio().resume();
      room.addStream(mic); log('sending my microphone');
      onChange(); return true;
    },
    stop() {
      if (!mic) return;
      try { room.removeStream(mic); } catch {}
      mic.getTracks().forEach(t => t.stop()); mic.meter.close(); mic = null; muted = false; onChange();
    },
    mute(m) { if (!mic) return; muted = !!m; mic.getAudioTracks().forEach(t => { t.enabled = !muted; }); onChange(); },
    joined(id) { if (mic) room.addStream(mic, id); },
    left(id) { drop(id); onChange(); },
    // someone turned their microphone off: stop playing what is left of their stream
    silent(id) { drop(id); },
    hears: id => heard.has(id),
    level: id => (id === 'me' ? (mic && !muted ? mic.meter.read() : 0) : heard.get(id)?.meter.read() || 0),
    close() { v.stop(); for (const id of [...heard.keys()]) drop(id); },
    debug: () => ({ ctx: ctx?.state, heard: [...heard.keys()], mic: !!mic }),
  };
  return v;
}
