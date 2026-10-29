# Wayfinder: static AI trip planner with budget tracking

A complete demo that runs by **opening `index.html` in a browser**. No install, no server, no build step, no API keys, no network.

## What is in the box

| Path | Purpose |
| --- | --- |
| `index.html` | Single page app shell |
| `css/styles.css` | All styling (incl. print styles) |
| `js/data.js` | Sample data: 6 destinations, ~65 attractions, 24 hotels, flight prices from 5 origin cities, transport, food and climate data |
| `js/engine.js` | Itinerary generator, weather model, budget maths, savings/upgrade suggestions, auto-fit |
| `js/disruptions.js` | Rule-based "live" events (rain, heatwave, closure, flight delay, transit strike, hotel overbooking) with undo |
| `js/assistant.js` | Simulated AI: explains the plan and answers questions with keyword rules |
| `js/store.js` | localStorage persistence with in-memory fallback |
| `js/ui.js` | Rendering and interactions |
| `assets/img/` | Local SVG images (destinations, hotels, logo) |

## Try it in two minutes

1. Open `index.html`, click **Load demo trip** (or pick a destination, budget, interests and click **Generate**).
2. **Itinerary**: remove, reorder, move between days, swap, or add activities; change hotel, flights, dining or local transport. Costs update instantly. Ask the planner questions ("day 2", "what should I pack?").
3. **Budget**: see the breakdown and formulas, lower the budget below the plan and click **Auto-fit to budget**, or apply individual savings and upgrades.
4. **Expenses**: log, edit and delete spending, or load sample expenses. See planned vs actual and a projected total.
5. **Live demo**: trigger rain, heatwave, closures, flight delays, strikes or overbooking and watch the itinerary and budget adapt. Use **Undo last**.
6. **Saved & export**: save/open/duplicate/rename/delete trips; export JSON, itinerary CSV, expenses CSV, text summary; print or save as PDF; re-import JSON.

## How the "AI" and "live updates" work

There is no model and no feed. Itineraries are built by scoring sample attractions (interest match, rating, time-of-day fit, cost, opening days, weather suitability) and filling day slots greedily. "Remix" changes a seed to vary choices. Weather is a deterministic pseudo-random forecast per destination and date. Disruptions only happen when you press a demo control, and each one applies a predefined rule.

## Notes

- All prices are fictional sample figures in USD.
- Data is stored in your browser's localStorage. If it is blocked (some private modes), the app keeps data in memory for the session and says so on the Saved tab.
- Scripts are classic `<script>` tags (not ES modules) so everything works from `file://`.
- Tested in Chromium; any modern browser should work.

## Images

`assets/img/photos/*.jpg` holds the destination and hotel photos (AI-generated, supplied by the project owner and cropped to 1200×700; the originals were small, so they are slightly soft at full width). To swap in higher-resolution images, replace the files with the same names: `paris`, `tokyo`, `bali`, `rome`, `lisbon`, `capetown`, `hotel-budget`, `hotel-mid`, `hotel-luxury`. If a JPG is missing, the app falls back to the SVG illustration in `assets/img/`. Everything is bundled locally, so the demo works offline.
