import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craftCard, validateBlueprint, findRecipe } from '../js/crafting.js';
import { createCombat, playCard, endTurn, effectiveCost } from '../js/combat.js';
import { createRun, craftIntoDeck, salvageCard, reinscribe, mend, descend, burnCard, resurface, rest, gainRelic as gainRelicFor, applyRewards, serializeRun, deserializeRun, enterNode, leaveDelve, campChoice, buyOil, currentNode } from '../js/run.js';
import { generateMap, availableNodes } from '../js/overworld.js';
import { generateRegion, findPath, step, isFloor, objectAt, lightRadius } from '../js/world.js';
import { RECIPES, REGIONS } from '../js/data.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
// Every run starts on the map. The bottom row is always a delve.
const intoDelve = run => { enterNode(run, availableNodes(run.map)[0].id, () => 0.5); return run.world; };

test('formula: color base x ink material multiplier', () => {
  const c = craftCard({ colors: ['red'], inkMat: 'blood', cardMat: 'wood' });
  assert.equal(c.name, 'Sanguine Flame');
  assert.deepEqual(c.effects, [{ type: 'damage', amount: 12 }]);
  assert.equal(c.cost, 1);
  assert.equal(c.hpCost, 3);
  assert.equal(c.durability, 8);
});

test('stone boosts power, gold ink adds cost', () => {
  const c = craftCard({ colors: ['white'], inkMat: 'gold', cardMat: 'stone' });
  assert.deepEqual(c.effects, [{ type: 'block', amount: 11 }]); // 5 * 1.5 * 1.5 = 11.25
  assert.equal(c.cost, 3);
  assert.equal(c.durability, Infinity);
});

test('a second ink costs 1 more mana and keeps both effects at full strength', () => {
  const c = craftCard({ colors: ['red', 'blue'], inkMat: 'silver', cardMat: 'silver' });
  assert.equal(c.name, 'Silvered Storm');
  assert.deepEqual(c.effects, [{ type: 'damage', amount: 6 }, { type: 'draw', amount: 2 }]);
  assert.equal(c.cost, 2);
  assert.equal(craftCard({ colors: ['red'], inkMat: 'silver', cardMat: 'silver' }).cost, 1);
});

test('enchantment slots are limited by card material', () => {
  assert.match(validateBlueprint({ colors: ['red'], inkMat: 'charcoal', cardMat: 'paper', enchants: ['echo'] }), /holds only 0/);
  assert.equal(validateBlueprint({ colors: ['red'], inkMat: 'charcoal', cardMat: 'wood', enchants: ['echo'] }), null);
});

test('recipes override the formula', () => {
  assert.equal(findRecipe({ colors: ['red'], inkMat: 'charcoal', cardMat: 'paper', enchants: [] }), null);
  const k = craftCard({ colors: ['red'], inkMat: 'blood', cardMat: 'wood' });
  assert.equal(k.recipeId, null);
  const e = craftCard({ colors: ['green'], inkMat: 'gold', cardMat: 'wood' });
  assert.equal(e.name, 'Evergreen');
  assert.equal(e.durability, Infinity);
});

test('crafting spends ingredients and discovers recipes', () => {
  const run = createRun();
  run.inventory.ink_blood = 1;
  const r = craftIntoDeck(run, { colors: ['red'], inkMat: 'blood', cardMat: 'paper' });
  assert.equal(r.card.name, 'Kindling');
  assert.equal(r.discovered, true);
  assert.equal(run.inventory.color_red, undefined);
  assert.equal(run.deck.length, 11);
  assert.ok(craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'paper' }).error);
});

test('paper cards burn out after 3 casts across fights', () => {
  const run = createRun();
  const { card } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'paper' });
  for (let i = 0; i < 3; i++) {
    const c = createCombat(run, ['grimoire'], seq(0.99));
    c.hand.push(card);
    assert.equal(playCard(c, card.uid, 0), null);
  }
  assert.equal(run.deck.includes(card), false);
});

test('a fight can be won and enemies act', () => {
  const run = createRun();
  const c = createCombat(run, ['gravemoth'], seq(0.3, 0.7, 0.1));
  let guard = 0;
  while (!c.over && guard++ < 50) {
    for (const k of [...c.hand]) playCard(c, k.uid, 0);
    endTurn(c);
  }
  assert.equal(c.over, 'won');
  assert.ok(run.hp < 60);
});

test('salvage returns a component, once per bench', () => {
  const run = createRun();
  const r = salvageCard(run, run.deck[0].uid, seq(0));
  assert.equal(r.part, 'ink_charcoal');
  assert.ok(salvageCard(run, run.deck[0].uid).error);
});

test('every recipe is craftable', () => {
  for (const r of RECIPES) {
    const bp = { colors: r.match.colors, inkMat: r.match.inkMat, cardMat: r.match.cardMat, enchants: r.match.enchants || [] };
    assert.equal(validateBlueprint(bp), null, r.id);
    assert.equal(craftCard(bp, { corruption: 99 }).recipeId, r.id);
    if (r.forbidden) assert.equal(craftCard(bp).recipeId, null, `${r.id} needs Corruption`);
  }
});

test('finds are ready to use; slate, silver and gold are spent as you inscribe', async () => {
  const { addItem } = await import('../js/run.js');
  const run = createRun(1);
  assert.deepEqual(addItem(run, 'raw_ash'), ['ink_charcoal', 'ink_charcoal']);
  assert.equal(run.inventory.raw_ash, undefined);
  assert.equal(run.inventory.ink_charcoal, 6);
  assert.deepEqual(addItem(run, 'raw_silver', 3), ['raw_silver', 'raw_silver', 'raw_silver']);
  // Silver ore pays for a silver card (two) and silver ink (one).
  run.inventory.ink_silver = 0;
  const { card, error } = craftIntoDeck(run, { colors: ['red'], inkMat: 'silver', cardMat: 'silver' });
  assert.equal(error, undefined);
  assert.equal(card.cardMat, 'silver');
  assert.equal(run.inventory.raw_silver, undefined);
  // Blood ink can always be had, at a price.
  Object.assign(run.inventory, { color_red: 1, mat_paper: 1 });
  const hp = run.hp, corruption = run.corruption;
  const r = craftIntoDeck(run, { colors: ['red'], inkMat: 'blood', cardMat: 'paper' });
  assert.equal(r.bled, 6);
  assert.equal(run.hp, hp - 6);
  assert.equal(run.corruption, corruption + 3);
  run.hp = 5;
  Object.assign(run.inventory, { color_red: 1, mat_paper: 1 });
  assert.match(craftIntoDeck(run, { colors: ['red'], inkMat: 'blood', cardMat: 'paper' }).error, /too weak/);
  // Two slate mend a stone card.
  Object.assign(run.inventory, { color_red: 1, raw_slate: 2 });
  run.hp = 50;
  const stone = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'stone' }).card;
  assert.ok(stone);
  assert.equal(run.inventory.raw_slate, undefined);
});

