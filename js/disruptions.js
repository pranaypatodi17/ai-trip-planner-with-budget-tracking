/* Simulated "live" disruptions. Nothing is fetched: each control applies predefined rules to the trip. */
(function () {
  var E = window.Engine, D = window.TripData;

  function snapshot(trip) {
    return JSON.stringify({
      days: trip.days, weather: trip.weather, hotelId: trip.hotelId, extras: trip.extras,
      closed: trip.closed, wishlist: trip.wishlist, localId: trip.localId
    });
  }
  function restore(trip, snap) {
    var s = JSON.parse(snap);
    Object.keys(s).forEach(function (k) { trip[k] = s[k]; });
  }
  function unwish(trip, aid) { trip.wishlist = trip.wishlist.filter(function (x) { return x !== aid; }); }
  function nm(trip, aid) { var a = E.getAttr(trip.params.dest, aid); return a ? a.name : aid; }
  function log(trip, type, icon, title, lines, snap, before) {
    var after = E.budget(trip).total;
    trip.events.unshift({
      id: E.uid('e'), ts: Date.now(), type: type, icon: icon, title: title, lines: lines,
      delta: after - before, undo: snap
    });
  }
  function dayLabel(trip, di) {
    var d = E.parseDate(E.dayDate(trip, di));
    return 'Day ' + (di + 1) + ' (' + d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ')';
  }
  function setWeather(trip, di, type) {
    var t = trip.weather[di].temp;
    if (type === 'rain') t = t - 3;
    if (type === 'hot') t = Math.max(t, 33);
    trip.weather[di] = { type: type, temp: t, forced: true };
  }

  /* 1. Storm: every outdoor activity is swapped for an indoor alternative. */
  function rain(trip, di) {
    var snap = snapshot(trip), before = E.budget(trip).total, lines = [];
    if (trip.weather[di].type === 'rain' && trip.weather[di].forced) return { ok: false, msg: dayLabel(trip, di) + ' is already a storm day.' };
    setWeather(trip, di, 'rain');
    lines.push('Forecast changed to heavy rain for ' + dayLabel(trip, di) + '.');
    trip.days[di].items.forEach(function (it) {
      var a = E.getAttr(trip.params.dest, it.aid);
      if (a && !a.indoor) {
        var rep = E.findReplacement(trip, di, a.id, { indoorOnly: true });
        lines.push('Outdoor “' + a.name + '” → indoor “' + nm(trip, rep) + '”.');
        it.aid = rep; unwish(trip, rep); it.note = 'Rain rule: swapped from ' + a.name; delete it.logged;
        if (!E.isGeneric(a.id) && trip.wishlist.indexOf(a.id) < 0) trip.wishlist.push(a.id);
      }
    });
    if (lines.length === 1) lines.push('Every activity that day was already indoors. No changes needed.');
    log(trip, 'rain', '🌧️', 'Heavy rain on ' + dayLabel(trip, di), lines, snap, before);
    return { ok: true };
  }

  /* 2. Heatwave: outdoor midday/afternoon items trade places with indoor morning/evening items, else are swapped. */
  function heat(trip, di) {
    var snap = snapshot(trip), before = E.budget(trip).total, lines = [];
    if (trip.weather[di].type === 'hot' && trip.weather[di].forced) return { ok: false, msg: dayLabel(trip, di) + ' is already a heatwave day.' };
    setWeather(trip, di, 'hot');
    lines.push('Forecast changed to ' + trip.weather[di].temp + '°C heatwave for ' + dayLabel(trip, di) + '.');
    var items = trip.days[di].items;
    items.forEach(function (it, idx) {
      var a = E.getAttr(trip.params.dest, it.aid);
      if (!a || a.indoor) return;
      // Hot hours are the middle of the day: any slot that is neither first nor last.
      if (idx === 0 || idx === items.length - 1) return;
      var swap = null;
      [0, items.length - 1].forEach(function (j) {
        var b = E.getAttr(trip.params.dest, items[j].aid);
        if (!swap && b && b.indoor) swap = j;
      });
      if (swap !== null) {
        var other = items[swap], bn = nm(trip, other.aid);
        items[idx] = other; items[swap] = it;
        it.note = 'Heat rule: moved to cooler time'; 
        lines.push('Swapped times: “' + a.name + '” ↔ “' + bn + '” so you are outdoors in cooler hours.');
      } else {
        var rep = E.findReplacement(trip, di, a.id, { indoorOnly: true });
        lines.push('Outdoor “' + a.name + '” → air-conditioned “' + nm(trip, rep) + '”.');
        it.aid = rep; unwish(trip, rep); it.note = 'Heat rule: swapped from ' + a.name; delete it.logged;
        if (trip.wishlist.indexOf(a.id) < 0) trip.wishlist.push(a.id);
      }
    });
    if (lines.length === 1) lines.push('Your hot-hours slots were already indoors or in the early morning / evening. Tip: carry water and sunscreen.');
    else lines.push('Tip: carry water, sunscreen and a hat.');
    log(trip, 'heat', '🔥', 'Heatwave on ' + dayLabel(trip, di), lines, snap, before);
    return { ok: true };
  }

  /* 3. Closure: attraction closed for the whole trip; every booking replaced with best same-category alternative. */
  function closure(trip, aid) {
    var snap = snapshot(trip), before = E.budget(trip).total, lines = [];
    var a = E.getAttr(trip.params.dest, aid);
    if (!a || E.isGeneric(aid)) return { ok: false, msg: 'Choose an attraction from your itinerary.' };
    trip.closed = trip.closed || {};
    trip.closed[aid] = true;
    lines.push('“' + a.name + '” is closed unexpectedly (maintenance / strike).');
    trip.days.forEach(function (day, di) {
      day.items.forEach(function (it) {
        if (it.aid !== aid) return;
        var wxBad = E.isOutdoorBad(trip.weather[di].type, a.slot);
        var rep = E.findReplacement(trip, di, aid, { indoorOnly: wxBad });
        lines.push(dayLabel(trip, di) + ': replaced with “' + nm(trip, rep) + '” (' + (E.getAttr(trip.params.dest, rep).cat) + ').');
        it.aid = rep; unwish(trip, rep); it.note = 'Closure rule: replaces ' + a.name; delete it.logged;
      });
    });
    trip.wishlist = trip.wishlist.filter(function (x) { return x !== aid; });
    if (lines.length === 1) lines.push('It was not in your itinerary, so nothing changed; it is now hidden from suggestions.');
    log(trip, 'closure', '🚧', '“' + a.name + '” closed', lines, snap, before);
    return { ok: true };
  }

  /* 4. Flight delay: early day-1 plans are bumped to the wishlist and extra costs appear. */
  function delay(trip, hours) {
    var snap = snapshot(trip), before = E.budget(trip).total, lines = [];
    var t = trip.params.travelers;
    lines.push('Your inbound flight is delayed by ' + hours + ' hours.');
    var items = trip.days[0].items, dropN = 0;
    if (hours >= 12) dropN = items.length;
    else if (hours >= 6) dropN = Math.max(0, items.length - 1);
    else if (hours >= 3) dropN = Math.min(1, items.length);
    var dropped = items.splice(0, dropN);
    dropped.forEach(function (it) {
      if (E.isGeneric(it.aid)) return;
      if (trip.wishlist.indexOf(it.aid) < 0) trip.wishlist.push(it.aid);
      lines.push('Day 1 “' + nm(trip, it.aid) + '” can no longer fit. Moved to your wishlist.');
    });
    if (!trip.days[0].items.length) {
      trip.days[0].items.push({ uid: E.uid('i'), aid: 'pool', slot: 'afternoon', note: 'Delay rule: arrive and rest' });
      lines.push('Day 1 is now a rest evening at the hotel.');
    }
    if (hours >= 3) { trip.extras.push({ id: E.uid('x'), label: 'Airport snacks & lounge (delay)', amount: 15 * t }); lines.push('Added ' + E.money(15 * t) + ' for snacks / lounge access.'); }
    if (hours >= 6) { trip.extras.push({ id: E.uid('x'), label: 'Late-night taxi transfer (delay)', amount: 60 }); lines.push('Added $60 for a late-night taxi to the hotel.'); }
    if (hours >= 12) { trip.extras.push({ id: E.uid('x'), label: 'Rebooking fee (delay)', amount: 40 * t }); lines.push('Added ' + E.money(40 * t) + ' rebooking fee.'); }
    if (hours < 3) lines.push('A short delay: no itinerary changes, just allow extra time.');
    log(trip, 'delay', '🛬', 'Flight delayed ' + hours + 'h', lines, snap, before);
    return { ok: true };
  }

  /* 5. Transit strike: long day-trips are swapped for nearby options and a taxi surcharge may apply. */
  function strike(trip, di) {
    var snap = snapshot(trip), before = E.budget(trip).total, lines = [];
    lines.push('A transit strike hits ' + dayLabel(trip, di) + '.');
    trip.days[di].items.forEach(function (it) {
      var a = E.getAttr(trip.params.dest, it.aid);
      if (a && a.hours >= 5) {
        var rep = E.findReplacement(trip, di, a.id, { maxHours: 3, indoorOnly: E.isOutdoorBad(trip.weather[di].type, a.slot) });
        lines.push('Far-away “' + a.name + '” → nearby “' + nm(trip, rep) + '”.');
        it.aid = rep; unwish(trip, rep); it.note = 'Strike rule: swapped from ' + a.name; delete it.logged;
        if (trip.wishlist.indexOf(a.id) < 0) trip.wishlist.push(a.id);
      }
    });
    if (trip.localId === 'transit') {
      var taxi = Math.round(D.LOCAL_BASE.ride * E.dest(trip).localF.ride);
      var extra = Math.max(20, taxi - E.localDayCost(trip));
      extra = Math.max(extra, 20);
      trip.extras.push({ id: E.uid('x'), label: 'Taxis during strike, Day ' + (di + 1), amount: extra });
      lines.push('Switched to taxis for the day: +' + E.money(extra) + '.');
    } else {
      lines.push('You use ' + D.LOCAL_LABELS[trip.localId].toLowerCase() + ', so no extra transport cost.');
    }
    log(trip, 'strike', '🚧', 'Transit strike on ' + dayLabel(trip, di), lines, snap, before);
    return { ok: true };
  }

  /* 6. Hotel overbooked: rebook within the same tier, otherwise one tier down. */
  function overbook(trip) {
    var snap = snapshot(trip), before = E.budget(trip).total, lines = [];
    var cur = E.hotelOf(trip), hs = E.dest(trip).hotels;
    lines.push(cur.name + ' reports an overbooking and cancels your reservation.');
    var alt = hs.filter(function (h) { return h.tier === cur.tier && h.id !== cur.id; })[0];
    if (!alt) {
      var sorted = E.hotelsSorted(trip), idx = sorted.map(function (h) { return h.id; }).indexOf(cur.id);
      alt = idx > 0 ? sorted[idx - 1] : sorted[1];
    }
    trip.hotelId = alt.id;
    var diff = (alt.nightly - cur.nightly) * E.nights(trip) * E.rooms(trip);
    lines.push('Rebooked at ' + alt.name + ' (' + alt.area + ', ' + E.money(alt.nightly) + '/night).');
    lines.push('Room cost changes by ' + (diff >= 0 ? '+' : '') + E.money(diff) + ' for the stay.');
    log(trip, 'overbook', '🏨', 'Hotel overbooked', lines, snap, before);
    return { ok: true };
  }

  /* Weather back to the forecast for one day (does not undo itinerary swaps). */
  function clear(trip, di) {
    var snap = snapshot(trip), before = E.budget(trip).total;
    trip.weather[di] = E.weatherFor(trip.params.dest, E.dayDate(trip, di));
    log(trip, 'clear', '🌤️', 'Forecast refreshed for ' + dayLabel(trip, di), ['Weather restored to the original forecast. Existing swaps stay in place; use Undo or the wishlist to bring activities back.'], snap, before);
    return { ok: true };
  }

  function undo(trip) {
    var ev = trip.events.shift();
    if (!ev) return null;
    var keep = trip.events;
    restore(trip, ev.undo);
    trip.events = keep;
    return ev;
  }

  window.Disruptions = { rain: rain, heat: heat, closure: closure, delay: delay, strike: strike, overbook: overbook, clear: clear, undo: undo, dayLabel: dayLabel };
})();
