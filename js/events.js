import { EVENTS, STORY, STORY_ALLY_TRUST, ENCHANTMENTS, INK_COLORS, RECIPES, REGIONS, LANTERN, CORRUPTION, RAW_MATERIALS, RELICS } from './data.js';
import { cloneCard } from './crafting.js';
import { lightRadius, reveal } from './world.js';

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function addOil(run, n) {
  const before = run.oil;
  run.oil = Math.min(run.oilMax ?? LANTERN.max, run.oil + n);
  if (run.world) {
    run.world.radius = lightRadius(run.oil);
    reveal(run.world);
  }
  return run.oil - before;
}

function learnRandom(run, rng) {
  const unknown = RECIPES.filter(r => !run.grimoire.has(r.id) && !r.forbidden);
  if (!unknown.length) return null;
  const r = pick(unknown, rng);
  run.grimoire.add(r.id);
  return r;
}

// Which version of the last story beat you get.
export function lastBeat(run) {
  const trust = run.story?.trust || 0;
  return trust >= STORY_ALLY_TRUST ? 'vell4_ally' : trust <= 0 ? 'vell4_hollow' : 'vell4_page';
}

// Story beats. Same shape of result as events, plus `story` flags for the guardian fight.
function resolveStory(run, beat, opt, rng) {
  const add = (id, n = 1) => { run.inventory[id] = (run.inventory[id] || 0) + n; };
  const st = run.story ||= { trust: 0, met: [] };
  const trust = n => { st.trust += n; };
  st.met.push(beat);
  switch (`${beat}:${opt}`) {
    case 'vell1:give': {
      const have = Object.keys(INK_COLORS).filter(c => run.inventory[`color_${c}`] > 0);
      const given = [];
      for (let i = 0; i < 2 && have.length; i++) {
        const c = have[i % have.length];
        if (run.inventory[`color_${c}`] > 0) { run.inventory[`color_${c}`]--; given.push(INK_COLORS[c].name); }
      }
      trust(1);
      add('ench_swift');
      return { text: `${given.length ? `You give her your ${given.join(' and ')} ink.` : 'You have no ink to give, so you give her your company instead.'} She finishes the ward in one long stroke and presses a moth wing into your palm. "It was on the stair. It wants to be fast."`, items: ['ench_swift'] };
    }
    case 'vell1:ask': {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 10);
      const eased = Math.min(run.dread, 10);
      run.dread -= eased;
      return { text: `"A book," she says. "The first one. It is still writing." You sit with her a while. It helps more than you expect (+${run.hp - before} HP, -${eased} Dread).` };
    }
    case 'vell1:take': {
      trust(-1);
      const relic = pick(Object.keys(RELICS).filter(id => !run.relics.includes(id)), rng);
      return { text: 'You pull the quill from her fingers. She does not fight you. Wrapped around its shaft is something older.', relic };
    }
    case 'vell2:help': {
      run.hp = Math.max(1, run.hp - 8);
      trust(1);
      add('raw_wisp');
      return { text: 'You pin the page flat. The water burns like cold iron (8 HP). For one moment the ending holds, and Vell laughs. She gives you a wisp of ghostlight from her lamp.', items: ['raw_wisp'] };
    }
    case 'vell2:take': {
      trust(-1);
      run.corruption = (run.corruption || 0) + 2;
      const r = learnRandom(run, rng);
      return { text: `You pull the page out of the water. It stops changing in your hands.${r ? ` It is the true form of ${r.name}.` : ''} Vell stares at her empty fingers. Something black creeps up your wrist (+2 Corruption).`, learned: r?.id };
    }
    case 'vell2:leave':
      return { text: 'You leave her copying. Behind you, the page rewrites its ending again.' };
    case 'vell3:bind': {
      trust(-1);
      const crafted = run.deck.filter(k => k.crafted);
      if (!crafted.length) return { text: 'You have nothing worth binding. She closes her eyes, relieved.' };
      const card = [...crafted].sort((a, b) => (a.maxDurability === Infinity) - (b.maxDurability === Infinity) || a.maxDurability - b.maxDurability)[0];
      card.durability = card.maxDurability = Infinity;
      card.pristine = true;
      return { text: `She takes ${card.name} in both hands and breathes on it. The page goes hard as bone. When she gives it back, her eyes do not quite find you.` };
    }
    case 'vell3:share': {
      run.hp = Math.max(1, run.hp - 6);
      trust(1);
      return { text: 'You give her your water and sit with her among the dead. The ink at her throat recedes a little (6 HP).' };
    }
    case 'vell3:cut': {
      trust(-2);
      add('raw_ichor', 2);
      return { text: 'You cut. The ink comes away in thick ropes, still moving. Vell screams, then goes very quiet.', items: ['raw_ichor', 'raw_ichor'] };
    }
    case 'vell4_ally:fight':
      st.ally = true;
      return { text: 'She takes her place beside you. "Together, then."' };
    case 'vell4_ally:send': {
      run.oil = run.oilMax ?? LANTERN.max;
      run.hp = run.maxHp;
      return { text: 'She hesitates, then climbs toward the light. Her lantern is full, and so are you.' };
    }
    case 'vell4_page:read': {
      const r = learnRandom(run, rng);
      if (r) return { text: `"For whoever comes after," it begins. It ends with the true form of ${r.name}.`, learned: r.id };
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 15);
      return { text: `You already know everything she wrote. It is a comfort anyway (+${run.hp - before} HP).` };
    }
    case 'vell4_page:burn': {
      const oil = addOil(run, 40);
      return { text: `Her last page burns slow and bright (+${oil} oil).` };
    }
    case 'vell4_hollow:fight':
      return { text: 'It stands. It still holds a pen.', fight: ['vellHollow'], elite: true };
    case 'vell4_hollow:slip':
      st.hollowAhead = true;
      return { text: 'You wait until it bends back to its writing, then slip past. Far ahead, you hear it climbing toward the Grimoire.' };
  }
  return { text: '' };
}

// Applies an event choice to the run. Returns
//   { text, items?, learned?, fight?, relic? }
// A returned `relic` id is for the caller to grant (run.js owns relic effects).
// `learned` is a recipe id newly added to the Grimoire.
export function resolveEvent(run, eventId, optionId, rng = Math.random) {
  if (STORY[eventId]) return resolveStory(run, eventId, optionId, rng);
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
      const r = learnRandom(run, rng);
      if (!r) return { text: 'The shelf tears your hands (8 HP). The scribe has nothing left to teach you, but he thanks you all the same.' };
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
