# SpellCrafter

A dark fantasy roguelike deckbuilder where you craft your own spell cards. You play an Inkbinder: card crafting is the magic system.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design.

## Web prototype

Plain HTML, CSS and JavaScript modules, with no build step.

```sh
npm start        # serves the game at http://localhost:8000
npm test         # runs the rules tests (Node 18+)
```

Opening `index.html` straight from disk won't work, because browsers block JavaScript modules on `file://` pages. Use `npm start`, or any static file server.

### What's in it

- **Four dungeon floors** that are generated fresh each run: the Chapel Ruins, the Drowned Archive, the Catacombs, and the Last Library where the boss waits. Explore by tapping a tile or with WASD or the arrow keys.
- **Scavenging:** raw materials from the environment, reliquary boxes, and an elite on each floor.
- **Floor guardians:** a boss stands on each floor's stairs down: the Bell Warden, the Pale Scrivener, the Ossuary Saint, and finally the Unbound Grimoire. At half health each one enters a second phase.
- **Dread:** the longer you wander, the more often monsters find you.
- **Lantern oil:** your light shrinks as oil runs low. Burn a card for oil, or climb back to the surface to refill.
- **Hand-drawn pixel art** for the Inkbinder, dungeon tiles, scavenge spots, enemies, and the ink glyphs on cards.
- **Writing desks:** refine raw materials, craft cards with a live preview, add monster parts to existing cards, mend worn cards, salvage, and rest.
- **Monster parts are enchantments** (Moth Wing = Swift, Hound Fang = Leech, and so on).
- **Durability:** paper and wood cards wear out across the run. Stone, silver and gold are permanent.
- **Thirteen hidden recipes** (two of them forbidden), recorded in a Grimoire that is saved in your browser and carries over between runs.
- **Four Inkbinders** to unlock: the Inkbinder, Bloodscribe, Ash Monk and Gilded Heretic.
- **Deeper crafting:** rare inks (Ichor, Ghostlight), glinting pristine finds, cards that become Well-Worn and Heirlooms, and Corruption, which unlocks forbidden recipes.
- **Ink reactions:** cast inscribed cards of different inks back to back to set off Storm, Brand, Hexfire and seven more.
- **Relics:** ten passive trinkets from elites, reliquaries and the merchant.
- **Autosave:** close the tab and pick up where you left off from the title screen.
- **Random events** with choices: Candle Shrine, Trapped Scribe, Ink Well, Hanged Lanterns, Chained Book, Dead Peddler, Mirror Pool, Ink-Stained Altar.
- **Animation and synthesized sound:** smooth movement, hit effects, floating numbers, screen shake, ink-colored particles, and a per-floor ambient drone. Toggle sound in the top bar.
- **Guided first run:** one-time tips the first time you explore, craft, fight, run low on oil, or meet a guardian.

### Code layout

| File | What it does |
|---|---|
| `js/data.js` | All tunable numbers: ingredients, enemies, recipes, the run path |
| `js/crafting.js` | Turns a blueprint into a card |
| `js/combat.js` | Fight rules |
| `js/run.js` | Run state: inventory, refining, re-inscribe, mend, rewards, shop, salvage |
| `js/world.js` | Dungeon generation, fog of war, pathfinding, random encounters |
| `js/explore-view.js` | Draws the dungeon on a canvas |
| `js/sprites.js` | The pixel art: every sprite as rows of palette letters, plus the renderer |
| `js/events.js` | Random event outcomes |
| `js/meta.js` | Saved progress: the Grimoire, lifetime stats, sound preference |
| `js/audio.js` | Synthesized sound effects and ambience |
| `js/main.js` | Screens and input |
| `tests/` | Rules tests |
