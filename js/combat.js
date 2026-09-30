import { ENEMIES } from './data.js';
import { salvageRoll } from './crafting.js';

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// A fight. Mutates `run` (hp, maxHp, gold, deck, inventory) as things happen.
export function createCombat(run, enemyKeys, rng = Math.random, { hpMult = 1 } = {}) {
  const c = {
    run, rng,
    enemies: enemyKeys.map(key => {
      const e = ENEMIES[key];
      const hp = Math.round(e.hp * hpMult);
      return { key, name: e.name, hp, maxHp: hp, block: 0, poison: 0, weak: 0, strength: 0, moveIdx: 0 };
    }),
    hunger: {}, // card uid -> times cast this fight (Hungering)
    player: { block: 0, energy: 0, weak: 0, poison: 0, nextFree: false },
    drawPile: shuffle([...run.deck], rng),
    hand: [], discard: [], exhaust: [],
    swiftUsed: new Set(),
    turn: 0,
    log: [],
    over: null, // 'won' | 'lost'
  };
  log(c, `${c.enemies.map(e => e.name).join(' and ')} ${c.enemies.length > 1 ? 'block' : 'blocks'} your path.`);
  startPlayerTurn(c);
  return c;
}

const log = (c, msg) => c.log.push(msg);
const GROWS = new Set(['damage', 'damageAll', 'block', 'heal', 'poison']);
const alive = c => c.enemies.filter(e => e.hp > 0);

export function currentMove(enemy) {
  const moves = ENEMIES[enemy.key].moves;
  return moves[enemy.moveIdx % moves.length];
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
  if (c.player.poison > 0) {
    loseHp(c, c.player.poison, 'Poison');
    c.player.poison--;
    if (c.over) return;
  }
  draw(c, Math.max(0, c.run.handSize - c.hand.length));
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

export function effectiveCost(c, card) {
  if (c.player.nextFree) return 0;
  if (card.enchants.includes('swift') && !c.swiftUsed.has(card.uid)) return 0;
  return card.cost;
}

// Returns null if the card can be played, or a reason it can't.
export function canPlay(c, card) {
  if (c.over) return 'The fight is over.';
  if (effectiveCost(c, card) > c.player.energy) return 'Not enough mana.';
  if (card.hpCost && c.run.hp <= card.hpCost) return 'Not enough blood left to pay.';
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

  if (card.hpCost) loseHp(c, card.hpCost, 'blood price');

  let dealtTotal = 0, killed = false;
  const pierce = card.enchants.includes('piercing');
  const growth = card.enchants.includes('hungering') ? 2 * (c.hunger[card.uid] || 0) : 0;
  const apply = (scale) => {
    for (const e of card.effects) {
      const base = e.amount + (GROWS.has(e.type) ? growth : 0);
      const n = scale === 1 ? base : Math.max(1, Math.round(base * scale));
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
        case 'block': c.player.block += n; break;
        case 'draw': draw(c, n); break;
        case 'heal': c.run.hp = Math.min(c.run.maxHp, c.run.hp + n); break;
        case 'poison':
          if (!target || target.hp <= 0) target = alive(c)[0];
          if (target) target.poison += n;
          break;
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

  if (card.enchants.includes('hungering')) c.hunger[card.uid] = (c.hunger[card.uid] || 0) + 1;
  if (card.enchants.includes('hallowed')) c.player.block += 4;
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

  // Wear and tear.
  let broken = false;
  if (Number.isFinite(card.durability)) {
    card.durability--;
    if (card.durability <= 0) {
      broken = true;
      c.run.deck = c.run.deck.filter(k => k.uid !== card.uid);
      log(c, `${card.name} crumbles to nothing.`);
      if (c.rng() < 0.5) {
        const part = salvageRoll(card, c.rng);
        c.run.inventory[part] = (c.run.inventory[part] || 0) + 1;
        c.salvaged = [...(c.salvaged || []), part];
      }
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

export function endTurn(c) {
  if (c.over) return;
  const kept = c.hand.filter(k => k.enchants.includes('bound'));
  c.discard.push(...c.hand.filter(k => !k.enchants.includes('bound')));
  c.hand = kept;
  if (c.player.weak > 0) c.player.weak--;

  for (const e of alive(c)) {
    e.block = 0;
    if (e.poison > 0) {
      const n = Math.min(e.hp, e.poison);
      e.hp -= n;
      e.poison--;
      log(c, `${e.name} takes ${n} poison.`);
      if (e.hp <= 0) { log(c, `${e.name} rots away.`); continue; }
    }
    for (const a of currentMove(e).actions) {
      switch (a.type) {
        case 'attack':
          for (let i = 0; i < (a.times || 1); i++) {
            damagePlayer(c, e, a.amount);
            if (c.over) return;
          }
          break;
        case 'block': e.block += a.amount; break;
        case 'buff': e[a.status] += a.amount; break;
        case 'debuff': c.player[a.status] += a.amount; break;
      }
    }
    if (e.weak > 0) e.weak--;
    e.moveIdx++;
  }

  if (!alive(c).length) { c.over = 'won'; return; }
  startPlayerTurn(c);
}
