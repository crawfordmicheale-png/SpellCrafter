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
  echo:      { name: 'Echo',      part: "Acolyte's Bell",   desc: 'Casts again at half power.' },
  swift:     { name: 'Swift',     part: 'Moth Wing',        desc: 'Costs 0 the first time it is cast each fight.' },
  bound:     { name: 'Bound',     part: "Scrivener's Quill", desc: 'Stays in your hand at end of turn.' },
  volatile:  { name: 'Volatile',  part: 'Ember Heart',      desc: 'Double power. Exhausts for the rest of the fight.' },
  leech:     { name: 'Leech',     part: 'Hound Fang',       desc: 'Heal for a quarter of the damage dealt.' },
  siphon:    { name: 'Siphon',    part: 'Grave Candle',     desc: 'Gain 1 mana if this kills an enemy.' },
  hungering: { name: 'Hungering', part: 'Ghoul Tongue',     desc: 'Gets +2 stronger each time you cast it in a fight.' },
  piercing:  { name: 'Piercing',  part: "Weaver's Needle",  desc: 'Damage ignores Block.' },
  hallowed:  { name: 'Hallowed',  part: "Saint's Knucklebone", desc: 'Also gain 4 Block when cast.' },
};

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
};

// Refining turns raw materials into crafting ingredients. Some raws have a choice.
export const REFINING = [
  { id: 'charcoal',   from: { raw_ash: 1 },       to: { ink_charcoal: 2 } },
  { id: 'white',      from: { raw_bone: 1 },      to: { color_white: 1 } },
  { id: 'paper',      from: { raw_rags: 1 },      to: { mat_paper: 2 } },
  { id: 'wood',       from: { raw_timber: 1 },    to: { mat_wood: 1 } },
  { id: 'black',      from: { raw_gravesoil: 1 }, to: { color_black: 1 } },
  { id: 'red',        from: { raw_bloodroot: 1 }, to: { color_red: 1 } },
  { id: 'blue',       from: { raw_kelp: 1 },      to: { color_blue: 1 } },
  { id: 'green',      from: { raw_moss: 1 },      to: { color_green: 1 } },
  { id: 'stone',      from: { raw_slate: 2 },     to: { mat_stone: 1 } },
  { id: 'silverInk',  from: { raw_silver: 1 },    to: { ink_silver: 1 } },
  { id: 'silverCard', from: { raw_silver: 2 },    to: { mat_silver: 1 } },
  { id: 'goldInk',    from: { raw_gold: 1 },      to: { ink_gold: 1 } },
  { id: 'goldCard',   from: { raw_gold: 2 },      to: { mat_gold: 1 } },
  { id: 'bloodInk',   from: { raw_heart: 1 },     to: { ink_blood: 2 } },
  { id: 'bleed',      from: {}, hpCost: 6,        to: { ink_blood: 1 } },
];

// Every ingredient in the game, keyed by inventory id.
export const INGREDIENTS = {};
for (const [k, v] of Object.entries(INK_COLORS))     INGREDIENTS[`color_${k}`] = { kind: 'color',   key: k, name: v.name, rarity: 'common' };
for (const [k, v] of Object.entries(INK_MATERIALS))  INGREDIENTS[`ink_${k}`]   = { kind: 'inkMat',  key: k, name: `${v.name} Ink`, rarity: { charcoal: 'common', silver: 'uncommon', gold: 'rare', blood: 'rare' }[k] };
for (const [k, v] of Object.entries(CARD_MATERIALS)) INGREDIENTS[`mat_${k}`]   = { kind: 'cardMat', key: k, name: `${v.name} Card`, rarity: { paper: 'common', wood: 'common', stone: 'uncommon', silver: 'uncommon', gold: 'rare' }[k] };
for (const [k, v] of Object.entries(ENCHANTMENTS))   INGREDIENTS[`ench_${k}`]  = { kind: 'enchant', key: k, name: v.part, rarity: 'uncommon' };
for (const [k, v] of Object.entries(RAW_MATERIALS))  INGREDIENTS[`raw_${k}`]   = { kind: 'raw',     key: k, name: v.name, rarity: v.rarity };

