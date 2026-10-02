import {
  INK_COLORS, INK_MATERIALS, CARD_MATERIALS, ENCHANTMENTS, SECOND_INK_COST, REACTIONS,
  RECIPES, STARTER_CARDS, CORRUPTION, PRISTINE, WEAR, PICKUP, ALT_SOURCES, SIGNATURES, NAME_MAX,
} from './data.js';

let nextUid = 1;
const uid = () => `c${nextUid++}`;

// After loading a save, keep new card ids clear of the loaded ones.
export function ensureUidAbove(n) { nextUid = Math.max(nextUid, n + 1); }

const sameSet = (a = [], b = []) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// Forbidden recipes only answer to an Inkbinder who is Forsaken.
export function findRecipe({ colors, inkMat, cardMat, enchants = [] }, corruption = 0) {
  return RECIPES.find(r =>
    (!r.forbidden || corruption >= CORRUPTION.forsaken) &&
    sameSet(r.match.colors, colors) &&
    r.match.inkMat === inkMat &&
    r.match.cardMat === cardMat &&
    (r.match.enchants || []).every(e => enchants.includes(e)),
  ) || null;
}

// ---------- items ----------

// Adds an item to an inventory. Finds that are ready to use turn straight into
// their ingredients. Returns the ids actually added, one entry per item.
export function gainItem(inventory, id, n = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    for (const [to, k] of Object.entries(PICKUP[id] || { [id]: 1 })) {
      inventory[to] = (inventory[to] || 0) + k;
      for (let j = 0; j < k; j++) out.push(to);
    }
  }
  return out;
}

// What a list of found items becomes once picked up.
export const refinedIds = ids => ids.flatMap(id => {
  const to = PICKUP[id];
  return to ? Object.entries(to).flatMap(([t, k]) => Array(k).fill(t)) : [id];
});

// How a blueprint gets paid for: each slot uses its ready-made item if you have one,
// otherwise its other source (two slate for stone, silver ore for silver, your blood).
// Returns { items: { id: n }, hp } or { error }.
export function spendPlan(bp, inventory, hp = Infinity) {
  const left = { ...inventory };
  const items = {};
  let blood = 0;
  const take = (id, n = 1) => { left[id] = (left[id] || 0) - n; items[id] = (items[id] || 0) + n; };
  const slot = (kind, key, id) => {
    if ((left[id] || 0) >= 1) { take(id); return true; }
    const alt = ALT_SOURCES[kind]?.[key];
    if (!alt) return false;
    if (alt.hp) { blood += alt.hp; return true; }
    const [aid, n] = Object.entries(alt)[0];
    if ((left[aid] || 0) < n) return false;
    take(aid, n);
    return true;
  };
  if (bp.cardMat && !slot('cardMat', bp.cardMat, `mat_${bp.cardMat}`)) return { error: 'You are missing ingredients.' };
  for (const c of bp.colors || []) if (!slot('color', c, `color_${c}`)) return { error: 'You are missing ingredients.' };
  if (bp.inkMat && !slot('inkMat', bp.inkMat, `ink_${bp.inkMat}`)) return { error: 'You are missing ingredients.' };
  for (const e of bp.enchants || []) if (!slot('enchant', e, `ench_${e}`)) return { error: 'You are missing ingredients.' };
  if (bp.pristine && !slot('catalyst', 'pristine', 'ess_pristine')) return { error: 'You are missing ingredients.' };
  if (blood && hp <= blood) return { error: 'You are too weak to write in your own blood.' };
  return { items, hp: blood };
}

// How many of a slot option you could still pay for, given what is left.
export function available(kind, key, inventory) {
  const id = { cardMat: 'mat_', color: 'color_', inkMat: 'ink_', enchant: 'ench_' }[kind] + key;
  const alt = ALT_SOURCES[kind]?.[key];
  if (alt?.hp) return Infinity;
  const extra = alt ? Math.floor((inventory[Object.keys(alt)[0]] || 0) / Object.values(alt)[0]) : 0;
  return Math.max(0, inventory[id] || 0) + Math.max(0, extra);
}

// ---------- blueprints ----------

