// All tunable game data lives here. Numbers are first-pass and meant to be tweaked.

export const INK_COLORS = {
  red:   { name: 'Crimson Ink', short: 'Red',   noun: 'Flame',   effect: 'damage', base: 6, hue: '#c0392b', desc: 'Deals damage' },
  white: { name: 'Bone Ink',    short: 'White', noun: 'Ward',    effect: 'block',  base: 5, hue: '#e8e0cc', desc: 'Gains Block' },
  blue:  { name: 'Drowned Ink', short: 'Blue',  noun: 'Insight', effect: 'draw',   base: 2, hue: '#3a6ea5', desc: 'Draws cards' },
  green: { name: 'Moss Ink',    short: 'Green', noun: 'Mending', effect: 'heal',   base: 4, hue: '#4f8a4b', desc: 'Heals you' },
  black: { name: 'Grave Ink',   short: 'Black', noun: 'Blight',  effect: 'poison', base: 3, hue: '#6b4f7a', desc: 'Applies Poison' },
  // Pale ink only remembers: it repeats your last card at a percentage of its power.
  grey:  { name: 'Pale Ink',    short: 'Pale',  noun: 'Mimicry', effect: 'mimic',  base: 50, hue: '#b8b2c8', desc: 'Repeats your last card' },
};

// One rule for mixing: a card can carry a second ink for +1 mana. Both effects stay at
// full strength, and the card sets off that pair's reaction every time it is cast.
export const SECOND_INK_COST = 1;

// Ink reactions: casting a card right after one of a different color, or casting
// a two-ink card, sets off the reaction for that pair. Two-ink cards are named after it.
export const REACTIONS = {
  'blue+red':    { name: 'Storm',     desc: 'Draw 1 card.', effects: [{ type: 'draw', amount: 1 }] },
  'red+white':   { name: 'Brand',     desc: 'Deal damage equal to half your Block.', effects: [{ type: 'brand' }] },
  'green+red':   { name: 'Cautery',   desc: 'Heal 3 and cure your Poison.', effects: [{ type: 'heal', amount: 3 }, { type: 'cure' }] },
  'black+red':   { name: 'Hexfire',   desc: "The target's Poison burns all at once.", effects: [{ type: 'detonate' }] },
  'blue+white':  { name: 'Aegis',     desc: 'Gain 5 Block.', effects: [{ type: 'block', amount: 5 }] },
  'blue+green':  { name: 'Tide',      desc: 'Gain 1 mana.', effects: [{ type: 'mana', amount: 1 }] },
  'black+blue':  { name: 'Nightmare', desc: 'Apply 2 Weak to the target.', effects: [{ type: 'weaken', amount: 2 }] },
  'green+white': { name: 'Sanctuary', desc: 'Heal 4.', effects: [{ type: 'heal', amount: 4 }] },
  'black+white': { name: 'Shroud',    desc: "Strip the target's Block.", effects: [{ type: 'strip' }] },
  'black+green': { name: 'Rot',       desc: "Spread the target's Poison to every other enemy.", effects: [{ type: 'spread' }] },
  'grey+red':    { name: 'Bloodletting', desc: 'Apply 2 Bleed to the target.', effects: [{ type: 'bleed', amount: 2 }] },
  'grey+white':  { name: 'Mirror Ward',  desc: 'Gain 4 Block.', effects: [{ type: 'block', amount: 4 }] },
  'blue+grey':   { name: 'Recall',       desc: 'Draw 1 card.', effects: [{ type: 'draw', amount: 1 }] },
  'green+grey':  { name: 'Renewal',      desc: 'Heal 3.', effects: [{ type: 'heal', amount: 3 }] },
  'black+grey':  { name: 'Unravel',      desc: 'Apply 2 Frail to the target.', effects: [{ type: 'frail', amount: 2 }] },
};

// Relics: passive trinkets. Elites offer a choice of three; reliquaries and the
// merchant sometimes have one.
export const RELICS = {
  inkwell:     { name: 'Cracked Inkwell',     desc: 'Blood ink costs 1 less HP to cast.' },
  thimble:     { name: "Scrivener's Thimble", desc: 'Paper cards last 2 casts longer.' },
  mothlantern: { name: 'Moth Lantern',        desc: 'Your lantern burns oil half as fast, but Dread rises faster.' },
  bell:        { name: 'Tolling Bell',        desc: 'Enemies start every fight with 1 Weak.' },
  needle:      { name: 'Silver Needle',       desc: 'Your first attack each turn ignores Block.' },
  candle:      { name: 'Chapel Candle',       desc: 'Heal 4 HP after every fight.' },
  quill:       { name: 'Raven Quill',         desc: 'Draw 2 extra cards on the first turn of each fight.' },
  locket:      { name: 'Heart Locket',        desc: '+10 max HP.' },
  dice:        { name: 'Bone Dice',           desc: 'Monsters drop an extra item a third of the time.' },
  prism:       { name: 'Ink Prism',           desc: 'Ink reactions are twice as strong.' },
  // Unlocked by filling the Grimoire (see UNLOCKS).
  cartographer: { name: "Cartographer's Chalk", desc: 'You always see traps, and cracked walls glint.' },
  leechjar:    { name: 'Leech Jar',           desc: 'Bleed you apply is 1 higher.' },
  paleglass:   { name: 'Pale Glass',          desc: 'Pale ink repeats at 25% more power.' },
  oilskin:     { name: 'Oilskin Satchel',     desc: 'Flooded delves do not wear your paper faster.' },
  // The Rag Merchant's last favor.
  scale:       { name: "The Merchant's Scale", desc: 'Merchants charge you 25% less.' },
};
// Relics that never turn up at random.
export const SPECIAL_RELICS = new Set(['scale']);
export const RELIC_PRICE = 70;
export const CHEST_RELIC_CHANCE = 0.15;

export const INK_MATERIALS = {
  charcoal: { name: 'Charcoal', adj: 'Ashen',    mult: 0.75, extraCost: 0, hpCost: 0, desc: 'Weaker, but common.' },
  silver:   { name: 'Silver',   adj: 'Silvered', mult: 1.0,  extraCost: 0, hpCost: 0, purify: true, desc: 'Full strength. Cleanses a debuff from you.' },
  gold:     { name: 'Gold',     adj: 'Gilded',   mult: 1.5,  extraCost: 1, hpCost: 0, desc: 'Half again as strong. +1 mana.' },
  blood:    { name: 'Blood',    adj: 'Sanguine', mult: 2.0,  extraCost: 0, hpCost: 3, desc: 'Twice as strong. Costs 3 HP to cast.' },
  // Rare inks, from what elites and wraiths leave behind.
  ichor:      { name: 'Ichor',      adj: 'Ichorous', mult: 1.75, extraCost: 0,  hpCost: 0, corrupts: 1, desc: 'Nearly twice as strong. Corrupts you each cast.' },
  ghostlight: { name: 'Ghostlight', adj: 'Ghostlit', mult: 1.0,  extraCost: -1, hpCost: 0, desc: 'Full strength. Costs 1 less.' },
};