test('the desk hints when you are one part from a named spell', async () => {
  const { recipeHint } = await import('../js/crafting.js');
  let h = recipeHint({ colors: ['blue'], inkMat: 'silver', cardMat: 'wood', enchants: [] });
  assert.equal(h.recipe.id, 'clarity');
  assert.equal(h.kind, 'card');
  assert.equal(h.change, 'swap');
  h = recipeHint({ colors: ['red'], inkMat: 'silver', cardMat: 'stone', enchants: [] });
  assert.equal(h.recipe.id, 'bellstrike');
  assert.equal(h.kind, 'ench');
  assert.equal(recipeHint({ colors: ['blue'], inkMat: 'silver', cardMat: 'silver', enchants: [] }), null);
  assert.equal(recipeHint({ colors: ['green'], inkMat: 'charcoal', cardMat: 'paper', enchants: [] }), null);
  for (const r of RECIPES) {
    const parts = r.match.colors.length + 2 + (r.match.enchants || []).length;
    assert.ok(parts <= 4, `${r.id} has ${parts} parts`);
  }
});

test('heirlooms take a signature, and well-worn cards can be renamed', async () => {
  const { recordCast, chooseSignature, renameCard } = await import('../js/crafting.js');
  const run = createRun(30);
  const { card } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood' });
  assert.ok(renameCard(card, 'Old Faithful').error);
  for (let i = 0; i < 8; i++) recordCast(card);
  assert.equal(renameCard(card, '  Old <b>Faithful</b>  ').card.name, 'Old bFaithful/b');
  renameCard(card, 'Old Faithful');
  assert.ok(chooseSignature(card, 'unfading').error);
  for (let i = 0; i < 12; i++) recordCast(card);
  assert.ok(card.signaturePending);
  const dmg = card.effects[0].amount;
  chooseSignature(card, 'resonant');
  assert.equal(card.effects[0].amount, dmg + 3);
  assert.ok(!card.signaturePending);
  // Re-inscribing keeps the name and the signature.
  card.durability = 3;
  reinscribe(run, card.uid, 'volatile');
  assert.equal(card.name, 'Old Faithful');
  assert.equal(card.signature, 'resonant');
  assert.equal(card.effects[0].amount, 9 + 3 + 3); // volatile 9, worn +3, resonant +3
});

test('re-inscribing rebuilds the card with the new enchantment', () => {
  const run = createRun(1);
  const { card } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood' });
  assert.deepEqual(card.effects, [{ type: 'damage', amount: 5 }]);
  card.durability = 5;
  reinscribe(run, card.uid, 'volatile');
  assert.deepEqual(card.enchants, ['volatile']);
  assert.deepEqual(card.effects, [{ type: 'damage', amount: 9 }]);
  assert.equal(card.durability, 5);
  run.inventory.ench_echo = 1;
  assert.match(reinscribe(run, card.uid, 'echo').error, /No room/);
  assert.ok(mend(run, card.uid).error); // wood card used at start
});

test('hungering cards grow each cast in a fight', () => {
  const run = createRun(1);
  run.inventory.ench_hungering = 1;
  run.inventory.color_red = 1;
  const { card } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood', enchants: ['hungering'] });
  const c = createCombat(run, ['grimoire'], seq(0.99));
  c.player.energy = 9;
  const hp = () => c.enemies[0].hp;
  let before = hp(); c.hand.push(card); playCard(c, card.uid); const first = before - hp();
  before = hp(); c.hand.push(card); playCard(c, card.uid); const second = before - hp();
  assert.equal(second - first, 2);
});

test('delves generate connected maps with a desk and a way out', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (let r = 0; r < REGIONS.length; r++) {
      const elite = seed % 2 ? REGIONS[r].elites[0] : null;
      const w = generateRegion(r, seed, { elite });
      assert.ok(w.rooms.length >= 4, `rooms seed ${seed}`);
      assert.ok(isFloor(w, w.px, w.py));
      const goal = w.objects.find(o => o.type === 'exit');
      const desk = w.objects.find(o => o.type === 'desk');
      assert.ok(goal && desk);
      assert.equal(goal.guard, elite);
      w.seen.fill(1);
      assert.ok(findPath(w, goal.x, goal.y), `exit reachable seed ${seed} region ${r}`);
      assert.equal(w.objects.filter(o => w.objects.some(p => p !== o && p.x === o.x && p.y === o.y)).length, 0);
    }
  }
});

test('walking builds dread and eventually meets something', () => {
  const run = createRun(3);
  const w = intoDelve(run);
  let met = null;
  const rng = seq(0.5, 0.01);
  for (let i = 0; i < 400 && !met; i++) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isFloor(w, w.px + dx, w.py + dy) && !objectAt(w, w.px + dx, w.py + dy));
    const [dx, dy] = dirs[i % dirs.length];
    met = step(w, run, dx, dy, rng).encounter;
  }
  assert.ok(met);
  assert.ok(run.dread > 0);
  descend(run);
  assert.equal(run.regionIdx, 1);
  assert.equal(run.world, null);
  assert.equal(run.map.act, 1);
});

test('sprites are well-formed', async () => {
  const { SPRITES, PALETTE, GLYPHS, NODE_SPRITES, SWAPS } = await import('../js/sprites.js');
  for (const [name, rows] of Object.entries(SPRITES)) {
    assert.equal(rows.length, 16, `${name} height`);
    rows.forEach((r, i) => {
      assert.equal(r.length, 16, `${name} row ${i} width`);
      for (const ch of r) assert.ok(ch === '.' || PALETTE[ch] || /[1-9]/.test(ch), `${name} row ${i} char ${ch}`);
    });
  }
  for (const [name, rows] of Object.entries(GLYPHS)) rows.forEach(r => assert.equal(r.length, 9, name));
  for (const [raw, [spr, swap]] of Object.entries(NODE_SPRITES)) {
    assert.ok(SPRITES[spr], raw);
    if (swap) assert.ok(SWAPS[swap], raw);
  }
});

