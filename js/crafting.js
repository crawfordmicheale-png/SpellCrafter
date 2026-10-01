import {
  INK_COLORS, INK_MATERIALS, CARD_MATERIALS, ENCHANTMENTS, HYBRID_FACTOR, HYBRID_NOUNS,
  RECIPES, STARTER_CARDS, CORRUPTION, PRISTINE, WEAR,
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

// Returns an error message, or null if the blueprint can be crafted.
export function validateBlueprint(bp, inventory = null) {
  if (!bp.cardMat) return 'Choose a card material.';
  if (!bp.colors?.length) return 'Choose an ink color.';
  if (bp.colors.length > 2) return 'You can mix at most two inks.';
  if (bp.colors.length === 2 && bp.colors[0] === bp.colors[1]) return 'Mix two different inks.';
  if (!bp.inkMat) return 'Choose an ink material.';
  const enchants = bp.enchants || [];
  const slots = CARD_MATERIALS[bp.cardMat].slots;
  if (enchants.length > slots) return `${CARD_MATERIALS[bp.cardMat].name} holds only ${slots} enchantment${slots === 1 ? '' : 's'}.`;
  if (new Set(enchants).size !== enchants.length) return 'Each enchantment can go on a card once.';
  if (inventory) {
    const need = {};
    for (const id of blueprintIngredients(bp)) need[id] = (need[id] || 0) + 1;
    for (const [id, n] of Object.entries(need)) {
      if ((inventory[id] || 0) < n) return 'You are missing ingredients.';
    }
  }
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
    const hybrid = bp.colors.length === 2;
    let mult = ink.mult * (mat.powerMult || 1) * (hybrid ? HYBRID_FACTOR : 1);
    if (enchants.includes('volatile')) mult *= 2;
    effects = bp.colors.map(c => {
      const color = INK_COLORS[c];
      return { type: color.effect, amount: Math.max(1, Math.round(color.base * mult)) };
    });
    const noun = hybrid ? HYBRID_NOUNS[[...bp.colors].sort().join('+')] : INK_COLORS[bp.colors[0]].noun;
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
    cost: Math.max(0, mat.cost + ink.extraCost),
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
  return WEAR[tier - 1].name;
}

// Adds the bonuses of wear tiers in (from, to] to a card's effects.
export function applyWear(card, from, to) {
  const bonus = WEAR.slice(from, to).reduce((sum, w) => sum + w.bonus, 0);
  if (bonus) for (const e of card.effects) if (GROWS.has(e.type)) e.amount += bonus;
}

export const wearName = card => (card.wear ? WEAR[card.wear - 1].name : null);

export function makeStarterCard(key) {
  const s = STARTER_CARDS[key];
  return {
    uid: uid(), name: s.name, crafted: false, starter: key,
    colors: s.colors, inkMat: null, cardMat: null, enchants: [],
    cost: s.cost, hpCost: 0, purify: false, goldOnCast: 0,
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
};

export function describeCard(card) {
  const lines = card.effects.map(e => EFFECT_TEXT[e.type](e.amount));
  if (card.hpCost) lines.push(`Costs ${card.hpCost} HP.`);
  if (card.purify) lines.push('Purify 1 debuff.');
  if (card.goldOnCast) lines.push(`Gain ${card.goldOnCast} gold.`);
  if (card.enchants.includes('hallowed')) lines.push('Gain 4 Block.');
  if (card.enchants.includes('piercing')) lines.push('Ignores Block.');
  return lines;
}

export function enchantLabel(key) {
  return ENCHANTMENTS[key].name;
}