// durability: uses across the whole run (Infinity = permanent)
export const CARD_MATERIALS = {
  paper:  { name: 'Paper',  cost: 0, durability: 3,        slots: 0, desc: '0 cost. Burns after 3 casts.' },
  wood:   { name: 'Wood',   cost: 1, durability: 8,        slots: 1, desc: 'Lasts 8 casts. 1 enchantment.' },
  stone:  { name: 'Stone',  cost: 2, durability: Infinity, slots: 1, powerMult: 1.5, desc: 'Permanent. Half again as strong, but costs 2.' },
  silver: { name: 'Silver', cost: 1, durability: Infinity, slots: 2, desc: 'Permanent. 2 enchantments.' },
  gold:   { name: 'Gold',   cost: 1, durability: Infinity, slots: 3, goldOnCast: 2, desc: 'Permanent. 3 enchantments. +2 gold per cast.' },
};

export const ENCHANTMENTS = {
  echo:      { name: 'Echo',      part: "Acolyte's Bell",   desc: 'Casts again at half power.' },
  swift:     { name: 'Swift',     part: 'Moth Wing',        desc: 'Costs 0 the first time it is cast each fight.' },
  bound:     { name: 'Bound',     part: "Scrivener's Quill", desc: 'Stays in your hand at end of turn.' },
  volatile:  { name: 'Volatile',  part: 'Ember Heart',      desc: 'Double power. Exhausts for the rest of the fight.' },
  leech:     { name: 'Leech',     part: 'Hound Fang',       desc: 'Heal for a quarter of the damage dealt.' },
  siphon:    { name: 'Siphon',    part: 'Grave Candle',     desc: 'Gain 1 mana if this kills an enemy.' },
  hungering: { name: 'Hungering', part: 'Ghoul Tongue',     desc: 'Gets +2 stronger each time you cast it in a fight.' },
  piercing:  { name: 'Piercing',  part: "Weaver's Needle",  desc: 'Damage ignores Block.' },
  hallowed:  { name: 'Hallowed',  part: "Saint's Knucklebone", desc: 'Also gain 4 Block when cast.' },
  // Unlocked by filling the Grimoire (see UNLOCKS).
  serrated:  { name: 'Serrated',  part: 'Rusted Hook',      desc: 'Applies 2 Bleed when it deals damage.' },
  withering: { name: 'Withering', part: 'Withered Hand',    desc: 'Applies 2 Frail to the target.' },
};

// Statuses. Bleed: an enemy loses HP equal to its Bleed each time it attacks, then
// Bleed drops by 1 at the end of its turn. Frail: Block gained is cut by a quarter.
export const FRAIL_MULT = 0.75;

// Raw materials are what you scavenge in the world. Refine them at a writing desk.
export const RAW_MATERIALS = {
  ash:       { name: 'Ash',          node: 'Ash heap',          color: '#8a8580', rarity: 'common' },
  bone:      { name: 'Bone Shards',  node: 'Ossuary niche',     color: '#e8e0cc', rarity: 'common' },
  rags:      { name: 'Rotten Vestments', node: 'Vestry chest',  color: '#b9a57e', rarity: 'common' },
  timber:    { name: 'Old Timber',   node: 'Broken pews',       color: '#8a5a33', rarity: 'common' },
  gravesoil: { name: 'Grave Soil',   node: 'Fresh grave',       color: '#6b4f7a', rarity: 'common' },
  bloodroot: { name: 'Bloodroot',    node: 'Bloodroot patch',   color: '#c0392b', rarity: 'common' },
  kelp:      { name: 'Drowned Kelp', node: 'Flooded shelf',     color: '#3a6ea5', rarity: 'common' },
  moss:      { name: 'Grave Moss',   node: 'Mossy font',        color: '#4f8a4b', rarity: 'common' },
  slate:     { name: 'Slate',        node: 'Fallen slate',      color: '#77736f', rarity: 'uncommon' },
  silver:    { name: 'Silver Ore',   node: 'Silver vein',       color: '#c9ced6', rarity: 'uncommon' },
  gold:      { name: 'Gold Leaf',    node: 'Gilded tomes',      color: '#d7ad52', rarity: 'rare' },
  heart:     { name: 'Heartblood',   node: null,                color: '#8d1f1a', rarity: 'rare' },
  ichor:     { name: 'Ichor',        node: null,                color: '#7a8a2a', rarity: 'rare' },
  wisp:      { name: 'Ghostlight Wisp', node: null,             color: '#9fd8e0', rarity: 'uncommon' },
  mirror:    { name: 'Mirror Shard', node: 'Shattered mirror',  color: '#b8b2c8', rarity: 'uncommon' },
};

// What you pick up is ready to use. Most finds turn straight into ingredients.
// Slate, silver and gold stay as they are: you decide what they become when you inscribe.
export const PICKUP = {
  raw_ash: { ink_charcoal: 2 },
  raw_bone: { color_white: 1 },
  raw_rags: { mat_paper: 2 },
  raw_timber: { mat_wood: 1 },
  raw_gravesoil: { color_black: 1 },
  raw_bloodroot: { color_red: 1 },
  raw_kelp: { color_blue: 1 },
  raw_moss: { color_green: 1 },
  raw_heart: { ink_blood: 2 },
  raw_ichor: { ink_ichor: 1 },
  raw_wisp: { ink_ghostlight: 1 },
  raw_mirror: { color_grey: 1 },
};

// Other ways to pay for a blueprint slot, tried after the ready-made item.
// `hp` is paid in your own blood.
export const ALT_SOURCES = {
  cardMat: { stone: { raw_slate: 2 }, silver: { raw_silver: 2 }, gold: { raw_gold: 2 } },
  inkMat: { silver: { raw_silver: 1 }, gold: { raw_gold: 1 }, blood: { hp: 6 } },
};

// Every ingredient in the game, keyed by inventory id.
export const INGREDIENTS = {};
for (const [k, v] of Object.entries(INK_COLORS))     INGREDIENTS[`color_${k}`] = { kind: 'color',   key: k, name: v.name, rarity: 'common' };
for (const [k, v] of Object.entries(INK_MATERIALS))  INGREDIENTS[`ink_${k}`]   = { kind: 'inkMat',  key: k, name: `${v.name} Ink`, rarity: { charcoal: 'common', silver: 'uncommon', gold: 'rare', blood: 'rare', ichor: 'rare', ghostlight: 'uncommon' }[k] };
for (const [k, v] of Object.entries(CARD_MATERIALS)) INGREDIENTS[`mat_${k}`]   = { kind: 'cardMat', key: k, name: `${v.name} Card`, rarity: { paper: 'common', wood: 'common', stone: 'uncommon', silver: 'uncommon', gold: 'rare' }[k] };
for (const [k, v] of Object.entries(ENCHANTMENTS))   INGREDIENTS[`ench_${k}`]  = { kind: 'enchant', key: k, name: v.part, rarity: 'uncommon' };
for (const [k, v] of Object.entries(RAW_MATERIALS))  INGREDIENTS[`raw_${k}`]   = { kind: 'raw',     key: k, name: v.name, rarity: v.rarity };

INGREDIENTS.raw_slate.hint = 'Two make a Stone Card.';
INGREDIENTS.raw_silver.hint = 'One makes Silver Ink, two make a Silver Card.';
INGREDIENTS.raw_gold.hint = 'One makes Gold Ink, two make a Gold Card.';
INGREDIENTS.ess_pristine = { kind: 'essence', key: 'pristine', name: 'Pristine Essence', rarity: 'rare' };

