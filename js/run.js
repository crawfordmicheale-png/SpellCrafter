import {
  ENEMIES, INGREDIENTS, PRICES, REGIONS, STARTER_DECK, STARTING_INVENTORY, PLAYER_START, REFINING,
  CARD_MATERIALS, BENCH_REST_HEAL, RAW_MATERIALS, DESCEND_HEAL, LANTERN, RELICS, RELIC_PRICE, CHEST_RELIC_CHANCE,
  VARIANTS, CORRUPTION, EVENTS, MAP, DELVE, CAMP, OIL_WARE,
} from './data.js';
import { makeStarterCard, craftCard, validateBlueprint, blueprintIngredients, salvageRoll, ensureUidAbove, applyWear } from './crafting.js';
import { generateRegion, lightRadius, reveal } from './world.js';
import { generateMap, availableNodes, guardianOf } from './overworld.js';
import { lastBeat } from './events.js';

export function createRun(seed = Math.floor(Math.random() * 2 ** 31), knownRecipes = [], variant = 'inkbinder') {
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
    map: null,
    salvagedHere: false,
    story: { trust: 0, met: [] },
    seenEvents: [],
    relics: [],
    variant,
    corruption: 0,
    oilMax: LANTERN.max,
    perks: [],
  };
  const { inventory = {}, relics = [], ...rest } = VARIANTS[variant]?.start || {};
  Object.assign(run, rest);
  for (const [id, n] of Object.entries(inventory)) run.inventory[id] = (run.inventory[id] || 0) + n;
  for (const id of relics) gainRelic(run, id);
  run.map = generateMap(0, seed);
  return run;
}

export const oilMax = run => run.oilMax ?? LANTERN.max;

// Which Inkbinders a player's lifetime progress has unlocked.
export function isUnlocked(meta, variant) {
  const u = VARIANTS[variant]?.unlock;
  if (!u) return true;
  if (u.type === 'deepest') return (meta.deepest ?? -1) >= u.value;
  if (u.type === 'grimoire') return (meta.grimoire?.length || 0) >= u.value;
  return false;
}

export const corruptionState = run => (run.corruption >= CORRUPTION.forsaken ? 'Forsaken'
  : run.corruption >= CORRUPTION.tainted ? 'Tainted' : null);

function enterWorld(run, world) {
  run.world = world;
  world.radius = lightRadius(run.oil);
  reveal(world);
}

// ---------- relics ----------

export const hasRelic = (run, id) => run.relics.includes(id);
export const unownedRelics = run => Object.keys(RELICS).filter(id => !hasRelic(run, id));

export function gainRelic(run, id) {
  if (hasRelic(run, id)) return;
  run.relics.push(id);
  if (id === 'locket') { run.maxHp += 10; run.hp += 10; }
  if (id === 'thimble') {
    for (const k of run.deck) if (k.cardMat === 'paper') { k.durability += 2; k.maxDurability += 2; }
  }
}

export function relicChoices(run, n = 3, rng = Math.random) {
  const pool = unownedRelics(run);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
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
  if (run.oil >= oilMax(run)) return { error: 'Your lantern is already full.' };
  if (run.deck.length <= LANTERN.minDeck) return { error: 'You cannot spare another card.' };
  run.deck = run.deck.filter(k => k.uid !== cardUid);
  const before = run.oil;
  run.oil = Math.min(oilMax(run), run.oil + value);
  run.world.radius = lightRadius(run.oil);
  reveal(run.world);
  return { oil: run.oil - before, card };
}

// Climb back to the surface to refill the lantern. You return to the same spot.
export function resurface(run) {
  if (run.oil >= oilMax(run)) return { error: 'Your lantern is already full.' };
  run.oil = oilMax(run);
  run.dread += LANTERN.resurfaceDread;
  run.world.radius = lightRadius(run.oil);
  reveal(run.world);
  return { dread: LANTERN.resurfaceDread };
}

export const currentRegion = run => REGIONS[run.regionIdx];

// ---------- the overworld map ----------

export const currentNode = run => (run.map?.pos != null ? run.map.nodes[run.map.pos] : null);

const pickFrom = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// Move to a node on the map. Returns what is there:
//   { type: 'delve' } (run.world is now set) | { type: 'shop' } | { type: 'camp' }
//   | { type: 'event', event } | { type: 'story', event } | { type: 'cache', items, gold, relic? }
//   | { type: 'fight', enemies, kind }
// The outcome is stored on the node, so reloading a save lands in the same place.
export function enterNode(run, nodeId, rng = Math.random) {
  const map = run.map;
  const node = map.nodes[nodeId];
  if (!node || !availableNodes(map).includes(node)) return { error: 'You cannot reach that from here.' };
  map.pos = node.id;
  map.visited.push(node.id);
  node.outcome = resolveNode(run, node, rng);
  return node.outcome;
}

