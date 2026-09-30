import { ENEMIES, INGREDIENTS, PRICES, RUN_PATH, STARTER_DECK, STARTING_INVENTORY, PLAYER_START } from './data.js';
import { makeStarterCard, craftCard, validateBlueprint, blueprintIngredients, salvageRoll } from './crafting.js';

export function createRun() {
  return {
    ...PLAYER_START,
    deck: STARTER_DECK.map(makeStarterCard),
    inventory: { ...STARTING_INVENTORY },
    nodeIdx: 0,
    grimoire: new Set(), // recipe ids discovered this run
    salvagedHere: false,
  };
}

export const currentNode = run => RUN_PATH[run.nodeIdx];

export function advance(run) {
  run.nodeIdx++;
  run.salvagedHere = false;
  return currentNode(run);
}

export function addItem(run, id, n = 1) {
  run.inventory[id] = (run.inventory[id] || 0) + n;
}

export function removeItem(run, id, n = 1) {
  run.inventory[id] -= n;
  if (run.inventory[id] <= 0) delete run.inventory[id];
}

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

export function salvageCard(run, cardUid, rng = Math.random) {
  if (run.salvagedHere) return { error: 'You can salvage only one card per bench.' };
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
export function rollRewards(enemyKeys, node, rng = Math.random) {
  const items = [];
  for (const key of enemyKeys) {
    const drops = ENEMIES[key].drops;
    if (!drops.length) continue;
    const n = ENEMIES[key].elite ? 3 : 1 + (rng() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) items.push(pick(drops, rng));
  }
  const gold = node.boss ? 0 : node.elite ? 40 + Math.floor(rng() * 15) : 12 + Math.floor(rng() * 10);
  return { items, gold };
}

export function applyRewards(run, rewards) {
  for (const id of rewards.items) addItem(run, id);
  run.gold += rewards.gold;
}

export function rollShop(rng = Math.random) {
  const ids = Object.keys(INGREDIENTS);
  const stock = new Set();
  while (stock.size < 8) stock.add(pick(ids, rng));
  return [...stock].map(id => ({ id, price: PRICES[INGREDIENTS[id].rarity], sold: false }));
}