// Glinting scavenge spots give double materials and a Pristine Essence.
// Add the essence when inscribing for a stronger, Pristine card.
export const PRISTINE = { chance: 0.12, mult: 1.3 };

// Cards grow as you use them. Bonuses stack and apply to damage, Block, healing and Poison.
export const WEAR = [
  { casts: 8,  bonus: 1, name: 'Well-Worn' },
  { casts: 20, bonus: 2, name: 'Heirloom' },
];

// When a card becomes an Heirloom, you choose its signature at a desk.
// Well-Worn and Heirloom cards can also be renamed.
export const SIGNATURES = {
  weightless: { name: 'Weightless', desc: 'Costs 1 less (never below 0).' },
  unfading:   { name: 'Unfading',   desc: 'Never wears out.' },
  resonant:   { name: 'Resonant',   desc: '+3 to its damage, Block, healing and Poison.' },
};
export const NAME_MAX = 24;

// Corruption builds from blood and ichor. Tainted: Black and Blood cards hit harder,
// but you start fights Weak. Forsaken: forbidden recipes open, but enemies grow stronger.
export const CORRUPTION = {
  tainted: 5, forsaken: 10, taintBonus: 2,
  craftBlood: 2, bleed: 1, restCleanse: 2, prayCleanse: 3,
};

export const PRICES = { common: 12, uncommon: 25, rare: 45 };
export const REPAIR_PRICE = 20;
export const BENCH_REST_HEAL = 0.3; // fraction of max HP, once per desk

// Named spells. Matching colors + ink material + card material (and any listed
// enchantments) replaces the formula with a fixed, stronger effect. No recipe
// needs more than four parts, and the desk hints when you are one part away.
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
  {
    id: 'bellstrike', name: 'Bellstrike',
    match: { colors: ['red'], inkMat: 'silver', cardMat: 'stone', enchants: ['echo'] },
    effects: [{ type: 'damage', amount: 10 }, { type: 'block', amount: 10 }],
    hint: 'Crimson on stone, silvered, that rings twice.',
    flavor: 'The chapel bell still tolls for someone.',
  },
  {
    id: 'mindleech', name: 'Mind Leech',
    match: { colors: ['black', 'blue'], inkMat: 'blood', cardMat: 'silver' },
    effects: [{ type: 'poison', amount: 9 }, { type: 'draw', amount: 2 }],
    hint: 'A nightmare written in blood on silver.',
    flavor: 'It learns what they fear, then feeds.',
  },
  {
    id: 'gravebloom', name: 'Gravebloom',
    match: { colors: ['black', 'green'], inkMat: 'charcoal', cardMat: 'wood' },
    effects: [{ type: 'poison', amount: 5 }, { type: 'heal', amount: 4 }],
    hint: 'Rot and moss in ash, on a humble plank.',
    flavor: 'What dies here feeds what grows here.',
  },
  {
    id: 'litany', name: "Saint's Litany",
    match: { colors: ['white'], inkMat: 'silver', cardMat: 'silver', enchants: ['hallowed'] },
    effects: [{ type: 'block', amount: 12 }, { type: 'heal', amount: 5 }],
    hint: 'Bone ink, silvered twice, blessed by a saint.',
    flavor: 'Said over every body in the catacombs. None of them stayed down.',
  },
  {
    id: 'needlestorm', name: 'Needlestorm',
    match: { colors: ['black'], inkMat: 'blood', cardMat: 'wood', enchants: ['piercing'] },
    effects: [{ type: 'damage', amount: 6 }, { type: 'damage', amount: 6 }, { type: 'poison', amount: 3 }],
    hint: 'Grave ink in blood, stitched through wood with a needle.',
    flavor: 'The weaver never misses the same place twice.',
  },
  {
    id: 'hymn', name: 'Drowned Hymn',
    match: { colors: ['blue', 'white'], inkMat: 'charcoal', cardMat: 'paper' },
    effects: [{ type: 'draw', amount: 2 }, { type: 'block', amount: 5 }],
    hint: 'An aegis in ash on a single sheet.',
    flavor: 'Sung underwater, it sounds like breathing.',
  },
  {
    id: 'unwriting', name: 'The Unwriting', forbidden: true,
    match: { colors: ['black'], inkMat: 'blood', cardMat: 'stone' },
    effects: [{ type: 'damage', amount: 30 }, { type: 'loseMaxHp', amount: 3 }],
    hint: 'Forbidden. Grave ink and blood, carved in stone.',
    flavor: 'It does not kill. It removes the word for them.',
  },
  {
    id: 'hollowcrown', name: 'The Hollow Crown', forbidden: true,
    match: { colors: ['black', 'white'], inkMat: 'ichor', cardMat: 'gold' },
    effects: [{ type: 'damageAll', amount: 12 }, { type: 'block', amount: 8 }],
    hint: 'Forbidden. A shroud in ichor on a golden page.',
    flavor: 'Every Inkbinder who wore it heard the same voice.',
  },
  {
    id: 'secondhand', name: 'The Second Hand',
    match: { colors: ['grey'], inkMat: 'silver', cardMat: 'silver' },
    effects: [{ type: 'mimic', amount: 100 }, { type: 'draw', amount: 1 }],
    hint: 'Pale ink, silver on silver, that remembers everything.',
    flavor: 'Whatever you just said, it says again.',
  },
  {
    id: 'emberrite', name: 'Ember Rite',
    match: { colors: ['red'], inkMat: 'gold', cardMat: 'gold' },
    effects: [{ type: 'damageAll', amount: 9 }],
    hint: 'Crimson and gold, on gold.',
    flavor: 'The chapel burned brightest the night they gilded the altar.',
  },
];

// Uncraftable starting cards. Permanent.
export const STARTER_CARDS = {
  strike:   { name: 'Strike',   cost: 1, effects: [{ type: 'damage', amount: 5 }], colors: ['red'] },
  guard:    { name: 'Guard',    cost: 1, effects: [{ type: 'block', amount: 5 }],  colors: ['white'] },
  scribble: { name: 'Scribble', cost: 0, effects: [{ type: 'draw', amount: 1 }],   colors: ['blue'] },
  // Depth 5 starts you with one. It clogs your hand until you burn or salvage it.
  blot:     { name: 'Blot',     cost: 0, effects: [], colors: ['black'], unplayable: true },
};
export const STARTER_DECK = ['strike', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'scribble'];

export const STARTING_INVENTORY = {
  color_red: 1, color_white: 2,
  ink_charcoal: 4, ink_silver: 1,
  mat_paper: 2, mat_wood: 1,
  ench_volatile: 1,
  color_black: 1,
};

export const PLAYER_START = { hp: 60, maxHp: 60, gold: 30, energy: 3, handSize: 5 };

