// All tunable game data lives here. Numbers are first-pass and meant to be tweaked.

export const INK_COLORS = {
  red:   { name: 'Crimson Ink', short: 'Red',   noun: 'Flame',   effect: 'damage', base: 6, hue: '#c0392b', desc: 'Deals damage' },
  white: { name: 'Bone Ink',    short: 'White', noun: 'Ward',    effect: 'block',  base: 5, hue: '#e8e0cc', desc: 'Gains Block' },
  blue:  { name: 'Drowned Ink', short: 'Blue',  noun: 'Insight', effect: 'draw',   base: 2, hue: '#3a6ea5', desc: 'Draws cards' },
  green: { name: 'Moss Ink',    short: 'Green', noun: 'Mending', effect: 'heal',   base: 4, hue: '#4f8a4b', desc: 'Heals you' },
  black: { name: 'Grave Ink',   short: 'Black', noun: 'Blight',  effect: 'poison', base: 3, hue: '#6b4f7a', desc: 'Applies Poison' },
};

// Two inks mixed together make a hybrid: both effects at HYBRID_FACTOR strength.
export const HYBRID_FACTOR = 0.6;
export const HYBRID_NOUNS = {
  'blue+red': 'Storm', 'red+white': 'Brand', 'green+red': 'Cautery', 'black+red': 'Hexfire',
  'blue+white': 'Aegis', 'blue+green': 'Tide', 'black+blue': 'Nightmare',
  'green+white': 'Sanctuary', 'black+white': 'Shroud', 'black+green': 'Rot',
};

export const INK_MATERIALS = {
  charcoal: { name: 'Charcoal', adj: 'Ashen',    mult: 0.75, extraCost: 0, hpCost: 0, desc: 'x0.75 power. Cheap.' },
  silver:   { name: 'Silver',   adj: 'Silvered', mult: 1.0,  extraCost: 0, hpCost: 0, purify: true, desc: 'x1 power. Removes 1 debuff from you.' },
  gold:     { name: 'Gold',     adj: 'Gilded',   mult: 1.5,  extraCost: 1, hpCost: 0, desc: 'x1.5 power. +1 cost.' },
  blood:    { name: 'Blood',    adj: 'Sanguine', mult: 2.0,  extraCost: 0, hpCost: 3, desc: 'x2 power. Costs 3 HP to cast.' },
};

// durability: uses across the whole run (Infinity = permanent)
export const CARD_MATERIALS = {
  paper:  { name: 'Paper',  cost: 0, durability: 3,        slots: 0, desc: '0 cost. Burns after 3 casts.' },
  wood:   { name: 'Wood',   cost: 1, durability: 8,        slots: 1, desc: 'Lasts 8 casts. 1 enchantment.' },
  stone:  { name: 'Stone',  cost: 2, durability: Infinity, slots: 1, powerMult: 1.5, desc: 'Permanent. x1.5 power, but costs 2.' },
  silver: { name: 'Silver', cost: 1, durability: Infinity, slots: 2, desc: 'Permanent. 2 enchantments.' },
  gold:   { name: 'Gold',   cost: 1, durability: Infinity, slots: 3, goldOnCast: 2, desc: 'Permanent. 3 enchantments. +2 gold per cast.' },
};

export const ENCHANTMENTS = {
  echo:     { name: 'Echo',     desc: 'Casts again at half power.' },
  swift:    { name: 'Swift',    desc: 'Costs 0 the first time it is cast each fight.' },
  bound:    { name: 'Bound',    desc: 'Stays in your hand at end of turn.' },
  volatile: { name: 'Volatile', desc: 'Double power. Exhausts for the rest of the fight.' },
  leech:    { name: 'Leech',    desc: 'Heal for a quarter of the damage dealt.' },
  siphon:   { name: 'Siphon',   desc: 'Gain 1 mana if this kills an enemy.' },
};

// Every ingredient in the game, keyed by inventory id.
export const INGREDIENTS = {};
for (const [k, v] of Object.entries(INK_COLORS))     INGREDIENTS[`color_${k}`] = { kind: 'color',   key: k, name: v.name, rarity: 'common' };
for (const [k, v] of Object.entries(INK_MATERIALS))  INGREDIENTS[`ink_${k}`]   = { kind: 'inkMat',  key: k, name: `${v.name} Ink`, rarity: { charcoal: 'common', silver: 'uncommon', gold: 'rare', blood: 'rare' }[k] };
for (const [k, v] of Object.entries(CARD_MATERIALS)) INGREDIENTS[`mat_${k}`]   = { kind: 'cardMat', key: k, name: `${v.name} Card`, rarity: { paper: 'common', wood: 'common', stone: 'uncommon', silver: 'uncommon', gold: 'rare' }[k] };
for (const [k, v] of Object.entries(ENCHANTMENTS))   INGREDIENTS[`ench_${k}`]  = { kind: 'enchant', key: k, name: v.name, rarity: 'uncommon' };

export const PRICES = { common: 12, uncommon: 25, rare: 45 };
export const REPAIR_PRICE = 20;

