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

- **Four acts, each a branching map** in the style of Slay the Spire: the Chapel Ruins, the Drowned Archive, the Catacombs, and the Last Library. Pick your path through delves, unknown events, merchants and scriptoria.
- **Delves:** small dungeons generated fresh each time. Explore by tapping a tile or with WASD or the arrow keys, then find the way out. Haunted delves hold an elite on the way out.
- **Delve conditions** shown on the map: Flooded, Lightless, Ossuary, Collapsing and Hallowed ground each change what the delve is like.
- **Pests** that go after your cards: Paper Moths eat paper, Ink Leeches smudge cheap pages, Rust Wraiths tarnish silver and gold.
- **Deck viewer:** tap Deck in the top bar, or press V, from anywhere in a run.
- **Pale ink**, a sixth color that repeats your last card, plus **Bleed** and **Frail**.
- **Delve secrets:** cracked walls with hidden rooms, traps in the corridors, and trapdoors to a richer level beneath.
- **Unlocks:** new enchantments and relics as your Grimoire fills, and a **daily descent** with the same seed for everyone.
- **The Rag Merchant's story:** his ledger of favors, and what he knows about Vell. Vell also remarks on what you have written.
- **Touch:** swipe to walk in delves; press and hold (or right-click) a card for its details.
- **Scriptoria:** craft, then choose to rest or refill your lantern.
- **A storyline:** Sister Vell, the Inkbinder who went down before you. How you treat her decides whether she stands with you against the Grimoire, or against you.
- **Act guardians:** one of two per act (the Bell Warden or the Hollow Bishop, the Pale Scrivener or the Leviathan Index, the Ossuary Saint or the Bone Cantor), and finally the Unbound Grimoire. At half health each one enters a second phase.
- **Depths:** eight harder levels, unlocked one at a time by winning. Each adds a rule on top of the last.
- **Dread:** the longer you wander, the more often monsters find you.
- **Lantern oil:** your light shrinks as oil runs low. Burn a card for oil, or climb back to the surface to refill.
- **Hand-drawn pixel art** for the Inkbinder, dungeon tiles, scavenge spots, enemies, and the ink glyphs on cards.
- **Writing desks:** craft cards with a live preview, add monster parts to existing cards, mend worn cards and salvage. What you scavenge is ready to use; slate, silver and gold are spent as you inscribe. When the ink stirs, you are one part from a named spell.
- **A second ink** on any card costs 1 more mana and builds that pair's reaction into the card.
- **Signatures:** rename the cards you cast most, and give each Heirloom a signature (Weightless, Unfading or Resonant).
- **Monster parts are enchantments** (Moth Wing = Swift, Hound Fang = Leech, and so on).
- **Durability:** paper and wood cards wear out across the run. Stone, silver and gold are permanent.
- **Thirteen hidden recipes** of up to four parts each (two of them forbidden), recorded in a Grimoire that is saved in your browser and carries over between runs.
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
| `js/crafting.js` | Turns a blueprint into a card; pickups, recipe hints, signatures |
| `js/combat.js` | Fight rules |
| `js/run.js` | Run state: map moves, inventory, crafting, re-inscribe, mend, camps, rewards, shop, salvage |
| `js/overworld.js` | The branching act maps |
| `js/world.js` | Delve generation, fog of war, pathfinding, random encounters |
| `js/explore-view.js` | Draws the dungeon on a canvas |
| `js/sprites.js` | The pixel art: every sprite as rows of palette letters, plus the renderer |
| `js/events.js` | Random event and storyline outcomes |
| `js/meta.js` | Saved progress: the Grimoire, lifetime stats, sound preference |
| `js/audio.js` | Synthesized sound effects and ambience |
| `js/main.js` | Screens and input |
| `tests/` | Rules tests |