export const PRICES = { common: 12, uncommon: 25, rare: 45 };
export const REPAIR_PRICE = 20;
export const BENCH_REST_HEAL = 0.3; // fraction of max HP, once per desk

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
  {
    id: 'bellstrike', name: 'Bellstrike',
    match: { colors: ['red', 'white'], inkMat: 'silver', cardMat: 'stone', enchants: ['echo'] },
    effects: [{ type: 'damage', amount: 10 }, { type: 'block', amount: 10 }],
    hint: 'A branded stone, silvered, that rings twice.',
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
    match: { colors: ['green', 'white'], inkMat: 'silver', cardMat: 'silver', enchants: ['hallowed'] },
    effects: [{ type: 'block', amount: 12 }, { type: 'heal', amount: 5 }],
    hint: 'A sanctuary, silvered twice, blessed by a saint.',
    flavor: 'Said over every body in the catacombs. None of them stayed down.',
  },
  {
    id: 'needlestorm', name: 'Needlestorm',
    match: { colors: ['black', 'red'], inkMat: 'blood', cardMat: 'wood', enchants: ['piercing'] },
    effects: [{ type: 'damage', amount: 6 }, { type: 'damage', amount: 6 }, { type: 'poison', amount: 3 }],
    hint: 'Hexfire in blood, stitched through wood with a needle.',
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
};
export const STARTER_DECK = ['strike', 'strike', 'strike', 'strike', 'strike', 'guard', 'guard', 'guard', 'guard', 'scribble'];

