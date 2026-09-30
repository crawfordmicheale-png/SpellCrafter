import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craftCard, validateBlueprint, findRecipe } from '../js/crafting.js';
import { createCombat, playCard, endTurn } from '../js/combat.js';
import { createRun, craftIntoDeck, salvageCard, refine, reinscribe, mend, descend } from '../js/run.js';
import { generateRegion, findPath, step, isFloor, objectAt } from '../js/world.js';
import { RECIPES, REGIONS } from '../js/data.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

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

test('hybrid ink makes two weaker effects', () => {
  const c = craftCard({ colors: ['red', 'blue'], inkMat: 'silver', cardMat: 'silver' });
  assert.equal(c.name, 'Silvered Storm');
  assert.deepEqual(c.effects, [{ type: 'damage', amount: 4 }, { type: 'draw', amount: 1 }]);
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
    assert.equal(craftCard(bp).recipeId, r.id);
  }
});

test('refining turns raw materials into ingredients', () => {
  const run = createRun(1);
  assert.equal(refine(run, 'charcoal').error, undefined);
  assert.equal(run.inventory.raw_ash, undefined);
  assert.equal(run.inventory.ink_charcoal, 4);
  assert.ok(refine(run, 'silverCard').error);
  const hp = run.hp;
  refine(run, 'bleed');
  assert.equal(run.hp, hp - 6);
  assert.equal(run.inventory.ink_blood, 1);
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

test('regions generate connected maps with a desk and an exit', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (let r = 0; r < REGIONS.length; r++) {
      const w = generateRegion(r, seed);
      assert.ok(w.rooms.length >= 5, `rooms seed ${seed}`);
      assert.ok(isFloor(w, w.px, w.py));
      const goal = w.objects.find(o => o.type === (REGIONS[r].boss ? 'boss' : 'exit'));
      const desk = w.objects.find(o => o.type === 'desk');
      assert.ok(goal && desk);
      w.seen.fill(1);
      assert.ok(findPath(w, goal.x, goal.y), `exit reachable seed ${seed} region ${r}`);
      assert.equal(w.objects.filter(o => w.objects.some(p => p !== o && p.x === o.x && p.y === o.y)).length, 0);
    }
  }
});

test('walking builds dread and eventually meets something', () => {
  const run = createRun(3);
  const w = run.world;
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
});
