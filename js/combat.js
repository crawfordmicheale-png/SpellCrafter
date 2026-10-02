import { ENEMIES, REACTIONS, CORRUPTION, FRAIL_MULT } from './data.js';
import { salvageRoll, recordCast, GROWS } from './crafting.js';

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// A fight. Mutates `run` (hp, maxHp, gold, deck, inventory) as things happen.
// paperWear: extra uses a paper card loses per cast (a flooded delve).
// strength: extra Strength every enemy starts with (from the Depth).
export function createCombat(run, enemyKeys, rng = Math.random, { hpMult = 1, paperWear = 0, strength = 0 } = {}) {
  const c = {
    run, rng,
    enemies: enemyKeys.map(key => {
      const e = ENEMIES[key];
      const hp = Math.round(e.hp * hpMult);
      return { key, name: e.name, hp, maxHp: hp, block: 0, poison: 0, weak: 0, strength, bleed: 0, frail: 0, moveIdx: 0 };
    }),
    hunger: {}, // card uid -> times cast this fight (Hungering)
    player: { block: 0, energy: 0, weak: 0, poison: 0, frail: 0, nextFree: false },
    lastCast: null,      // { name, effects } of the last card cast, for Pale ink to repeat
    drawPile: shuffle([...run.deck], rng),
    hand: [], discard: [], exhaust: [],
    swiftUsed: new Set(),
    paperWear,
    smudged: new Set(), // card uids an Ink Leech has drained: half strength this fight
    tarnish: 0,         // turns left on which silver and gold cards cost 1 more
    pestEvent: null,    // { text, n } for the most recent thing a pest did to your cards
    lastColors: null,    // ink colors of the last card cast this turn
    lastReaction: null,  // { key, name, n } for the most recent reaction
    reactionCount: 0,
    needleReady: false,
    turn: 0,
    log: [],
    over: null, // 'won' | 'lost'
  };
  log(c, `${c.enemies.map(e => e.name).join(' and ')} ${c.enemies.length > 1 ? 'block' : 'blocks'} your path.`);
  const corruption = run.corruption || 0;
  if (corruption >= CORRUPTION.forsaken) {
    for (const e of c.enemies) e.strength += 1;
    log(c, 'You are Forsaken. Your enemies can smell it.');
  }
  if (hasRelic(run, 'bell')) {
    for (const e of c.enemies) e.weak = 1;
    log(c, 'The Tolling Bell rings. Your enemies falter.');
  }
  startPlayerTurn(c);
  if (corruption >= CORRUPTION.tainted) c.player.weak += 1;
  if (run.perks?.includes('openingBlock')) c.player.block += 4;
  return c;
}

const log = (c, msg) => c.log.push(msg);
// Frail cuts the Block you gain by a quarter.
const gainBlock = (c, n) => { c.player.block += c.player.frail > 0 ? Math.floor(n * FRAIL_MULT) : n; };
const bleedBonus = c => (hasRelic(c.run, 'leechjar') ? 1 : 0);
// What Pale ink can repeat. Anything else on a card is not copied.
const MIMICS = new Set(['damage', 'damageAll', 'block', 'draw', 'heal', 'poison']);
const hasRelic = (run, id) => !!run.relics?.includes(id);
const pairKey = (a, b) => [a, b].sort().join('+');

// Which reaction casting `colors` would set off, given the previous inscribed card's
// colors. A card following a different color reacts; a two-ink card always reacts with itself.
export function reactionFor(prevColors, colors) {
  if (prevColors) {
    for (const p of prevColors) for (const q of colors) {
      if (p !== q && REACTIONS[pairKey(p, q)]) return pairKey(p, q);
    }
  }
  if (colors.length === 2) return pairKey(colors[0], colors[1]);
  return null;
}

export const previewReaction = (c, card) => card.crafted ? reactionFor(c.lastColors, card.colors) : null;

export const bloodCost = (c, card) => Math.max(0, (card.hpCost || 0) - (hasRelic(c.run, 'inkwell') ? 1 : 0));
const alive = c => c.enemies.filter(e => e.hp > 0);

export function currentMove(enemy) {
  const def = ENEMIES[enemy.key];
  const moves = enemy.phase ? def.phase2.moves : def.moves;
  return moves[enemy.moveIdx % moves.length];
}

