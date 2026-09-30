import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craftCard, validateBlueprint, findRecipe } from '../js/crafting.js';
import { createCombat, playCard, endTurn } from '../js/combat.js';
import { createRun, craftIntoDeck, salvageCard } from '../js/run.js';

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