// Enemy moves cycle in order. Each move is a list of actions.
// Drop tables repeat entries to weight them.
export const ENEMIES = {
  acolyte: {
    name: 'Hollow Acolyte', hp: 24,
    desc: 'A monk who wrote his own name out of the world.',
    moves: [
      { actions: [{ type: 'attack', amount: 6 }] },
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'block', amount: 5 }] },
      { actions: [{ type: 'attack', amount: 8 }] },
    ],
    drops: ['ench_echo', 'raw_ash', 'raw_ash', 'raw_bone', 'raw_gravesoil'],
  },
  gravemoth: {
    name: 'Gravemoth', hp: 13,
    desc: 'Drawn to candlelight and open wounds.',
    moves: [
      { actions: [{ type: 'attack', amount: 3 }, { type: 'debuff', status: 'poison', amount: 2 }] },
      { actions: [{ type: 'attack', amount: 5 }] },
    ],
    drops: ['ench_swift', 'raw_moss', 'raw_rags', 'raw_rags'],
  },
  hound: {
    name: 'Ashen Hound', hp: 20,
    desc: 'It still hunts for the master it burned.',
    moves: [
      { actions: [{ type: 'attack', amount: 4, times: 2 }] },
      { actions: [{ type: 'buff', status: 'strength', amount: 2 }, { type: 'block', amount: 4 }] },
      { actions: [{ type: 'attack', amount: 9 }] },
    ],
    drops: ['ench_leech', 'raw_ash', 'raw_bloodroot', 'raw_timber', 'ench_volatile', 'ench_serrated'],
  },
  ghoul: {
    name: 'Candle Ghoul', hp: 22,
    desc: 'It eats the wax, then the wick, then the one holding it.',
    moves: [
      { actions: [{ type: 'attack', amount: 6 }] },
      { actions: [{ type: 'buff', status: 'strength', amount: 1 }, { type: 'attack', amount: 4 }] },
    ],
    drops: ['ench_hungering', 'raw_gravesoil', 'raw_bone', 'ench_siphon'],
  },
  drowned: {
    name: 'Drowned Scribe', hp: 18,
    desc: 'Still copying the same page, underwater, forever.',
    moves: [
      { actions: [{ type: 'attack', amount: 5 }, { type: 'debuff', status: 'weak', amount: 1 }] },
      { actions: [{ type: 'attack', amount: 7 }] },
    ],
    drops: ['raw_kelp', 'raw_kelp', 'raw_silver', 'ench_bound', 'raw_rags', 'raw_wisp'],
  },
  warden: {
    name: 'The Bell Warden', hp: 54, elite: true, guardian: true,
    desc: 'It rang the bell for every funeral. Now it rings for yours.',
    phase2: {
      at: 0.5, name: 'The bell cracks',
      text: 'The great bell splits down the middle. The sound does not stop.',
      strength: 1, block: 8,
      moves: [
        { actions: [{ type: 'attack', amount: 6 }, { type: 'debuff', status: 'weak', amount: 1 }] },
        { actions: [{ type: 'attack', amount: 4, times: 3 }] },
        { actions: [{ type: 'block', amount: 8 }, { type: 'buff', status: 'strength', amount: 1 }] },
      ],
    },
    moves: [
      { actions: [{ type: 'attack', amount: 9 }] },
      { actions: [{ type: 'block', amount: 8 }, { type: 'debuff', status: 'weak', amount: 1 }] },
      { actions: [{ type: 'attack', amount: 3, times: 3 }] },
    ],
    drops: ['ench_echo', 'raw_silver', 'raw_silver', 'raw_heart', 'raw_slate', 'raw_gold', 'raw_ichor'],
  },
  bishop: {
    name: 'The Hollow Bishop', hp: 56, elite: true, guardian: true,
    desc: 'He blesses everyone who comes down the stair. The blessing is a kind of drowning.',
    phase2: {
      at: 0.5, name: 'The mitre falls',
      text: 'His mitre rolls away. There is nothing under it but a mouth.',
      strength: 1, block: 6,
      moves: [
        { actions: [{ type: 'attack', amount: 11 }] },
        { actions: [{ type: 'attack', amount: 3, times: 3 }] },
        { actions: [{ type: 'block', amount: 8 }, { type: 'buff', status: 'strength', amount: 1 }] },
      ],
    },
    moves: [
      { actions: [{ type: 'attack', amount: 8 }] },
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'block', amount: 6 }] },
      { actions: [{ type: 'attack', amount: 5 }, { type: 'debuff', status: 'poison', amount: 2 }] },
    ],
    drops: ['ench_hallowed', 'raw_silver', 'raw_gold', 'raw_heart', 'raw_slate', 'raw_ichor'],
  },
  scrivener: {
    name: 'The Pale Scrivener', hp: 62, elite: true, guardian: true,
    desc: 'An Inkbinder who wrote one spell too many. The ink wrote back.',
    phase2: {
      at: 0.5, name: 'The Scrivener writes back',
      text: 'Ink pours from its sleeves and starts writing on the walls. Your name is in every line.',
      strength: 1, block: 10,
      moves: [
        { actions: [{ type: 'attack', amount: 7 }, { type: 'debuff', status: 'poison', amount: 3 }] },
        { actions: [{ type: 'attack', amount: 14 }] },
        { actions: [{ type: 'block', amount: 12 }, { type: 'debuff', status: 'weak', amount: 2 }] },
      ],
    },
    moves: [
      { actions: [{ type: 'attack', amount: 11 }] },
      { actions: [{ type: 'block', amount: 10 }, { type: 'debuff', status: 'weak', amount: 2 }] },
      { actions: [{ type: 'attack', amount: 5, times: 3 }] },
    ],
    drops: ['ench_bound', 'raw_gold', 'raw_gold', 'raw_heart', 'raw_silver', 'raw_ichor'],
  },
  wraith: {
    name: 'Choir Wraith', hp: 20,
    desc: 'It still sings the funeral hymn. The notes cut.',
    moves: [
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'attack', amount: 3 }] },
      { actions: [{ type: 'attack', amount: 7 }] },
      { actions: [{ type: 'debuff', status: 'frail', amount: 2 }, { type: 'attack', amount: 4 }] },
    ],
    drops: ['raw_bone', 'raw_ash', 'ench_echo', 'raw_silver', 'raw_wisp', 'raw_wisp', 'ench_withering', 'raw_mirror'],
  },
  boneweaver: {
    name: 'Bone Weaver', hp: 26,
    desc: 'It builds its webs from finger bones and threads them with sinew.',
    moves: [
      { actions: [{ type: 'block', amount: 6 }, { type: 'attack', amount: 5 }] },
      { actions: [{ type: 'attack', amount: 3, times: 3 }] },
    ],
    drops: ['ench_piercing', 'raw_bone', 'raw_bone', 'raw_slate'],
  },
  inkling: {
    name: 'Ink Wraith', hp: 16,
    desc: 'A spell that escaped its page. It wants a new one.',
    moves: [
      { actions: [{ type: 'attack', amount: 4 }, { type: 'debuff', status: 'poison', amount: 3 }] },
      { actions: [{ type: 'attack', amount: 6 }] },
    ],
    drops: ['raw_kelp', 'raw_gravesoil', 'ench_bound', 'raw_gold'],
  },
  index: {
    name: 'The Leviathan Index', hp: 60, elite: true, guardian: true,
    desc: 'A great eel stitched together from catalogue cards. It knows where every book is, and where you are.',
    phase2: {
      at: 0.5, name: 'The Index turns',
      text: 'Ten thousand cards flip at once. It has found your entry.',
      strength: 1, block: 8,
      moves: [
        { actions: [{ type: 'attack', amount: 5, times: 3 }] },
        { actions: [{ type: 'smudge' }, { type: 'attack', amount: 8 }] },
        { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'attack', amount: 6 }] },
      ],
    },
    moves: [
      { actions: [{ type: 'attack', amount: 4, times: 2 }] },
      { actions: [{ type: 'smudge' }, { type: 'attack', amount: 6 }] },
      { actions: [{ type: 'block', amount: 10 }, { type: 'debuff', status: 'poison', amount: 3 }] },
    ],
    drops: ['ench_bound', 'raw_silver', 'raw_wisp', 'raw_wisp', 'raw_kelp', 'raw_ichor'],
  },
  cantor: {
    name: 'The Bone Cantor', hp: 66, elite: true, guardian: true,
    desc: 'The last voice in the catacombs. Every note costs it a bone. It has plenty.',
    phase2: {
      at: 0.5, name: 'The last verse',
      text: 'It sings with no breath left. The dead join in.',
      strength: 2, block: 10,
      moves: [
        { actions: [{ type: 'attack', amount: 14 }] },
        { actions: [{ type: 'attack', amount: 4, times: 4 }] },
        { actions: [{ type: 'block', amount: 12 }, { type: 'debuff', status: 'weak', amount: 2 }] },
      ],
    },
    moves: [
      { actions: [{ type: 'buff', status: 'strength', amount: 2 }, { type: 'block', amount: 8 }] },
      { actions: [{ type: 'attack', amount: 12 }] },
      { actions: [{ type: 'tarnish' }, { type: 'attack', amount: 5, times: 2 }] },
    ],
    drops: ['ench_echo', 'ench_hallowed', 'raw_gold', 'raw_slate', 'raw_heart', 'raw_ichor'],
  },
  saint: {
    name: 'The Ossuary Saint', hp: 68, elite: true, guardian: true,
    desc: 'Canonised for building the catacombs. He is still adding to them.',
    phase2: {
      at: 0.5, name: 'The Saint rises',
      text: 'The bones of the walls answer him. He stands taller than he should.',
      strength: 2, block: 12,
      moves: [
        { actions: [{ type: 'attack', amount: 8, times: 2 }] },
        { actions: [{ type: 'block', amount: 14 }, { type: 'buff', status: 'strength', amount: 2 }] },
        { actions: [{ type: 'attack', amount: 6 }, { type: 'debuff', status: 'poison', amount: 4 }, { type: 'debuff', status: 'weak', amount: 1 }] },
      ],
    },
    moves: [
      { actions: [{ type: 'attack', amount: 12 }] },
      { actions: [{ type: 'block', amount: 12 }, { type: 'buff', status: 'strength', amount: 2 }] },
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'debuff', status: 'poison', amount: 3 }] },
    ],
    drops: ['ench_hallowed', 'ench_hallowed', 'raw_silver', 'raw_gold', 'raw_heart', 'raw_ichor', 'raw_ichor'],
  },
  gravedigger: {
    name: 'The Gravedigger', hp: 40, elite: true,
    desc: 'He has been digging the same grave for forty years. It is nearly your size.',
    moves: [
      { actions: [{ type: 'attack', amount: 10 }] },
      { actions: [{ type: 'block', amount: 8 }, { type: 'attack', amount: 4 }] },
      { actions: [{ type: 'attack', amount: 3, times: 3 }] },
    ],
    drops: ['raw_timber', 'raw_gravesoil', 'raw_heart', 'raw_ichor', 'raw_silver', 'ench_echo'],
  },
  abbot: {
    name: 'The Drowned Abbot', hp: 48, elite: true,
    desc: 'He still leads the vespers. The congregation is underwater too.',
    moves: [
      { actions: [{ type: 'attack', amount: 6 }, { type: 'debuff', status: 'weak', amount: 2 }] },
      { actions: [{ type: 'attack', amount: 12 }] },
      { actions: [{ type: 'block', amount: 10 }, { type: 'debuff', status: 'poison', amount: 3 }] },
    ],
    drops: ['raw_kelp', 'raw_silver', 'raw_silver', 'raw_ichor', 'ench_bound', 'raw_heart', 'raw_wisp'],
  },
  choirmaster: {
    name: 'The Choirmaster', hp: 54, elite: true,
    desc: 'He conducts a choir of the dead. Every note is a little louder than the last.',
    moves: [
      { actions: [{ type: 'buff', status: 'strength', amount: 2 }, { type: 'attack', amount: 5 }] },
      { actions: [{ type: 'attack', amount: 4, times: 3 }] },
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'block', amount: 12 }] },
    ],
    drops: ['ench_echo', 'ench_hallowed', 'raw_ichor', 'raw_gold', 'raw_wisp', 'raw_wisp'],
  },
  // Pests: monsters that go after your cards. Stone fears none of them.
  papermoth: {
    name: 'Paper Moth', hp: 18,
    desc: 'It has eaten every hymnal in the chapel. It is still hungry.',
    moves: [
      { actions: [{ type: 'devour' }, { type: 'attack', amount: 4 }] },
      { actions: [{ type: 'attack', amount: 7 }] },
    ],
    drops: ['ench_swift', 'raw_rags', 'raw_rags'],
  },
  inkleech: {
    name: 'Ink Leech', hp: 28,
    desc: 'It drinks the ink off cheap pages and leaves them grey.',
    moves: [
      { actions: [{ type: 'smudge' }, { type: 'attack', amount: 5 }] },
      { actions: [{ type: 'attack', amount: 9 }] },
      { actions: [{ type: 'block', amount: 6 }, { type: 'smudge' }] },
    ],
    drops: ['raw_wisp', 'raw_kelp', 'ench_leech'],
  },
  rustwraith: {
    name: 'Rust Wraith', hp: 34,
    desc: 'Where it passes, silver blackens and gold goes dull.',
    moves: [
      { actions: [{ type: 'tarnish' }, { type: 'attack', amount: 6 }] },
      { actions: [{ type: 'attack', amount: 4, times: 2 }] },
      { actions: [{ type: 'block', amount: 8 }, { type: 'tarnish' }] },
    ],
    drops: ['raw_silver', 'raw_gold', 'raw_slate'],
  },
  vellHollow: {
    name: 'Vell, Hollowed', hp: 58, elite: true,
    desc: 'Sister Vell, or the ink that wears her. It writes with her hands now.',
    moves: [
      { actions: [{ type: 'attack', amount: 7 }, { type: 'debuff', status: 'poison', amount: 3 }] },
      { actions: [{ type: 'block', amount: 10 }, { type: 'buff', status: 'strength', amount: 2 }] },
      { actions: [{ type: 'attack', amount: 4, times: 3 }] },
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'attack', amount: 8 }] },
    ],
    drops: ['raw_ichor', 'raw_ichor', 'raw_wisp', 'ess_pristine', 'ench_bound'],
  },
  grimoire: {
    name: 'The Unbound Grimoire', hp: 110, boss: true,
    desc: 'The first book. It has been waiting for a new hand to hold it.',
    phase2: {
      at: 0.5, name: 'The final page',
      text: 'The Grimoire tears open to its last page. It is blank, and it is hungry.',
      strength: 2, block: 15,
      moves: [
        { actions: [{ type: 'attack', amount: 18 }] },
        { actions: [{ type: 'attack', amount: 6 }, { type: 'debuff', status: 'poison', amount: 5 }] },
        { actions: [{ type: 'attack', amount: 5, times: 4 }] },
        { actions: [{ type: 'block', amount: 16 }, { type: 'buff', status: 'strength', amount: 3 }] },
      ],
    },
    moves: [
      { actions: [{ type: 'attack', amount: 12 }] },
      { actions: [{ type: 'attack', amount: 5 }, { type: 'debuff', status: 'poison', amount: 4 }] },
      { actions: [{ type: 'block', amount: 14 }, { type: 'buff', status: 'strength', amount: 3 }] },
      { actions: [{ type: 'attack', amount: 4, times: 4 }] },
    ],
    drops: [],
  },
};