test('lantern oil drains slowly and shrinks the light', () => {
  const run = createRun(5);
  const w = intoDelve(run);
  assert.equal(w.radius, 5);
  let steps = 0;
  for (let i = 0; i < 2000 && run.oil > 50; i++) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isFloor(w, w.px + dx, w.py + dy) && !objectAt(w, w.px + dx, w.py + dy));
    const [dx, dy] = dirs[i % dirs.length];
    if (!step(w, run, dx, dy, () => 0.99).blocked) steps++;
  }
  assert.equal(run.oil, 50);
  assert.ok(steps >= 250, `${steps} steps for 50 oil`);
  assert.equal(w.radius, 4);
  assert.equal(lightRadius(0), 1);
});

test('burning cards and resurfacing refuel the lantern', () => {
  const run = createRun(5);
  intoDelve(run);
  run.oil = 40;
  const starter = run.deck[0];
  assert.equal(burnCard(run, starter.uid).oil, 8);
  assert.equal(run.oil, 48);
  run.inventory.mat_stone = 1;
  const { card: stone } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'stone' });
  assert.match(burnCard(run, stone.uid).error, /will not burn/);
  const dread = run.dread;
  assert.equal(resurface(run).dread, 30);
  assert.equal(run.oil, 100);
  assert.equal(run.dread, dread + 30);
  assert.ok(resurface(run).error);
  assert.ok(run.world.objects.some(o => o.type === 'up' && o.x === run.world.px && o.y === run.world.py));
});

test('events resolve their choices', async () => {
  const { resolveEvent } = await import('../js/events.js');
  const run = createRun(7);
  run.hp = 30;
  let r = resolveEvent(run, 'shrine', 'pray');
  assert.equal(run.hp, 42);
  assert.equal(run.dread, 10);
  run.oil = 50;
  resolveEvent(run, 'shrine', 'take');
  assert.equal(run.oil, 80);
  assert.equal(run.maxHp, 56);
  r = resolveEvent(run, 'scribe', 'free', () => 0);
  assert.ok(r.learned);
  assert.ok(run.grimoire.has(r.learned));
  r = resolveEvent(run, 'lanterns', 'cut', () => 0);
  assert.ok(Array.isArray(r.fight) && r.fight.length);
  r = resolveEvent(run, 'well', 'drink', () => 0.1);
  assert.equal(r.items.length, 2);
  assert.match(resolveEvent(run, 'well', 'leave').text, /leave/i);
});

test('the Grimoire and records persist between runs', async () => {
  const { loadMeta, learn, recordRun, forget } = await import('../js/meta.js');
  const data = {};
  const store = { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  const meta = loadMeta(store);
  assert.deepEqual(meta.grimoire, []);
  learn(meta, 'kindling', store);
  learn(meta, 'kindling', store);
  recordRun(meta, { won: false, depth: 2 }, store);
  const again = loadMeta(store);
  assert.deepEqual(again.grimoire, ['kindling']);
  assert.equal(again.runs, 1);
  assert.equal(again.deepest, 2);
  const run = createRun(1, again.grimoire);
  run.inventory.ink_blood = 1;
  assert.equal(craftIntoDeck(run, { colors: ['red'], inkMat: 'blood', cardMat: 'paper' }).discovered, false);
  forget(store);
  assert.deepEqual(loadMeta(store).grimoire, []);
  assert.deepEqual(loadMeta({ getItem() { throw new Error('blocked'); } }).grimoire, []);
});

test('piercing ignores block and hallowed grants block', () => {
  const run = createRun(1);
  Object.assign(run.inventory, { ench_piercing: 1, ench_hallowed: 1, color_red: 2, mat_wood: 2, ink_charcoal: 2 });
  const { card: pierce } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood', enchants: ['piercing'] });
  const { card: holy } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood', enchants: ['hallowed'] });
  const c = createCombat(run, ['grimoire'], seq(0.99));
  c.player.energy = 9;
  c.enemies[0].block = 20;
  const hp = c.enemies[0].hp;
  c.hand.push(pierce); playCard(c, pierce.uid);
  assert.equal(c.enemies[0].hp, hp - 5);
  assert.equal(c.enemies[0].block, 20);
  const block = c.player.block;
  c.hand.push(holy); playCard(c, holy.uid);
  assert.equal(c.player.block, block + 4);
});

test('some delves hold an event, drawn from the unseen pool', () => {
  let events = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (let r = 0; r < REGIONS.length; r++) {
      const w = generateRegion(r, seed, { events: ['mirror', 'altar'] });
      const ev = w.objects.filter(o => o.type === 'event');
      assert.ok(ev.length <= 1);
      for (const o of ev) assert.ok(['mirror', 'altar'].includes(o.event));
      events += ev.length;
    }
  }
  assert.ok(events > 30 && events < 90, `${events} events in 160 delves`);
  assert.equal(REGIONS.length, 4);
});

test('ink reactions fire between inscribed cards of different inks', async () => {
  const { reactionFor } = await import('../js/combat.js');
  assert.equal(reactionFor(['red'], ['white']), 'red+white');
  assert.equal(reactionFor(['red'], ['red']), null);
  assert.equal(reactionFor(null, ['blue', 'red']), 'blue+red');
  const run = createRun(2);
  Object.assign(run.inventory, { color_red: 2, color_white: 2, color_black: 1, mat_wood: 3, ink_charcoal: 3 });
  const { card: ward } = craftIntoDeck(run, { colors: ['white'], inkMat: 'charcoal', cardMat: 'wood' });
  const { card: flame } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood' });
  const c = createCombat(run, ['grimoire'], seq(0.99));
  c.player.energy = 9;
  c.hand.push(ward); playCard(c, ward.uid);            // 4 Block
  const hp = c.enemies[0].hp;
  c.hand.push(flame); playCard(c, flame.uid);          // 5 damage, then Brand: half of 4 Block
  assert.equal(c.lastReaction.name, 'Brand');
  assert.equal(c.enemies[0].hp, hp - 5 - 2);
  // Starter cards neither react nor break a chain.
  const strike = run.deck.find(k => k.starter === 'strike');
  c.hand.push(strike); playCard(c, strike.uid);
  assert.equal(c.lastReaction.n, 1);
  assert.deepEqual(c.lastColors, ['red']);
});

