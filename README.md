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

- A 9-stop run: crafting benches, fights, an elite, a shop, and the Unbound Grimoire as the boss.
- The crafting bench: card material + one or two ink colors + ink material + enchantments, with a live preview.
- Durability: paper and wood cards wear out across the run. Stone, silver and gold are permanent.
- Ingredients from enemy drops, the shop, salvaging cards, and cards that break.
- Four hidden recipes that get recorded in your Grimoire.

### Code layout

| File | What it does |
|---|---|
| `js/data.js` | All tunable numbers: ingredients, enemies, recipes, the run path |
| `js/crafting.js` | Turns a blueprint into a card |
| `js/combat.js` | Fight rules |
| `js/run.js` | Run state: inventory, rewards, shop, salvage |
| `js/main.js` | Screens and input |
| `tests/` | Rules tests |