// Named spells. Matching colors + ink material + card material (and any listed
// enchantments) replaces the formula with a fixed, stronger effect.
export const RECIPES = [
  {
    id: 'pact', name: 'Pact of Ruin',
    match: { colors: ['black'], inkMat: 'blood', cardMat: 'gold' },
    effects: [{ type: 'damage', amount: 22 }, { type: 'loseMaxHp', amount: 4 }],
    hint: 'Grave ink, spilled blood, and a golden page.',
    flavor: 'Some debts are paid by the living.',
  },
  {
    id: 'clarity', name: 'Clarity',
    match: { colors: ['blue'], inkMat: 'silver', cardMat: 'silver' },
    effects: [{ type: 'draw', amount: 3 }, { type: 'nextFree', amount: 1 }],
    hint: 'Drowned ink, silver on silver.',
    flavor: 'For one breath, the fog lifts.',
  },
  {
    id: 'kindling', name: 'Kindling',
    match: { colors: ['red'], inkMat: 'blood', cardMat: 'paper' },
    effects: [{ type: 'damageAll', amount: 10 }],
    hint: 'Crimson and blood on a page that wants to burn.',
    flavor: 'The page was always meant to burn.',
  },
  {
    id: 'evergreen', name: 'Evergreen',
    match: { colors: ['green'], inkMat: 'gold', cardMat: 'wood' },
    effects: [{ type: 'heal', amount: 6 }, { type: 'block', amount: 4 }],
    unbreakable: true,
    hint: 'Moss and gold, pressed into living wood.',
    flavor: 'The wood remembers being a tree.',
  },
];

// Uncraftable starting cards. Permanent.
export const STARTER_CARDS = {
  strike:   { name: 'Strike',   cost: 1, effects: [{ type: 'damage', amount: 5 }], colors: ['red'] },
  guard:    { name: 'Guard',    cost: 1, effects: [{ type: 'block', amount: 5 }],  colors: ['white'] },
  scribble: { name: 'Scribble', cost: 0, effects: [{ type: 'draw', amount: 1 }],   colors: ['blue'] },
};
export const STARTER_DECK = ['strike', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'scribble'];

export const STARTING_INVENTORY = {
  color_red: 1, color_white: 1, color_black: 1,
  ink_charcoal: 2, ink_silver: 1,
  mat_paper: 2, mat_wood: 1,
  ench_volatile: 1,
};

export const PLAYER_START = { hp: 60, maxHp: 60, gold: 30, energy: 3, handSize: 5 };

// Enemy moves cycle in order. Each move is a list of actions.
export const ENEMIES = {
  acolyte: {
    name: 'Hollow Acolyte', hp: 24,
    desc: 'A monk who wrote his own name out of the world.',
    moves: [
      { actions: [{ type: 'attack', amount: 6 }] },
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'block', amount: 5 }] },
      { actions: [{ type: 'attack', amount: 8 }] },
    ],
    drops: ['color_black', 'ink_charcoal', 'mat_paper'],
  },
  gravemoth: {
    name: 'Gravemoth', hp: 13,
    desc: 'Drawn to candlelight and open wounds.',
    moves: [
      { actions: [{ type: 'attack', amount: 3 }, { type: 'debuff', status: 'poison', amount: 2 }] },
      { actions: [{ type: 'attack', amount: 5 }] },
    ],
    drops: ['color_green', 'mat_paper', 'ench_swift'],
  },
  hound: {
    name: 'Ashen Hound', hp: 20,
    desc: 'It still hunts for the master it burned.',
    moves: [
      { actions: [{ type: 'attack', amount: 4, times: 2 }] },
      { actions: [{ type: 'buff', status: 'strength', amount: 2 }, { type: 'block', amount: 4 }] },
      { actions: [{ type: 'attack', amount: 9 }] },
    ],
    drops: ['color_red', 'mat_wood', 'ink_charcoal', 'ench_echo'],
  },
  scrivener: {
    name: 'The Pale Scrivener', hp: 52, elite: true,
    desc: 'An Inkbinder who wrote one spell too many. The ink wrote back.',
    moves: [
      { actions: [{ type: 'attack', amount: 11 }] },
      { actions: [{ type: 'block', amount: 10 }, { type: 'debuff', status: 'weak', amount: 2 }] },
      { actions: [{ type: 'attack', amount: 5, times: 3 }] },
    ],
    drops: ['ink_gold', 'mat_silver', 'ink_blood', 'color_blue', 'ench_bound', 'ench_leech'],
  },
  grimoire: {
    name: 'The Unbound Grimoire', hp: 110, boss: true,
    desc: 'The first book. It has been waiting for a new hand to hold it.',
    moves: [
      { actions: [{ type: 'attack', amount: 12 }] },
      { actions: [{ type: 'attack', amount: 5 }, { type: 'debuff', status: 'poison', amount: 4 }] },
      { actions: [{ type: 'block', amount: 14 }, { type: 'buff', status: 'strength', amount: 3 }] },
      { actions: [{ type: 'attack', amount: 4, times: 4 }] },
    ],
    drops: [],
  },
};

// The prototype's run is a fixed path. A branching map comes later.
export const RUN_PATH = [
  { type: 'bench',  label: 'Crafting Bench' },
  { type: 'fight',  label: 'Chapel Ruins',    enemies: ['acolyte'] },
  { type: 'fight',  label: 'Moth Lanterns',   enemies: ['gravemoth', 'gravemoth'] },
  { type: 'bench',  label: 'Crafting Bench' },
  { type: 'fight',  label: 'The Burnt Kennel', enemies: ['hound', 'gravemoth'] },
  { type: 'shop',   label: 'The Rag Merchant' },
  { type: 'fight',  label: 'Scriptorium',     enemies: ['scrivener'], elite: true },
  { type: 'bench',  label: 'Crafting Bench' },
  { type: 'fight',  label: 'The Last Library', enemies: ['grimoire'], boss: true },
];
