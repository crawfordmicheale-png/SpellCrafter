import {
  ENEMIES, INGREDIENTS, PRICES, REGIONS, STARTER_DECK, STARTING_INVENTORY, PLAYER_START, REFINING,
  CARD_MATERIALS, BENCH_REST_HEAL, RAW_MATERIALS, DESCEND_HEAL, LANTERN,
} from './data.js';
import { makeStarterCard, craftCard, validateBlueprint, blueprintIngredients, salvageRoll } from './crafting.js';
import { generateRegion, lightRadius, reveal } from './world.js';

export function createRun(seed = Math.floor(Math.random() * 2 ** 31), knownRecipes = []) {
  const run = {
    ...PLAYER_START,
    seed,
    deck: STARTER_DECK.map(makeStarterCard),
    inventory: { ...STARTING_INVENTORY },
    grimoire: new Set(knownRecipes), // recipe ids known, including ones from earlier runs
    dread: 0,
    oil: LANTERN.max,
    regionIdx: 0,
    world: null,
    salvagedHere: false,
  };
  enterWorld(run, generateRegion(0, seed));
  return run;
}

function enterWorld(run, world) {
  run.world = world;
  world.radius = lightRadius(run.oil);
  reveal(world);
}

export function burnValue(card) {
  if (!card.crafted) return LANTERN.burn.starter;
  return LANTERN.burn[card.cardMat] || 0; // stone and metal will not burn
}

// Feed a card to the lantern. Returns { oil } or { error }.
export function burnCard(run, cardUid) {
  const card = run.deck.find(k => k.uid === cardUid);
  if (!card) return { error: 'That card is not in your deck.' };
  const value = burnValue(card);
  if (!value) return { error: `${CARD_MATERIALS[card.cardMat].name} will not burn.` };
  if (run.oil >= LANTERN.max) return { error: 'Your lantern is already full.' };
  if (run.deck.length <= LANTERN.minDeck) return { error: 'You cannot spare another card.' };
  run.deck = run.deck.filter(k => k.uid !== cardUid);
  const before = run.oil;
  run.oil = Math.min(LANTERN.max, run.oil + value);
  run.world.radius = lightRadius(run.oil);
  reveal(run.world);
  return { oil: run.oil - before, card };
}

// Climb back to the surface to refill the lantern. You return to the same spot.
export function resurface(run) {
  if (run.oil >= LANTERN.max) return { error: 'Your lantern is already full.' };
  run.oil = LANTERN.max;
  run.dread += LANTERN.resurfaceDread;
  run.world.radius = lightRadius(run.oil);
  reveal(run.world);
  return { dread: LANTERN.resurfaceDread };
}

export const currentRegion = run => REGIONS[run.regionIdx];

export function descend(run) {
  run.regionIdx++;
  enterWorld(run, generateRegion(run.regionIdx, run.seed + run.regionIdx * 7919));
  run.dread = Math.floor(run.dread / 2);
  const heal = Math.round(run.maxHp * DESCEND_HEAL);
  run.hp = Math.min(run.maxHp, run.hp + heal);
  return { heal };
}

export function addItem(run, id, n = 1) {
  run.inventory[id] = (run.inventory[id] || 0) + n;
}

export function removeItem(run, id, n = 1) {
  run.inventory[id] -= n;
  if (run.inventory[id] <= 0) delete run.inventory[id];
}

const has = (run, needs) => Object.entries(needs).every(([id, n]) => (run.inventory[id] || 0) >= n);

// Spends ingredients and adds the new card to the deck. Returns { card } or { error }.
export function craftIntoDeck(run, bp) {
  const error = validateBlueprint(bp, run.inventory);
  if (error) return { error };
  const card = craftCard(bp);
  for (const id of blueprintIngredients(bp)) removeItem(run, id);
  run.deck.push(card);
  const discovered = card.recipeId && !run.grimoire.has(card.recipeId);
  if (card.recipeId) run.grimoire.add(card.recipeId);
  return { card, discovered };
}

export function canRefine(run, recipe) {
  if (recipe.hpCost && run.hp <= recipe.hpCost) return 'You are too weak to bleed.';
  if (!has(run, recipe.from)) return 'Missing materials.';
  return null;
}

export function refine(run, recipeId) {
  const recipe = REFINING.find(r => r.id === recipeId);
  const error = canRefine(run, recipe);
  if (error) return { error };
  for (const [id, n] of Object.entries(recipe.from)) removeItem(run, id, n);
  if (recipe.hpCost) run.hp -= recipe.hpCost;
  for (const [id, n] of Object.entries(recipe.to)) addItem(run, id, n);
  return { made: recipe.to };
}