test('relics change the rules', () => {
  const run = createRun(4);
  gainRelicFor(run, 'locket');
  assert.equal(run.maxHp, 70);
  gainRelicFor(run, 'bell');
  gainRelicFor(run, 'needle');
  gainRelicFor(run, 'prism');
  gainRelicFor(run, 'inkwell');
  const c = createCombat(run, ['grimoire'], seq(0.99));
  assert.equal(c.enemies[0].weak, 1);
  c.enemies[0].block = 50;
  const strike = run.deck.find(k => k.starter === 'strike');
  c.hand.push(strike);
  const hp = c.enemies[0].hp;
  playCard(c, strike.uid);
  assert.equal(c.enemies[0].hp, hp - 5); // needle: ignores Block
  assert.equal(c.enemies[0].block, 50);
  Object.assign(run.inventory, { color_red: 1, mat_paper: 1, ink_blood: 1 });
  gainRelicFor(run, 'thimble');
  const { card } = craftIntoDeck(run, { colors: ['red'], inkMat: 'blood', cardMat: 'paper' });
  assert.equal(card.durability, 5);
  const before = run.hp;
  c.player.energy = 9;
  c.hand.push(card); playCard(c, card.uid);
  assert.equal(run.hp, before - 2); // inkwell: blood costs 1 less
  run.hp = 40;
  gainRelicFor(run, 'candle');
  const rewards = { items: [], gold: 0 };
  applyRewards(run, rewards);
  assert.equal(rewards.healed, 4);
});

test('the Moth Lantern halves oil use', () => {
  const run = createRun(5);
  gainRelicFor(run, 'mothlantern');
  const w = intoDelve(run);
  for (let i = 0; i < 100; i++) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isFloor(w, w.px + dx, w.py + dy) && !objectAt(w, w.px + dx, w.py + dy));
    step(w, run, ...dirs[i % dirs.length], () => 0.99);
  }
  assert.equal(run.oil, 90);
  assert.ok(run.dread > 100);
});

test('a run survives saving and loading', () => {
  const run = createRun(9);
  const onMap = deserializeRun(serializeRun(run)).run;
  assert.equal(onMap.world, null);
  assert.equal(onMap.map.nodes.length, run.map.nodes.length);
  intoDelve(run);
  Object.assign(run.inventory, { color_red: 1, mat_stone: 1 });
  craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'stone' });
  gainRelicFor(run, 'dice');
  run.world.objects[3].gone = true;
  const text = serializeRun(run, { log: ['hello'], eventObjId: 7 });
  const { run: back, resume } = deserializeRun(text);
  assert.equal(back.deck.length, run.deck.length);
  assert.equal(back.deck.at(-1).durability, Infinity);
  assert.equal(back.deck[0].durability, Infinity);
  assert.ok(back.grimoire instanceof Set);
  assert.ok(back.world.tiles instanceof Uint8Array);
  assert.deepEqual(Array.from(back.world.seen), Array.from(run.world.seen));
  assert.deepEqual(back.relics, ['dice']);
  assert.equal(back.world.objects[3].gone, true);
  assert.deepEqual(resume, { log: ['hello'], eventObjId: 7 });
  // Cards made after loading never reuse an id.
  Object.assign(back.inventory, { color_red: 1, mat_paper: 1, ink_charcoal: 1 });
  const { card } = craftIntoDeck(back, { colors: ['red'], inkMat: 'charcoal', cardMat: 'paper' });
  assert.ok(!back.deck.slice(0, -1).some(k => k.uid === card.uid));
});

test('Inkbinder variants start differently and unlock from progress', async () => {
  const { isUnlocked, oilMax } = await import('../js/run.js');
  const blood = createRun(3, [], 'bloodscribe');
  assert.equal(blood.maxHp, 70);
  assert.equal(blood.inventory.ink_blood, 2);
  assert.deepEqual(blood.relics, ['inkwell']);
  assert.equal(blood.corruption, 2);
  const heretic = createRun(3, [], 'heretic');
  assert.equal(heretic.gold, 120);
  assert.equal(oilMax(heretic), 70);
  heretic.oil = 60;
  intoDelve(heretic);
  assert.equal(resurface(heretic).dread, 30);
  assert.equal(heretic.oil, 70);
  const monk = createRun(3, [], 'ashmonk');
  const c = createCombat(monk, ['grimoire'], seq(0.99));
  assert.equal(c.player.block, 4);
  assert.ok(isUnlocked({ deepest: -1, grimoire: [] }, 'inkbinder'));
  assert.ok(!isUnlocked({ deepest: 0, grimoire: [] }, 'bloodscribe'));
  assert.ok(isUnlocked({ deepest: 1, grimoire: [] }, 'bloodscribe'));
  assert.ok(isUnlocked({ deepest: -1, grimoire: ['a', 'b', 'c'] }, 'ashmonk'));
  assert.ok(!isUnlocked({ deepest: 1, grimoire: [] }, 'heretic'));
});

test('crafted cards become Well-Worn and keep it when re-inscribed', () => {
  const run = createRun(6);
  Object.assign(run.inventory, { color_red: 1, mat_silver: 1, ink_charcoal: 1, ench_echo: 1 });
  const { card } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'silver' });
  const base = card.effects[0].amount;
  const c = createCombat(run, ['grimoire'], seq(0.99));
  for (let i = 0; i < 8; i++) { c.player.energy = 9; c.hand.push(card); playCard(c, card.uid); }
  assert.equal(card.wear, 1);
  assert.equal(card.effects[0].amount, base + 1);
  assert.match(c.log.join(' '), /Well-Worn/);
  reinscribe(run, card.uid, 'echo');
  assert.equal(card.effects[0].amount, base + 1);
  assert.equal(card.casts, 8);
});

test('pristine spots and essence make stronger cards', async () => {
  const { scavenge } = await import('../js/run.js');
  const run = createRun(6);
  const node = { raw: 'bone', amount: 1, pristine: true };
  const r = scavenge(run, node);
  assert.equal(run.inventory.color_white, 4);
  assert.equal(run.inventory.ess_pristine, 1);
  assert.ok(r.pristine);
  Object.assign(run.inventory, { color_red: 1, mat_wood: 1 });
  const { card } = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood', pristine: true });
  assert.equal(card.name, 'Pristine Ashen Flame');
  assert.equal(card.effects[0].amount, 7); // 5 x 1.3 = 6.5, rounded
  assert.equal(run.inventory.ess_pristine, undefined);
  let pristineSpots = 0;
  for (let seed = 1; seed <= 20; seed++) pristineSpots += generateRegion(0, seed).objects.filter(o => o.pristine).length;
  assert.ok(pristineSpots > 5);
});