// Each region is one act: a branching map of delves, events, shops and camps,
// with its guardian at the top. `raws` weights what the scavenge spots hold.
export const REGIONS = [
  {
    name: 'The Chapel Ruins',
    intro: 'Pews split for firewood. Bones in every niche. Somewhere below, a bell.',
    raws: { ash: 3, bone: 3, rags: 2, timber: 2, gravesoil: 2, bloodroot: 2, moss: 1, mirror: 1 },
    encounters: [['acolyte'], ['gravemoth', 'gravemoth'], ['gravemoth'], ['acolyte', 'gravemoth'], ['papermoth'], ['papermoth', 'gravemoth']],
    elites: ['gravedigger'], guardians: ['warden', 'bishop'], hpMult: 1,
    tiles: { 1: '#2b2430', 2: '#352c3c', 3: '#1d1822', 4: '#4f7a45', 5: '#4a3f50', 6: '#6b5a74', 7: '#2a2230', 8: '#1f1a24', 9: '#231c28' },
  },
  {
    name: 'The Drowned Archive',
    intro: 'The river took the library a century ago. The scribes never stopped working.',
    raws: { kelp: 3, moss: 2, slate: 2, silver: 2, rags: 2, bloodroot: 1, bone: 1, mirror: 1 },
    encounters: [['drowned'], ['drowned', 'gravemoth'], ['hound'], ['ghoul'], ['inkleech'], ['inkleech', 'papermoth']],
    elites: ['abbot'], guardians: ['scrivener', 'index'], hpMult: 1.1,
    tiles: { 1: '#1f2a30', 2: '#27363d', 3: '#141c21', 4: '#3f7a6f', 5: '#3a4d56', 6: '#557582', 7: '#1f2c33', 8: '#162027', 9: '#18242a' },
  },
  {
    name: 'The Catacombs',
    intro: 'The dead here were buried standing up, facing the stair. They are still waiting for someone to come down it.',
    raws: { bone: 3, gravesoil: 3, ash: 2, slate: 2, silver: 1, moss: 1, timber: 1, mirror: 2 },
    encounters: [['wraith'], ['boneweaver'], ['wraith', 'acolyte'], ['boneweaver', 'gravemoth'], ['rustwraith'], ['rustwraith', 'inkleech']],
    elites: ['choirmaster'], guardians: ['saint', 'cantor'], hpMult: 1.2,
    tiles: { 1: '#2a2826', 2: '#34312d', 3: '#1a1816', 4: '#6b6a4a', 5: '#4d4944', 6: '#79736a', 7: '#2a2724', 8: '#1e1c1a', 9: '#22201e' },
  },
  {
    name: 'The Last Library',
    intro: 'Every book here was written by an Inkbinder. Most of them are still screaming.',
    raws: { gold: 2, silver: 2, bloodroot: 2, gravesoil: 2, bone: 1, slate: 1, kelp: 1, mirror: 2 },
    encounters: [['hound', 'ghoul'], ['inkling', 'inkling'], ['ghoul', 'gravemoth', 'gravemoth'], ['inkling', 'wraith'], ['boneweaver', 'inkling'], ['rustwraith', 'papermoth'], ['inkleech', 'inkling']],
    elites: ['gravedigger', 'abbot', 'choirmaster'], guardians: null, boss: 'grimoire', hpMult: 1.3,
    tiles: { 1: '#2e2320', 2: '#392b26', 3: '#1e1614', 4: '#8a6a2a', 5: '#523a2e', 6: '#7a5840', 7: '#2e201a', 8: '#221814', 9: '#241915' },
  },
];

