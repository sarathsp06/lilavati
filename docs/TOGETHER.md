# Together: exploring a page with other people

Press **Invite** in the top bar, then **Start and copy the invite link**. Everyone who opens that link
(`…/?join=<token>`) is in the same session:

- they can chat in the Together panel;
- on the same page, they see the same picture: a slider moved, an arrow dragged, a shape drawn or a button
  pressed by one person happens for everyone;
- someone who arrives later gets the picture as it is now, and the recent chat;
- people on other pages show up in the list with a link to join them there. Moving between pages keeps you in
  the session (the token is kept for the browser tab), and **Leave** ends it.

The token is 10 random letters and digits; anyone with the link can join, nobody else can find the session.

## How it works (no server of our own)

The same approach as Toy City (github.com/sarathsp06/toycity, `docs/multiplayer.md`):

1. **Finding each other:** browsers announce themselves on public **Nostr relays** over WebSocket, in a room
   named after the token, through the Trystero library (`web/together/trystero-nostr.js`, the patched copy
   from Toy City; `tools/trystero.patch`). The relays only pass along WebRTC connection offers, which are
   encrypted with the token. The relay list is in `web/together/index.js`; everyone must use the same one.
2. **Talking:** from then on everything goes directly between browsers over **WebRTC** data channels.
3. **Strict networks:** when two browsers can't reach each other directly (mobile data, offices), the
   connection goes through Cloudflare's TURN relay. Short-lived credentials come from Toy City's Worker
   (`toycity-turn.sarathsp.workers.dev`); without it, direct connections still work.

## The code

| File | What it does |
|---|---|
| `web/together/session.js` | The session without network or page: members, chat, and who answers a newcomer (whoever has been on that page longest). Pure; tested by `tests/together.test.mjs`. |
| `web/together/index.js` | The Invite button, the panel, the connection, and keeping the page in step. Loaded by `concepts.js` on every page. |
| `web/together/share.js` | `share(get, set)`: how a page hands over state that lives only in JavaScript; `room`: the people on the page and messages of its own. |

What is shared on a page:

- every `input`, `select` and `textarea` in `<main>`, matched by position; a change is applied on the other
  side by setting the value and firing `input` and `change`, so the page reacts as if it was done there;
- clicks on buttons and preset links in `<main>`, replayed by position (a "Try this" button does not scroll
  the other person's page);
- whatever the page's `share(get, set)` returns (the arrows on the vectors page, the drawing on the Fourier
  page, the satellite on the orbits page).

Only things a person actually did are sent (trusted events), so a change that arrives is never echoed back.
While dragging, updates go out about 12 times a second. Anything marked `data-local` stays personal.

## Pages with secrets: the room

Some pages are not one shared picture: in the guessing game (`web/nash-equilibrium/`) each person keeps
their number to themselves until the reveal. `room` from `share.js` gives a page the people on it and a
channel of its own:

```js
import { room } from '../together/share.js';
room.on(ev => ev.type === 'message' ? handle(ev.data, ev.from) : seatPeople(room.people()));
room.send({ k: 'lock', r: 1, h: fingerprint });   // to everyone on this page
```

The game sends only a SHA-256 fingerprint of each guess (with a random salt) when someone locks in, and
the guess itself once everyone has; the others check it against the fingerprint, so a guess can be
neither seen early nor changed late. The round logic is pure and tested: `web/nash-equilibrium/game.js`,
`tests/game.test.mjs`.

## Adding a page

At the end of its `app.js`:

```js
import { share, nums } from '../together/share.js';
// ...
share(() => ({ points }), s => { const p = nums(s?.points, 200); if (!p) return; points = [...p]; draw(); });
```

or just `share()` when everything is in the controls. Check it with two browser windows on the same link.