test('corruption builds from blood and ichor, and changes the rules', () => {
  const run = createRun(8);
  Object.assign(run.inventory, { color_red: 1, color_black: 2, mat_wood: 2, mat_stone: 1, ink_blood: 2, ink_ichor: 1 });
  craftIntoDeck(run, { colors: ['red'], inkMat: 'blood', cardMat: 'wood' });
  assert.equal(run.corruption, 2);
  const { card: ichor } = craftIntoDeck(run, { colors: ['black'], inkMat: 'ichor', cardMat: 'wood' });
  const c1 = createCombat(run, ['grimoire'], seq(0.99));
  c1.hand.push(ichor); playCard(c1, ichor.uid);
  assert.equal(run.corruption, 3);
  assert.equal(c1.player.weak, 0);
  run.corruption = 5; // Tainted
  const c2 = createCombat(run, ['grimoire'], seq(0.99));
  assert.equal(c2.player.weak, 1);
  const poison = c2.enemies[0].poison;
  c2.player.energy = 9; c2.hand.push(ichor); playCard(c2, ichor.uid);
  assert.equal(c2.enemies[0].poison - poison, Math.round(3 * 1.75) + 2);
  run.corruption = 10; // Forsaken
  const c3 = createCombat(run, ['grimoire'], seq(0.99));
  assert.equal(c3.enemies[0].strength, 1);
  const { card: unwriting } = craftIntoDeck(run, { colors: ['black'], inkMat: 'blood', cardMat: 'stone' });
  assert.equal(unwriting.name, 'The Unwriting');
  run.corruption = 4;
  rest(run, {});
  assert.equal(run.corruption, 2 + 0); // rest cleanses 2 (after the blood craft added 2)
});

test('ghostlight ink costs one less', () => {
  const k = craftCard({ colors: ['red'], inkMat: 'ghostlight', cardMat: 'wood' });
  assert.equal(k.cost, 0);
  assert.equal(k.name, 'Ghostlit Flame');
  const g = craftCard({ colors: ['red'], inkMat: 'ghostlight', cardMat: 'paper' });
  assert.equal(g.cost, 0);
});

test('bosses change phase at half health', async () => {
  const { currentMove } = await import('../js/combat.js');
  const run = createRun(11);
  const c = createCombat(run, ['warden'], seq(0.99));
  const e = c.enemies[0];
  assert.equal(e.maxHp, 54);
  const firstMove = currentMove(e);
  c.player.energy = 99;
  const strike = run.deck.find(k => k.starter === 'strike');
  while (e.hp > e.maxHp / 2) { c.hand.push(strike); playCard(c, strike.uid); }
  assert.equal(e.phase, 1);
  assert.equal(e.strength, 1);
  assert.ok(e.block >= 8);
  assert.notDeepEqual(currentMove(e), firstMove);
  assert.equal(c.phaseEvent.name, 'The bell cracks');
});

test('act maps branch upward to a single guardian, with a camp before it', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (let act = 0; act < REGIONS.length; act++) {
      const map = generateMap(act, seed);
      const { nodes } = map;
      const top = nodes.filter(n => n.type === 'guardian');
      assert.equal(top.length, 1);
      assert.ok(availableNodes(map).length >= 2, `choices at the start, seed ${seed}`);
      assert.ok(availableNodes(map).every(n => n.type === 'delve'));
      for (const n of nodes) {
        if (n.type !== 'guardian') assert.ok(n.next.length, `dead end at row ${n.row}`);
        for (const id of n.next) assert.equal(nodes[id].row, n.row + 1);
        if (nodes.some(m => m.next.includes(n.id) && ['camp'].includes(m.type))) assert.ok(n.type === 'guardian' || n.type !== 'camp');
      }
      for (const n of nodes.filter(m => m.next.includes(top[0].id))) assert.equal(n.type, 'camp');
      for (const type of ['haunted', 'shop', 'story']) assert.ok(nodes.some(n => n.type === type), `${type} seed ${seed} act ${act}`);
      // No two paths cross.
      for (const a of nodes) for (const b of nodes) {
        if (a.row !== b.row || a === b) continue;
        for (const x of a.next) for (const y of b.next) {
          if (a.col < b.col) assert.ok(nodes[x].col <= nodes[y].col, `crossing seed ${seed}`);
        }
      }
      // Merchants, camps and haunted delves never follow one of their own kind.
      for (const n of nodes) for (const id of n.next) {
        if (['shop', 'haunted'].includes(n.type)) assert.notEqual(nodes[id].type, n.type);
      }
    }
  }
});

test('moving on the map follows the lines', () => {
  const run = createRun(21);
  const [first] = availableNodes(run.map);
  const far = run.map.nodes.find(n => n.row === 3);
  assert.ok(enterNode(run, far.id).error);
  const r = enterNode(run, first.id, () => 0.5);
  assert.equal(r.type, 'delve');
  assert.ok(run.world);
  assert.equal(currentNode(run), first);
  run.dread = 41;
  assert.equal(leaveDelve(run).eased, 21);
  assert.equal(run.world, null);
  const next = availableNodes(run.map);
  assert.ok(next.length >= 1);
  assert.ok(next.every(n => first.next.includes(n.id)));
});

test('scriptoria offer rest or oil, merchants sell oil', () => {
  const run = createRun(22);
  const camp = { type: 'camp' };
  run.hp = 20; run.oil = 10;
  assert.equal(campChoice(run, camp, 'rest').heal, 18);
  assert.ok(campChoice(run, camp, 'oil').error);
  const camp2 = { type: 'camp' };
  assert.equal(campChoice(run, camp2, 'oil').oil, 90);
  run.oil = 50; run.gold = 20;
  assert.equal(buyOil(run).oil, 40);
  assert.equal(run.gold, 5);
  assert.ok(buyOil(run).error);
});

