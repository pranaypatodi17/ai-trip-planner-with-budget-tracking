/* Planning engine: weather, itinerary generation, budget maths, suggestions. All local rules. */
(function () {
  var D = window.TripData;

  /* ---------- helpers ---------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function rand(seed) { return hash(String(seed)) / 4294967296; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return (p || 'id') + Math.random().toString(36).slice(2, 9); }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return fmtISO(d); }
  function dayDate(trip, di) { return addDays(trip.params.start, di); }
  function weekday(trip, di) { return parseDate(dayDate(trip, di)).getDay(); }
  function dest(trip) { return D.DESTS[trip.params.dest]; }
  function money(n) {
    var neg = n < 0; n = Math.round(Math.abs(n));
    return (neg ? '-' : '') + '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* ---------- attractions ---------- */
  function getAttr(destId, aid) {
    var d = D.DESTS[destId];
    for (var i = 0; i < d.attractions.length; i++) if (d.attractions[i].id === aid) return d.attractions[i];
    return D.GENERIC[aid] || null;
  }
  function usedIds(trip) {
    var used = {};
    trip.days.forEach(function (day) { day.items.forEach(function (it) { used[it.aid] = true; }); });
    return used;
  }
  function isOutdoorBad(type, slot) {
    if (type === 'rain') return true;
    if (type === 'hot') return slot === 'midday' || slot === 'afternoon';
    return false;
  }
  function isGeneric(aid) { return !!D.GENERIC[aid]; }

  /* ---------- weather (deterministic per destination + date) ---------- */
  function weatherFor(destId, dateStr) {
    var c = D.DESTS[destId].climate;
    var m = parseDate(dateStr).getMonth() + 1;
    var seasonal = c.hem === 0 ? 0 : c.hem * Math.cos((m - 7.5) / 12 * 2 * Math.PI);
    var temp = Math.round(c.mean + c.amp * seasonal + (rand(destId + dateStr + 't') - 0.5) * 6);
    var r = rand(destId + dateStr + 'w');
    var type;
    if (r < c.rain) { type = 'rain'; temp -= 3; }
    else if (temp >= 32 || (temp >= 27 && r > 1 - c.hot)) type = 'hot';
    else type = r < 0.55 ? 'sunny' : 'cloudy';
    return { type: type, temp: temp };
  }

  /* ---------- scoring & scheduling ---------- */
  function slotAffinity(a, slot) {
    if (a.slot === slot) return 2;
    var d = Math.abs(D.SLOT_RANK[a.slot] - D.SLOT_RANK[slot]);
    return d === 1 ? 0.6 : -1.2;
  }
  function score(trip, a, slot, di, perSlotCap) {
    var p = trip.params;
    if (a.closed.indexOf(weekday(trip, di)) >= 0) return -Infinity;
    if (trip.closed && trip.closed[a.id]) return -Infinity;
    var w = trip.weather[di].type;
    var s = a.rating;
    if (p.interests.indexOf(a.cat) >= 0) s += 3;
    s += slotAffinity(a, slot);
    if (isOutdoorBad(w, slot)) s += a.indoor ? 2 : -6;
    if (a.hours >= 5 && slot !== 'morning') s -= 8;
    if (a.hours >= 6 && (p.pace === 'relaxed')) s -= 2;
    s -= Math.min(3, a.cost / perSlotCap);
    if (trip.seed) s += (rand(trip.seed + '|' + a.id + '|' + di) - 0.5) * 2.4;
    return s;
  }
  function slotsForDay(trip, di) {
    var slots = D.PACE_SLOTS[trip.params.pace].slice();
    if (di === 0 && slots.length > 2) slots.shift();
    if (di === trip.params.days - 1 && slots.length > 2) slots.pop();
    return slots;
  }
  function generic(trip, di) {
    return trip.weather[di].type === 'rain' ? 'cafe' : 'free';
  }

  function schedule(trip) {
    var d = dest(trip), p = trip.params;
    var used = {};
    var perSlotCap = Math.max(15, (p.budget * 0.2 / p.travelers) / (p.days * 3));
    trip.days = [];
    for (var di = 0; di < p.days; di++) {
      var items = [];
      slotsForDay(trip, di).forEach(function (slot) {
        var best = null, bestScore = -Infinity;
        d.attractions.forEach(function (a) {
          if (used[a.id]) return;
          var s = score(trip, a, slot, di, perSlotCap);
          if (s > bestScore) { bestScore = s; best = a; }
        });
        if (best && bestScore > 2) { used[best.id] = true; items.push({ uid: uid('i'), aid: best.id, slot: slot }); }
        else items.push({ uid: uid('i'), aid: generic(trip, di), slot: slot });
      });
      trip.days.push({ items: items });
    }
    return trip;
  }

  /* ---------- trip creation ---------- */
  function defaultHotel(destObj, style) {
    var tier = style === 'budget' ? 'budget' : style === 'luxury' ? 'luxury' : 'mid';
    var list = destObj.hotels.filter(function (h) { return h.tier === tier; });
    return list[0].id;
  }
  function defaultParams() {
    var s = new Date(); s.setDate(s.getDate() + 30);
    return {
      origin: 'nyc', dest: 'lisbon', start: fmtISO(s), days: 5, travelers: 2, budget: 3500,
      style: 'comfort', pace: 'balanced', interests: ['food', 'culture', 'nightlife'], flightClass: 'economy'
    };
  }
  function create(params, seed) {
    var p = clone(params);
    var d = D.DESTS[p.dest];
    var trip = {
      id: uid('t'), savedId: null, name: d.name + ' · ' + p.days + ' days',
      createdAt: Date.now(), seed: seed || 0, params: p,
      hotelId: defaultHotel(d, p.style), foodTier: p.style,
      localId: p.style === 'luxury' ? 'ride' : 'transit', flightClass: p.flightClass,
      weather: [], days: [], wishlist: [], extras: [], events: [], expenses: [], closed: {}
    };
    for (var i = 0; i < p.days; i++) trip.weather.push(weatherFor(p.dest, addDays(p.start, i)));
    return schedule(trip);
  }
  function remix(trip) {
    var t = clone(trip);
    t.seed = (t.seed || 0) + 1;
    schedule(t);
    t.wishlist = [];
    return t;
  }

  /* ---------- budget ---------- */
  function hotelOf(trip) {
    var hs = dest(trip).hotels;
    for (var i = 0; i < hs.length; i++) if (hs[i].id === trip.hotelId) return hs[i];
    return hs[0];
  }
  function flightClassOf(trip) {
    return D.FLIGHT_CLASSES.filter(function (c) { return c.id === trip.flightClass; })[0] || D.FLIGHT_CLASSES[1];
  }
  function flightPerPerson(trip) {
    return Math.round(dest(trip).flights[trip.params.origin] * flightClassOf(trip).mult);
  }
  function foodPerPersonDay(trip) {
    return Math.round(D.FOOD_BASE[trip.foodTier] * dest(trip).foodF);
  }
  function localDayCost(trip, localId) {
    var id = localId || trip.localId;
    var base = D.LOCAL_BASE[id] * dest(trip).localF[id];
    return Math.round(id === 'transit' ? base * trip.params.travelers : base);
  }
  function itemCost(trip, item) {
    var a = getAttr(trip.params.dest, item.aid);
    return a ? a.cost * trip.params.travelers : 0;
  }
  function nights(trip) { return Math.max(1, trip.params.days - 1); }
  function rooms(trip) { return Math.ceil(trip.params.travelers / 2); }

  var LINE_ORDER = [
    ['flights', 'Flights', '✈️', '#2563eb'],
    ['lodging', 'Lodging', '🏨', '#7c3aed'],
    ['food', 'Food & drink', '🍽️', '#ea580c'],
    ['transport', 'Local transport', '🚇', '#0891b2'],
    ['activities', 'Activities', '🎟️', '#16a34a'],
    ['extras', 'Disruption costs', '⚠️', '#dc2626'],
    ['buffer', 'Contingency (8%)', '🛟', '#64748b']
  ];

  function budget(trip) {
    var p = trip.params, L = {};
    L.flights = flightPerPerson(trip) * p.travelers;
    L.lodging = hotelOf(trip).nightly * nights(trip) * rooms(trip);
    L.food = foodPerPersonDay(trip) * p.days * p.travelers;
    L.transport = localDayCost(trip) * p.days;
    L.activities = 0;
    trip.days.forEach(function (day) { day.items.forEach(function (it) { L.activities += itemCost(trip, it); }); });
    L.extras = trip.extras.reduce(function (s, e) { return s + e.amount; }, 0);
    var sub = L.flights + L.lodging + L.food + L.transport + L.activities + L.extras;
    L.buffer = Math.round(sub * 0.08);
    var total = sub + L.buffer;
    var pct = p.budget > 0 ? total / p.budget : 0;
    return {
      lines: L, total: total, budget: p.budget, remaining: p.budget - total, pct: pct,
      status: pct <= 0.9 ? 'good' : pct <= 1 ? 'warn' : 'over',
      perPerson: total / p.travelers, perDay: total / p.days
    };
  }

  /* Expense categories map onto the planned lines. */
  var EXP_CATS = [
    ['flights', 'Flights', '✈️'],
    ['lodging', 'Lodging', '🏨'],
    ['food', 'Food & drink', '🍽️'],
    ['transport', 'Local transport', '🚇'],
    ['activities', 'Activities', '🎟️'],
    ['other', 'Shopping & other', '🛍️']
  ];
  function planned(trip) {
    var b = budget(trip).lines;
    return {
      flights: b.flights, lodging: b.lodging, food: b.food, transport: b.transport,
      activities: b.activities, other: b.extras + b.buffer
    };
  }
  function spent(trip) {
    var s = { flights: 0, lodging: 0, food: 0, transport: 0, activities: 0, other: 0 }, total = 0;
    trip.expenses.forEach(function (e) { s[e.cat] = (s[e.cat] || 0) + e.amount; total += e.amount; });
    s.total = total;
    return s;
  }

  /* ---------- itinerary operations ---------- */
  function findItem(trip, id) {
    for (var d = 0; d < trip.days.length; d++) {
      for (var i = 0; i < trip.days[d].items.length; i++) {
        if (trip.days[d].items[i].uid === id) return { day: d, index: i, item: trip.days[d].items[i] };
      }
    }
    return null;
  }
  function removeItem(trip, id) {
    var f = findItem(trip, id); if (!f) return;
    trip.days[f.day].items.splice(f.index, 1);
    if (!isGeneric(f.item.aid) && trip.wishlist.indexOf(f.item.aid) < 0) trip.wishlist.push(f.item.aid);
  }
  function insertByRank(trip, di, item) {
    var a = getAttr(trip.params.dest, item.aid);
    var rank = a ? D.SLOT_RANK[a.slot] : 2;
    var items = trip.days[di].items, pos = items.length;
    for (var i = 0; i < items.length; i++) {
      var b = getAttr(trip.params.dest, items[i].aid);
      if (b && D.SLOT_RANK[b.slot] > rank) { pos = i; break; }
    }
    items.splice(pos, 0, item);
  }
  function addItem(trip, di, aid) {
    var a = getAttr(trip.params.dest, aid);
    if (!a) return false;
    trip.wishlist = trip.wishlist.filter(function (x) { return x !== aid; });
    insertByRank(trip, di, { uid: uid('i'), aid: aid, slot: a.slot });
    return true;
  }
  function moveItem(trip, id, dir) {
    var f = findItem(trip, id); if (!f) return;
    var items = trip.days[f.day].items, j = f.index + dir;
    if (j < 0 || j >= items.length) return;
    var t = items[f.index]; items[f.index] = items[j]; items[j] = t;
  }
  function moveToDay(trip, id, di) {
    var f = findItem(trip, id); if (!f || f.day === di) return;
    trip.days[f.day].items.splice(f.index, 1);
    insertByRank(trip, di, f.item);
  }
  function replaceItem(trip, id, aid) {
    var f = findItem(trip, id); if (!f) return;
    var old = f.item.aid;
    f.item.aid = aid; delete f.item.note; delete f.item.logged;
    var a = getAttr(trip.params.dest, aid);
    if (a) f.item.slot = a.slot;
    trip.wishlist = trip.wishlist.filter(function (x) { return x !== aid; });
    return old;
  }
  /* Options offered in "add" / "swap" menus: unused, open that weekday, plus fallback generics. */
  function available(trip, di) {
    var used = usedIds(trip), out = [];
    var w = trip.weather[di].type, wd = weekday(trip, di);
    dest(trip).attractions.forEach(function (a) {
      if (used[a.id]) return;
      out.push({
        a: a,
        closedToday: a.closed.indexOf(wd) >= 0,
        closedNow: !!(trip.closed && trip.closed[a.id]),
        weatherOk: !(w === 'rain' && !a.indoor) && !(w === 'hot' && !a.indoor && a.slot !== 'morning' && a.slot !== 'evening')
      });
    });
    ['cafe', 'free', 'pool'].forEach(function (g) {
      out.push({ a: D.GENERIC[g], closedToday: false, closedNow: false, weatherOk: true });
    });
    return out;
  }

  /* Best replacement for a disrupted item (used by rain, heat, closure and strike rules). */
  function findReplacement(trip, di, oldAid, opts) {
    opts = opts || {};
    var old = getAttr(trip.params.dest, oldAid);
    var used = usedIds(trip), wd = weekday(trip, di);
    var best = null, bestScore = -Infinity;
    dest(trip).attractions.forEach(function (a) {
      if (used[a.id] || a.id === oldAid) return;
      if (a.closed.indexOf(wd) >= 0 || (trip.closed && trip.closed[a.id])) return;
      if (opts.indoorOnly && !a.indoor) return;
      if (opts.maxHours && a.hours > opts.maxHours) return;
      var s = a.rating;
      if (old && a.cat === old.cat) s += 3;
      if (trip.params.interests.indexOf(a.cat) >= 0) s += 2;
      if (old) s -= Math.abs(a.cost - old.cost) / 40;
      if (s > bestScore) { bestScore = s; best = a; }
    });
    if (best) return best.id;
    return opts.indoorOnly ? 'cafe' : 'free';
  }

  /* ---------- budget suggestions ---------- */
  function hotelsSorted(trip) { return dest(trip).hotels.slice().sort(function (a, b) { return a.nightly - b.nightly; }); }

  function suggestions(trip) {
    var out = [], base = budget(trip), d = dest(trip);
    function add(id, kind, title, desc, fn) {
      var t = clone(trip);
      if (fn(t) === false) return;
      var delta = budget(t).total - base.total;
      if (kind === 'save' && delta >= 0) return;
      if (kind === 'upgrade' && (delta <= 0 || delta > base.remaining)) return;
      out.push({ id: id, kind: kind, title: title, desc: desc, delta: delta, trip: t });
    }
    // Flights
    var ci = D.FLIGHT_CLASSES.indexOf(flightClassOf(trip));
    if (ci > 0) {
      var lower = D.FLIGHT_CLASSES[ci - 1];
      add('flight-down', 'save', 'Fly ' + lower.label, 'Same route with a cheaper fare class.', function (t) { t.flightClass = lower.id; });
    }
    // Hotel step down
    var hs = hotelsSorted(trip), cur = hotelOf(trip), hi = hs.map(function (h) { return h.id; }).indexOf(cur.id);
    if (hi > 0) {
      var lowH = hs[hi - 1];
      add('hotel-down', 'save', 'Stay at ' + lowH.name, lowH.area + ' · ' + money(lowH.nightly) + '/night (' + lowH.tier + ').', function (t) { t.hotelId = lowH.id; });
    }
    // Food
    var tiers = ['budget', 'comfort', 'luxury'], ti = tiers.indexOf(trip.foodTier);
    if (ti > 0) add('food-down', 'save', 'Eat at ' + tiers[ti - 1] + ' places', 'Swap to ' + tiers[ti - 1] + '-level dining most days.', function (t) { t.foodTier = tiers[ti - 1]; });
    // Local transport
    var curLocal = localDayCost(trip);
    ['transit', 'ride', 'rental'].forEach(function (id) {
      if (id !== trip.localId && localDayCost(trip, id) < curLocal) {
        add('local-' + id, 'save', 'Use: ' + D.LOCAL_LABELS[id], 'Cheaper daily local transport.', function (t) { t.localId = id; });
      }
    });
    // Replace the priciest paid activity
    var worst = null;
    trip.days.forEach(function (day, di) {
      day.items.forEach(function (it) {
        var a = getAttr(trip.params.dest, it.aid);
        if (a && a.cost > 0 && (!worst || a.cost > worst.a.cost)) worst = { a: a, it: it, di: di };
      });
    });
    if (worst) {
      var rep = findReplacement(trip, worst.di, worst.a.id, { indoorOnly: worst.a.indoor });
      var repA = getAttr(trip.params.dest, rep);
      if (repA && repA.cost < worst.a.cost) {
        add('act-swap', 'save', 'Swap “' + worst.a.name + '”', 'Replace with “' + repA.name + '” (' + money(repA.cost) + ' pp vs ' + money(worst.a.cost) + ' pp).', function (t) { replaceItem(t, worst.it.uid, rep); });
      }
    }
    // Upgrades when under budget
    if (hi < hs.length - 1) {
      var upH = hs[hi + 1];
      add('hotel-up', 'upgrade', 'Upgrade to ' + upH.name, upH.area + ' · ' + money(upH.nightly) + '/night · ' + upH.perks + '.', function (t) { t.hotelId = upH.id; });
    }
    if (ci < D.FLIGHT_CLASSES.length - 1) {
      var upF = D.FLIGHT_CLASSES[ci + 1];
      add('flight-up', 'upgrade', 'Upgrade flights to ' + upF.label, 'More comfort for the long haul.', function (t) { t.flightClass = upF.id; });
    }
    if (ti < 2) add('food-up', 'upgrade', 'Treat yourself: ' + tiers[ti + 1] + ' dining', 'Better restaurants for the whole trip.', function (t) { t.foodTier = tiers[ti + 1]; });
    out.sort(function (a, b) { return a.delta - b.delta; });
    return out;
  }

  /* Rule-based auto-fit: apply the least painful cuts until the plan fits. */
  function optimize(trip) {
    var t = clone(trip), steps = [];
    var priority = ['local-transit', 'local-ride', 'flight-down', 'hotel-down', 'food-down', 'act-swap'];
    for (var guard = 0; guard < 25; guard++) {
      if (budget(t).total <= t.params.budget) break;
      var sugg = suggestions(t).filter(function (s) { return s.kind === 'save'; });
      var pick = null;
      for (var i = 0; i < priority.length && !pick; i++) {
        pick = sugg.filter(function (s) { return s.id === priority[i]; })[0];
      }
      if (!pick) break;
      steps.push(pick.title + ' (saves ' + money(-pick.delta) + ')');
      t = pick.trip;
    }
    return { trip: t, steps: steps, fits: budget(t).total <= t.params.budget };
  }

  window.Engine = {
    clone: clone, uid: uid, money: money, parseDate: parseDate, fmtISO: fmtISO, addDays: addDays, dayDate: dayDate, weekday: weekday,
    dest: dest, getAttr: getAttr, usedIds: usedIds, isGeneric: isGeneric, isOutdoorBad: isOutdoorBad,
    weatherFor: weatherFor, defaultParams: defaultParams, create: create, remix: remix,
    hotelOf: hotelOf, flightClassOf: flightClassOf, flightPerPerson: flightPerPerson, foodPerPersonDay: foodPerPersonDay,
    localDayCost: localDayCost, itemCost: itemCost, nights: nights, rooms: rooms,
    LINE_ORDER: LINE_ORDER, EXP_CATS: EXP_CATS, budget: budget, planned: planned, spent: spent,
    findItem: findItem, removeItem: removeItem, addItem: addItem, moveItem: moveItem, moveToDay: moveToDay,
    replaceItem: replaceItem, available: available, findReplacement: findReplacement,
    suggestions: suggestions, optimize: optimize, hotelsSorted: hotelsSorted, rand: rand
  };
})();