// Bosses change at half health: new moves, a burst of Strength and Block.
function checkPhase(c, enemy) {
  const p = ENEMIES[enemy.key].phase2;
  if (!p || enemy.phase || enemy.hp <= 0 || enemy.hp > enemy.maxHp * p.at) return;
  enemy.phase = 1;
  enemy.moveIdx = 0;
  enemy.strength += p.strength || 0;
  enemy.block += p.block || 0;
  log(c, `${p.name}! ${p.text}`);
  c.phaseEvent = { name: p.name, text: p.text, n: (c.phaseEvent?.n || 0) + 1 };
}

function draw(c, n) {
  for (let i = 0; i < n; i++) {
    if (!c.drawPile.length) {
      if (!c.discard.length) return;
      c.drawPile = shuffle(c.discard, c.rng);
      c.discard = [];
    }
    c.hand.push(c.drawPile.pop());
  }
}

function startPlayerTurn(c) {
  c.turn++;
  c.player.block = 0;
  c.player.energy = c.run.energy;
  c.player.nextFree = false;
  c.lastColors = null;
  c.needleReady = hasRelic(c.run, 'needle');
  if (c.player.poison > 0) {
    loseHp(c, c.player.poison, 'Poison');
    c.player.poison--;
    if (c.over) return;
  }
  const extra = c.turn === 1 && hasRelic(c.run, 'quill') ? 2 : 0;
  draw(c, Math.max(0, c.run.handSize + extra - c.hand.length));
}

function loseHp(c, n, source) {
  c.run.hp = Math.max(0, c.run.hp - n);
  log(c, `You lose ${n} HP (${source}).`);
  if (c.run.hp <= 0) c.over = 'lost';
}

function damageEnemy(c, enemy, amount, pierce = false) {
  if (c.player.weak > 0) amount = Math.floor(amount * 0.75);
  const blocked = pierce ? 0 : Math.min(enemy.block, amount);
  enemy.block -= blocked;
  const dealt = Math.min(enemy.hp, amount - blocked);
  enemy.hp -= dealt;
  if (enemy.hp <= 0) log(c, `${enemy.name} is unwritten.`);
  checkPhase(c, enemy);
  return { dealt, killed: enemy.hp <= 0 && dealt > 0 };
}

function damagePlayer(c, enemy, amount) {
  amount += enemy.strength;
  if (enemy.weak > 0) amount = Math.floor(amount * 0.75);
  const blocked = Math.min(c.player.block, amount);
  c.player.block -= blocked;
  const taken = amount - blocked;
  if (taken > 0) loseHp(c, taken, enemy.name);
  else log(c, `You block ${enemy.name}.`);
}

export const isMetal = card => card.cardMat === 'silver' || card.cardMat === 'gold';

export function effectiveCost(c, card) {
  if (c.player.nextFree) return 0;
  if (card.enchants.includes('swift') && !c.swiftUsed.has(card.uid)) return 0;
  return card.cost + (c.tarnish > 0 && isMetal(card) ? 1 : 0);
}

// Returns null if the card can be played, or a reason it can't.
export function canPlay(c, card) {
  if (c.over) return 'The fight is over.';
  if (card.unplayable) return `${card.name} cannot be cast.`;
  if (effectiveCost(c, card) > c.player.energy) return 'Not enough mana.';
  const blood = bloodCost(c, card);
  if (blood && c.run.hp <= blood) return 'Not enough blood left to pay.';
  return null;
}