test('unknown nodes and the guardian resolve', () => {
  const run = createRun(23);
  // An unknown node in the bottom row, so it can be entered from the start.
  const node = { id: run.map.nodes.length, row: 0, type: 'unknown', next: [] };
  run.map.nodes.push(node);
  assert.equal(enterNode(run, node.id, () => 0.01).type, 'fight');
  run.map.pos = null;
  const cache = enterNode(run, node.id, () => 0.2);
  assert.equal(cache.type, 'cache');
  assert.ok(cache.items.length >= 1);
  run.map.pos = null;
  const ev = enterNode(run, node.id, () => 0.9);
  assert.equal(ev.type, 'event');
  assert.ok(run.seenEvents.includes(ev.event));
  node.type = 'guardian';
  run.map.pos = null;
  const g = enterNode(run, node.id).enemies[0];
  assert.equal(g, run.map.guardian);
  assert.ok(REGIONS[0].guardians.includes(g));
  run.regionIdx = 3;
  run.map.act = 3; run.map.guardian = 'grimoire';
  run.map.pos = null;
  const boss = enterNode(run, node.id);
  assert.equal(boss.kind, 'boss');
  assert.deepEqual(boss.enemies, ['grimoire']);
});

test("Sister Vell's story follows your choices", async () => {
  const { resolveEvent, lastBeat } = await import('../js/events.js');
  const kind = createRun(24);
  resolveEvent(kind, 'vell1', 'give');
  resolveEvent(kind, 'vell2', 'help');
  resolveEvent(kind, 'vell3', 'share');
  assert.equal(kind.story.trust, 3);
  assert.equal(lastBeat(kind), 'vell4_ally');
  resolveEvent(kind, 'vell4_ally', 'fight');
  assert.ok(kind.story.ally);

  const cruel = createRun(25);
  const r = resolveEvent(cruel, 'vell1', 'take', () => 0);
  assert.ok(r.relic);
  assert.equal(lastBeat(cruel), 'vell4_hollow');
  assert.deepEqual(resolveEvent(cruel, 'vell4_hollow', 'fight').fight, ['vellHollow']);
  resolveEvent(cruel, 'vell4_hollow', 'slip');
  assert.ok(cruel.story.hollowAhead);

  const mild = createRun(26);
  resolveEvent(mild, 'vell1', 'give');
  assert.equal(lastBeat(mild), 'vell4_page');
  Object.assign(mild.inventory, { color_red: 1, mat_paper: 1, ink_charcoal: 1 });
  const { card } = craftIntoDeck(mild, { colors: ['red'], inkMat: 'charcoal', cardMat: 'paper' });
  resolveEvent(mild, 'vell3', 'bind');
  assert.equal(card.durability, Infinity);
  assert.ok(card.pristine);
});

test('new events resolve', async () => {
  const { resolveEvent } = await import('../js/events.js');
  const run = createRun(12);
  let r = resolveEvent(run, 'book', 'read', () => 0);
  assert.equal(run.inventory.ink_ichor, 1);
  assert.equal(run.corruption, 2);
  run.oil = 10;
  resolveEvent(run, 'book', 'burn');
  assert.equal(run.oil, 45);
  r = resolveEvent(run, 'corpse', 'search', () => 0.9);
  assert.equal(r.items.length, 3);
  assert.ok(resolveEvent(run, 'corpse', 'search', () => 0.1).fight);
  run.dread = 30;
  resolveEvent(run, 'corpse', 'bury');
  assert.equal(run.dread, 10);
  Object.assign(run.inventory, { color_red: 1, mat_wood: 1 });
  craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'wood' });
  const before = run.deck.length;
  r = resolveEvent(run, 'mirror', 'gaze', () => 0);
  assert.equal(run.deck.length, before + 1);
  const [a, b] = run.deck.filter(k => k.crafted);
  assert.notEqual(a.uid, b.uid);
  assert.equal(a.name, b.name);
  r = resolveEvent(run, 'altar', 'card', () => 0);
  assert.ok(r.relic);
  assert.equal(run.deck.length, before);
  const hp = run.hp;
  resolveEvent(run, 'altar', 'blood');
  assert.equal(run.hp, hp - 10);
  assert.equal(run.inventory.ess_pristine, 1);
});

test('delve conditions show on the map and change the delve', async () => {
  const { DELVE_CONDITIONS } = await import('../js/data.js');
  let withCond = 0, delves = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const map = generateMap(0, seed);
    for (const n of map.nodes) {
      if (n.cond) assert.ok(['delve', 'haunted'].includes(n.type) && n.row > 0 && DELVE_CONDITIONS[n.cond]);
      if ((n.type === 'delve' || n.type === 'haunted') && n.row > 0) { delves++; if (n.cond) withCond++; }
    }
  }
  assert.ok(withCond / delves > 0.5 && withCond / delves < 0.8, `${withCond}/${delves}`);
  const plain = generateRegion(0, 5), hallowed = generateRegion(0, 5, { cond: 'hallowed' });
  assert.ok(plain.objects.some(o => o.type === 'desk'));
  assert.ok(!hallowed.objects.some(o => o.type === 'desk'));
  const collapsing = generateRegion(0, 5, { cond: 'collapsing' });
  assert.ok(collapsing.rooms.length < plain.rooms.length);
  let kelp = 0, kelpFlooded = 0;
  for (let seed = 1; seed <= 20; seed++) {
    kelp += generateRegion(0, seed).objects.filter(o => o.raw === 'kelp').length;
    kelpFlooded += generateRegion(0, seed, { cond: 'flooded' }).objects.filter(o => o.raw === 'kelp').length;
  }
  assert.ok(kelpFlooded > kelp * 2, `${kelpFlooded} vs ${kelp}`);
});

test('hallowed ground is quiet, lightless burns oil fast, collapsing clears dread', () => {
  const walk = (cond, steps) => {
    const run = createRun(40);
    const w = generateRegion(0, 40, { cond });
    run.world = w;
    let met = 0;
    for (let i = 0; i < steps; i++) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isFloor(w, w.px + dx, w.py + dy) && !objectAt(w, w.px + dx, w.py + dy));
      if (step(w, run, ...dirs[i % dirs.length], () => 0).encounter) met++;
    }
    return { run, met };
  };
  assert.equal(walk('hallowed', 200).met, 0);
  assert.ok(walk(null, 200).met > 0);
  assert.equal(walk('lightless', 100).run.oil, 60);
  assert.equal(walk(null, 100).run.oil, 80);
  const { run } = walk('collapsing', 50);
  assert.ok(run.dread > 0);
  leaveDelve(run);
  assert.equal(run.dread, 0);
});

