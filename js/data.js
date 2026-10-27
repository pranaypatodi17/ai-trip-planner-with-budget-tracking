/* Static sample data for the demo. No network, no APIs. All prices are USD. */
(function () {
  function A(id, name, cat, indoor, cost, hours, slot, rating, desc, closed) {
    return { id: id, name: name, cat: cat, indoor: !!indoor, cost: cost, hours: hours, slot: slot, rating: rating, desc: desc, closed: closed || [] };
  }
  function H(id, name, tier, nightly, rating, area, perks) {
    return { id: id, name: name, tier: tier, nightly: nightly, rating: rating, area: area, perks: perks };
  }

  var CATS = {
    culture:   { label: 'Culture',    icon: '🎭', color: '#8b5cf6' },
    history:   { label: 'History',    icon: '🏛️', color: '#b45309' },
    food:      { label: 'Food',       icon: '🍜', color: '#ea580c' },
    nature:    { label: 'Nature',     icon: '🌿', color: '#16a34a' },
    adventure: { label: 'Adventure',  icon: '🧗', color: '#dc2626' },
    relax:     { label: 'Relaxation', icon: '🧖', color: '#0891b2' },
    shopping:  { label: 'Shopping',   icon: '🛍️', color: '#db2777' },
    nightlife: { label: 'Nightlife',  icon: '🌃', color: '#4f46e5' }
  };

  var ORIGINS = {
    nyc: 'New York', lon: 'London', bom: 'Mumbai', syd: 'Sydney', sfo: 'San Francisco'
  };

  var FLIGHT_CLASSES = [
    { id: 'saver',    label: 'Saver (1 stop, basic)', mult: 0.82 },
    { id: 'economy',  label: 'Economy',               mult: 1 },
    { id: 'premium',  label: 'Premium Economy',       mult: 1.7 },
    { id: 'business', label: 'Business',              mult: 3.4 }
  ];

  var STYLES = {
    budget:  { label: 'Budget',  note: 'Hostels & guesthouses, street food, public transit' },
    comfort: { label: 'Comfort', note: 'Mid-range hotels, sit-down restaurants, mix of transit & taxis' },
    luxury:  { label: 'Luxury',  note: 'Boutique & 5-star stays, fine dining, private transfers' }
  };
  var FOOD_BASE = { budget: 30, comfort: 65, luxury: 140 };         // per person per day
  var LOCAL_BASE = { transit: 8, ride: 30, rental: 45 };            // transit per person/day, others per group/day
  var LOCAL_LABELS = {
    transit: 'Public transit pass',
    ride: 'Taxi / ride-hailing',
    rental: 'Rental car or scooter'
  };

  var DESTS = {
    paris: {
      id: 'paris', name: 'Paris', country: 'France', tagline: 'Art, cafés and iron-lace skylines',
      best: 'Culture · History · Food',
      climate: { mean: 12, amp: 9, hem: 1, rain: 0.3, hot: 0.1 },
      foodF: 1.15, localF: { transit: 1.1, ride: 1.2, rental: 1.2 },
      flights: { nyc: 620, lon: 140, bom: 720, syd: 1450, sfo: 780 },
      attractions: [
        A('louvre', 'Louvre Museum', 'culture', 1, 22, 3.5, 'morning', 4.8, 'Skip-the-line entry to the Mona Lisa and the great galleries.', [2]),
        A('eiffel', 'Eiffel Tower Summit', 'history', 0, 30, 2, 'evening', 4.7, 'Lift to the top for a sparkling night view of the city.'),
        A('montmartre', 'Montmartre & Sacré-Cœur Walk', 'history', 0, 0, 2.5, 'morning', 4.6, 'Cobbled lanes, painters\' square and a hilltop basilica.'),
        A('seine', 'Seine Evening Cruise', 'relax', 0, 18, 1.5, 'evening', 4.5, 'Glide past floodlit monuments with a drink in hand.'),
        A('orsay', 'Musée d\'Orsay', 'culture', 1, 16, 2.5, 'afternoon', 4.7, 'Impressionist masterpieces inside a grand old railway station.', [1]),
        A('marais', 'Le Marais Food Tour', 'food', 0, 85, 3, 'midday', 4.8, 'Falafel, pastries, cheese and wine across the historic quarter.'),
        A('versailles', 'Palace of Versailles', 'history', 0, 28, 5, 'morning', 4.6, 'Hall of Mirrors and royal gardens, a half-day out of town.', [1]),
        A('moulin', 'Cabaret Night at Moulin Rouge', 'nightlife', 1, 95, 2.5, 'evening', 4.4, 'Feathers, can-can and champagne in the iconic red windmill.'),
        A('luxgardens', 'Luxembourg Gardens Picnic', 'nature', 0, 6, 2, 'afternoon', 4.5, 'Boules, boats and a baguette picnic under the chestnut trees.'),
        A('canalbike', 'Canal Saint-Martin Bike Ride', 'adventure', 0, 35, 3, 'morning', 4.3, 'Guided cycle through the hip canals and hidden passages.'),
        A('galeries', 'Galeries Lafayette & Rooftop', 'shopping', 1, 0, 2, 'afternoon', 4.3, 'Belle-époque department store with a free rooftop panorama.')
      ],
      hotels: [
        H('paris-b', 'Hôtel du Marais Hostel', 'budget', 70, 4.1, 'Le Marais', 'Free breakfast, shared lounge'),
        H('paris-m1', 'Hôtel Lumière Montmartre', 'mid', 160, 4.4, 'Montmartre', 'Breakfast, Wi-Fi, rooftop terrace'),
        H('paris-m2', 'Maison Saint-Germain', 'mid', 195, 4.5, 'Saint-Germain', 'Courtyard garden, bike rental'),
        H('paris-l', 'Le Grand Étoile Palace', 'luxury', 520, 4.9, 'Champs-Élysées', 'Spa, Michelin dining, concierge')
      ]
    },
    tokyo: {
      id: 'tokyo', name: 'Tokyo', country: 'Japan', tagline: 'Neon, shrines and perfect ramen',
      best: 'Food · Culture · Nightlife',
      climate: { mean: 16, amp: 10, hem: 1, rain: 0.3, hot: 0.15 },
      foodF: 1.0, localF: { transit: 1.3, ride: 1.5, rental: 1.3 },
      flights: { nyc: 1150, lon: 980, bom: 620, syd: 780, sfo: 920 },
      attractions: [
        A('sensoji', 'Senso-ji Temple & Nakamise', 'history', 0, 0, 2, 'morning', 4.7, 'Tokyo\'s oldest temple with a lively street of snacks.'),
        A('shibuya', 'Shibuya Crossing & Sky Deck', 'culture', 0, 18, 1.5, 'evening', 4.5, 'Watch the famous scramble from above at dusk.'),
        A('tsukiji', 'Tsukiji Outer Market Tasting', 'food', 0, 40, 2.5, 'morning', 4.7, 'Fresh sushi, tamagoyaki and grilled seafood skewers.'),
        A('teamlab', 'teamLab Planets', 'culture', 1, 32, 2.5, 'afternoon', 4.8, 'Walk barefoot through immersive digital art rooms.'),
        A('meiji', 'Meiji Shrine Forest Walk', 'nature', 0, 0, 2, 'morning', 4.6, 'A calm wooded path to one of Japan\'s grandest shrines.'),
        A('akiba', 'Akihabara Arcades & Shopping', 'shopping', 1, 25, 3, 'afternoon', 4.4, 'Retro games, anime goods and claw-machine glory.'),
        A('goldengai', 'Golden Gai Bar Hop', 'nightlife', 1, 50, 3, 'evening', 4.5, 'Tiny themed bars packed into lantern-lit alleys.'),
        A('hakone', 'Hakone & Mt. Fuji Views Excursion', 'nature', 0, 120, 7, 'morning', 4.8, 'Ropeway, lake cruise and a postcard view of Fuji.'),
        A('onsen', 'Onsen & Spa Evening', 'relax', 1, 45, 2.5, 'evening', 4.6, 'Soak in hot mineral baths overlooking the city lights.'),
        A('tnm', 'Tokyo National Museum', 'culture', 1, 10, 2.5, 'afternoon', 4.5, 'Samurai swords, ukiyo-e prints and ancient ceramics.', [1]),
        A('ramen', 'Ramen Making Masterclass', 'food', 1, 55, 2.5, 'midday', 4.6, 'Knead, roll and slurp your own bowl with a local chef.'),
        A('gokart', 'Street Go-Kart Through Tokyo', 'adventure', 0, 90, 2, 'evening', 4.3, 'Costumed karting past the neon landmarks.')
      ],
      hotels: [
        H('tokyo-b', 'Shinjuku Capsule Inn', 'budget', 55, 4.0, 'Shinjuku', 'Capsule pod, shared onsen'),
        H('tokyo-m1', 'Asakusa Garden Hotel', 'mid', 140, 4.4, 'Asakusa', 'Breakfast, near Senso-ji'),
        H('tokyo-m2', 'Shibuya Stream Hotel', 'mid', 185, 4.5, 'Shibuya', 'Rooftop bar, co-working space'),
        H('tokyo-l', 'The Imperial Tower Tokyo', 'luxury', 480, 4.9, 'Marunouchi', 'Spa, sky lounge, butler service')
      ]
    },
    bali: {
      id: 'bali', name: 'Bali', country: 'Indonesia', tagline: 'Rice terraces, temples and sunsets',
      best: 'Nature · Relaxation · Adventure',
      climate: { mean: 30, amp: 1, hem: 0, rain: 0.35, hot: 0.1 },
      foodF: 0.5, localF: { transit: 0.5, ride: 0.55, rental: 0.5 },
      flights: { nyc: 1500, lon: 1150, bom: 520, syd: 480, sfo: 1250 },
      attractions: [
        A('tegalalang', 'Tegallalang Rice Terraces', 'nature', 0, 5, 2.5, 'morning', 4.6, 'Emerald terraces, jungle swings and fresh coconut.'),
        A('uluwatu', 'Uluwatu Temple & Kecak Dance', 'culture', 0, 12, 2.5, 'evening', 4.7, 'Clifftop temple and a fire dance at sunset.'),
        A('monkey', 'Ubud Monkey Forest', 'nature', 0, 8, 2, 'morning', 4.4, 'Ancient temples among mischievous macaques.'),
        A('batur', 'Mount Batur Sunrise Trek', 'adventure', 0, 45, 5, 'morning', 4.8, 'Pre-dawn hike to a volcano rim with breakfast cooked by steam.'),
        A('cooking', 'Balinese Cooking Class', 'food', 1, 35, 4, 'midday', 4.7, 'Market tour then grind, steam and feast.'),
        A('beachclub', 'Seminyak Beach Club Sunset', 'nightlife', 0, 20, 3, 'evening', 4.5, 'DJ sets, cocktails and a sky on fire.'),
        A('spa', 'Traditional Balinese Spa', 'relax', 1, 30, 2, 'afternoon', 4.8, 'Two-hour massage, flower bath and ginger tea.'),
        A('tirta', 'Tirta Empul Water Temple', 'history', 0, 10, 2, 'morning', 4.6, 'Join a purification ritual in sacred spring pools.'),
        A('artmarket', 'Ubud Art Market', 'shopping', 0, 0, 2, 'afternoon', 4.2, 'Handwoven bags, silver and carved masks. Bring bargaining skills.'),
        A('nusa', 'Nusa Penida Snorkel Day', 'adventure', 0, 85, 8, 'morning', 4.7, 'Fast boat, manta rays and turtle bays.'),
        A('lukisan', 'Museum Puri Lukisan', 'culture', 1, 8, 1.5, 'afternoon', 4.3, 'Balinese painting through the centuries, with a peaceful garden.')
      ],
      hotels: [
        H('bali-b', 'Ubud Bamboo Hostel', 'budget', 22, 4.2, 'Ubud', 'Pool, free breakfast, yoga deck'),
        H('bali-m1', 'Canggu Surf Villas', 'mid', 75, 4.4, 'Canggu', 'Private pool, scooter rental'),
        H('bali-m2', 'Sawah Retreat Ubud', 'mid', 95, 4.6, 'Ubud', 'Rice-field views, spa credits'),
        H('bali-l', 'Cliffside Uluwatu Resort', 'luxury', 310, 4.9, 'Uluwatu', 'Infinity pool, private butler')
      ]
    },
    rome: {
      id: 'rome', name: 'Rome', country: 'Italy', tagline: 'Two thousand years in every street',
      best: 'History · Food · Culture',
      climate: { mean: 16, amp: 9, hem: 1, rain: 0.2, hot: 0.25 },
      foodF: 1.0, localF: { transit: 0.9, ride: 1.0, rental: 1.1 },
      flights: { nyc: 680, lon: 160, bom: 640, syd: 1500, sfo: 880 },
      attractions: [
        A('colosseum', 'Colosseum & Roman Forum', 'history', 0, 24, 3.5, 'morning', 4.8, 'Walk the arena floor and the heart of ancient Rome.'),
        A('vatican', 'Vatican Museums & Sistine Chapel', 'culture', 1, 32, 3.5, 'morning', 4.8, 'Raphael rooms, tapestries and Michelangelo\'s ceiling.', [0]),
        A('trevi', 'Trevi Fountain & Spanish Steps Stroll', 'culture', 0, 0, 1.5, 'evening', 4.6, 'Toss a coin and eat gelato at golden hour.'),
        A('trastevere', 'Trastevere Food Walk', 'food', 0, 70, 3, 'midday', 4.8, 'Supplì, porchetta, cacio e pepe and natural wine.'),
        A('pantheon', 'Pantheon & Piazza Navona', 'history', 1, 5, 1.5, 'afternoon', 4.7, 'A 2,000-year-old dome with a hole in the sky.'),
        A('borghese', 'Villa Borghese Gardens by Bike', 'nature', 0, 12, 2.5, 'afternoon', 4.5, 'Pedal Rome\'s green lung to a lakeside rowboat.'),
        A('pasta', 'Handmade Pasta Class', 'food', 1, 65, 3, 'midday', 4.7, 'Fettuccine and tiramisu with a nonna-approved teacher.'),
        A('appia', 'Appian Way E-Bike Ride', 'adventure', 0, 45, 3.5, 'morning', 4.5, 'Cycle the Queen of Roads past tombs and aqueducts.'),
        A('corso', 'Via del Corso & Campo de\' Fiori Shopping', 'shopping', 0, 0, 2, 'afternoon', 4.1, 'Boutiques, leather goods and a lively morning market.'),
        A('testaccio', 'Testaccio Nightlife Tour', 'nightlife', 1, 40, 3, 'evening', 4.4, 'Cocktail bars and clubs in the old slaughterhouse district.'),
        A('terme', 'Thermal Spa Experience', 'relax', 1, 55, 2.5, 'afternoon', 4.4, 'Roman-style baths, steam and massage.'),
        A('galleria', 'Galleria Borghese', 'culture', 1, 20, 2, 'afternoon', 4.7, 'Bernini sculptures in a baroque villa. Timed entry.', [1])
      ],
      hotels: [
        H('rome-b', 'Termini Backpackers', 'budget', 60, 4.0, 'Termini', 'Free Wi-Fi, social kitchen'),
        H('rome-m1', 'Hotel Fontana Trastevere', 'mid', 150, 4.4, 'Trastevere', 'Breakfast, terrace'),
        H('rome-m2', 'Palazzo Navona Suites', 'mid', 210, 4.6, 'Navona', 'Historic building, A/C'),
        H('rome-l', 'Grand Hotel Imperiale', 'luxury', 450, 4.9, 'Via Veneto', 'Rooftop pool, spa')
      ]
    },
    lisbon: {
      id: 'lisbon', name: 'Lisbon', country: 'Portugal', tagline: 'Yellow trams, fado and custard tarts',
      best: 'Food · Nightlife · Relaxation',
      climate: { mean: 17, amp: 7, hem: 1, rain: 0.15, hot: 0.25 },
      foodF: 0.75, localF: { transit: 0.7, ride: 0.8, rental: 1.0 },
      flights: { nyc: 560, lon: 130, bom: 800, syd: 1650, sfo: 820 },
      attractions: [
        A('belem', 'Belém Tower & Jerónimos Monastery', 'history', 0, 15, 2.5, 'morning', 4.6, 'Manueline masterpieces on the Tagus waterfront.', [1]),
        A('tram28', 'Tram 28 Ride Through Alfama', 'culture', 0, 3, 1.5, 'morning', 4.4, 'Rattle uphill through the oldest, narrowest streets.'),
        A('nata', 'Pastéis de Nata Tasting Walk', 'food', 0, 30, 2, 'midday', 4.7, 'The best custard tarts in town, plus ginjinha cherry liqueur.'),
        A('sintra', 'Sintra: Pena Palace Day', 'history', 0, 22, 6, 'morning', 4.8, 'Fairy-tale hilltop palaces wrapped in forest.'),
        A('cascais', 'Cascais Coastal Cycle', 'nature', 0, 25, 4, 'morning', 4.5, 'Ride the Atlantic shoreline to Cabo da Roca.'),
        A('fado', 'Bairro Alto Fado & Bars', 'nightlife', 1, 35, 3, 'evening', 4.6, 'Live fado followed by bar-hopping in cobbled lanes.'),
        A('timeout', 'Time Out Market Dinner', 'food', 1, 25, 2, 'evening', 4.5, 'Dozens of star-chef stalls under one roof.'),
        A('lx', 'LX Factory Shopping', 'shopping', 0, 0, 2, 'afternoon', 4.3, 'Industrial-chic complex of bookshops, design and cafés.'),
        A('surf', 'Surf Lesson at Carcavelos', 'adventure', 0, 45, 2.5, 'morning', 4.4, 'Beginner-friendly waves with gear included.'),
        A('gulbenkian', 'Gulbenkian Museum', 'culture', 1, 10, 2, 'afternoon', 4.6, 'Egyptian, Islamic and European art in leafy gardens.', [2]),
        A('miradouro', 'Miradouro Sunset & Wine', 'relax', 0, 15, 2, 'evening', 4.7, 'Sip vinho verde on a hilltop viewpoint at sundown.')
      ],
      hotels: [
        H('lisbon-b', 'Alfama Sunrise Hostel', 'budget', 38, 4.3, 'Alfama', 'Free breakfast, rooftop'),
        H('lisbon-m1', 'Casa Chiado Boutique', 'mid', 115, 4.5, 'Chiado', 'Breakfast, walking distance to trams'),
        H('lisbon-m2', 'Baixa Pombaline Hotel', 'mid', 140, 4.4, 'Baixa', 'Central, A/C, bar'),
        H('lisbon-l', 'Palácio do Tejo', 'luxury', 380, 4.9, 'Príncipe Real', 'Garden pool, fine dining')
      ]
    },
    capetown: {
      id: 'capetown', name: 'Cape Town', country: 'South Africa', tagline: 'Mountain, ocean and vineyards',
      best: 'Nature · Adventure · Food',
      climate: { mean: 17, amp: 5, hem: -1, rain: 0.2, hot: 0.15 },
      foodF: 0.6, localF: { transit: 0.5, ride: 0.7, rental: 1.0 },
      flights: { nyc: 1250, lon: 780, bom: 680, syd: 1180, sfo: 1550 },
      attractions: [
        A('table', 'Table Mountain Cable Car', 'nature', 0, 28, 3, 'morning', 4.8, 'Rotating cable car to the flat-topped summit.'),
        A('robben', 'Robben Island Tour', 'history', 0, 35, 4, 'morning', 4.6, 'Ferry and guided visit to Mandela\'s prison cell.'),
        A('capepoint', 'Cape Point & Boulders Penguins', 'nature', 0, 40, 7, 'morning', 4.8, 'Dramatic cliffs and penguins on a sheltered beach.'),
        A('waterfront', 'V&A Waterfront Shopping', 'shopping', 1, 0, 3, 'afternoon', 4.4, 'Craft markets, harbour views and sea lions.'),
        A('wine', 'Stellenbosch Wine Tasting', 'food', 1, 45, 4, 'midday', 4.8, 'Cellar-door tastings with mountain-view lunch.'),
        A('bokaap', 'Bo-Kaap Walk & Cape Malay Cooking', 'culture', 0, 30, 2.5, 'midday', 4.6, 'Colourful houses, spice stories and samoosas.'),
        A('kayak', 'Kayak with Seals', 'adventure', 0, 55, 3, 'morning', 4.5, 'Paddle out of Hout Bay beside playful Cape fur seals.'),
        A('camps', 'Camps Bay Sunset & Cocktails', 'nightlife', 0, 25, 3, 'evening', 4.5, 'Beach bars below the Twelve Apostles.'),
        A('zeitz', 'Zeitz MOCAA', 'culture', 1, 14, 2, 'afternoon', 4.5, 'Africa\'s largest contemporary art museum in a grain silo.'),
        A('spa-ct', 'Mountain-View Spa Afternoon', 'relax', 1, 70, 2.5, 'afternoon', 4.6, 'Massage, sauna and a quiet pool.'),
        A('district6', 'District Six Museum', 'history', 1, 5, 1.5, 'afternoon', 4.5, 'Stories of a community and its forced removal.', [0]),
        A('braai', 'Braai Dinner Experience', 'food', 1, 38, 2.5, 'evening', 4.5, 'Live-fire grilling, boerewors and local wines.')
      ],
      hotels: [
        H('capetown-b', 'Long Street Backpackers', 'budget', 30, 4.1, 'City Bowl', 'Rooftop bar, tour desk'),
        H('capetown-m1', 'Sea Point Boutique Hotel', 'mid', 95, 4.5, 'Sea Point', 'Pool, ocean views'),
        H('capetown-m2', 'Green Point Lodge', 'mid', 120, 4.4, 'Green Point', 'Breakfast, near stadium'),
        H('capetown-l', 'Table Bay Grand', 'luxury', 340, 4.9, 'Waterfront', 'Spa, harbour-view suites')
      ]
    }
  };

  // Fallback activities used to fill gaps or replace disrupted plans.
  var GENERIC = {
    free:  { id: 'free',  name: 'Free time & local wandering', cat: 'relax', indoor: false, cost: 0, hours: 2, slot: 'afternoon', rating: 4.0, desc: 'No plans. Explore on foot, find a bench, people-watch.', closed: [] },
    cafe:  { id: 'cafe',  name: 'Cafe & indoor market browsing', cat: 'food', indoor: true, cost: 8, hours: 1.5, slot: 'afternoon', rating: 4.1, desc: 'Dry, comfortable and delicious: a local cafe with a nearby covered market.', closed: [] },
    pool:  { id: 'pool',  name: 'Hotel pool, lounge & rest', cat: 'relax', indoor: true, cost: 0, hours: 2, slot: 'afternoon', rating: 4.0, desc: 'Recharge at your hotel and plan tomorrow.', closed: [] }
  };

  var TIME_SETS = {
    1: ['10:00'],
    2: ['09:30', '19:00'],
    3: ['09:30', '14:00', '19:00'],
    4: ['09:00', '11:30', '14:30', '19:00'],
    5: ['09:00', '11:00', '13:30', '16:00', '19:30'],
    6: ['08:30', '10:30', '12:30', '15:00', '17:30', '20:00']
  };

  var SLOT_RANK = { morning: 0, midday: 1, afternoon: 2, evening: 3 };
  var PACE_SLOTS = {
    relaxed:  ['morning', 'evening'],
    balanced: ['morning', 'afternoon', 'evening'],
    packed:   ['morning', 'midday', 'afternoon', 'evening']
  };

  var WEATHER = {
    sunny:  { label: 'Sunny',        icon: '☀️' },
    cloudy: { label: 'Partly cloudy', icon: '⛅' },
    rain:   { label: 'Heavy rain',   icon: '🌧️' },
    hot:    { label: 'Heatwave',     icon: '🔥' }
  };

  window.TripData = {
    CATS: CATS, ORIGINS: ORIGINS, FLIGHT_CLASSES: FLIGHT_CLASSES, STYLES: STYLES,
    FOOD_BASE: FOOD_BASE, LOCAL_BASE: LOCAL_BASE, LOCAL_LABELS: LOCAL_LABELS,
    DESTS: DESTS, GENERIC: GENERIC, TIME_SETS: TIME_SETS, SLOT_RANK: SLOT_RANK,
    PACE_SLOTS: PACE_SLOTS, WEATHER: WEATHER
  };
})();
