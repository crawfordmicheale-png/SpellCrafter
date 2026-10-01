import { EVENTS, ENCHANTMENTS, INK_COLORS, RECIPES, REGIONS, LANTERN, CORRUPTION, RAW_MATERIALS, RELICS } from './data.js';
import { cloneCard } from './crafting.js';
import { lightRadius, reveal } from './world.js';

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function addOil(run, n) {
  const before = run.oil;
  run.oil = Math.min(run.oilMax ?? LANTERN.max, run.oil + n);
  run.world.radius = lightRadius(run.oil);
  reveal(run.world);
  return run.oil - before;
}

// Applies an event choice to the run. Returns
//   { text, items?, learned?, fight?, relic? }
// A returned `relic` id is for the caller to grant (run.js owns relic effects).
// `learned` is a recipe id newly added to the Grimoire.
export function resolveEvent(run, eventId, optionId, rng = Math.random) {
  const add = (id, n = 1) => { run.inventory[id] = (run.inventory[id] || 0) + n; };
  switch (`${eventId}:${optionId}`) {
    case 'shrine:pray': {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 12);
      run.dread += 10;
      const cleansed = Math.min(run.corruption || 0, CORRUPTION.prayCleanse);
      run.corruption = (run.corruption || 0) - cleansed;
      return { text: `The candles gutter as you kneel. You recover ${run.hp - before} HP${cleansed ? ` and ${cleansed} Corruption lifts from you` : ''}, but the silence afterwards is heavy.` };
    }
    case 'shrine:take': {
      const oil = addOil(run, 30);
      run.maxHp = Math.max(1, run.maxHp - 4);
      run.hp = Math.min(run.hp, run.maxHp);
      return { text: `You pour the candle fat into your lantern (+${oil} oil). Something in your chest goes cold. You lose 4 max HP.` };
    }
    case 'scribe:free': {
      run.hp = Math.max(1, run.hp - 8);
      const unknown = RECIPES.filter(r => !run.grimoire.has(r.id));
      if (!unknown.length) return { text: 'The shelf tears your hands (8 HP). The scribe has nothing left to teach you, but he thanks you all the same.' };
      const r = pick(unknown, rng);
      run.grimoire.add(r.id);
      return { text: `The shelf tears your hands (8 HP). Gasping, the scribe presses the page into them. It is the true form of ${r.name}.`, learned: r.id };
    }
    case 'scribe:rob':
      run.gold += 35;
      run.dread += 25;
      return { text: 'You take his purse. He does not beg. He only watches you go.' };
    case 'scribe:leave':
      run.dread += 5;
      return { text: 'His voice follows you a long way down the corridor.' };
    case 'well:drink': {
      if (rng() < 0.5) {
        const parts = [pick(Object.keys(ENCHANTMENTS), rng), pick(Object.keys(ENCHANTMENTS), rng)].map(k => `ench_${k}`);
        parts.forEach(id => add(id));
        return { text: 'The ink tastes of iron and old words. When you wipe your mouth, something is left in your hand.', items: parts };
      }
      run.hp = Math.max(1, run.hp - 10);
      return { text: 'The ink fights its way back up. You retch for a long time. You lose 10 HP.' };
    }
    case 'well:bottle': {
      const inks = [pick(Object.keys(INK_COLORS), rng), pick(Object.keys(INK_COLORS), rng)].map(k => `color_${k}`);
      inks.forEach(id => add(id));
      run.dread += 10;
      return { text: 'You fill every bottle you have. The surface of the well goes still, as if it is watching.', items: inks };
    }
    case 'lanterns:cut': {
      const oil = addOil(run, 40);
      const pool = REGIONS[run.regionIdx].encounters;
      return { text: `The lantern crashes down and you save the oil (+${oil}). The noise echoes for a long time. Something answers it.`, fight: pick(pool, rng) };
    }
    case 'lanterns:climb': {
      const oil = addOil(run, 25);
      run.hp = Math.max(1, run.hp - 6);
      return { text: `The chain bites into your palms, but you reach the lantern (+${oil} oil, -6 HP).` };
    }
    case 'book:read': {
      const ink = pick(['ink_ichor', 'ink_ghostlight'], rng);
      add(ink);
      run.corruption = (run.corruption || 0) + 2;
      return { text: 'The words crawl off the page and into your bottles. You will be hearing them for a while.', items: [ink] };
    }
    case 'book:burn': {
      const oil = addOil(run, 35);
      return { text: `It screams as it burns, and it burns very brightly (+${oil} oil).` };
    }
    case 'corpse:search': {
      if (rng() < 0.4) {
        return { text: 'You open the pack. Something inside it opens its eyes.', fight: pick(REGIONS[run.regionIdx].encounters, rng) };
      }
      const raws = Object.keys(RAW_MATERIALS).filter(k => RAW_MATERIALS[k].node);
      const items = [0, 1, 2].map(() => `raw_${pick(raws, rng)}`);
      items.forEach(id => add(id));
      run.gold += 25;
      return { text: 'His pack is heavy with the wares nobody wanted. Twenty-five gold in the lining, too.', items };
    }
    case 'corpse:bury': {
      const eased = Math.min(run.dread, 20);
      run.dread -= eased;
      return { text: `You scrape a shallow grave and say what words you remember. Your nerves settle (-${eased} Dread).` };
    }
    case 'mirror:gaze': {
      run.dread += 15;
      const crafted = run.deck.filter(k => k.crafted);
      if (!crafted.length) return { text: 'Your reflection shrugs. It has nothing you have not written yourself.' };
      const copy = cloneCard(pick(crafted, rng));
      run.deck.push(copy);
      return { text: `Your reflection hands you a card through the water: ${copy.name}. Its fingers are very cold.` };
    }
    case 'mirror:drink': {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 15);
      run.corruption = (run.corruption || 0) + 2;
      return { text: `It tastes of nothing at all. You feel better (+${run.hp - before} HP), and somehow worse.` };
    }
    case 'altar:card': {
      const starters = run.deck.filter(k => !k.crafted);
      if (!starters.length || run.deck.length <= LANTERN.minDeck) return { text: 'You have nothing plain enough to offer.' };
      const card = pick(starters, rng);
      run.deck = run.deck.filter(k => k !== card);
      const unowned = Object.keys(RELICS).filter(id => !run.relics.includes(id));
      if (!unowned.length) { run.gold += 40; return { text: `The ${card.name} soaks into the stone. The bowl fills with coins (+40 gold).` }; }
      const relic = pick(unowned, rng);
      return { text: `The ${card.name} soaks into the stone. When you look again, the bowl holds the ${RELICS[relic].name}.`, relic };
    }
    case 'altar:blood': {
      run.hp = Math.max(1, run.hp - 10);
      add('raw_ichor'); add('ess_pristine');
      return { text: 'You cut your palm over the bowl (-10 HP). The ink on the altar drinks, and gives something back.', items: ['raw_ichor', 'ess_pristine'] };
    }
    default:
      return { text: 'You leave it behind.' };
  }
}

export const eventName = id => EVENTS[id].name;
