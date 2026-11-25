// What a concept page hands to "Together" (index.js): how to read and set the part of its state that
// lives in JavaScript (dragged arrows, drawings), not in sliders and dropdowns. Sliders, dropdowns,
// checkboxes and button clicks are shared without any help from the page.
//
//   share(get, set)   at the end of app.js, once the page is ready. get() returns plain JSON;
//                     set(state) applies one that came from someone else and redraws. A page with
//                     nothing beyond its controls calls share() with no arguments.
//
// set() receives data from other people's browsers: check it before use (nums() helps).
export const hooks = { get: null, set: null, ready: false, onReady: null };

export function share(get = null, set = null) {
  Object.assign(hooks, { get, set, ready: true });
  hooks.onReady?.();
}

// a list of finite numbers (at most max of them), or null
export function nums(a, max = 1e5) {
  if (!Array.isArray(a) || a.length > max) return null;
  return a.every(v => typeof v === 'number' && Number.isFinite(v)) ? a : null;
}
