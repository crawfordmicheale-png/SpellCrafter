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

- **Three dungeon floors** that are generated fresh each run: the Chapel Ruins, the Drowned Archive, and the Last Library where the boss waits. Explore by tapping a tile or with WASD or the arrow keys.
- **Scavenging:** raw materials from the environment, reliquary boxes, and a guardian elite on each floor.
- **Dread:** the longer you wander, the more often monsters find you.
- **Writing desks:** refine raw materials, craft cards with a live preview, add monster parts to existing cards, mend worn cards, salvage, and rest.
- **Monster parts are enchantments** (Moth Wing = Swift, Hound Fang = Leech, and so on).
- **Durability:** paper and wood cards wear out across the run. Stone, silver and gold are permanent.
- **Seven hidden recipes**, recorded in your Grimoire.

### Code layout

| File | What it does |
|---|---|
| `js/data.js` | All tunable numbers: ingredients, enemies, recipes, the run path |
| `js/crafting.js` | Turns a blueprint into a card |
| `js/combat.js` | Fight rules |
| `js/run.js` | Run state: inventory, refining, re-inscribe, mend, rewards, shop, salvage |
| `js/world.js` | Dungeon generation, fog of war, pathfinding, random encounters |
| `js/explore-view.js` | Draws the dungeon on a canvas |
| `js/main.js` | Screens and input |
| `tests/` | Rules tests |