// Returns an error message, or null if the blueprint can be crafted.
export function validateBlueprint(bp, inventory = null, hp = Infinity) {
  if (!bp.cardMat) return 'Choose a card material.';
  if (!bp.colors?.length) return 'Choose an ink color.';
  if (bp.colors.length > 2) return 'You can mix at most two inks.';
  if (bp.colors.length === 2 && bp.colors[0] === bp.colors[1]) return 'Mix two different inks.';
  if (!bp.inkMat) return 'Choose an ink material.';
  const enchants = bp.enchants || [];
  const slots = CARD_MATERIALS[bp.cardMat].slots;
  if (enchants.length > slots) return `${CARD_MATERIALS[bp.cardMat].name} holds only ${slots} enchantment${slots === 1 ? '' : 's'}.`;
  if (new Set(enchants).size !== enchants.length) return 'Each enchantment can go on a card once.';
  if (inventory) return spendPlan(bp, inventory, hp).error || null;
  return null;
}

export function blueprintIngredients(bp) {
  return [
    `mat_${bp.cardMat}`,
    ...bp.colors.map(c => `color_${c}`),
    `ink_${bp.inkMat}`,
    ...(bp.enchants || []).map(e => `ench_${e}`),
    ...(bp.pristine ? ['ess_pristine'] : []),
  ];
}

// Builds a card from a blueprint. Does not touch inventory.
export function craftCard(bp, { corruption = 0 } = {}) {
  const err = validateBlueprint(bp);
  if (err) throw new Error(err);
  const enchants = [...(bp.enchants || [])];
  const ink = INK_MATERIALS[bp.inkMat];
  const mat = CARD_MATERIALS[bp.cardMat];
  const recipe = findRecipe({ ...bp, enchants }, corruption);

  let effects, name;
  if (recipe) {
    effects = recipe.effects.map(e => ({ ...e }));
    name = recipe.name;
  } else {
    const two = bp.colors.length === 2;
    let mult = ink.mult * (mat.powerMult || 1);
    if (enchants.includes('volatile')) mult *= 2;
    effects = bp.colors.map(c => {
      const color = INK_COLORS[c];
      return { type: color.effect, amount: Math.max(1, Math.round(color.base * mult)) };
    });
    const noun = two ? REACTIONS[[...bp.colors].sort().join('+')].name : INK_COLORS[bp.colors[0]].noun;
    name = `${ink.adj} ${noun}`;
  }
  if (bp.pristine) {
    for (const e of effects) if (GROWS.has(e.type) || e.type === 'draw') e.amount = Math.max(1, Math.round(e.amount * (e.type === 'draw' ? 1 : PRISTINE.mult)));
    name = `Pristine ${name}`;
  }

  const unbreakable = !!recipe?.unbreakable;
  const durability = unbreakable ? Infinity : mat.durability;
  return {
    uid: uid(),
    name,
    crafted: true,
    recipeId: recipe?.id || null,
    flavor: recipe?.flavor || null,
    colors: [...bp.colors],
    inkMat: bp.inkMat,
    cardMat: bp.cardMat,
    enchants,
    cost: Math.max(0, mat.cost + ink.extraCost + (bp.colors.length === 2 ? SECOND_INK_COST : 0)),
    hpCost: ink.hpCost,
    corrupts: ink.corrupts || 0,
    pristine: !!bp.pristine,
    casts: 0,
    wear: 0,
    purify: !!ink.purify,
    goldOnCast: mat.goldOnCast || 0,
    effects,
    durability,
    maxDurability: durability,
  };
}

// Effects that grow with Hungering, wear and Corruption.
export const GROWS = new Set(['damage', 'damageAll', 'block', 'heal', 'poison']);

// Counts a cast. Returns the name of a newly reached wear tier, if any.
export function recordCast(card) {
  if (!card.crafted) return null;
  card.casts = (card.casts || 0) + 1;
  const tier = WEAR.filter(w => card.casts >= w.casts).length;
  if (tier <= (card.wear || 0)) return null;
  applyWear(card, card.wear || 0, tier);
  card.wear = tier;
  if (tier >= WEAR.length && !card.signature) card.signaturePending = true;
  return WEAR[tier - 1].name;
}

// ---------- signatures and names ----------

export function chooseSignature(card, id) {
  if (!card.signaturePending || !SIGNATURES[id]) return { error: 'This card has no signature to choose.' };
  card.signature = id;
  card.signaturePending = false;
  applySignature(card);
  return { card };
}

// Applies a card's signature. Called again after the card is rebuilt.
export function applySignature(card) {
  switch (card.signature) {
    case 'weightless': card.cost = Math.max(0, card.cost - 1); break;
    case 'unfading': card.durability = card.maxDurability = Infinity; break;
    case 'resonant': for (const e of card.effects) if (GROWS.has(e.type)) e.amount += 3; break;
  }
}

export const canRename = card => card.crafted && (card.wear || 0) >= 1;