// Adds an enchantment to a card you already own. The card is rebuilt so
// power-changing enchantments (Volatile) and recipes apply.
export function reinscribe(run, cardUid, enchant) {
  const card = run.deck.find(k => k.uid === cardUid);
  if (!card?.crafted) return { error: 'Only crafted cards can be re-inscribed.' };
  if (card.enchants.includes(enchant)) return { error: 'That card already carries it.' };
  if (card.enchants.length >= CARD_MATERIALS[card.cardMat].slots) return { error: 'No room for another enchantment.' };
  if (!run.inventory[`ench_${enchant}`]) return { error: 'You have none of that.' };
  const bp = { colors: card.colors, inkMat: card.inkMat, cardMat: card.cardMat, enchants: [...card.enchants, enchant] };
  const fresh = craftCard(bp);
  removeItem(run, `ench_${enchant}`);
  const discovered = fresh.recipeId && !run.grimoire.has(fresh.recipeId);
  if (fresh.recipeId) run.grimoire.add(fresh.recipeId);
  Object.assign(card, { ...fresh, uid: card.uid, durability: Math.min(card.durability, fresh.maxDurability) });
  return { card, discovered };
}

// Restores a worn card using one of the material it is made from.
export function mend(run, cardUid) {
  const card = run.deck.find(k => k.uid === cardUid);
  if (!card || !Number.isFinite(card.durability) || card.durability >= card.maxDurability) return { error: 'Nothing to mend.' };
  const mat = `mat_${card.cardMat}`;
  if (!run.inventory[mat]) return { error: `You need a ${INGREDIENTS[mat].name} to mend it.` };
  removeItem(run, mat);
  card.durability = card.maxDurability;
  return { card };
}

export function rest(run, desk) {
  if (desk.rested) return { error: 'You have already rested here.' };
  const heal = Math.round(run.maxHp * BENCH_REST_HEAL);
  run.hp = Math.min(run.maxHp, run.hp + heal);
  run.dread = Math.max(0, run.dread - 30);
  desk.rested = true;
  return { heal };
}

export function salvageCard(run, cardUid, rng = Math.random) {
  if (run.salvagedHere) return { error: 'You can salvage only one card per visit.' };
  const card = run.deck.find(k => k.uid === cardUid);
  if (!card) return { error: 'That card is not in your deck.' };
  if (run.deck.length <= 5) return { error: 'Your deck is too thin to salvage.' };
  const part = salvageRoll(card, rng);
  run.deck = run.deck.filter(k => k.uid !== cardUid);
  addItem(run, part);
  run.salvagedHere = true;
  return { part };
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// Loot for a won fight. Each enemy drops from its own themed table.
export function rollRewards(enemyKeys, { elite = false, boss = false } = {}, rng = Math.random) {
  const items = [];
  for (const key of enemyKeys) {
    const drops = ENEMIES[key].drops;
    if (!drops.length) continue;
    const n = ENEMIES[key].elite ? 3 : 1 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) items.push(pick(drops, rng));
  }
  const gold = boss ? 0 : elite ? 40 + Math.floor(rng() * 15) : 6 + Math.floor(rng() * 8);
  return { items, gold };
}

export function scavenge(run, node) {
  const id = `raw_${node.raw}`;
  addItem(run, id, node.amount);
  node.gone = true;
  return { items: Array(node.amount).fill(id) };
}

const CHEST_LOOT = ['raw_silver', 'raw_slate', 'raw_gold', 'raw_heart', 'ench_echo', 'ench_swift', 'ench_leech', 'ench_volatile', 'ench_hungering'];

export function openChest(run, chest, rng = Math.random) {
  const items = [pick(CHEST_LOOT, rng)];
  if (rng() < 0.5) items.push(pick(Object.keys(RAW_MATERIALS).filter(k => k !== 'heart').map(k => `raw_${k}`), rng));
  const gold = 10 + Math.floor(rng() * 20);
  for (const id of items) addItem(run, id);
  run.gold += gold;
  chest.gone = true;
  return { items, gold };
}

export function applyRewards(run, rewards) {
  for (const id of rewards.items) addItem(run, id);
  run.gold += rewards.gold;
}

export function rollShop(rng = Math.random) {
  const ids = Object.keys(INGREDIENTS).filter(id => id !== 'raw_heart');
  const stock = new Set();
  while (stock.size < 9) stock.add(pick(ids, rng));
  return [...stock].map(id => ({ id, price: PRICES[INGREDIENTS[id].rarity], sold: false }));
}