export function playCard(c, cardUid, targetIdx = 0) {
  const idx = c.hand.findIndex(k => k.uid === cardUid);
  if (idx < 0) return 'That card is not in your hand.';
  const card = c.hand[idx];
  const reason = canPlay(c, card);
  if (reason) return reason;

  let target = c.enemies[targetIdx];
  if (!target || target.hp <= 0) target = alive(c)[0];

  const cost = effectiveCost(c, card);
  const usedFree = c.player.nextFree;
  c.player.energy -= cost;
  c.player.nextFree = false;
  if (card.enchants.includes('swift')) c.swiftUsed.add(card.uid);
  c.hand.splice(idx, 1);
  log(c, `You cast ${card.name}${usedFree ? ' for free' : ''}.`);

  const blood = bloodCost(c, card);
  if (blood) loseHp(c, blood, 'blood price');

  let dealtTotal = 0, killed = false;
  const needle = c.needleReady && card.effects.some(e => e.type === 'damage' || e.type === 'damageAll');
  if (needle) c.needleReady = false;
  const pierce = card.enchants.includes('piercing') || needle;
  const tainted = (c.run.corruption || 0) >= CORRUPTION.tainted
    && (card.colors.includes('black') || card.inkMat === 'blood');
  const growth = (card.enchants.includes('hungering') ? 2 * (c.hunger[card.uid] || 0) : 0)
    + (tainted ? CORRUPTION.taintBonus : 0);
  const smudge = c.smudged.has(card.uid) ? 0.5 : 1;
  if (smudge < 1) log(c, `${card.name} is smudged and writes faintly.`);
  const apply = (scale) => {
    for (const e of card.effects) {
      const base = e.amount + (GROWS.has(e.type) ? growth : 0);
      const k = scale * (e.type === 'loseMaxHp' ? 1 : smudge);
      const n = k === 1 ? base : Math.max(1, Math.round(base * k));
      switch (e.type) {
        case 'damage': {
          if (!target || target.hp <= 0) target = alive(c)[0];
          if (!target) break;
          const r = damageEnemy(c, target, n, pierce);
          dealtTotal += r.dealt; killed ||= r.killed;
          break;
        }
        case 'damageAll':
          for (const en of alive(c)) {
            const r = damageEnemy(c, en, n, pierce);
            dealtTotal += r.dealt; killed ||= r.killed;
          }
          break;
        case 'block': gainBlock(c, n); break;
        case 'draw': draw(c, n); break;
        case 'heal': c.run.hp = Math.min(c.run.maxHp, c.run.hp + n); break;
        case 'poison':
          if (!target || target.hp <= 0) target = alive(c)[0];
          if (target) target.poison += n;
          break;
        case 'mimic': {
          const last = c.lastCast;
          if (!last) { log(c, 'The pale ink finds nothing to remember.'); break; }
          const pct = n + (hasRelic(c.run, 'paleglass') ? 25 : 0);
          log(c, `The pale ink repeats ${last.name} at ${pct}%.`);
          for (const le of last.effects) {
            const m = Math.max(1, Math.round(le.amount * pct / 100));
            if (le.type === 'damage' || le.type === 'damageAll') {
              for (const en of le.type === 'damageAll' ? alive(c) : [target && target.hp > 0 ? target : alive(c)[0]].filter(Boolean)) {
                const r = damageEnemy(c, en, m, pierce);
                dealtTotal += r.dealt; killed ||= r.killed;
              }
            } else if (le.type === 'block') gainBlock(c, m);
            else if (le.type === 'draw') draw(c, m);
            else if (le.type === 'heal') c.run.hp = Math.min(c.run.maxHp, c.run.hp + m);
            else if (le.type === 'poison') { const t = target && target.hp > 0 ? target : alive(c)[0]; if (t) t.poison += m; }
          }
          break;
        }
        case 'loseMaxHp':
          if (scale === 1) {
            c.run.maxHp = Math.max(1, c.run.maxHp - n);
            c.run.hp = Math.min(c.run.hp, c.run.maxHp);
          }
          break;
        case 'nextFree': c.player.nextFree = true; break;
      }
    }
  };
  apply(1);
  if (card.enchants.includes('echo')) { log(c, `${card.name} echoes.`); apply(0.5); }
  // Remember this card for Pale ink, with its amounts as cast (not Pale cards themselves).
  if (!card.effects.some(e => e.type === 'mimic')) {
    const kept = card.effects.filter(e => MIMICS.has(e.type))
      .map(e => ({ type: e.type, amount: Math.max(1, Math.round((e.amount + (GROWS.has(e.type) ? growth : 0)) * smudge)) }));
    if (kept.length) c.lastCast = { name: card.name, effects: kept };
  }
  if (!target || target.hp <= 0) target = alive(c)[0];
  if (target && card.enchants.includes('serrated') && dealtTotal > 0) {
    target.bleed += 2 + bleedBonus(c);
    log(c, `${target.name} bleeds.`);
  }
  if (target && card.enchants.includes('withering')) target.frail += 2;

  if (card.enchants.includes('hungering')) c.hunger[card.uid] = (c.hunger[card.uid] || 0) + 1;
  if (card.enchants.includes('hallowed')) gainBlock(c, 4);
  if (card.enchants.includes('leech') && dealtTotal > 0) {
    const heal = Math.floor(dealtTotal / 4);
    c.run.hp = Math.min(c.run.maxHp, c.run.hp + heal);
  }
  if (card.enchants.includes('siphon') && killed) c.player.energy += 1;
  if (card.purify) {
    if (c.player.poison > 0) c.player.poison = 0;
    else if (c.player.weak > 0) c.player.weak = 0;
  }
  if (card.goldOnCast) c.run.gold += card.goldOnCast;
  if (card.corrupts) c.run.corruption = (c.run.corruption || 0) + card.corrupts;
  const tier = recordCast(card);
  if (tier) {
    log(c, `${card.name} is now ${tier}.${card.signaturePending ? ' Choose its signature at a writing desk.' : ''}`);
    c.wornUp = { name: card.name, tier, n: (c.wornUp?.n || 0) + 1 };
  }

  // Ink reactions. Only inscribed cards react; starter cards are plain ink.
  const reactKey = card.crafted ? reactionFor(c.lastColors, card.colors) : null;
  if (card.crafted) c.lastColors = card.colors;
  if (reactKey && !c.over && alive(c).length) {
    if (!target || target.hp <= 0) target = alive(c)[0];
    const r = react(c, reactKey, target);
    dealtTotal += r.dealt; killed ||= r.killed;
  }

  // Wear and tear.
  let broken = false;
  if (Number.isFinite(card.durability)) {
    card.durability -= 1 + (card.cardMat === 'paper' ? c.paperWear : 0);
    if (card.durability <= 0) {
      broken = true;
      breakCard(c, card);
    }
  }
  if (!broken) {
    if (card.enchants.includes('volatile')) c.exhaust.push(card);
    else c.discard.push(card);
  }

  if (c.run.hp <= 0) c.over = 'lost';
  else if (!alive(c).length) c.over = 'won';
  return null;
}