// Size of one delve. A haunted delve has an elite on the way out, and more to find.
export const DELVE = {
  plain: { rooms: 7, nodes: 8, chests: 1 },
  haunted: { rooms: 8, nodes: 11, chests: 2 },
  eventChance: 0.35,
  secretChance: 0.4,  // a cracked wall hiding a small room
  traps: [1, 3],      // traps per delve
  lowerChance: 0.15,  // a trapdoor to a lower level
  lower: { rooms: 6, nodes: 9, chests: 2, raws: { silver: 4, gold: 3, slate: 3, mirror: 2 }, encounterMult: 1.5 },
  leaveDread: 0.5, // Dread is multiplied by this when you climb out
};

// Delve conditions, shown on the map before you choose. Most delves have one.
//   raws: extra scavenge weights; rooms/nodes/chests: size changes; encounterMult and
//   oilMult scale encounter chance and oil use; paperWear: extra use lost by paper cards
//   cast in fights here; chestBonus: extra items per reliquary; leaveDread: Dread kept on leaving.
export const DELVE_CONDITIONS = {
  flooded:    { name: 'Flooded',         glyph: '≈', desc: 'Paper cards lose an extra use in fights here. Drowned Kelp everywhere.', raws: { kelp: 8 }, paperWear: 1 },
  lightless:  { name: 'Lightless',       glyph: '◐', desc: 'Your lantern burns twice as fast. Reliquaries hold more.', oilMult: 2, chests: 1, chestBonus: 1 },
  ossuary:    { name: 'Ossuary',         glyph: '✝', desc: 'Bone everywhere, and the dead are restless: things find you half again as often.', raws: { bone: 8, gravesoil: 3 }, nodes: 3, encounterMult: 1.5 },
  collapsing: { name: 'Collapsing',      glyph: '▼', desc: 'Small and quick, with little to find. Climbing out clears all your Dread.', rooms: -3, nodes: -3, chests: -1, leaveDread: 0 },
  hallowed:   { name: 'Hallowed ground', glyph: '✧', desc: 'Nothing wanders here, but there is no desk to write at.', encounterMult: 0, noDesk: true },
};

// The overworld map for each act.
export const MAP = {
  rows: 8,          // 6 rows of choices, a camp row, then the guardian
  cols: 5,
  paths: 4,
  // weights for the choice rows; row 0 is always a delve
  weights: { delve: 40, unknown: 30, haunted: 12, shop: 10, camp: 8 },
  // what an unknown node turns out to be
  unknown: { ambush: 0.15, cache: 0.12 },
  conditionChance: 0.65, // chance a delve has a condition

};

export const NODE_TYPES = {
  delve: { name: 'Delve', sprite: 'stairsDown', desc: 'A dungeon. Scavenge, craft at its desk, and find the way out. Things wander in the dark.' },
  haunted: { name: 'Haunted delve', sprite: 'skull', desc: 'A deeper dungeon with more to find. An elite guards the way out and keeps a relic.' },
  unknown: { name: 'Unknown', sprite: 'unknown', desc: 'Usually an event. Sometimes a cache. Sometimes something waiting.' },
  shop: { name: 'Merchant', sprite: 'merchant', desc: 'Ingredients, lantern oil, repairs and the odd relic.' },
  camp: { name: 'Scriptorium', sprite: 'desk', desc: 'Craft, then either rest or refill your lantern.' },
  story: { name: 'Sister Vell', sprite: 'vell', desc: 'The Inkbinder who went down before you.' },
  guardian: { name: 'Guardian', sprite: null, desc: 'The guardian of this act. Beat it to go deeper.' },
};