function unseenEvents(run) {
  const pool = Object.keys(EVENTS).filter(id => !run.seenEvents.includes(id));
  return pool.length ? pool : Object.keys(EVENTS);
}

function resolveNode(run, node, rng) {
  const region = currentRegion(run);
  const seed = run.seed + run.regionIdx * 7919 + node.id * 131;
  switch (node.type) {
    case 'delve':
    case 'haunted': {
      const elite = node.type === 'haunted' ? pickFrom(region.elites, rng) : null;
      const world = generateRegion(run.regionIdx, seed, { elite, events: unseenEvents(run) });
      for (const o of world.objects) if (o.type === 'event') run.seenEvents.push(o.event);
      enterWorld(run, world);
      return { type: 'delve', elite };
    }
    case 'shop':
      node.stock = rollShop(rng, run);
      return { type: 'shop' };
    case 'camp':
      return { type: 'camp' };
    case 'story': {
      const beat = ['vell1', 'vell2', 'vell3'][run.regionIdx] || lastBeat(run);
      return { type: 'story', event: beat };
    }
    case 'guardian':
      return { type: 'fight', enemies: [guardianOf(run.regionIdx)], kind: region.boss ? 'boss' : 'guardian' };
    case 'unknown': {
      const r = rng();
      if (r < MAP.unknown.ambush) return { type: 'fight', enemies: pickFrom(region.encounters, rng), kind: 'random' };
      if (r < MAP.unknown.ambush + MAP.unknown.cache) {
        const loot = openChest(run, {}, rng);
        return { type: 'cache', ...loot };
      }
      const event = pickFrom(unseenEvents(run), rng);
      run.seenEvents.push(event);
      return { type: 'event', event };
    }
  }
  return { type: 'none' };
}

// Climb out of a delve and back onto the map. The open air eases your Dread.
export function leaveDelve(run) {
  run.world = null;
  const before = run.dread;
  run.dread = Math.floor(run.dread * DELVE.leaveDread);
  return { eased: before - run.dread };
}

// At a scriptorium you may rest or refill your lantern, not both.
export function campChoice(run, node, choice) {
  if (node.campUsed) return { error: 'You have already made your choice here.' };
  if (choice === 'rest') {
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * CAMP.heal));
    run.dread = Math.max(0, run.dread - CAMP.dread);
    const cleansed = Math.min(run.corruption || 0, CAMP.corruption);
    run.corruption -= cleansed;
    node.campUsed = 'rest';
    return { heal: run.hp - before, cleansed };
  }
  if (choice === 'oil') {
    if (run.oil >= oilMax(run)) return { error: 'Your lantern is already full.' };
    const before = run.oil;
    run.oil = oilMax(run);
    node.campUsed = 'oil';
    return { oil: run.oil - before };
  }
  return { error: 'Unknown choice.' };
}

export function buyOil(run) {
  if (run.gold < OIL_WARE.price) return { error: 'Not enough gold.' };
  if (run.oil >= oilMax(run)) return { error: 'Your lantern is already full.' };
  run.gold -= OIL_WARE.price;
  const before = run.oil;
  run.oil = Math.min(oilMax(run), run.oil + OIL_WARE.oil);
  return { oil: run.oil - before };
}

// After the guardian falls: on to the next act and a fresh map.
export function descend(run) {
  run.regionIdx++;
  run.world = null;
  run.map = generateMap(run.regionIdx, run.seed);
  run.dread = Math.floor(run.dread / 2);
  const heal = Math.round(run.maxHp * DESCEND_HEAL);
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + heal);
  return { heal: run.hp - before };
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
  const card = craftCard(bp, { corruption: run.corruption });
  if (card.cardMat === 'paper' && hasRelic(run, 'thimble')) { card.durability += 2; card.maxDurability += 2; }
  if (bp.inkMat === 'blood') run.corruption += CORRUPTION.craftBlood;
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
  if (recipe.id === 'bleed') run.corruption += CORRUPTION.bleed;
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
  const bp = { colors: card.colors, inkMat: card.inkMat, cardMat: card.cardMat, enchants: [...card.enchants, enchant], pristine: card.pristine };
  const fresh = craftCard(bp, { corruption: run.corruption });
  applyWear(fresh, 0, card.wear || 0); // a well-worn card keeps its wear
  removeItem(run, `ench_${enchant}`);
  const discovered = fresh.recipeId && !run.grimoire.has(fresh.recipeId);
  if (fresh.recipeId) run.grimoire.add(fresh.recipeId);
  Object.assign(card, {
    ...fresh, uid: card.uid, casts: card.casts || 0, wear: card.wear || 0,
    durability: Math.min(card.durability, fresh.maxDurability),
  });
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
  run.corruption = Math.max(0, run.corruption - CORRUPTION.restCleanse);
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
export function rollRewards(enemyKeys, { elite = false, boss = false, dice = false } = {}, rng = Math.random) {
  const items = [];
  for (const key of enemyKeys) {
    const drops = ENEMIES[key].drops;
    if (!drops.length) continue;
    const n = (ENEMIES[key].elite ? 3 : 1 + (rng() < 0.4 ? 1 : 0)) + (dice && rng() < 1 / 3 ? 1 : 0);
    for (let i = 0; i < n; i++) items.push(pick(drops, rng));
  }
  const gold = boss ? 0 : elite ? 40 + Math.floor(rng() * 15) : 6 + Math.floor(rng() * 8);
  return { items, gold };
}