function breakCard(c, card) {
  card.durability = 0;
  c.run.deck = c.run.deck.filter(k => k.uid !== card.uid);
  log(c, `${card.name} crumbles to nothing.`);
  if (c.rng() < 0.5) {
    const part = salvageRoll(card, c.rng);
    c.run.inventory[part] = (c.run.inventory[part] || 0) + 1;
    c.salvaged = [...(c.salvaged || []), part];
  }
}

const pickFrom = (c, arr) => arr[Math.floor(c.rng() * arr.length)];
const pest = (c, text, label) => { log(c, text); c.pestEvent = { text, label, n: (c.pestEvent?.n || 0) + 1 }; };

// What pests do to your cards. Your hand is already discarded when enemies act,
// so they go after the cards in your draw and discard piles.
function pestAction(c, e, type) {
  const piles = [...c.drawPile, ...c.discard];
  switch (type) {
    case 'devour': {
      const pool = piles.filter(k => k.cardMat === 'paper');
      if (!pool.length) { log(c, `${e.name} finds no paper to eat.`); return; }
      const card = pickFrom(c, pool);
      c.drawPile = c.drawPile.filter(k => k !== card);
      c.discard = c.discard.filter(k => k !== card);
      card.durability--;
      if (card.durability <= 0) { pest(c, `${e.name} eats ${card.name} whole.`, `${card.name} devoured`); breakCard(c, card); }
      else { c.exhaust.push(card); pest(c, `${e.name} eats into ${card.name}. It is gone for this fight, and worn.`, `${card.name} eaten`); }
      return;
    }
    case 'smudge': {
      const pool = [...piles, ...c.hand].filter(k => k.crafted && (k.cardMat === 'paper' || k.cardMat === 'wood') && !c.smudged.has(k.uid));
      if (!pool.length) { log(c, `${e.name} finds no cheap pages to drink from.`); return; }
      const card = pickFrom(c, pool);
      c.smudged.add(card.uid);
      pest(c, `${e.name} drinks the ink from ${card.name}. It is at half strength for this fight.`, `${card.name} smudged`);
      return;
    }
    case 'tarnish': {
      if (!c.run.deck.some(isMetal)) { log(c, `${e.name} finds no silver or gold to tarnish.`); return; }
      c.tarnish = 1;
      pest(c, `${e.name} breathes on your silver and gold. They cost 1 more next turn.`, 'Silver and gold tarnished');
    }
  }
}