test('pests go after paper, cheap ink and metal; stone is safe', () => {
  const run = createRun(41);
  Object.assign(run.inventory, { color_red: 3, mat_paper: 2, mat_wood: 1, raw_silver: 2, raw_slate: 2, ink_charcoal: 4 });
  const paper = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'paper' }).card;
  const silver = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'silver' }).card;
  const stone = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'stone' }).card;
  // Paper Moth: eats a paper card out of the piles for the fight, and wears it.
  let c = createCombat(run, ['papermoth'], () => 0);
  c.hand = []; c.drawPile = [paper, stone]; c.discard = [];
  endTurn(c);
  assert.ok(c.exhaust.includes(paper));
  assert.equal(paper.durability, 2);
  assert.ok(!c.drawPile.includes(paper) && !c.hand.includes(paper));
  // Ink Leech: a paper or wood card works at half strength.
  c = createCombat(run, ['inkleech'], () => 0);
  c.hand = []; c.drawPile = [paper, stone, silver]; c.discard = [];
  endTurn(c);
  assert.ok(c.smudged.has(paper.uid));
  assert.ok(!c.smudged.has(stone.uid) && !c.smudged.has(silver.uid));
  c.hand.push(paper); c.player.energy = 3;
  const hp = c.enemies[0].hp, block = c.enemies[0].block;
  playCard(c, paper.uid, 0);
  assert.equal(hp + block - c.enemies[0].hp - c.enemies[0].block, 3); // 5 damage halved
  // Rust Wraith: silver and gold cost 1 more next turn; stone does not.
  c = createCombat(run, ['rustwraith'], () => 0);
  endTurn(c);
  assert.equal(effectiveCost(c, silver), silver.cost + 1);
  assert.equal(effectiveCost(c, stone), stone.cost);
  endTurn(c); // its next move is a plain attack
  assert.equal(effectiveCost(c, silver), silver.cost);
});

test('flooded delves wear paper twice as fast', () => {
  const run = createRun(42);
  Object.assign(run.inventory, { color_red: 1, mat_paper: 1 });
  const paper = craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'paper' }).card;
  const c = createCombat(run, ['gravemoth'], () => 0.5, { paperWear: 1 });
  c.hand.push(paper); c.player.energy = 3;
  playCard(c, paper.uid, 0);
  assert.equal(paper.durability, 1);
});

test('each act picks one of two guardians; the last act is always the Grimoire', () => {
  const seen = [new Set(), new Set(), new Set(), new Set()];
  for (let seed = 1; seed <= 40; seed++) {
    for (let act = 0; act < REGIONS.length; act++) seen[act].add(generateMap(act, seed).guardian);
  }
  assert.deepEqual([...seen[0]].sort(), ['bishop', 'warden']);
  assert.deepEqual([...seen[1]].sort(), ['index', 'scrivener']);
  assert.deepEqual([...seen[2]].sort(), ['cantor', 'saint']);
  assert.deepEqual([...seen[3]], ['grimoire']);
});

test('the new guardians change phase and use their tricks', async () => {
  const { ENEMIES } = await import('../js/data.js');
  for (const key of ['bishop', 'index', 'cantor']) {
    const run = createRun(50);
    const c = createCombat(run, [key], () => 0.5);
    assert.ok(ENEMIES[key].guardian && ENEMIES[key].phase2);
    c.enemies[0].hp = Math.floor(c.enemies[0].maxHp / 2) + 1;
    c.hand = [{ ...run.deck[0], uid: 'zz' }];
    c.player.energy = 3;
    playCard(c, 'zz', 0);
    assert.equal(c.enemies[0].phase, 1, key);
  }
});

test('depths stack their rules', async () => {
  const { fightOptions, priceFor, campChoice: camp, buyOil: oil } = await import('../js/run.js');
  const easy = createRun(60), hard = createRun(60, [], 'inkbinder', 8);
  assert.equal(hard.depth, 8);
  assert.equal(hard.oilMax, 85);
  assert.ok(hard.deck.some(k => k.starter === 'blot'));
  assert.ok(!easy.deck.some(k => k.starter === 'blot'));
  assert.deepEqual(fightOptions(easy, 'random'), { hpMult: 1, strength: 0, paperWear: 0 });
  assert.deepEqual(fightOptions(hard, 'random'), { hpMult: 1, strength: 1, paperWear: 0 });
  assert.equal(fightOptions(hard, 'elite').hpMult, 1.1);
  assert.equal(fightOptions(hard, 'guardian').strength, 2);
  assert.equal(priceFor(hard, 20), 25);
  assert.equal(priceFor(easy, 20), 20);
  hard.hp = 10;
  assert.equal(camp(hard, { type: 'camp' }, 'rest').heal, 12); // 20% of 60
  // A Blot cannot be cast.
  const c = createCombat(hard, ['gravemoth'], () => 0.5, fightOptions(hard, 'random'));
  assert.equal(c.enemies[0].strength, 1);
  const blot = hard.deck.find(k => k.starter === 'blot');
  c.hand.push(blot);
  assert.match(playCard(c, blot.uid, 0), /cannot be cast/);
  // Depth 2 still lets you fill the smaller lantern.
  hard.oil = 50; hard.gold = 100;
  oil(hard);
  assert.equal(hard.oil, 85);
  assert.equal(hard.gold, 81);
});

test('winning opens the next depth, once', async () => {
  const { freshMeta, recordRun } = await import('../js/meta.js');
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; }, removeItem(k) { delete this.data[k]; } };
  const meta = freshMeta();
  assert.equal(recordRun(meta, { won: false, depth: 2, level: 0, maxLevel: 8 }, store).unlocked, null);
  assert.equal(recordRun(meta, { won: true, depth: 3, level: 0, maxLevel: 8 }, store).unlocked, 1);
  assert.equal(recordRun(meta, { won: true, depth: 3, level: 0, maxLevel: 8 }, store).unlocked, null);
  assert.equal(recordRun(meta, { won: true, depth: 3, level: 1, maxLevel: 8 }, store).unlocked, 2);
  meta.depthUnlocked = 8;
  assert.equal(recordRun(meta, { won: true, depth: 3, level: 8, maxLevel: 8 }, store).unlocked, null);
  assert.equal(meta.bestDepth, 8);
});

test('pale ink repeats the last card you cast', () => {
  const run = createRun(70);
  const pale = craftCard({ colors: ['grey'], inkMat: 'silver', cardMat: 'wood' });
  assert.deepEqual(pale.effects, [{ type: 'mimic', amount: 50 }]);
  assert.equal(craftCard({ colors: ['grey'], inkMat: 'blood', cardMat: 'stone' }).effects[0].amount, 150);
  const c = createCombat(run, ['grimoire'], () => 0.5);
  c.hand = [{ ...run.deck[0], uid: 's1' }, pale];
  c.player.energy = 5;
  const hp = c.enemies[0].hp;
  playCard(c, 's1', 0);             // Strike: 5
  playCard(c, pale.uid, 0);         // repeats it at 50%: 3
  assert.equal(hp - c.enemies[0].hp, 8);
  assert.equal(c.lastCast.name, 'Strike');
  const second = craftCard({ colors: ['grey'], inkMat: 'silver', cardMat: 'silver' });
  assert.equal(second.recipeId, 'secondhand');
});