export function scavenge(run, node) {
  const id = `raw_${node.raw}`;
  const amount = node.pristine ? node.amount * 2 : node.amount;
  addItem(run, id, amount);
  const items = Array(amount).fill(id);
  if (node.pristine) { addItem(run, 'ess_pristine'); items.push('ess_pristine'); }
  node.gone = true;
  return { items, pristine: !!node.pristine };
}

const CHEST_LOOT = ['raw_silver', 'raw_slate', 'raw_gold', 'raw_heart', 'ench_echo', 'ench_swift', 'ench_leech', 'ench_volatile', 'ench_hungering'];

export function openChest(run, chest, rng = Math.random) {
  const items = [pick(CHEST_LOOT, rng)];
  if (rng() < 0.5) items.push(pick(Object.keys(RAW_MATERIALS).filter(k => k !== 'heart').map(k => `raw_${k}`), rng));
  const gold = 10 + Math.floor(rng() * 20);
  for (const id of items) addItem(run, id);
  run.gold += gold;
  chest.gone = true;
  let relic = null;
  if (rng() < CHEST_RELIC_CHANCE && unownedRelics(run).length) {
    relic = relicChoices(run, 1, rng)[0];
    gainRelic(run, relic);
  }
  return { items, gold, relic };
}

export function applyRewards(run, rewards) {
  for (const id of rewards.items) addItem(run, id);
  run.gold += rewards.gold;
  if (hasRelic(run, 'candle')) {
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + 4);
    rewards.healed = run.hp - before;
  }
}

export function rollShop(rng = Math.random, run = null) {
  const ids = Object.keys(INGREDIENTS).filter(id => id !== 'raw_heart');
  const stock = new Set();
  while (stock.size < 9) stock.add(pick(ids, rng));
  const wares = [...stock].map(id => ({ id, price: PRICES[INGREDIENTS[id].rarity], sold: false }));
  const relic = run && relicChoices(run, 1, rng)[0];
  if (relic) wares.push({ relic, price: RELIC_PRICE, sold: false });
  return wares;
}

// ---------- saving ----------
// JSON cannot hold Infinity, typed arrays or Sets, so those are converted here.

export function serializeRun(run, resume = {}) {
  const w = run.world;
  const data = {
    ...run,
    grimoire: [...run.grimoire],
    deck: run.deck.map(k => ({ ...k, durability: fin(k.durability), maxDurability: fin(k.maxDurability) })),
    world: w ? { ...w, tiles: Array.from(w.tiles), seen: Array.from(w.seen).join('') } : null,
  };
  return JSON.stringify({ v: SAVE_VERSION, run: data, resume });
}

const SAVE_VERSION = 2; // 2: the overworld map

const fin = n => (Number.isFinite(n) ? n : 'inf');
const unfin = n => (n === 'inf' ? Infinity : n);

export function deserializeRun(text) {
  const { v, run, resume } = JSON.parse(text);
  if (v !== SAVE_VERSION) throw new Error('Unknown save version');
  run.grimoire = new Set(run.grimoire);
  run.relics ||= [];
  run.corruption ||= 0;   // saves from before Corruption existed
  run.perks ||= [];
  run.variant ||= 'inkbinder';
  run.deck = run.deck.map(k => ({ ...k, durability: unfin(k.durability), maxDurability: unfin(k.maxDurability) }));
  if (run.world) {
    run.world.tiles = Uint8Array.from(run.world.tiles);
    run.world.seen = Uint8Array.from(run.world.seen, ch => +ch);
  }
  ensureUidAbove(Math.max(0, ...run.deck.map(k => +k.uid.slice(1))));
  return { run, resume };
}