function react(c, key, target) {
  const reaction = REACTIONS[key];
  const mult = hasRelic(c.run, 'prism') ? 2 : 1;
  let dealt = 0, killed = false;
  c.lastReaction = { key, name: reaction.name, n: ++c.reactionCount };
  log(c, `${reaction.name}! ${reaction.desc}`);
  for (const e of reaction.effects) {
    const n = (e.amount || 0) * mult;
    switch (e.type) {
      case 'draw': draw(c, n); break;
      case 'block': gainBlock(c, n); break;
      case 'heal': c.run.hp = Math.min(c.run.maxHp, c.run.hp + n); break;
      case 'mana': c.player.energy += n; break;
      case 'bleed': if (target) target.bleed += n + bleedBonus(c); break;
      case 'frail': if (target) target.frail += n; break;
      case 'cure': c.player.poison = 0; break;
      case 'weaken': if (target) target.weak += n; break;
      case 'strip': if (target) target.block = 0; break;
      case 'brand': {
        const dmg = Math.floor(c.player.block / 2) * mult;
        if (target && dmg > 0) { const r = damageEnemy(c, target, dmg); dealt += r.dealt; killed ||= r.killed; }
        break;
      }
      case 'detonate': {
        if (!target || !target.poison) break;
        const dmg = Math.min(target.hp, target.poison * mult);
        target.hp -= dmg;
        target.poison = 0;
        dealt += dmg;
        checkPhase(c, target);
        if (target.hp <= 0) { killed = true; log(c, `${target.name} burns away.`); }
        break;
      }
      case 'spread':
        if (target?.poison) for (const other of alive(c)) if (other !== target) other.poison += target.poison * mult;
        break;
    }
  }
  return { dealt, killed };
}

export function endTurn(c) {
  if (c.over) return;
  const kept = c.hand.filter(k => k.enchants.includes('bound'));
  c.discard.push(...c.hand.filter(k => !k.enchants.includes('bound')));
  c.hand = kept;
  if (c.player.weak > 0) c.player.weak--;
  if (c.player.frail > 0) c.player.frail--;
  if (c.tarnish > 0) c.tarnish--;

  for (const e of alive(c)) {
    e.block = 0;
    if (e.poison > 0) {
      const n = Math.min(e.hp, e.poison);
      e.hp -= n;
      e.poison--;
      log(c, `${e.name} takes ${n} poison.`);
      checkPhase(c, e);
      if (e.hp <= 0) { log(c, `${e.name} rots away.`); continue; }
    }
    for (const a of currentMove(e).actions) {
      if (e.hp <= 0) break; // bled out mid-turn
      switch (a.type) {
        case 'attack':
          for (let i = 0; i < (a.times || 1) && e.hp > 0; i++) {
            damagePlayer(c, e, a.amount);
            if (c.over) return;
            if (e.bleed > 0) {
              const n = Math.min(e.hp, e.bleed);
              e.hp -= n;
              log(c, `${e.name} bleeds for ${n}.`);
              checkPhase(c, e);
              if (e.hp <= 0) log(c, `${e.name} bleeds out.`);
            }
          }
          break;
        case 'block': e.block += e.frail > 0 ? Math.floor(a.amount * FRAIL_MULT) : a.amount; break;
        case 'buff': e[a.status] += a.amount; break;
        case 'debuff': c.player[a.status] += a.amount; break;
        case 'devour': case 'smudge': case 'tarnish': pestAction(c, e, a.type); break;
      }
    }
    if (e.weak > 0) e.weak--;
    if (e.bleed > 0) e.bleed--;
    if (e.frail > 0) e.frail--;
    e.moveIdx++;
  }

  if (!alive(c).length) { c.over = 'won'; return; }
  startPlayerTurn(c);
}