export const CAMP = { heal: 0.3, dread: 30, corruption: 2 };
export const OIL_WARE = { oil: 40, price: 15 };

// Random encounters: chance per step on open floor.
export const ENCOUNTER = { graceSteps: 12, base: 0.02, perDread: 0.0003, max: 0.09, dreadPerStep: 1 };
export const DESCEND_HEAL = 0.2; // fraction of max HP restored between acts

// Lantern oil drains slowly as you walk. Less oil, less light.
export const LANTERN = {
  max: 100,
  stepsPerOil: 5,
  // [minimum oil, light radius in tiles], checked in order
  radii: [[60, 5], [30, 4], [12, 3], [1, 2], [0, 1]],
  darkEncounterMult: 2,  // encounter chance when the lantern is out
  burn: { starter: 8, paper: 15, wood: 30 }, // oil gained by burning a card
  resurfaceDread: 30,    // the climb back down frays your nerves
  minDeck: 5,
};

// Random events found on the map. Outcomes are resolved in events.js.
export const EVENTS = {
  shrine: {
    name: 'Candle Shrine',
    text: 'A shrine to a saint nobody remembers. Someone keeps the candles lit.',
    options: [
      { id: 'pray', label: 'Pray', desc: 'Heal 12 HP. Dread +10.' },
      { id: 'take', label: 'Take the candles', desc: '+30 lantern oil. Lose 4 max HP.' },
      { id: 'leave', label: 'Leave it be', desc: '' },
    ],
  },
  scribe: {
    name: 'The Trapped Scribe',
    text: 'A scribe lies pinned under a fallen shelf, a page clutched to his chest. "Help me and I will teach you what is written here."',
    options: [
      { id: 'free', label: 'Lift the shelf', desc: 'Lose 8 HP. Learn a spell for your Grimoire.' },
      { id: 'rob', label: 'Take his purse', desc: '+35 gold. Dread +25.' },
      { id: 'leave', label: 'Walk on', desc: 'Dread +5.' },
    ],
  },
  well: {
    name: 'The Ink Well',
    text: 'A stone well filled to the brim with black ink. Something turns over beneath the surface.',
    options: [
      { id: 'drink', label: 'Drink', desc: 'Either gain 2 monster parts or lose 10 HP.' },
      { id: 'bottle', label: 'Fill your bottles', desc: 'Gain 2 random ink colors. Dread +10.' },
      { id: 'leave', label: 'Leave it', desc: '' },
    ],
  },
  book: {
    name: 'The Chained Book',
    text: 'A book chained to a lectern, its pages turning by themselves. It already knows your name.',
    options: [
      { id: 'read', label: 'Read it', desc: 'Gain a rare ink (Ichor or Ghostlight). Corruption +2.' },
      { id: 'burn', label: 'Burn it for light', desc: '+35 lantern oil.' },
      { id: 'leave', label: 'Leave it chained', desc: '' },
    ],
  },
  corpse: {
    name: 'The Dead Peddler',
    text: 'A peddler slumped against the wall, his pack still full. Whatever killed him did not want his wares.',
    options: [
      { id: 'search', label: 'Search his pack', desc: 'Probably three raw materials and some gold. Probably.' },
      { id: 'bury', label: 'Bury him', desc: 'Dread -20.' },
      { id: 'leave', label: 'Leave him', desc: '' },
    ],
  },
  mirror: {
    name: 'The Mirror Pool',
    text: 'Still black water. It shows a version of you who never came down here.',
    options: [
      { id: 'gaze', label: 'Gaze into it', desc: 'A copy of one of your crafted cards. Dread +15.' },
      { id: 'drink', label: 'Drink', desc: 'Heal 15 HP. Corruption +2.' },
      { id: 'leave', label: 'Look away', desc: '' },
    ],
  },
  altar: {
    name: 'The Ink-Stained Altar',
    text: 'An altar black with old ink. A bowl in the middle waits for an offering.',
    options: [
      { id: 'card', label: 'Offer a starter card', desc: 'Lose a random starter card. Gain a relic.' },
      { id: 'blood', label: 'Offer blood', desc: 'Lose 10 HP. Gain Ichor and a Pristine Essence.' },
      { id: 'leave', label: 'Offer nothing', desc: '' },
    ],
  },
  lanterns: {
    name: 'Hanged Lanterns',
    text: 'Lanterns hang from the vault on long chains, still burning. The chains are rusted through.',
    options: [
      { id: 'cut', label: 'Cut one down', desc: '+40 lantern oil. The crash will draw something.' },
      { id: 'climb', label: 'Climb for the oil', desc: '+25 lantern oil. Lose 6 HP.' },
      { id: 'leave', label: 'Leave them', desc: '' },
    ],
  },
};

// The storyline: Sister Vell, the Inkbinder who went down before you. One beat per act.
// Your choices move her trust. In the last act it decides who she is when you find her.
export const STORY = {
  vell1: {
    name: 'The Woman at the Font', art: 'vell',
    text: 'A woman in a scorched habit kneels at a dry font, writing a ward onto the stone with one finger. Her hands are black to the wrist. "Sister Vell," she says, without looking up. "I came down a year ago. I am nearly out of ink."',
    options: [
      { id: 'give', label: 'Give her your ink', desc: 'Lose up to 2 ink colors. She will remember.' },
      { id: 'ask', label: 'Ask what waits below', desc: 'Heal 10 HP. Dread -10.' },
      { id: 'take', label: 'Take her quill', desc: 'Gain a relic. She will remember that too.' },
    ],
  },
  vell2: {
    name: 'The Drowned Scriptorium', art: 'vell',
    text: 'Vell sits at a desk under a foot of black water, copying a page that rewrites itself as she works. "It keeps changing the ending," she says. Her eyes are ink to the rims.',
    options: [
      { id: 'help', label: 'Hold the page still', desc: 'Lose 8 HP. Gain Ghostlight. She will remember.' },
      { id: 'take', label: 'Take the page from her', desc: 'Learn a spell. Corruption +2. She will remember.' },
      { id: 'leave', label: 'Leave her to it', desc: '' },
    ],
  },
  vell3: {
    name: "Vell's Bargain", art: 'vell',
    text: 'Vell waits among the standing dead. The ink has reached her throat. "I can bind one of your cards so it never wears out," she whispers. "It will take the last of me that is still me."',
    options: [
      { id: 'bind', label: 'Let her bind a card', desc: 'Your most fragile crafted card becomes Permanent and Pristine. It costs her.' },
      { id: 'share', label: 'Refuse, and share your water', desc: 'Lose 6 HP. She will remember.' },
      { id: 'cut', label: 'Cut the ink from her hands', desc: 'Gain 2 Ichor. She will never forgive it.' },
    ],
  },
  vell4_ally: {
    name: 'The Last Page', art: 'vell',
    text: 'Vell is waiting at the foot of the last stair. Her hands are clean. "I will hold its pages open," she says. "You write."',
    options: [
      { id: 'fight', label: 'Face the Grimoire together', desc: 'The Grimoire starts with 25% less HP and 2 Weak.' },
      { id: 'send', label: 'Send her up to the light', desc: 'She leaves you her lantern and her blessing: full oil, full HP.' },
    ],
  },
  vell4_page: {
    name: 'The Last Page', art: 'vell',
    text: 'You find only her habit, folded on a lectern, and a last page with your name on it.',
    options: [
      { id: 'read', label: 'Read it', desc: 'Learn a spell, or heal 15 if you know them all.' },
      { id: 'burn', label: 'Burn it for light', desc: '+40 lantern oil.' },
    ],
  },
  vell4_hollow: {
    name: 'The Last Page', art: 'vellHollow',
    text: 'What used to be Vell is writing on the floor with its fingers, the same word over and over. It is your name. It looks up.',
    options: [
      { id: 'fight', label: 'Face her', desc: 'A hard fight. She keeps a relic.' },
      { id: 'slip', label: 'Slip past her', desc: 'She goes ahead to her master. The Grimoire gains 2 Strength.' },
    ],
  },
};
export const STORY_ALLY_TRUST = 2;

