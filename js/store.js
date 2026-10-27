/* Persistence: localStorage when available, otherwise an in-session memory fallback. */
(function () {
  var KEY = 'aiTripPlanner.demo.v1';
  var memory = null;
  var persistent = false;

  try {
    window.localStorage.setItem('__probe__', '1');
    window.localStorage.removeItem('__probe__');
    persistent = true;
  } catch (e) { persistent = false; }

  function empty() { return { current: null, saved: [] }; }

  function load() {
    var raw = null;
    if (persistent) {
      try { raw = window.localStorage.getItem(KEY); } catch (e) { persistent = false; }
    }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          parsed.saved = Array.isArray(parsed.saved) ? parsed.saved : [];
          return parsed;
        }
      } catch (e) { /* corrupt data: start fresh */ }
    }
    return memory ? JSON.parse(memory) : empty();
  }

  function save(state) {
    var raw = JSON.stringify(state);
    memory = raw; // always keep an in-session copy
    if (persistent) {
      try { window.localStorage.setItem(KEY, raw); }
      catch (e) { persistent = false; }
    }
    return persistent;
  }

  function clear() {
    memory = null;
    if (persistent) { try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  }

  window.Store = {
    load: load, save: save, clear: clear,
    isPersistent: function () { return persistent; }
  };
})();
