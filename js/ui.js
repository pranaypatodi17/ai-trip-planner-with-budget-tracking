/* UI: rendering and event handling. Everything runs in the browser against local data. */
(function () {
  var E = window.Engine, D = window.TripData, X = window.Disruptions, A = window.Assistant, Store = window.Store;
  var money = E.money;

  var S = { trip: null, saved: [], tab: 'plan', form: E.defaultParams(), chat: [], editExp: null, expFilter: 'all' };
  var TABS = ['plan', 'itinerary', 'budget', 'expenses', 'live', 'saved'];

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toast(msg, isErr) {
    var el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : ''); el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }
  function fmtDay(trip, di, long) {
    return E.parseDate(E.dayDate(trip, di)).toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function fmtISOLabel(iso) { return E.parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function options(list, sel) {
    return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + (o[2] ? ' disabled' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  function dayOptions(trip, sel) {
    return options(trip.days.map(function (d, i) { return [i, 'Day ' + (i + 1) + ' · ' + fmtDay(trip, i) + ' ' + D.WEATHER[trip.weather[i].type].icon]; }), sel);
  }
  function timeFor(n, idx) {
    var set = D.TIME_SETS[Math.min(n, 6)];
    return set[Math.min(idx, set.length - 1)];
  }
  /* Prefers a real photo at assets/img/photos/<name>.jpg when present, else the bundled SVG illustration. */
  function photo(name, attrs) {
    return '<img src="assets/img/photos/' + name + '.jpg" onerror="this.onerror=null;this.src=\'assets/img/' + name + '.svg\'" alt="" ' + (attrs || '') + '>';
  }
  function statusLabel(st) { return st === 'good' ? 'On track' : st === 'warn' ? 'Tight' : 'Over budget'; }
  function statusClass(st) { return st === 'good' ? 'good' : st === 'warn' ? 'warn' : 'bad'; }
  function catTag(cat) { var c = D.CATS[cat]; return '<span class="tag" style="background:' + c.color + '">' + c.icon + ' ' + c.label + '</span>'; }

  /* ---------- persistence ---------- */
  function persist() { Store.save({ current: S.trip, saved: S.saved }); }
  function commit(msg) { persist(); render(); if (msg) toast(msg); }

  /* ---------- tab handling ---------- */
  function show(tab) {
    if (!S.trip && tab !== 'plan' && tab !== 'saved') { toast('Generate a trip first (or load the demo trip).', true); tab = 'plan'; }
    S.tab = tab;
    TABS.forEach(function (t) { $('#tab-' + t).hidden = t !== tab; });
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      var on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
    });
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    renderSummary();
    ({ plan: renderPlan, itinerary: renderItinerary, budget: renderBudget, expenses: renderExpenses, live: renderLive, saved: renderSaved })[S.tab]();
  }

  function renderSummary() {
    var el = $('#summary'), t = S.trip;
    if (!t) { el.hidden = true; return; }
    var b = E.budget(t), sp = E.spent(t);
    el.hidden = false;
    el.innerHTML = '<span><b>' + esc(t.name) + '</b></span>' +
      '<span>' + fmtISOLabel(t.params.start) + ' · ' + t.params.days + ' days · ' + t.params.travelers + ' traveler' + (t.params.travelers > 1 ? 's' : '') + '</span>' +
      '<span>Plan <b>' + money(b.total) + '</b> / ' + money(b.budget) + '</span>' +
      '<div class="meter" title="' + Math.round(b.pct * 100) + '% of budget"><i class="' + (b.status === 'over' ? 'over' : b.status === 'warn' ? 'warn' : '') + '" style="width:' + Math.min(100, b.pct * 100) + '%"></i></div>' +
      '<span>' + statusLabel(b.status) + (sp.total ? ' · Spent <b>' + money(sp.total) + '</b>' : '') + '</span>';
  }

  /* =====================================================================
     PLAN TAB
     ===================================================================== */
  function renderPlan() {
    var f = S.form, p = $('#tab-plan');
    p.innerHTML =
      '<div class="hero"><h1>Plan a trip. Track every dollar.</h1>' +
      '<p>Pick a destination, set your budget and interests, and the planner builds a day-by-day itinerary with a full cost breakdown. Then edit it, log expenses, and trigger simulated rain, closures and delays to watch it adapt. No server, no APIs: everything runs in your browser.</p>' +
      '<button class="primary" data-act="demo">▶ Load demo trip</button>' +
      (S.trip ? '<button data-act="goto" data-tab="itinerary">Continue current trip →</button>' : '') + '</div>' +
      '<div class="card"><h3>1 · Choose a destination</h3><div class="dests" id="destPicker"></div></div>' +
      '<div class="card"><h3>2 · Trip details</h3><div class="form-grid">' +
      field('Departing from', '<select data-inp="form" name="origin">' + options(Object.keys(D.ORIGINS).map(function (k) { return [k, D.ORIGINS[k]]; }), f.origin) + '</select>') +
      field('Start date', '<input type="date" data-inp="form" name="start" value="' + esc(f.start) + '">') +
      field('Days (2–10)', '<input type="number" data-inp="form" name="days" min="2" max="10" value="' + esc(f.days) + '">') +
      field('Travelers (1–8)', '<input type="number" data-inp="form" name="travelers" min="1" max="8" value="' + esc(f.travelers) + '">') +
      field('Total budget (USD)', '<input type="number" data-inp="form" name="budget" min="100" step="50" value="' + esc(f.budget) + '">') +
      field('Travel style', '<select data-inp="form" name="style">' + options(Object.keys(D.STYLES).map(function (k) { return [k, D.STYLES[k].label + ' — ' + D.STYLES[k].note]; }), f.style) + '</select>') +
      field('Pace', '<select data-inp="form" name="pace">' + options([['relaxed', 'Relaxed (2 activities/day)'], ['balanced', 'Balanced (3/day)'], ['packed', 'Packed (4/day)']], f.pace) + '</select>') +
      field('Flights', '<select data-inp="form" name="flightClass">' + options(D.FLIGHT_CLASSES.map(function (c) { return [c.id, c.label]; }), f.flightClass) + '</select>') +
      '</div>' +
      '<div class="field" style="margin-top:6px"><label>Interests</label><div class="chips" id="interestChips"></div></div>' +
      '<div id="formErrors" class="err"></div>' +
      '<div class="row"><button class="primary" data-act="generate">✨ Generate itinerary</button><span class="muted small">Uses rules + sample data, no AI service.</span></div></div>' +
      '<div class="card"><h3>Live estimate</h3><div id="preview" class="preview"></div></div>';
    drawDests(); drawInterests(); updatePreview();
  }
  function field(label, html) { return '<div class="field"><label>' + label + '</label>' + html + '</div>'; }
  function drawDests() {
    $('#destPicker').innerHTML = Object.keys(D.DESTS).map(function (id) {
      var d = D.DESTS[id];
      return '<button type="button" class="dest' + (S.form.dest === id ? ' sel' : '') + '" data-act="pickDest" data-id="' + id + '" aria-pressed="' + (S.form.dest === id) + '">' +
        photo(id) + '<span><b>' + d.name + ', ' + d.country + '</b>' + esc(d.tagline) + '</span></button>';
    }).join('');
  }
  function drawInterests() {
    $('#interestChips').innerHTML = Object.keys(D.CATS).map(function (k) {
      var c = D.CATS[k];
      return '<label class="chip"><input type="checkbox" data-chg="interest" value="' + k + '"' + (S.form.interests.indexOf(k) >= 0 ? ' checked' : '') + '>' + c.icon + ' ' + c.label + '</label>';
    }).join('');
  }
  function readForm() {
    var f = S.form, errs = [];
    var days = parseInt(f.days, 10), trav = parseInt(f.travelers, 10), bud = parseFloat(f.budget);
    if (!(days >= 2 && days <= 10)) errs.push('Days must be between 2 and 10.');
    if (!(trav >= 1 && trav <= 8)) errs.push('Travelers must be between 1 and 8.');
    if (!(bud >= 100)) errs.push('Budget must be at least $100.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.start || '')) errs.push('Choose a valid start date.');
    return {
      errors: errs,
      params: { origin: f.origin, dest: f.dest, start: f.start, days: days, travelers: trav, budget: Math.round(bud), style: f.style, pace: f.pace, interests: f.interests.slice(), flightClass: f.flightClass }
    };
  }
  function updatePreview() {
    var r = readForm(), el = $('#preview'), eb = $('#formErrors');
    if (!el) return;
    eb.textContent = '';
    if (r.errors.length) { el.innerHTML = '<span class="muted">Fix the form to see an estimate: ' + r.errors.join(' ') + '</span>'; return; }
    var t = E.create(r.params), b = E.budget(t), L = b.lines, d = D.DESTS[r.params.dest];
    el.innerHTML = '<div class="row between"><div><div class="big ' + statusClass(b.status) + '">' + money(b.total) + '</div><div class="muted">estimated total for ' + d.name + ' · ' + money(b.perPerson) + ' per person · ' + money(b.perDay) + '/day</div></div>' +
      '<div><span class="pill ' + statusClass(b.status) + '">' + statusLabel(b.status) + '</span> <span class="muted">' + (b.remaining >= 0 ? money(b.remaining) + ' to spare' : money(-b.remaining) + ' over budget') + '</span></div></div>' +
      '<div class="bar big" style="margin:10px 0"><i style="width:' + Math.min(100, b.pct * 100) + '%;background:var(--' + statusClass(b.status) + ')"></i></div>' +
      '<div class="small muted">Flights ' + money(L.flights) + ' · Lodging ' + money(L.lodging) + ' (' + esc(E.hotelOf(t).name) + ') · Food ' + money(L.food) + ' · Transport ' + money(L.transport) + ' · Activities ' + money(L.activities) + ' · Buffer ' + money(L.buffer) + '</div>';
  }
  function generate(params, label) {
    if (S.trip && !S.trip.savedId && S.trip.expenses.length && !window.confirm('Replace the current trip? It has logged expenses and has not been saved.')) return;
    S.trip = E.create(params, 0);
    S.chat = [{ who: 'bot', html: 'Your <b>' + esc(S.trip.name) + '</b> itinerary is ready. Ask me anything below.' }];
    persist();
    show('itinerary');
    toast(label || 'Itinerary generated');
  }

  /* =====================================================================
     ITINERARY TAB
     ===================================================================== */
  function renderItinerary() {
    var t = S.trip, p = t.params, d = E.dest(t), b = E.budget(t), h = E.hotelOf(t);
    var why = A.why(t), tips = A.tips(t);
    var html =
      '<div class="banner">' + photo(p.dest) + '<div class="in"><h2>' + esc(t.name) + '</h2>' +
      '<div>' + esc(d.name) + ', ' + esc(d.country) + ' · ' + fmtISOLabel(p.start) + ' → ' + fmtISOLabel(E.addDays(p.start, p.days - 1)) + '</div>' +
      '<div class="small" style="margin-top:6px">' + esc(d.tagline) + ' · from ' + esc(D.ORIGINS[p.origin]) + ' · ' + p.travelers + ' traveler' + (p.travelers > 1 ? 's' : '') + '</div>' +
      '<div class="row" style="margin-top:12px"><button class="sm" data-act="remix">🔀 Remix itinerary</button><button class="sm" data-act="optimize">🪄 Auto-fit to budget</button><button class="sm" data-act="goto" data-tab="budget">Budget details →</button></div></div></div>' +
      '<div class="grid g2">' +
      '<div class="card why"><h3>🧠 Why this plan</h3><ul>' + why.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul><div class="small muted">' + tips.join(' ') + '</div></div>' +
      '<div class="card"><h3>🧳 Trip logistics</h3>' +
      '<div class="row" style="align-items:flex-start;flex-wrap:nowrap">' + photo('hotel-' + h.tier, 'width="110" height="75" style="border-radius:10px;object-fit:cover"') + '<div><b>' + esc(h.name) + '</b><div class="small muted">' + esc(h.area) + ' · ★ ' + h.rating + ' · ' + esc(h.perks) + '</div></div></div>' +
      '<div class="form-grid" style="margin-top:12px">' +
      field('Hotel', '<select data-chg="hotel">' + options(E.dest(t).hotels.map(function (x) { return [x.id, x.name + ' · ' + money(x.nightly) + '/night']; }), t.hotelId) + '</select>') +
      field('Flights', '<select data-chg="flightClass">' + options(D.FLIGHT_CLASSES.map(function (c) { return [c.id, c.label + ' · ' + money(Math.round(d.flights[p.origin] * c.mult)) + ' pp']; }), t.flightClass) + '</select>') +
      field('Dining', '<select data-chg="foodTier">' + options(['budget', 'comfort', 'luxury'].map(function (k) { return [k, D.STYLES[k].label + ' · ' + money(Math.round(D.FOOD_BASE[k] * d.foodF)) + ' pp/day']; }), t.foodTier) + '</select>') +
      field('Local transport', '<select data-chg="localId">' + options(['transit', 'ride', 'rental'].map(function (k) { return [k, D.LOCAL_LABELS[k] + ' · ' + money(E.localDayCost(t, k)) + '/day']; }), t.localId) + '</select>') +
      '</div></div></div>' +
      '<div class="card"><h3>💬 Ask the planner <span class="pill">local rules</span></h3><div class="chat" id="chat"></div>' +
      '<div class="chips" style="margin:10px 0">' + A.SUGGESTED.map(function (q) { return '<button class="sm" data-act="ask" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>' +
      '<form class="row" id="askForm" style="flex-wrap:nowrap"><input id="askInput" placeholder="Try: day 2, hotel, what should I pack…" autocomplete="off"><button class="primary">Ask</button></form></div>';

    t.days.forEach(function (day, di) {
      var w = t.weather[di], wx = D.WEATHER[w.type], n = day.items.length;
      var dayCost = day.items.reduce(function (s, it) { return s + E.itemCost(t, it); }, 0);
      html += '<div class="card day"><div class="day-head"><h3>Day ' + (di + 1) + ' · ' + fmtDay(t, di, true) + '</h3>' +
        '<div class="row"><span class="wx ' + w.type + '">' + wx.icon + ' ' + wx.label + ' · ' + w.temp + '°C' + (w.forced ? ' (simulated)' : '') + '</span><span class="pill">Activities ' + money(dayCost) + '</span></div></div>';
      if (!n) html += '<div class="empty">Nothing planned. Add an activity below.</div>';
      day.items.forEach(function (it, idx) {
        var a = E.getAttr(p.dest, it.aid), cost = E.itemCost(t, it);
        var opts = E.available(t, di).map(function (o) {
          var dis = o.closedToday || o.closedNow;
          return [o.a.id, o.a.name + ' (' + (o.a.cost ? money(o.a.cost) : 'free') + ')' + (dis ? ' — closed' : o.weatherOk ? '' : ' — weather risk'), dis];
        });
        html += '<div class="item"><div class="time">' + timeFor(n, idx) + '</div><div>' +
          '<h4>' + (D.CATS[a.cat] ? D.CATS[a.cat].icon : '') + ' ' + esc(a.name) + '</h4>' +
          '<div class="meta">' + catTag(a.cat) + '<span>' + (a.indoor ? '🏠 indoor' : '🌤 outdoor') + '</span><span>~' + a.hours + 'h</span><span>★ ' + a.rating + '</span><b>' + (cost ? money(cost) + (p.travelers > 1 ? ' (' + money(a.cost) + ' pp)' : '') : 'Free') + '</b></div>' +
          '<div class="small muted">' + esc(a.desc) + '</div>' +
          (it.note ? '<div class="note">⚡ ' + esc(it.note) + '</div>' : '') + '</div>' +
          '<div class="acts"><button class="sm" data-act="up" data-uid="' + it.uid + '" title="Move earlier"' + (idx === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="sm" data-act="down" data-uid="' + it.uid + '" title="Move later"' + (idx === n - 1 ? ' disabled' : '') + '>↓</button>' +
          '<select data-chg="moveDay" data-uid="' + it.uid + '" aria-label="Move to day"><option value="">Move to…</option>' + options(t.days.map(function (_, i) { return [i, 'Day ' + (i + 1)]; }).filter(function (o) { return o[0] !== di; })) + '</select>' +
          '<select data-chg="swap" data-uid="' + it.uid + '" aria-label="Swap activity"><option value="">Swap with…</option>' + options(opts) + '</select>' +
          (cost && !it.logged ? '<button class="sm" data-act="logItem" data-uid="' + it.uid + '" title="Add this cost to your expenses">＋ Log cost</button>' : '') + (it.logged ? '<span class="pill good">logged</span>' : '') +
          '<button class="sm danger" data-act="remove" data-uid="' + it.uid + '" title="Remove (kept in wishlist)">✕</button></div></div>';
      });
      var av = E.available(t, di).filter(function (o) { return !o.closedToday && !o.closedNow; }).map(function (o) { return [o.a.id, o.a.name + ' (' + (o.a.cost ? money(o.a.cost) + ' pp' : 'free') + ')' + (o.weatherOk ? '' : ' — weather risk')]; });
      html += '<div class="add-row"><select id="add-' + di + '" aria-label="Add activity to day ' + (di + 1) + '">' + options(av) + '</select><button class="sm" data-act="add" data-day="' + di + '">＋ Add to day ' + (di + 1) + '</button></div></div>';
    });

    html += '<div class="card"><h3>⭐ Wishlist <span class="pill">' + t.wishlist.length + '</span></h3>';
    if (!t.wishlist.length) html += '<p class="muted">Activities you remove, or that disruptions bump, are parked here so you can add them back.</p>';
    else html += t.wishlist.map(function (aid) {
      var a = E.getAttr(p.dest, aid), closed = t.closed && t.closed[aid];
      return '<div class="sugg"><div><b>' + esc(a.name) + '</b><span class="small muted">' + (a.cost ? money(a.cost) + ' pp' : 'free') + ' · ' + (a.indoor ? 'indoor' : 'outdoor') + (closed ? ' · closed' : '') + '</span></div><div class="row"><select id="wl-' + aid + '" aria-label="Day for ' + esc(a.name) + '">' + dayOptions(t) + '</select><button class="sm" data-act="wlAdd" data-aid="' + aid + '"' + (closed ? ' disabled' : '') + '>Add to day</button></div></div>';
    }).join('');
    html += '</div>';
    $('#tab-itinerary').innerHTML = html;
    renderChat();
  }
  function renderChat() {
    var c = $('#chat'); if (!c) return;
    c.innerHTML = S.chat.map(function (m) { return '<div class="msg ' + m.who + '">' + m.html + '</div>'; }).join('');
    c.scrollTop = c.scrollHeight;
  }
  function ask(q) {
    q = (q || '').trim(); if (!q) return;
    S.chat.push({ who: 'me', html: esc(q) });
    S.chat.push({ who: 'bot', html: '<span class="muted">thinking…</span>', pending: true });
    renderChat();
    setTimeout(function () {
      S.chat = S.chat.filter(function (m) { return !m.pending; });
      S.chat.push({ who: 'bot', html: A.answer(S.trip, q) });
      if (S.tab === 'itinerary') renderChat();
    }, 450);
  }

  /* =====================================================================
     BUDGET TAB
     ===================================================================== */
  function renderBudget() {
    var t = S.trip, b = E.budget(t), L = b.lines, p = t.params, h = E.hotelOf(t), sg = E.suggestions(t);
    var detail = {
      flights: money(E.flightPerPerson(t)) + ' × ' + p.travelers + ' traveler' + (p.travelers > 1 ? 's' : '') + ' (' + E.flightClassOf(t).label + ')',
      lodging: money(h.nightly) + ' × ' + E.nights(t) + ' nights × ' + E.rooms(t) + ' room' + (E.rooms(t) > 1 ? 's' : ''),
      food: money(E.foodPerPersonDay(t)) + ' × ' + p.days + ' days × ' + p.travelers,
      transport: money(E.localDayCost(t)) + '/day × ' + p.days + ' (' + D.LOCAL_LABELS[t.localId].toLowerCase() + ')',
      activities: 'Sum of scheduled activities × ' + p.travelers,
      extras: t.extras.length ? t.extras.map(function (x) { return esc(x.label); }).join('; ') : 'None (triggered by Live demo)',
      buffer: '8% safety margin'
    };
    var acc = 0, stops = E.LINE_ORDER.map(function (l) {
      var share = b.total ? L[l[0]] / b.total * 100 : 0, s = acc; acc += share;
      return l[3] + ' ' + s + '% ' + acc + '%';
    }).join(', ');
    var saves = sg.filter(function (s) { return s.kind === 'save'; }), ups = sg.filter(function (s) { return s.kind === 'upgrade'; });
    function suggRow(s) {
      return '<div class="sugg"><div><b>' + esc(s.title) + '</b><span class="small muted">' + esc(s.desc) + '</span></div><div class="row nowrap"><b class="' + (s.delta < 0 ? 'good' : 'warn') + '">' + (s.delta < 0 ? '−' : '+') + money(Math.abs(s.delta)) + '</b><button class="sm" data-act="applySugg" data-id="' + s.id + '">Apply</button></div></div>';
    }
    $('#tab-budget').innerHTML =
      '<div class="card"><div class="row between" style="align-items:flex-start"><div><div class="muted">Planned total</div><div class="big ' + statusClass(b.status) + '">' + money(b.total) + '</div>' +
      '<span class="pill ' + statusClass(b.status) + '">' + statusLabel(b.status) + '</span> <span class="muted">' + (b.remaining >= 0 ? money(b.remaining) + ' under budget' : money(-b.remaining) + ' over budget') + '</span></div>' +
      '<div style="min-width:200px"><label for="budgetInput">Your budget (USD)</label><input id="budgetInput" type="number" min="100" step="50" value="' + p.budget + '" data-chg="budget"></div></div>' +
      '<div class="bar big" style="margin:14px 0 6px"><i style="width:' + Math.min(100, b.pct * 100) + '%;background:var(--' + statusClass(b.status) + ')"></i></div>' +
      '<div class="row between small muted"><span>' + Math.round(b.pct * 100) + '% of budget</span><span>' + money(b.perPerson) + ' per person · ' + money(b.perDay) + ' per day</span></div>' +
      (b.status === 'over' ? '<div class="row" style="margin-top:12px"><button class="primary" data-act="optimize">🪄 Auto-fit to budget</button><span class="small muted">Applies the least painful cuts first.</span></div>' : '') + '</div>' +
      '<div class="grid g2"><div class="card"><h3>Breakdown</h3><div class="row" style="flex-wrap:nowrap;align-items:center"><div class="donut" style="background:conic-gradient(' + stops + ')"><div class="donut-c"><div>' + money(b.total) + '<div class="small muted" style="font-weight:500">total</div></div></div></div>' +
      '<div class="small stack">' + E.LINE_ORDER.map(function (l) { return L[l[0]] > 0 ? '<div><span class="dot" style="background:' + l[3] + '"></span>' + l[1] + ' <b>' + Math.round(L[l[0]] / b.total * 100) + '%</b></div>' : ''; }).join('') + '</div></div></div>' +
      '<div class="card"><h3>How it is calculated</h3><table><tbody>' + E.LINE_ORDER.map(function (l) {
        return '<tr><td>' + l[2] + ' ' + l[1] + '<div class="small muted">' + detail[l[0]] + '</div></td><td class="num"><b>' + money(L[l[0]]) + '</b></td></tr>';
      }).join('') + '<tr><td><b>Total</b></td><td class="num"><b>' + money(b.total) + '</b></td></tr></tbody></table></div></div>' +
      '<div class="grid g2"><div class="card"><h3>💡 Ways to save</h3>' + (saves.length ? saves.map(suggRow).join('') : '<p class="muted">Already at the lowest-cost options available.</p>') + '</div>' +
      '<div class="card"><h3>✨ Upgrades you can afford</h3>' + (ups.length ? ups.map(suggRow).join('') : '<p class="muted">' + (b.remaining <= 0 ? 'No spare budget for upgrades.' : 'No upgrade fits in your remaining ' + money(b.remaining) + '.') + '</p>') + '</div></div>';
  }

  /* =====================================================================
     EXPENSES TAB
     ===================================================================== */
  function defaultExpenseDate(t) {
    var today = E.fmtISO(new Date()), last = E.addDays(t.params.start, t.params.days - 1);
    return today >= t.params.start && today <= last ? today : t.params.start;
  }
  function catLabel(c) { var f = E.EXP_CATS.filter(function (x) { return x[0] === c; })[0]; return f ? f[2] + ' ' + f[1] : c; }

  function renderExpenses() {
    var t = S.trip, b = E.budget(t), pl = E.planned(t), sp = E.spent(t), ed = S.editExp ? t.expenses.filter(function (e) { return e.id === S.editExp; })[0] : null;
    var remaining = b.budget - sp.total, usedPct = b.budget ? sp.total / b.budget : 0;
    var dates = t.expenses.map(function (e) { return e.date; }).sort();
    var span = dates.length ? Math.max(1, Math.round((E.parseDate(dates[dates.length - 1]) - E.parseDate(dates[0])) / 864e5) + 1) : 0;
    var proj = span ? sp.total / span * t.params.days : 0;
    var list = t.expenses.filter(function (e) { return S.expFilter === 'all' || e.cat === S.expFilter; }).sort(function (a, c) { return c.date.localeCompare(a.date) || c.id.localeCompare(a.id); });

    $('#tab-expenses').innerHTML =
      '<div class="grid g2"><div class="card"><h3>Spending so far</h3><div class="big ' + (usedPct > 1 ? 'bad' : '') + '">' + money(sp.total) + '</div>' +
      '<div class="muted">of ' + money(b.budget) + ' budget · <b class="' + (remaining < 0 ? 'bad' : 'good') + '">' + (remaining >= 0 ? money(remaining) + ' left' : money(-remaining) + ' over') + '</b></div>' +
      '<div class="bar big" style="margin:10px 0"><i style="width:' + Math.min(100, usedPct * 100) + '%;background:var(--' + (usedPct > 1 ? 'bad' : usedPct > .9 ? 'warn' : 'good') + ')"></i></div>' +
      (span ? '<div class="small muted">Logged over ' + span + ' day' + (span > 1 ? 's' : '') + ' · at this pace the trip lands near <b class="' + (proj > b.budget ? 'bad' : '') + '">' + money(proj) + '</b> (daily average ' + money(sp.total / span) + ').</div>' : '<div class="small muted">No expenses yet. Add one, or load sample expenses.</div>') + '</div>' +
      '<div class="card"><h3>' + (ed ? 'Edit expense' : 'Add expense') + '</h3><form id="expForm"><div class="form-grid">' +
      field('Date', '<input type="date" name="date" required value="' + esc(ed ? ed.date : defaultExpenseDate(t)) + '">') +
      field('Category', '<select name="cat">' + options(E.EXP_CATS.map(function (c) { return [c[0], c[2] + ' ' + c[1]]; }), ed ? ed.cat : 'food') + '</select>') +
      field('Amount (USD)', '<input type="number" name="amount" min="0.01" step="0.01" required value="' + (ed ? ed.amount : '') + '">') +
      field('Note', '<input type="text" name="note" maxlength="80" placeholder="e.g. Lunch at Time Out Market" value="' + esc(ed ? ed.note : '') + '">') +
      '</div><div class="row"><button class="primary">' + (ed ? 'Save changes' : '＋ Add expense') + '</button>' + (ed ? '<button type="button" data-act="cancelEdit">Cancel</button>' : '') + '</div></form></div></div>' +
      '<div class="card"><h3>Planned vs actual</h3><table><thead><tr><th>Category</th><th>Progress</th><th class="num">Spent</th><th class="num">Planned</th><th class="num">Left</th></tr></thead><tbody>' +
      E.EXP_CATS.map(function (c) {
        var pv = pl[c[0]], sv = sp[c[0]], pct = pv ? sv / pv : (sv ? 2 : 0), over = sv > pv;
        return '<tr><td>' + c[2] + ' ' + c[1] + '</td><td style="min-width:140px"><div class="bar"><i style="width:' + Math.min(100, pct * 100) + '%;background:var(--' + (over ? 'bad' : pct > .85 ? 'warn' : 'good') + ')"></i></div></td>' +
          '<td class="num">' + money(sv) + '</td><td class="num">' + money(pv) + '</td><td class="num ' + (over ? 'bad' : '') + '">' + (over ? '−' + money(sv - pv) + ' over' : money(pv - sv)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card"><div class="row between"><h3 style="margin:0">Expense log <span class="pill">' + list.length + '</span></h3><div class="row"><select id="expFilter" data-chg="expFilter" style="width:auto" aria-label="Filter by category"><option value="all">All categories</option>' + options(E.EXP_CATS.map(function (c) { return [c[0], c[2] + ' ' + c[1]]; }), S.expFilter) + '</select>' +
      '<button class="sm" data-act="sampleExp">Load sample expenses</button><button class="sm danger" data-act="clearExp"' + (t.expenses.length ? '' : ' disabled') + '>Clear all</button></div></div>' +
      (list.length ? '<table style="margin-top:8px"><thead><tr><th>Date</th><th>Category</th><th>Note</th><th class="num">Amount</th><th></th></tr></thead><tbody>' + list.map(function (e) {
        return '<tr><td class="nowrap">' + fmtISOLabel(e.date) + '</td><td>' + catLabel(e.cat) + '</td><td>' + esc(e.note) + '</td><td class="num"><b>' + money(e.amount) + '</b></td><td class="right nowrap"><button class="sm" data-act="editExp" data-id="' + e.id + '">Edit</button> <button class="sm danger" data-act="delExp" data-id="' + e.id + '">✕</button></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="muted" style="margin-top:12px">Nothing to show.</p>') + '</div>';
  }
  function addExpense(t, date, cat, amount, note) {
    t.expenses.push({ id: E.uid('x'), date: date, cat: cat, amount: Math.round(amount * 100) / 100, note: note || '' });
  }
  function sampleExpenses(t) {
    var pl = E.planned(t), p = t.params, n = Math.max(1, p.days - 1);
    addExpense(t, p.start, 'flights', pl.flights * 0.97, 'Return flights (booked)');
    addExpense(t, p.start, 'lodging', pl.lodging * 0.5, 'Hotel deposit (50%)');
    for (var i = 0; i < n; i++) {
      var date = E.addDays(p.start, i), r = E.rand(t.id + 'e' + i);
      var food = pl.food / p.days * (0.9 + r * 0.45);
      addExpense(t, date, 'food', food * 0.4, 'Lunch');
      addExpense(t, date, 'food', food * 0.6, 'Dinner');
      addExpense(t, date, 'transport', pl.transport / p.days * (0.8 + r * 0.5), 'Local transport');
      if (i % 2 === 0) addExpense(t, date, 'activities', pl.activities / p.days * (0.8 + r * 0.6), 'Tickets & tours');
    }
    addExpense(t, E.addDays(p.start, Math.min(1, p.days - 1)), 'other', 25 * p.travelers, 'Souvenirs');
  }

  /* =====================================================================
     LIVE DEMO TAB
     ===================================================================== */
  function renderLive() {
    var t = S.trip, items = [];
    t.days.forEach(function (d, di) { d.items.forEach(function (it) { var a = E.getAttr(t.params.dest, it.aid); if (!E.isGeneric(a.id)) items.push([a.id, 'Day ' + (di + 1) + ' · ' + a.name]); }); });
    var evs = t.events;
    $('#tab-live').innerHTML =
      '<div class="card"><h3>📡 Simulated live conditions</h3><p class="muted">There is no real weather or booking feed. Use the controls to inject a disruption; predefined rules re-plan your itinerary and costs instantly. Every change can be undone.</p>' +
      '<div class="wxstrip">' + t.weather.map(function (w, i) { return '<div class="wxday" style="' + (w.forced ? 'border-color:var(--brand)' : '') + '"><div class="ic">' + D.WEATHER[w.type].icon + '</div><b>Day ' + (i + 1) + '</b><div>' + w.temp + '°C</div><div class="muted">' + fmtDay(t, i) + '</div>' + (w.forced ? '<div class="small" style="color:var(--brand)">simulated</div>' : '') + '</div>'; }).join('') + '</div></div>' +
      '<div class="grid g3">' +
      ctrl('🌧️ Heavy rain', 'Outdoor activities on that day are swapped for indoor ones.', '<select id="rainDay">' + dayOptions(t) + '</select>', 'rain', 'Trigger rain') +
      ctrl('🔥 Heatwave', 'Outdoor stops are moved to cooler hours or replaced with air-conditioned ones.', '<select id="heatDay">' + dayOptions(t) + '</select>', 'heat', 'Trigger heatwave') +
      ctrl('🚧 Attraction closure', 'A booked attraction closes; every visit is replaced with a similar one.', '<select id="closeAttr">' + (items.length ? options(items) : '<option value="">No attractions planned</option>') + '</select>', 'closure', 'Close attraction', !items.length) +
      ctrl('🛬 Flight delay', 'Day 1 plans are bumped to your wishlist and extra costs are added.', '<select id="delayHrs">' + options([[2, '2 hours'], [4, '4 hours'], [8, '8 hours'], [14, '14 hours (overnight)']], 4) + '</select>', 'delay', 'Delay flight') +
      ctrl('🚇 Transit strike', 'Far-away trips are swapped for nearby ones; taxi costs may apply.', '<select id="strikeDay">' + dayOptions(t) + '</select>', 'strike', 'Start strike') +
      ctrl('🏨 Hotel overbooked', 'Your hotel cancels; the planner rebooks and re-prices the stay.', '<div class="small muted">Current: ' + esc(E.hotelOf(t).name) + '</div>', 'overbook', 'Overbook hotel') +
      ctrl('🌤️ Refresh forecast', 'Restore one day to the original sample forecast.', '<select id="clearDay">' + dayOptions(t) + '</select>', 'clearWx', 'Refresh day') +
      '</div>' +
      '<div class="card" style="margin-top:18px"><div class="row between"><h3 style="margin:0">Alerts &amp; actions taken <span class="pill">' + evs.length + '</span></h3><div class="row"><button class="sm" data-act="undoEvent"' + (evs.length ? '' : ' disabled') + '>↩ Undo last</button><button class="sm danger" data-act="clearEvents"' + (evs.length ? '' : ' disabled') + '>Clear log</button></div></div>' +
      (evs.length ? '<ul class="events" style="margin-top:12px">' + evs.map(function (e) {
        return '<li><b>' + e.icon + ' ' + esc(e.title) + '</b> <span class="pill ' + (e.delta > 0 ? 'bad' : e.delta < 0 ? 'good' : '') + '">' + (e.delta === 0 ? 'no cost change' : (e.delta > 0 ? '+' : '−') + money(Math.abs(e.delta))) + '</span> <span class="small muted">' + new Date(e.ts).toLocaleTimeString() + '</span><ul>' + e.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></li>';
      }).join('') + '</ul>' : '<p class="muted" style="margin-top:12px">No disruptions yet. Pick a control above.</p>') + '</div>';
  }
  function ctrl(title, desc, control, act, label, disabled) {
    return '<div class="ctrl"><h4>' + title + '</h4><p class="small muted">' + desc + '</p><div class="stack">' + control + '<button class="primary" data-act="' + act + '"' + (disabled ? ' disabled' : '') + ' style="width:100%">' + label + '</button></div></div>';
  }

  /* =====================================================================
     SAVED & EXPORT TAB
     ===================================================================== */
  function summaryText(t) {
    var p = t.params, b = E.budget(t), L = ['TRIP: ' + t.name, E.dest(t).name + ', ' + E.dest(t).country + ' · ' + p.start + ' to ' + E.addDays(p.start, p.days - 1) + ' · ' + p.travelers + ' traveler(s) from ' + D.ORIGINS[p.origin], 'Hotel: ' + E.hotelOf(t).name, ''];
    t.days.forEach(function (day, di) {
      var w = t.weather[di];
      L.push('Day ' + (di + 1) + ' - ' + fmtDay(t, di, true) + ' (' + D.WEATHER[w.type].label + ', ' + w.temp + 'C)');
      day.items.forEach(function (it, idx) { var a = E.getAttr(p.dest, it.aid); L.push('  ' + timeFor(day.items.length, idx) + '  ' + a.name + ' [' + (a.cost ? money(a.cost) + ' pp' : 'free') + ']'); });
    });
    L.push('', 'BUDGET (' + money(b.budget) + ')');
    E.LINE_ORDER.forEach(function (l) { if (b.lines[l[0]]) L.push('  ' + l[1] + ': ' + money(b.lines[l[0]])); });
    L.push('  TOTAL: ' + money(b.total) + ' (' + (b.remaining >= 0 ? money(b.remaining) + ' under' : money(-b.remaining) + ' over') + ')');
    var sp = E.spent(t); if (sp.total) L.push('', 'SPENT SO FAR: ' + money(sp.total));
    return L.join('\n');
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }
  function itineraryCSV(t) {
    var rows = [['Day', 'Date', 'Weather', 'Time', 'Activity', 'Category', 'Hours', 'Cost per person (USD)', 'Cost for group (USD)']];
    t.days.forEach(function (day, di) {
      day.items.forEach(function (it, idx) {
        var a = E.getAttr(t.params.dest, it.aid);
        rows.push([di + 1, E.dayDate(t, di), D.WEATHER[t.weather[di].type].label, timeFor(day.items.length, idx), a.name, D.CATS[a.cat].label, a.hours, a.cost, E.itemCost(t, it)]);
      });
    });
    return toCSV(rows);
  }
  function expensesCSV(t) {
    var rows = [['Date', 'Category', 'Note', 'Amount (USD)']];
    t.expenses.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (e) { rows.push([e.date, e.cat, e.note, e.amount]); });
    return toCSV(rows);
  }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime + ';charset=utf-8' }), url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function slug(t) { return t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip'; }

  function renderSaved() {
    var t = S.trip;
    $('#tab-saved').innerHTML =
      '<div class="card"><h3>💾 Saved trips</h3>' +
      '<p class="small ' + (Store.isPersistent() ? 'good' : 'warn') + '">' + (Store.isPersistent() ? '✔ Saving to this browser (localStorage). Your trips persist after closing the tab.' : '⚠ localStorage is unavailable here, so trips are kept in memory for this session only. Use Export to keep a copy.') + '</p>' +
      (t ? '<form class="row" id="saveForm" style="flex-wrap:nowrap"><input name="name" value="' + esc(t.name) + '" maxlength="60" aria-label="Trip name"><button class="primary nowrap">' + (t.savedId ? 'Update saved trip' : 'Save trip') + '</button>' + (t.savedId ? '<button type="button" class="nowrap" data-act="saveCopy">Save as copy</button>' : '') + '</form>' : '<p class="muted">Generate a trip to save it.</p>') +
      '<div style="margin-top:14px">' + (S.saved.length ? S.saved.map(function (s) {
        var b = E.budget(s);
        return '<div class="sugg"><div><b>' + esc(s.name) + (t && t.savedId === s.id ? ' <span class="pill good">open</span>' : '') + '</b><span class="small muted">' + E.dest(s).name + ' · ' + fmtISOLabel(s.params.start) + ' · ' + s.params.days + ' days · ' + money(b.total) + ' of ' + money(b.budget) + ' · ' + s.expenses.length + ' expense(s) · saved ' + new Date(s.savedAt).toLocaleString() + '</span></div>' +
          '<div class="row nowrap"><button class="sm" data-act="openSaved" data-id="' + s.id + '">Open</button><button class="sm" data-act="dupSaved" data-id="' + s.id + '">Duplicate</button><button class="sm" data-act="renSaved" data-id="' + s.id + '">Rename</button><button class="sm danger" data-act="delSaved" data-id="' + s.id + '">Delete</button></div></div>';
      }).join('') : '<p class="muted">No saved trips yet.</p>') + '</div></div>' +
      '<div class="card"><h3>📤 Export &amp; import</h3>' + (t ? '<div class="row">' +
        '<button data-act="exJSON">Trip (.json)</button><button data-act="exItin">Itinerary (.csv)</button><button data-act="exExp"' + (t.expenses.length ? '' : ' disabled') + '>Expenses (.csv)</button>' +
        '<button data-act="exText">Download summary (.txt)</button><button data-act="print">🖨 Print / save as PDF</button></div>' +
        '<div class="field" style="margin-top:14px"><label for="summaryBox">Shareable text summary</label><textarea id="summaryBox" rows="10" readonly>' + esc(summaryText(t)) + '</textarea><div class="row" style="margin-top:8px"><button class="sm" data-act="copyText">Copy to clipboard</button></div></div>' : '<p class="muted">Generate a trip to export it.</p>') +
      '<div class="field"><label for="importFile">Import a trip (.json exported from this app)</label><input type="file" id="importFile" accept=".json,application/json" data-chg="import"></div></div>' +
      '<div class="card"><h3>🧹 Reset</h3><p class="muted">Delete all saved trips and the current draft from this browser.</p><button class="danger" data-act="wipe">Delete all data</button></div>';
  }
  function saveCurrent(name, asCopy) {
    var t = S.trip; if (!t) return;
    t.name = (name || t.name).trim() || t.name;
    var snap = E.clone(t);
    snap.savedAt = Date.now();
    if (asCopy || !t.savedId) { snap.id = E.uid('s'); }
    else snap.id = t.savedId;
    var idx = S.saved.map(function (s) { return s.id; }).indexOf(snap.id);
    snap.savedId = snap.id;
    if (idx >= 0) S.saved[idx] = snap; else S.saved.unshift(snap);
    t.savedId = snap.id;
    commit('Trip saved');
  }
  function sanitizeImported(raw) {
    var tr = raw && raw.trip ? raw.trip : raw;
    if (!tr || !tr.params || !D.DESTS[tr.params.dest] || !Array.isArray(tr.days) || !Array.isArray(tr.weather)) throw new Error('This file is not a trip exported from this app.');
    var t = E.clone(tr), d = D.DESTS[t.params.dest];
    t.id = E.uid('t'); t.savedId = null;
    ['wishlist', 'extras', 'events', 'expenses'].forEach(function (k) { if (!Array.isArray(t[k])) t[k] = []; });
    t.closed = t.closed || {};
    t.params.interests = Array.isArray(t.params.interests) ? t.params.interests : [];
    if (!d.hotels.some(function (h) { return h.id === t.hotelId; })) t.hotelId = d.hotels[0].id;
    t.days.forEach(function (day) {
      day.items = (day.items || []).filter(function (it) { return it && E.getAttr(t.params.dest, it.aid); }).map(function (it) { it.uid = it.uid || E.uid('i'); return it; });
    });
    t.expenses = t.expenses.filter(function (e) { return e && isFinite(e.amount) && e.date && e.cat; });
    t.name = String(t.name || d.name + ' trip');
    return t;
  }

  /* =====================================================================
     ACTIONS
     ===================================================================== */
  var ACT = {
    goto: function (el) { show(el.dataset.tab); },
    demo: function () {
      S.form = E.defaultParams();
      S.form.dest = 'paris'; S.form.origin = 'nyc'; S.form.days = 4; S.form.travelers = 2; S.form.budget = 3200;
      S.form.style = 'comfort'; S.form.pace = 'balanced'; S.form.interests = ['culture', 'food', 'history'];
      generate(readForm().params, 'Demo trip loaded');
    },
    pickDest: function (el) { S.form.dest = el.dataset.id; drawDests(); updatePreview(); },
    generate: function () {
      var r = readForm();
      if (r.errors.length) { $('#formErrors').textContent = r.errors.join(' '); toast('Please fix the form', true); return; }
      generate(r.params);
    },
    remix: function () { S.trip = E.remix(S.trip); commit('Itinerary remixed'); },
    optimize: function () {
      var b = E.budget(S.trip);
      if (b.total <= b.budget) { toast('Already within budget!'); return; }
      var r = E.optimize(S.trip);
      if (!r.steps.length) { toast('No further savings available.', true); return; }
      S.trip = r.trip;
      S.chat.push({ who: 'bot', html: '<b>Auto-fit applied</b><ul>' + r.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' + (r.fits ? 'Now within budget.' : 'Still over budget; consider raising it or shortening the trip.') });
      commit(r.fits ? 'Plan now fits your budget' : 'Reduced cost, but still over budget');
    },
    applySugg: function (el) {
      var s = E.suggestions(S.trip).filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!s) return;
      S.trip = s.trip; commit('Applied: ' + s.title);
    },
    up: function (el) { E.moveItem(S.trip, el.dataset.uid, -1); commit(); },
    down: function (el) { E.moveItem(S.trip, el.dataset.uid, 1); commit(); },
    remove: function (el) { E.removeItem(S.trip, el.dataset.uid); commit('Removed (kept in wishlist)'); },
    add: function (el) {
      var di = +el.dataset.day, sel = $('#add-' + di);
      if (sel && sel.value) { E.addItem(S.trip, di, sel.value); commit('Activity added'); }
    },
    wlAdd: function (el) {
      var sel = $('#wl-' + el.dataset.aid);
      E.addItem(S.trip, +sel.value, el.dataset.aid); commit('Added from wishlist');
    },
    logItem: function (el) {
      var f = E.findItem(S.trip, el.dataset.uid); if (!f) return;
      var a = E.getAttr(S.trip.params.dest, f.item.aid);
      addExpense(S.trip, E.dayDate(S.trip, f.day), 'activities', E.itemCost(S.trip, f.item), a.name);
      f.item.logged = true; commit('Logged ' + money(E.itemCost(S.trip, f.item)) + ' to expenses');
    },
    ask: function (el) { ask(el.dataset.q); },
    editExp: function (el) { S.editExp = el.dataset.id; renderExpenses(); $('#expForm').scrollIntoView({ block: 'center' }); },
    cancelEdit: function () { S.editExp = null; renderExpenses(); },
    delExp: function (el) { S.trip.expenses = S.trip.expenses.filter(function (e) { return e.id !== el.dataset.id; }); if (S.editExp === el.dataset.id) S.editExp = null; commit('Expense deleted'); },
    sampleExp: function () { sampleExpenses(S.trip); commit('Sample expenses added'); },
    clearExp: function () { if (window.confirm('Delete all ' + S.trip.expenses.length + ' expenses?')) { S.trip.expenses = []; S.trip.days.forEach(function (d) { d.items.forEach(function (i) { delete i.logged; }); }); commit('Expenses cleared'); } },
    rain: function () { handle(X.rain(S.trip, +$('#rainDay').value)); },
    heat: function () { handle(X.heat(S.trip, +$('#heatDay').value)); },
    closure: function () { handle(X.closure(S.trip, $('#closeAttr').value)); },
    delay: function () { handle(X.delay(S.trip, +$('#delayHrs').value)); },
    strike: function () { handle(X.strike(S.trip, +$('#strikeDay').value)); },
    overbook: function () { handle(X.overbook(S.trip)); },
    clearWx: function () { handle(X.clear(S.trip, +$('#clearDay').value)); },
    undoEvent: function () { var ev = X.undo(S.trip); if (ev) commit('Undid: ' + ev.title); },
    clearEvents: function () { S.trip.events = []; commit('Log cleared'); },
    saveCopy: function () { saveCurrent($('#saveForm').name.value, true); },
    openSaved: function (el) {
      var s = S.saved.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!s) return;
      S.trip = E.clone(s); S.trip.savedId = s.id; S.form = E.clone(s.params); S.chat = [{ who: 'bot', html: 'Loaded <b>' + esc(s.name) + '</b>.' }];
      persist(); show('itinerary'); toast('Trip opened');
    },
    dupSaved: function (el) {
      var s = S.saved.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!s) return;
      var c = E.clone(s); c.id = E.uid('s'); c.savedId = c.id; c.name = s.name + ' (copy)'; c.savedAt = Date.now();
      S.saved.unshift(c); commit('Trip duplicated');
    },
    renSaved: function (el) {
      var s = S.saved.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!s) return;
      var n = window.prompt('Rename trip', s.name); if (n && n.trim()) { s.name = n.trim().slice(0, 60); if (S.trip && S.trip.savedId === s.id) S.trip.name = s.name; commit('Renamed'); }
    },
    delSaved: function (el) {
      var s = S.saved.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!s) return;
      if (!window.confirm('Delete "' + s.name + '"?')) return;
      S.saved = S.saved.filter(function (x) { return x.id !== s.id; });
      if (S.trip && S.trip.savedId === s.id) S.trip.savedId = null;
      commit('Trip deleted');
    },
    exJSON: function () { download(slug(S.trip) + '.json', JSON.stringify({ app: 'wayfinder-demo', version: 1, trip: S.trip }, null, 2), 'application/json'); toast('Trip exported'); },
    exItin: function () { download(slug(S.trip) + '-itinerary.csv', itineraryCSV(S.trip), 'text/csv'); toast('Itinerary exported'); },
    exExp: function () { download(slug(S.trip) + '-expenses.csv', expensesCSV(S.trip), 'text/csv'); toast('Expenses exported'); },
    exText: function () { download(slug(S.trip) + '-summary.txt', summaryText(S.trip), 'text/plain'); toast('Summary exported'); },
    print: function () { window.print(); },
    copyText: function () {
      var box = $('#summaryBox');
      function fallback() { box.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Select the text and copy manually', true); } }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(box.value).then(function () { toast('Copied'); }, fallback); else fallback();
    },
    wipe: function () {
      if (!window.confirm('Delete ALL saved trips and the current draft?')) return;
      Store.clear(); S.trip = null; S.saved = []; S.chat = []; S.form = E.defaultParams(); show('plan'); toast('All data deleted');
    }
  };
  function handle(r) {
    if (r && r.ok === false) { toast(r.msg, true); return; }
    commit('Disruption applied. See the alerts below.');
  }

  var CHG = {
    interest: function (el) {
      var i = S.form.interests, k = el.value, at = i.indexOf(k);
      if (el.checked && at < 0) i.push(k); else if (!el.checked && at >= 0) i.splice(at, 1);
      updatePreview();
    },
    hotel: function (el) { S.trip.hotelId = el.value; commit('Hotel changed'); },
    flightClass: function (el) { S.trip.flightClass = el.value; commit('Flights changed'); },
    foodTier: function (el) { S.trip.foodTier = el.value; commit('Dining level changed'); },
    localId: function (el) { S.trip.localId = el.value; commit('Local transport changed'); },
    moveDay: function (el) { if (el.value === '') return; E.moveToDay(S.trip, el.dataset.uid, +el.value); commit('Moved to day ' + (+el.value + 1)); },
    swap: function (el) { if (!el.value) return; E.replaceItem(S.trip, el.dataset.uid, el.value); commit('Activity swapped'); },
    budget: function (el) {
      var v = parseFloat(el.value);
      if (!(v >= 100)) { toast('Budget must be at least $100', true); render(); return; }
      S.trip.params.budget = Math.round(v); commit('Budget updated');
    },
    expFilter: function (el) { S.expFilter = el.value; renderExpenses(); },
    import: function (el) {
      var file = el.files && el.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var t = sanitizeImported(JSON.parse(fr.result));
          S.trip = t; S.form = E.clone(t.params); S.chat = [{ who: 'bot', html: 'Imported <b>' + esc(t.name) + '</b>.' }];
          persist(); show('itinerary'); toast('Trip imported');
        } catch (err) { toast(err.message || 'Could not read that file', true); }
      };
      fr.onerror = function () { toast('Could not read that file', true); };
      fr.readAsText(file);
    }
  };

  /* ---------- delegated events ---------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('#tabs button');
    if (tab) { show(tab.dataset.tab); return; }
    var el = e.target.closest('[data-act]');
    if (el && !el.disabled && ACT[el.dataset.act]) ACT[el.dataset.act](el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-chg]');
    if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el);
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-inp="form"]');
    if (el) { S.form[el.name] = el.value; updatePreview(); }
  });
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.id === 'askForm') { var inp = $('#askInput'); ask(inp.value); inp.value = ''; }
    else if (f.id === 'saveForm') saveCurrent(f.name.value, false);
    else if (f.id === 'expForm') {
      var amt = parseFloat(f.amount.value);
      if (!(amt > 0)) { toast('Enter an amount above zero', true); return; }
      if (!f.date.value) { toast('Choose a date', true); return; }
      if (S.editExp) {
        var ex = S.trip.expenses.filter(function (x) { return x.id === S.editExp; })[0];
        if (ex) { ex.date = f.date.value; ex.cat = f.cat.value; ex.amount = Math.round(amt * 100) / 100; ex.note = f.note.value.trim(); }
        S.editExp = null; commit('Expense updated');
      } else {
        addExpense(S.trip, f.date.value, f.cat.value, amt, f.note.value.trim());
        commit('Expense added');
      }
    }
  });

  /* ---------- boot ---------- */
  (function init() {
    var st = Store.load();
    S.saved = st.saved || [];
    if (st.current && st.current.params && D.DESTS[st.current.params.dest]) {
      try { S.trip = sanitizeImported(st.current); S.trip.id = st.current.id; S.trip.savedId = st.current.savedId || null; S.form = E.clone(S.trip.params); } catch (e) { S.trip = null; }
    }
    if (S.trip) S.chat = [{ who: 'bot', html: 'Welcome back! Your last trip <b>' + esc(S.trip.name) + '</b> was restored.' }];
    show(S.trip ? 'itinerary' : 'plan');
  })();
})();