// What filling the Grimoire unlocks, for the runs after. `at` counts known spells.
export const UNLOCKS = [
  { at: 1, kind: 'relic', id: 'cartographer' },
  { at: 2, kind: 'enchant', id: 'serrated' },
  { at: 4, kind: 'enchant', id: 'withering' },
  { at: 6, kind: 'relic', id: 'leechjar' },
  { at: 8, kind: 'relic', id: 'paleglass' },
  { at: 10, kind: 'relic', id: 'oilskin' },
];

// Traps hidden in delve corridors. You only see one when you are close.
export const TRAPS = {
  spikes: { name: 'Spike plate', text: 'Spikes punch up through the floor', hp: 5 },
  gas:    { name: 'Grave gas', text: 'A grey gas hisses up and fills your lungs', hp: 3, dread: 15 },
  spill:  { name: 'Oil snare', text: 'A wire jerks your lantern sideways and oil spills', oil: 12 },
};

// The Rag Merchant's storyline: a line each time you meet, and up to three favors.
export const MERCHANT = {
  lines: [
    '"New face. Fewer every year. Your sort always buys ink first and bandages second."',
    '"You again. The Sister bought from me too, you know. Ink, mostly. Then more ink."',
    '"I knew her before she was Sister anything. She owes me for six bottles."',
    '"I don\'t go down past the Catacombs. Something down there pays better than I do."',
    '"Still breathing. Good for business."',
  ],
  favors: [
    { item: 'ench_leech', n: 1, ask: '"Bring me a hound\'s fang. I have a customer with peculiar teeth."' },
    { item: 'ench_echo', n: 1, ask: '"An acolyte\'s bell. Don\'t ask what for."' },
    { item: 'raw_slate', n: 2, ask: '"Two slates. Good ones. I am building something."' },
    { item: 'color_green', n: 2, ask: '"Two bottles of moss ink. My hands are not what they were."' },
    { item: 'ench_hungering', n: 1, ask: '"A ghoul\'s tongue. Fresh, if you can manage it."' },
    { item: 'raw_silver', n: 2, ask: '"Two lumps of silver ore. Prices are going up."' },
  ],
  done: [
    'He weighs it in his palm and nods. "Fair. Here, take this." (+40 gold, a Pristine Essence)',
    'He wraps it in three layers of rag. "You keep your word. Rare, down here." He gives you something from under the counter.',
    'He tucks it away and, for once, does not count it. "I sold her the ink that hollowed her," he says. "Take this. Make it worth something."',
  ],
};

// Depths: harder runs, unlocked one at a time by winning. Each level adds its rule
// to all the ones below it.
export const DEPTHS = [
  { name: 'Tougher guardians', desc: 'Elites, guardians and the Grimoire have 10% more HP.' },
  { name: 'A smaller lantern', desc: 'Your lantern holds 15 less oil.' },
  { name: 'Hungrier dark', desc: 'Ordinary monsters start every fight with 1 Strength.' },
  { name: 'Cold scriptoria', desc: 'Resting at a scriptorium heals 20% instead of 30%.' },
  { name: 'A blotted deck', desc: 'You start with a Blot, a card that cannot be cast. Burn it or salvage it.' },
  { name: 'Restless dead', desc: 'Random encounters are 25% more likely.' },
  { name: 'Greedy merchants', desc: 'Merchant prices and repairs cost 25% more.' },
  { name: 'The Grimoire stirs', desc: 'Guardians and the Grimoire start every fight with 2 Strength.' },
];

// Playable Inkbinders. Each starts differently and unlocks through lifetime progress.
// `start` adds to (inventory) or replaces (other fields) the normal starting values.
export const VARIANTS = {
  inkbinder: {
    name: 'The Inkbinder', swap: null,
    desc: 'Balanced. The way the old scribes taught it.',
    unlock: null, start: {},
  },
  bloodscribe: {
    name: 'The Bloodscribe', swap: 'blood',
    desc: 'Starts with 2 Blood Ink, the Cracked Inkwell and 70 max HP. Already a little corrupted.',
    unlock: { type: 'deepest', value: 1, text: 'Reach the Drowned Archive' },
    start: { maxHp: 70, hp: 70, relics: ['inkwell'], inventory: { ink_blood: 2 }, corruption: 2 },
  },
  ashmonk: {
    name: 'The Ash Monk', swap: 'ash',
    desc: 'Starts with extra charcoal and wood and begins every fight with 4 Block. Carries little gold.',
    unlock: { type: 'grimoire', value: 3, text: 'Know 3 spells in your Grimoire' },
    start: { gold: 10, inventory: { ink_charcoal: 7, mat_wood: 2 }, perks: ['openingBlock'] },
  },
  heretic: {
    name: 'The Gilded Heretic', swap: 'gilt',
    desc: 'Starts with 120 gold, a Gold Card and Gold Ink, but carries a smaller lantern (70 oil).',
    unlock: { type: 'deepest', value: 2, text: 'Reach the Catacombs' },
    start: { gold: 120, inventory: { mat_gold: 1, ink_gold: 1 }, oilMax: 70, oil: 70 },
  },
};

// Tips for a first run. Each shows once, and the player can turn them all off.
export const HINTS = {
  map: 'Choose where to go next. Delves are dungeons full of materials and wandering monsters. The guardian of the act waits at the top. Follow the lines.',
  explore: 'Tap a tile, swipe, or use WASD to walk. The writing desk is close by: that is where you craft. Scavenge the marked spots, then find the way out. Watch for cracked walls.',
  desk: 'Inscribe a card: pick a card material, an ink color and an ink material. A second ink costs 1 more mana. Monster parts add enchantments. If the ink stirs, you are one part away from a named spell.',
  fight: 'You get 3 mana each turn, and enemies show what they will do next. Cast crafted cards of different inks back to back to set off reactions. Press and hold a card (or right-click it) for its details.',
  lantern: 'Your lantern is running low and the dark is closing in. Burn a card for oil, or climb back to the surface from the stairs up.',
  corruption: 'Blood and ichor are corrupting you. At 5 you are Tainted, at 10 Forsaken. Rest at desks or pray at shrines to cleanse it.',
  guardian: 'Something guards the way out of this delve. Beat it and it leaves a relic. Craft before you face it.',
  pests: 'Some monsters go after your cards. Paper Moths eat paper. Ink Leeches smudge paper and wood. Rust Wraiths tarnish silver and gold. Stone fears none of them.',
  camp: 'A scriptorium. Craft as much as you like, then choose: rest to heal, or refill your lantern. You can only do one.',
};