test('bleed hurts enemies that attack; frail cuts block', () => {
  const run = createRun(71);
  const c = createCombat(run, ['hound'], () => 0.5);
  const e = c.enemies[0];
  e.bleed = 3;
  const hp = e.hp;
  c.hand = []; c.player.block = 100;
  endTurn(c);
  assert.ok(e.hp < hp, 'it bled when it attacked');
  c.player.frail = 2;
  c.player.block = 0;
  c.hand = [{ ...run.deck.find(k => k.starter === 'guard'), uid: 'g1' }];
  c.player.energy = 3;
  playCard(c, 'g1', 0);
  assert.equal(c.player.block, 3); // 5 x 0.75, rounded down
});

test('serrated and withering apply their statuses, and pale reactions exist', async () => {
  const { REACTIONS, INK_COLORS } = await import('../js/data.js');
  for (const k of Object.keys(INK_COLORS)) {
    if (k !== 'grey') assert.ok(REACTIONS[[k, 'grey'].sort().join('+')], `grey+${k}`);
  }
  const run = createRun(72);
  const card = craftCard({ colors: ['red'], inkMat: 'silver', cardMat: 'gold', enchants: ['serrated', 'withering'] });
  const c = createCombat(run, ['grimoire'], () => 0.5);
  c.hand = [card]; c.player.energy = 3;
  playCard(c, card.uid, 0);
  assert.equal(c.enemies[0].bleed, 2);
  assert.equal(c.enemies[0].frail, 2);
});

test('the Grimoire unlocks enchantments and relics for later runs', async () => {
  const { isLocked, unlocksBetween, relicChoices, rollRewards } = await import('../js/run.js');
  const fresh = createRun(73);
  assert.ok(isLocked(fresh, 'enchant', 'serrated'));
  assert.ok(isLocked(fresh, 'relic', 'cartographer'));
  assert.ok(!relicChoices(fresh, 30).some(id => ['cartographer', 'leechjar', 'scale'].includes(id)));
  for (let i = 0; i < 40; i++) {
    assert.ok(!rollRewards(['hound'], { run: fresh }, Math.random).items.includes('ench_serrated'));
  }
  const learned = createRun(73, RECIPES.slice(0, 6).map(r => r.id));
  assert.ok(!isLocked(learned, 'enchant', 'serrated'));
  assert.ok(!isLocked(learned, 'relic', 'leechjar'));
  assert.ok(isLocked(learned, 'relic', 'paleglass'));
  assert.deepEqual(unlocksBetween(1, 4).map(u => u.id), ['serrated', 'withering']);
});

test('delves hide cracked walls, traps and trapdoors', async () => {
  const { springTrap, enterLower } = await import('../js/run.js');
  let secrets = 0, hatches = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = generateRegion(seed % 4, seed);
    assert.ok(w.objects.filter(o => o.type === 'trap').length >= 1);
    if (w.secret) {
      secrets++;
      const crack = w.objects.find(o => o.type === 'crack');
      assert.ok(crack && isFloor(w, crack.x, crack.y));
      // The hidden room is only reachable through the crack.
      w.seen.fill(1);
      assert.equal(findPath(w, w.secret.x, w.secret.y), null);
      crack.gone = true;
      assert.ok(findPath(w, w.secret.x, w.secret.y));
    }
    if (w.objects.some(o => o.type === 'hatch')) hatches++;
  }
  assert.ok(secrets > 10 && hatches > 2, `${secrets} secrets, ${hatches} trapdoors`);
  const run = createRun(74);
  intoDelve(run);
  const hp = run.hp;
  springTrap(run, { trap: 'spikes' });
  assert.equal(run.hp, hp - 5);
  assert.ok(enterLower(run).ok);
  assert.ok(run.world.lower);
  assert.ok(!run.world.objects.some(o => o.type === 'up' || o.type === 'desk'));
  assert.ok(enterLower(run).error);
});

test("the Rag Merchant's favors pay out, and the last one tells the truth", async () => {
  const { meetMerchant, deliverFavor, canDeliver, priceFor } = await import('../js/run.js');
  const { MERCHANT } = await import('../js/data.js');
  const run = createRun(75);
  const first = meetMerchant(run, () => 0);
  assert.equal(first.line, MERCHANT.lines[0]);
  assert.ok(first.favor);
  assert.ok(!canDeliver(run));
  for (let i = 0; i < 3; i++) {
    const f = MERCHANT.favors[run.merchant.favor];
    run.inventory[f.item] = (run.inventory[f.item] || 0) + f.n;
    const r = deliverFavor(run, () => 0);
    assert.equal(r.text, MERCHANT.done[i]);
    if (i < 2) meetMerchant(run, () => 0);
  }
  assert.ok(run.relics.includes('scale'));
  assert.equal(priceFor(run, 20), 15);
  assert.equal(meetMerchant(run).favor, null);
});

test('Vell remarks on what you have written', async () => {
  const { vellRemark } = await import('../js/events.js');
  const run = createRun(76);
  assert.match(vellRemark(run), /haven't written anything/);
  Object.assign(run.inventory, { color_red: 1, mat_paper: 1 });
  craftIntoDeck(run, { colors: ['red'], inkMat: 'charcoal', cardMat: 'paper' });
  assert.match(vellRemark(run), /Paper/);
  run.deck.at(-1).customName = 'Kettle';
  assert.match(vellRemark(run), /Kettle/);
});

test('every effect type has card text', async () => {
  const { describeCard } = await import('../js/crafting.js');
  for (const r of RECIPES) assert.ok(describeCard(craftCard({ ...r.match, enchants: r.match.enchants || [] }, { corruption: 99 })).every(Boolean), r.id);
  for (const c of ['red', 'white', 'blue', 'green', 'black', 'grey']) {
    assert.ok(describeCard(craftCard({ colors: [c], inkMat: 'silver', cardMat: 'gold', enchants: ['serrated', 'withering'] })).length >= 3, c);
  }
});