export const STARTING_INVENTORY = {
  color_red: 1, color_white: 1,
  ink_charcoal: 2, ink_silver: 1,
  mat_paper: 2, mat_wood: 1,
  ench_volatile: 1,
  raw_bone: 1, raw_gravesoil: 1, raw_ash: 1,
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
    drops: ['ench_leech', 'raw_ash', 'raw_bloodroot', 'raw_timber', 'ench_volatile'],
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
    drops: ['raw_kelp', 'raw_kelp', 'raw_silver', 'ench_bound', 'raw_rags'],
  },
  warden: {
    name: 'The Bell Warden', hp: 42, elite: true,
    desc: 'It rang the bell for every funeral. Now it rings for yours.',
    moves: [
      { actions: [{ type: 'attack', amount: 9 }] },
      { actions: [{ type: 'block', amount: 8 }, { type: 'debuff', status: 'weak', amount: 1 }] },
      { actions: [{ type: 'attack', amount: 3, times: 3 }] },
    ],
    drops: ['ench_echo', 'raw_silver', 'raw_silver', 'raw_heart', 'raw_slate', 'raw_gold'],
  },
  scrivener: {
    name: 'The Pale Scrivener', hp: 52, elite: true,
    desc: 'An Inkbinder who wrote one spell too many. The ink wrote back.',
    moves: [
      { actions: [{ type: 'attack', amount: 11 }] },
      { actions: [{ type: 'block', amount: 10 }, { type: 'debuff', status: 'weak', amount: 2 }] },
      { actions: [{ type: 'attack', amount: 5, times: 3 }] },
    ],
    drops: ['ench_bound', 'raw_gold', 'raw_gold', 'raw_heart', 'raw_silver'],
  },
  wraith: {
    name: 'Choir Wraith', hp: 20,
    desc: 'It still sings the funeral hymn. The notes cut.',
    moves: [
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'attack', amount: 3 }] },
      { actions: [{ type: 'attack', amount: 7 }] },
    ],
    drops: ['raw_bone', 'raw_ash', 'ench_echo', 'raw_silver'],
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
  saint: {
    name: 'The Ossuary Saint', hp: 58, elite: true,
    desc: 'Canonised for building the catacombs. He is still adding to them.',
    moves: [
      { actions: [{ type: 'attack', amount: 12 }] },
      { actions: [{ type: 'block', amount: 12 }, { type: 'buff', status: 'strength', amount: 2 }] },
      { actions: [{ type: 'debuff', status: 'weak', amount: 2 }, { type: 'debuff', status: 'poison', amount: 3 }] },
    ],
    drops: ['ench_hallowed', 'ench_hallowed', 'raw_silver', 'raw_gold', 'raw_heart'],
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

// Each region is a procedurally generated dungeon floor.
// `raws` weights what the scavenge spots hold.
export const REGIONS = [
  {
    name: 'The Chapel Ruins',
    intro: 'Pews split for firewood. Bones in every niche. Somewhere below, a bell.',
    raws: { ash: 3, bone: 3, rags: 2, timber: 2, gravesoil: 2, bloodroot: 2, moss: 1 },
    nodes: 13, chests: 2,
    encounters: [['acolyte'], ['gravemoth', 'gravemoth'], ['gravemoth'], ['acolyte', 'gravemoth']],
    elite: 'warden', merchant: true, hpMult: 1, events: 1,
    tiles: { 1: '#2b2430', 2: '#352c3c', 3: '#1d1822', 4: '#4f7a45', 5: '#4a3f50', 6: '#6b5a74', 7: '#2a2230', 8: '#1f1a24', 9: '#231c28' },
  },
  {
    name: 'The Drowned Archive',
    intro: 'The river took the library a century ago. The scribes never stopped working.',
    raws: { kelp: 3, moss: 2, slate: 2, silver: 2, rags: 2, bloodroot: 1, bone: 1 },
    nodes: 14, chests: 2,
    encounters: [['drowned'], ['drowned', 'gravemoth'], ['hound'], ['ghoul']],
    elite: 'scrivener', merchant: true, hpMult: 1.1, events: 2,
    tiles: { 1: '#1f2a30', 2: '#27363d', 3: '#141c21', 4: '#3f7a6f', 5: '#3a4d56', 6: '#557582', 7: '#1f2c33', 8: '#162027', 9: '#18242a' },
  },
  {
    name: 'The Catacombs',
    intro: 'The dead here were buried standing up, facing the stair. They are still waiting for someone to come down it.',
    raws: { bone: 3, gravesoil: 3, ash: 2, slate: 2, silver: 1, moss: 1, timber: 1 },
    nodes: 13, chests: 2,
    encounters: [['wraith'], ['boneweaver'], ['wraith', 'acolyte'], ['boneweaver', 'gravemoth']],
    elite: 'saint', merchant: true, hpMult: 1.2, events: 2,
    tiles: { 1: '#2a2826', 2: '#34312d', 3: '#1a1816', 4: '#6b6a4a', 5: '#4d4944', 6: '#79736a', 7: '#2a2724', 8: '#1e1c1a', 9: '#22201e' },
  },
  {
    name: 'The Last Library',
    intro: 'Every book here was written by an Inkbinder. Most of them are still screaming.',
    raws: { gold: 2, silver: 2, bloodroot: 2, gravesoil: 2, bone: 1, slate: 1, kelp: 1 },
    nodes: 12, chests: 3,
    encounters: [['hound', 'ghoul'], ['inkling', 'inkling'], ['ghoul', 'gravemoth', 'gravemoth'], ['inkling', 'wraith'], ['boneweaver', 'inkling']],
    elite: null, boss: 'grimoire', merchant: false, hpMult: 1.3, events: 1,
    tiles: { 1: '#2e2320', 2: '#392b26', 3: '#1e1614', 4: '#8a6a2a', 5: '#523a2e', 6: '#7a5840', 7: '#2e201a', 8: '#221814', 9: '#241915' },
  },
];

// Random encounters: chance per step on open floor.
export const ENCOUNTER = { graceSteps: 12, base: 0.02, perDread: 0.0003, max: 0.09, dreadPerStep: 1 };
export const DESCEND_HEAL = 0.2; // fraction of max HP restored on the stairs

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
