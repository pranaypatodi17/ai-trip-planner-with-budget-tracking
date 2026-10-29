/* "AI" assistant. Pure keyword rules over the current trip; nothing leaves the browser. */
(function () {
  var E = window.Engine, D = window.TripData;
  var money = E.money;

  function activityItems(trip) {
    var out = [];
    trip.days.forEach(function (day, di) {
      day.items.forEach(function (it) {
        var a = E.getAttr(trip.params.dest, it.aid);
        if (a && !E.isGeneric(a.id)) out.push({ a: a, di: di });
      });
    });
    return out;
  }

  function why(trip) {
    var p = trip.params, d = E.dest(trip), b = E.budget(trip);
    var acts = activityItems(trip);
    var matched = acts.filter(function (x) { return p.interests.indexOf(x.a.cat) >= 0; });
    var lines = [];
    lines.push('Built for <b>' + p.travelers + ' traveler' + (p.travelers > 1 ? 's' : '') + '</b> in <b>' + d.name + '</b>, <b>' + D.STYLES[p.style].label.toLowerCase() + '</b> style with a <b>' + p.pace + '</b> pace (' + D.PACE_SLOTS[p.pace].length + ' activities on a full day).');
    if (p.interests.length) lines.push(matched.length + ' of ' + acts.length + ' scheduled activities match your interests (' + p.interests.map(function (i) { return D.CATS[i].label.toLowerCase(); }).join(', ') + ').');
    else lines.push('No interests selected, so I chose the highest-rated attractions.');
    var rainy = trip.weather.filter(function (w) { return w.type === 'rain'; }).length;
    var hot = trip.weather.filter(function (w) { return w.type === 'hot'; }).length;
    if (rainy || hot) lines.push('Weather rules: ' + (rainy ? rainy + ' rainy day' + (rainy > 1 ? 's' : '') + ' got indoor-leaning activities. ' : '') + (hot ? hot + ' hot day' + (hot > 1 ? 's' : '') + ' keep outdoor plans to cooler hours.' : ''));
    else lines.push('The forecast looks dry, so outdoor highlights are placed on their best days.');
    lines.push('Day 1 is lighter for arrival and the final day leaves time for departure. Places closed on a given weekday are never scheduled that day.');
    lines.push(b.status === 'over'
      ? 'Heads up: the plan is <b>' + money(-b.remaining) + ' over</b> your ' + money(b.budget) + ' budget. See the Budget tab for one-click fixes.'
      : 'The plan totals <b>' + money(b.total) + '</b>, leaving <b>' + money(b.remaining) + '</b> of your budget.');
    return lines;
  }

  function packing(trip) {
    var types = {}, min = 99, max = -99;
    trip.weather.forEach(function (w) { types[w.type] = true; min = Math.min(min, w.temp); max = Math.max(max, w.temp); });
    var list = ['Comfortable walking shoes', 'Power adapter & portable charger', 'Copies of passport & bookings'];
    if (types.rain) list.push('Compact umbrella or rain jacket');
    if (types.sunny || types.hot) list.push('Sunscreen, sunglasses & a refillable water bottle');
    if (types.hot || max >= 28) list.push('Light breathable clothing and a hat');
    if (min < 14) list.push('Warm layers (lows around ' + min + '°C)');
    if (activityItems(trip).some(function (x) { return x.a.cat === 'adventure'; })) list.push('Quick-dry activewear for adventure activities');
    if (activityItems(trip).some(function (x) { return x.a.cat === 'relax'; })) list.push('Swimsuit for spa or pool time');
    return list;
  }

  function tips(trip) {
    var t = [], b = E.budget(trip), L = b.lines;
    var biggest = Object.keys(L).sort(function (a, c) { return L[c] - L[a]; })[0];
    var names = { flights: 'flights', lodging: 'lodging', food: 'food', transport: 'local transport', activities: 'activities', extras: 'disruption costs', buffer: 'contingency' };
    t.push('Your biggest cost is ' + names[biggest] + ' (' + money(L[biggest]) + ', ' + Math.round(L[biggest] / b.total * 100) + '% of the trip).');
    var free = activityItems(trip).filter(function (x) { return x.a.cost === 0; }).length;
    if (free) t.push(free + ' of your activities are free. Great for the budget.');
    var d = E.dest(trip);
    t.push('Best for: ' + d.best + '.');
    return t;
  }

  function weatherSummary(trip) {
    var parts = trip.weather.map(function (w, i) {
      return 'Day ' + (i + 1) + ': ' + D.WEATHER[w.type].icon + ' ' + D.WEATHER[w.type].label.toLowerCase() + ' ' + w.temp + '°C';
    });
    var best = -1, bestN = -1;
    trip.weather.forEach(function (w, i) {
      if (w.type === 'rain') return;
      var n = trip.days[i].items.filter(function (it) { var a = E.getAttr(trip.params.dest, it.aid); return a && !a.indoor && !E.isGeneric(a.id); }).length;
      if (n > bestN) { bestN = n; best = i; }
    });
    return { parts: parts, best: best };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var SUGGESTED = [
    'Is my budget realistic?', 'What should I pack?', 'How can I save money?',
    'What if it rains?', 'What are the highlights?', 'Tell me about my hotel'
  ];

  function answer(trip, q) {
    var s = (q || '').toLowerCase();
    var b = E.budget(trip), d = E.dest(trip);
    var m;
    if ((m = s.match(/day\s*(\d+)/))) {
      var di = +m[1] - 1;
      if (di < 0 || di >= trip.days.length) return 'Your trip has days 1 to ' + trip.days.length + '.';
      var w = trip.weather[di];
      var items = trip.days[di].items.map(function (it) { var a = E.getAttr(trip.params.dest, it.aid); return esc(a.name) + ' (' + (a.cost ? money(a.cost) + ' pp' : 'free') + ')'; });
      return '<b>Day ' + (di + 1) + '</b> — ' + D.WEATHER[w.type].icon + ' ' + D.WEATHER[w.type].label + ', ' + w.temp + '°C.<br>' + (items.length ? items.join(' → ') : 'No activities planned.');
    }
    if (/budget|afford|realistic|cost|price|expens|total|enough|money/.test(s) && !/save|cheap|reduce/.test(s)) {
      var L = b.lines;
      var msg = 'Your plan costs <b>' + money(b.total) + '</b> against a <b>' + money(b.budget) + '</b> budget (' + Math.round(b.pct * 100) + '%). ';
      msg += b.status === 'over' ? '<b>That is over budget by ' + money(-b.remaining) + '.</b> ' : b.status === 'warn' ? 'It fits but with little spare room. ' : 'That leaves a comfortable ' + money(b.remaining) + '. ';
      msg += 'That is about ' + money(b.perDay) + ' per day or ' + money(b.perPerson) + ' per person. Flights ' + money(L.flights) + ', lodging ' + money(L.lodging) + ', food ' + money(L.food) + '.';
      if (b.status === 'over') { var f = E.optimize(trip); msg += '<br>Auto-fit would ' + (f.fits ? 'bring it under budget' : 'cut as much as possible') + ' with ' + f.steps.length + ' change' + (f.steps.length === 1 ? '' : 's') + '. Try the Budget tab.'; }
      return msg;
    }
    if (/pack|bring|wear|clothes|luggage/.test(s)) {
      return '<b>Packing list</b> based on your forecast:<ul>' + packing(trip).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
    }
    if (/save|cheap|reduce|cut|lower|less/.test(s)) {
      var sg = E.suggestions(trip).filter(function (x) { return x.kind === 'save'; }).slice(0, 3);
      if (!sg.length) return 'You are already at the lowest-cost options I know for this destination.';
      return '<b>Biggest savings:</b><ul>' + sg.map(function (x) { return '<li>' + esc(x.title) + ' — saves <b>' + money(-x.delta) + '</b></li>'; }).join('') + '</ul>Apply any of them in the Budget tab.';
    }
    if (/rain|weather|forecast|storm|sun|hot|heat|umbrella/.test(s)) {
      var ws = weatherSummary(trip);
      var r = '<b>Forecast</b><br>' + ws.parts.join('<br>');
      if (ws.best >= 0) r += '<br><br>Best day for outdoor highlights: <b>Day ' + (ws.best + 1) + '</b>.';
      r += '<br>If it rains, report heavy rain under <i>Live alerts</i> and I will swap outdoor stops for indoor ones.';
      return r;
    }
    if (/hotel|stay|sleep|room|lodg|accommodation/.test(s)) {
      var h = E.hotelOf(trip);
      var alts = d.hotels.filter(function (x) { return x.id !== h.id; }).map(function (x) { return esc(x.name) + ' (' + money(x.nightly) + ', ' + x.tier + ')'; });
      return 'You are staying at <b>' + esc(h.name) + '</b> in ' + esc(h.area) + ': ' + money(h.nightly) + '/night × ' + E.nights(trip) + ' nights × ' + E.rooms(trip) + ' room(s) = <b>' + money(h.nightly * E.nights(trip) * E.rooms(trip)) + '</b>. ' + esc(h.perks) + '.<br>Alternatives: ' + alts.join('; ') + '.';
    }
    if (/food|eat|restaurant|dinner|lunch|meal|hungry/.test(s)) {
      var fi = activityItems(trip).filter(function (x) { return x.a.cat === 'food'; });
      return 'Food budget: <b>' + money(E.foodPerPersonDay(trip)) + '</b> per person per day (' + trip.foodTier + ' level), <b>' + money(b.lines.food) + '</b> in total.' + (fi.length ? '<br>Food experiences planned: ' + fi.map(function (x) { return esc(x.a.name) + ' (day ' + (x.di + 1) + ')'; }).join(', ') + '.' : '<br>No food experiences in your itinerary yet. Add one from the Itinerary tab.');
    }
    if (/best|top|highlight|must|recommend|favou?rite/.test(s)) {
      var top = activityItems(trip).sort(function (a, c) { return c.a.rating - a.a.rating; }).slice(0, 3);
      return '<b>Top-rated stops in your plan:</b><ul>' + top.map(function (x) { return '<li>' + esc(x.a.name) + ' — ★ ' + x.a.rating + ' (day ' + (x.di + 1) + ')</li>'; }).join('') + '</ul>';
    }
    if (/hello|hi\b|hey|help|what can/.test(s)) return 'Hi! Ask me about your <b>budget</b>, <b>packing</b>, <b>weather</b>, <b>savings</b>, <b>hotel</b>, <b>food</b>, or a specific day (e.g. “day 2”).';
    return 'I can answer questions about your budget, packing, weather, savings, hotel, food, highlights, or a specific day (try “day 2”).';
  }

  window.Assistant = { why: why, packing: packing, tips: tips, answer: answer, SUGGESTED: SUGGESTED, weatherSummary: weatherSummary };
})();