export function renameCard(card, text) {
  if (!canRename(card)) return { error: 'Only Well-Worn cards can be renamed.' };
  const name = String(text || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  if (!name) return { error: 'Give it a name.' };
  card.customName = name;
  card.name = name;
  return { card };
}

// ---------- recipe hints ----------

const tokens = ({ colors = [], inkMat, cardMat, enchants = [] }) => [
  ...colors.map(c => `color:${c}`), inkMat && `ink:${inkMat}`, cardMat && `card:${cardMat}`, ...enchants.map(e => `ench:${e}`),
].filter(Boolean);

// When the blueprint is exactly one part away from a named spell, returns
// { recipe, kind, change: 'add' | 'swap' }. Known spells are preferred.
export function recipeHint(bp, known = new Set(), corruption = 0) {
  if (findRecipe({ ...bp, enchants: bp.enchants || [] }, corruption)) return null;
  const have = tokens(bp);
  if (have.length < 2) return null;
  let best = null;
  for (const r of RECIPES) {
    if (r.forbidden && corruption < CORRUPTION.forsaken) continue;
    const want = tokens(r.match);
    const missing = want.filter(t => !have.includes(t));
    // Extra enchantments never spoil a recipe.
    const extra = have.filter(t => !want.includes(t) && !t.startsWith('ench:'));
    const kind = missing[0]?.split(':')[0];
    let change = null;
    if (missing.length === 1 && extra.length === 0) change = 'add';
    else if (missing.length === 1 && extra.length === 1 && extra[0].split(':')[0] === kind) change = 'swap';
    if (!change) continue;
    const hint = { recipe: r, kind, change };
    if (!best || (known.has(r.id) && !known.has(best.recipe.id))) best = hint;
  }
  return best;
}

// Adds the bonuses of wear tiers in (from, to] to a card's effects.
export function applyWear(card, from, to) {
  const bonus = WEAR.slice(from, to).reduce((sum, w) => sum + w.bonus, 0);
  if (bonus) for (const e of card.effects) if (GROWS.has(e.type)) e.amount += bonus;
}

// An exact copy of a card with its own id and a fresh page.
export function cloneCard(card) {
  return { ...card, uid: uid(), effects: card.effects.map(e => ({ ...e })), enchants: [...card.enchants], durability: card.maxDurability };
}

export const wearName = card => (card.wear ? WEAR[card.wear - 1].name : null);

export function makeStarterCard(key) {
  const s = STARTER_CARDS[key];
  return {
    uid: uid(), name: s.name, crafted: false, starter: key,
    colors: s.colors, inkMat: null, cardMat: null, enchants: [],
    cost: s.cost, hpCost: 0, purify: false, goldOnCast: 0, unplayable: !!s.unplayable,
    effects: s.effects.map(e => ({ ...e })),
    durability: Infinity, maxDurability: Infinity,
  };
}

// What a card breaks down into when salvaged.
export function cardComponents(card) {
  if (!card.crafted) return ['ink_charcoal', 'mat_paper'];
  return blueprintIngredients(card);
}

export function salvageRoll(card, rng = Math.random) {
  const parts = cardComponents(card);
  return parts[Math.floor(rng() * parts.length)];
}

const EFFECT_TEXT = {
  damage: n => `Deal ${n} damage.`,
  damageAll: n => `Deal ${n} damage to ALL enemies.`,
  block: n => `Gain ${n} Block.`,
  draw: n => `Draw ${n} card${n === 1 ? '' : 's'}.`,
  heal: n => `Heal ${n} HP.`,
  poison: n => `Apply ${n} Poison.`,
  loseMaxHp: n => `Lose ${n} max HP.`,
  nextFree: () => 'Your next card this turn costs 0.',
  mimic: n => `Repeat your last card at ${n}% power.`,
};

export function describeCard(card) {
  const lines = card.effects.map(e => EFFECT_TEXT[e.type](e.amount));
  if (card.unplayable) lines.push('Cannot be cast. Burn it or salvage it.');
  if (card.hpCost) lines.push(`Costs ${card.hpCost} HP.`);
  if (card.purify) lines.push('Purify 1 debuff.');
  if (card.goldOnCast) lines.push(`Gain ${card.goldOnCast} gold.`);
  if (card.enchants.includes('hallowed')) lines.push('Gain 4 Block.');
  if (card.enchants.includes('piercing')) lines.push('Ignores Block.');
  if (card.enchants.includes('serrated')) lines.push('Bleed 2 on a hit.');
  if (card.enchants.includes('withering')) lines.push('Apply 2 Frail.');
  return lines;
}

export function enchantLabel(key) {
  return ENCHANTMENTS[key].name;
}
