import { EVENTS, ENCHANTMENTS, INK_COLORS, RECIPES, REGIONS, LANTERN, CORRUPTION } from './data.js';
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
//   { text, items?, learned?, fight? }
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
    default:
      return { text: 'You leave it behind.' };
  }
}

export const eventName = id => EVENTS[id].name;
