import {
  INK_COLORS, INK_MATERIALS, CARD_MATERIALS, ENCHANTMENTS, INGREDIENTS, RECIPES, RUN_PATH, ENEMIES, REPAIR_PRICE,
} from './data.js';
import { craftCard, validateBlueprint, describeCard, cardComponents } from './crafting.js';
import { createCombat, playCard, endTurn, canPlay, effectiveCost, currentMove } from './combat.js';
import {
  createRun, currentNode, advance, craftIntoDeck, salvageCard, rollRewards, applyRewards, rollShop,
} from './run.js';

const app = document.getElementById('app');
const bar = document.getElementById('bar');

let run = null;
let screen = 'title';
let combat = null;
let target = 0;
let rewards = null;
let shop = null;
let blueprint = null;
let notice = null; // { text, tone }
let salvageMode = false;

const emptyBlueprint = () => ({ cardMat: null, colors: [], inkMat: null, enchants: [] });

// ---------- helpers ----------

const pips = n => Array.from({ length: n }, () => '<i></i>').join('');

function durabilityLabel(card) {
  if (!Number.isFinite(card.durability)) return '<span class="dur perm" title="Permanent">Permanent</span>';
  const lost = card.maxDurability - card.durability;
  return `<span class="dur" title="${card.durability} casts left">${pips(card.durability)}<b>${pips(lost)}</b></span>`;
}

function sigil(colors) {
  const hues = colors.map(c => INK_COLORS[c].hue);
  const bg = hues.length === 1 ? hues[0] : `conic-gradient(${hues[0]} 0 50%, ${hues[1]} 0 100%)`;
  return `<span class="sigil" style="--ink:${bg}"></span>`;
}

function cardHtml(card, { cost = card.cost, disabled = false, action = '', extra = '' } = {}) {
  const mat = card.cardMat || 'starter';
  const lines = describeCard(card).map(l => `<li>${l}</li>`).join('');
  const ench = card.enchants.map(e => `<span class="tag" title="${ENCHANTMENTS[e].desc}">${ENCHANTMENTS[e].name}</span>`).join('');
  const inkLabel = card.inkMat ? `${INK_MATERIALS[card.inkMat].name} ink on ${CARD_MATERIALS[card.cardMat].name.toLowerCase()}` : 'Starter';
  const tag = action ? 'button' : 'div';
  return `<${tag} class="card mat-${mat}${card.recipeId ? ' named' : ''}${disabled ? ' disabled' : ''}" ${action} ${disabled && action ? 'aria-disabled="true"' : ''}>
    <span class="cost${cost < card.cost ? ' free' : ''}">${cost}</span>
    ${card.hpCost ? `<span class="blood" title="Costs ${card.hpCost} HP">${card.hpCost}</span>` : ''}
    <span class="cname">${card.name}</span>
    ${sigil(card.colors)}
    <ul class="ctext">${lines}</ul>
    ${card.flavor ? `<span class="flavor">${card.flavor}</span>` : ''}
    <span class="cfoot"><span class="tags">${ench}</span>${card.crafted ? durabilityLabel(card) : ''}</span>
    <span class="inklabel">${inkLabel}</span>
    ${extra}
  </${tag}>`;
}

function statusChips(s) {
  const out = [];
  if (s.block) out.push(`<span class="chip block">Block ${s.block}</span>`);
  if (s.poison) out.push(`<span class="chip poison">Poison ${s.poison}</span>`);
  if (s.weak) out.push(`<span class="chip weak">Weak ${s.weak}</span>`);
  if (s.strength) out.push(`<span class="chip str">Strength ${s.strength}</span>`);
  return out.join('');
}

function intentText(enemy) {
  return currentMove(enemy).actions.map(a => {
    switch (a.type) {
      case 'attack': {
        let n = a.amount + enemy.strength;
        if (enemy.weak) n = Math.floor(n * 0.75);
        return `<span class="intent atk">Attack ${n}${a.times ? ` × ${a.times}` : ''}</span>`;
      }
      case 'block': return '<span class="intent def">Defend</span>';
      case 'buff': return '<span class="intent buff">Empower</span>';
      case 'debuff': return `<span class="intent curse">Curse (${a.status})</span>`;
    }
  }).join('');
}

function bars(cur, max, cls = '') {
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  return `<span class="hpbar ${cls}"><span style="width:${pct}%"></span><em>${cur} / ${max}</em></span>`;
}

function ingredientCounts() {
  const counts = { ...run.inventory };
  const bp = blueprint;
  const used = [
    bp.cardMat && `mat_${bp.cardMat}`, bp.inkMat && `ink_${bp.inkMat}`,
    ...bp.colors.map(c => `color_${c}`), ...bp.enchants.map(e => `ench_${e}`),
  ].filter(Boolean);
  for (const id of used) counts[id]--;
  return counts;
}

// ---------- top bar ----------

function renderBar() {
  if (!run) { bar.hidden = true; return; }
  bar.hidden = false;
  const path = RUN_PATH.map((n, i) => {
    const state = i < run.nodeIdx ? 'done' : i === run.nodeIdx ? 'here' : '';
    const kind = n.boss ? 'boss' : n.elite ? 'elite' : n.type;
    return `<li class="${state} k-${kind}" title="${n.label}"><span>${n.label}</span></li>`;
  }).join('');
  bar.innerHTML = `
    <span class="brand">SpellCrafter</span>
    <ol class="path" aria-label="Your path">${path}</ol>
    <span class="stats">
      <span class="stat hp" title="Health">HP <b>${run.hp}/${run.maxHp}</b></span>
      <span class="stat gold" title="Gold">Gold <b>${run.gold}</b></span>
      <span class="stat deck" title="Cards in deck">Deck <b>${run.deck.length}</b></span>
    </span>`;
}

// ---------- screens ----------

function renderTitle() {
  app.innerHTML = `
  <section class="title-screen">
    <h1>SpellCrafter</h1>
    <p class="lede">The old gods wrote the world into being. When they died, their pens fell to the rest of us.</p>
    <p>You are an <strong>Inkbinder</strong>. What you write on a card becomes true, for as long as the card holds together.
    Ink is mixed from ash, silver, gold and blood. Cards are cut from paper, wood, stone and precious metal.
    Every spell you cast wears its page down.</p>
    <p>Somewhere past the chapel ruins, the first book has woken. It wants a new hand to hold it.</p>
    <ul class="howto">
      <li><b>Craft</b> at the bench: card material + ink color + ink material + enchantments.</li>
      <li><b>Fight</b> with the deck you've built. Cheap cards break. Permanent ones are worth the price.</li>
      <li><b>Scavenge</b> ingredients from what you kill, buy them, or salvage old cards.</li>
    </ul>
    <button class="primary" data-act="begin">Begin the run</button>
  </section>`;
}

function renderBench() {
  const counts = ingredientCounts();
  const groups = [
    ['cardMat', 'Card material', CARD_MATERIALS, 'mat_'],
    ['color', 'Ink color', INK_COLORS, 'color_'],
    ['inkMat', 'Ink material', INK_MATERIALS, 'ink_'],
    ['enchant', 'Enchantments', ENCHANTMENTS, 'ench_'],
  ];
  const satchel = groups.map(([kind, label, table, prefix]) => {
    const items = Object.keys(table).filter(k => (run.inventory[prefix + k] || 0) > 0).map(k => {
      const id = prefix + k;
      const left = counts[id] ?? 0;
      const sel = isSelected(kind, k);
      const swatch = kind === 'color' ? `<span class="swatch" style="--ink:${INK_COLORS[k].hue}"></span>` : '';
      return `<button class="ing k-${kind} m-${k}${sel ? ' sel' : ''}" data-act="pick" data-kind="${kind}" data-key="${k}" ${left <= 0 && !sel ? 'disabled' : ''} title="${table[k].desc}">
        ${swatch}<span>${INGREDIENTS[id].name}</span><b>${left}</b></button>`;
    }).join('');
    return `<div class="group"><h3>${label}</h3><div class="ings">${items || '<em class="none">None</em>'}</div></div>`;
  }).join('');

  const bp = blueprint;
  const slots = bp.cardMat ? CARD_MATERIALS[bp.cardMat].slots : 0;
  const slot = (label, val, kind, key) => `<button class="slot${val ? ' filled' : ''}" data-act="unpick" data-kind="${kind}" data-key="${key || ''}" ${val ? '' : 'disabled'}>
      <small>${label}</small><span>${val || 'Empty'}</span></button>`;
  const colorSlots = [0, 1].map(i => slot(i === 0 ? 'Ink color' : 'Mix a 2nd ink', bp.colors[i] && INK_COLORS[bp.colors[i]].name, 'color', bp.colors[i])).join('');
  const enchSlots = Array.from({ length: slots }, (_, i) => slot('Enchantment', bp.enchants[i] && ENCHANTMENTS[bp.enchants[i]].name, 'enchant', bp.enchants[i])).join('');

  const err = validateBlueprint(bp, run.inventory);
  let preview;
  if (!validateBlueprint(bp)) {
    preview = cardHtml(craftCard(bp));
  } else {
    preview = `<div class="card ghost"><span>${err}</span></div>`;
  }

  const deck = run.deck.map(k => cardHtml(k, {
    action: salvageMode ? `data-act="salvage" data-uid="${k.uid}"` : '',
    extra: salvageMode ? `<span class="salv">Salvage: ${[...new Set(cardComponents(k))].map(id => INGREDIENTS[id].name).join(', ')}</span>` : '',
  })).join('');

  const grimoire = RECIPES.map(r => run.grimoire.has(r.id)
    ? `<li class="known"><b>${r.name}</b> ${r.match.colors.map(c => INK_COLORS[c].short).join(' + ')} ink, ${INK_MATERIALS[r.match.inkMat].name}, ${CARD_MATERIALS[r.match.cardMat].name}</li>`
    : `<li><b>Unknown spell</b> <i>${r.hint}</i></li>`).join('');

  app.innerHTML = `
  <section class="bench">
    <header class="screen-head">
      <h2>The Crafting Bench</h2>
      <p>Pick ingredients from your satchel to fill the card. The preview updates as you go.</p>
    </header>
    <div class="bench-grid">
      <div class="panel satchel"><h3 class="panel-title">Satchel</h3>${satchel}</div>
      <div class="panel blueprint">
        <h3 class="panel-title">Blueprint</h3>
        ${slot('Card material', bp.cardMat && CARD_MATERIALS[bp.cardMat].name + ' card', 'cardMat', bp.cardMat)}
        ${colorSlots}
        ${slot('Ink material', bp.inkMat && INK_MATERIALS[bp.inkMat].name + ' ink', 'inkMat', bp.inkMat)}
        ${enchSlots}
        ${bp.cardMat && !slots ? '<p class="note">Paper can’t hold enchantments.</p>' : ''}
      </div>
      <div class="panel preview">
        <h3 class="panel-title">Preview</h3>
        ${preview}
        <button class="primary" data-act="craft" ${err ? 'disabled' : ''}>Inscribe card</button>
      </div>
    </div>
    ${notice ? `<p class="notice ${notice.tone || ''}" role="status">${notice.text}</p>` : ''}
    <div class="panel grimoire"><h3 class="panel-title">Grimoire</h3><ul>${grimoire}</ul></div>
    <div class="panel deckview">
      <div class="deckhead">
        <h3 class="panel-title">Your deck (${run.deck.length})</h3>
        <button data-act="toggleSalvage" ${run.salvagedHere ? 'disabled' : ''}>${salvageMode ? 'Cancel salvage' : run.salvagedHere ? 'Salvaged' : 'Salvage a card'}</button>
      </div>
      ${salvageMode ? '<p class="note">Pick a card to break down. You get back one of its ingredients at random.</p>' : ''}
      <div class="cards">${deck}</div>
    </div>
    <footer class="screen-foot"><button class="primary" data-act="leave">Leave the bench</button></footer>
  </section>`;
}

function isSelected(kind, key) {
  const bp = blueprint;
  if (kind === 'cardMat') return bp.cardMat === key;
  if (kind === 'inkMat') return bp.inkMat === key;
  if (kind === 'color') return bp.colors.includes(key);
  return bp.enchants.includes(key);
}

function renderFight() {
  const c = combat;
  const enemies = c.enemies.map((e, i) => {
    const dead = e.hp <= 0;
    const def = ENEMIES[e.key];
    return `<button class="enemy${dead ? ' dead' : ''}${i === target && !dead ? ' targeted' : ''}${def.boss ? ' boss' : def.elite ? ' elite' : ''}" data-act="target" data-idx="${i}" ${dead ? 'disabled' : ''}>
      <span class="ename">${e.name}</span>
      <span class="edesc">${def.desc}</span>
      ${dead ? '<span class="intent">Unwritten</span>' : `<span class="intents">${intentText(e)}</span>`}
      ${bars(Math.max(0, e.hp), e.maxHp)}
      <span class="chips">${statusChips(e)}</span>
    </button>`;
  }).join('');

  const hand = c.hand.map(k => {
    const why = canPlay(c, k);
    return cardHtml(k, { cost: effectiveCost(c, k), disabled: !!why, action: `data-act="play" data-uid="${k.uid}" title="${why || 'Cast'}"` });
  }).join('');

  const mana = Array.from({ length: Math.max(run.energy, c.player.energy) }, (_, i) => `<i class="${i < c.player.energy ? 'on' : ''}"></i>`).join('');
  const recent = c.log.slice(-7).map(l => `<li>${l}</li>`).join('');

  app.innerHTML = `
  <section class="fight">
    <p class="fight-title">${currentNode(run).label}</p>
    <div class="enemies">${enemies}</div>
    <div class="table">
      <div class="panel player">
        <span class="pname">The Inkbinder</span>
        ${bars(run.hp, run.maxHp, 'you')}
        <span class="chips">${statusChips(c.player)}${c.player.nextFree ? '<span class="chip free">Next card free</span>' : ''}</span>
        <span class="mana" title="Mana: ${c.player.energy}">${mana}<em>${c.player.energy} mana</em></span>
        <span class="piles">Draw ${c.drawPile.length} · Discard ${c.discard.length}${c.exhaust.length ? ` · Exhausted ${c.exhaust.length}` : ''} · Turn ${c.turn}</span>
      </div>
      <ol class="panel log" aria-live="polite">${recent}</ol>
    </div>
    <div class="hand">${hand || '<p class="none">Your hand is empty.</p>'}</div>
    <footer class="screen-foot"><button class="primary" data-act="endTurn">End turn</button></footer>
  </section>`;
}

function renderRewards() {
  const r = rewards;
  const items = r.items.map(id => `<li class="loot r-${INGREDIENTS[id].rarity}">${INGREDIENTS[id].name}</li>`).join('');
  const salv = (r.salvaged || []).map(id => `<li class="loot">${INGREDIENTS[id].name} <small>(from a broken card)</small></li>`).join('');
  app.innerHTML = `
  <section class="rewards center">
    <h2>The page falls silent</h2>
    <p>You search what's left.</p>
    <ul class="loots">${items}${salv}${r.gold ? `<li class="loot gold">${r.gold} gold</li>` : ''}</ul>
    ${!items && !salv && !r.gold ? '<p>Nothing worth keeping.</p>' : ''}
    <button class="primary" data-act="next">Continue</button>
  </section>`;
}

function renderShop() {
  const stock = shop.map((s, i) => `<button class="ware r-${INGREDIENTS[s.id].rarity}" data-act="buy" data-idx="${i}" ${s.sold || run.gold < s.price ? 'disabled' : ''}>
      <span>${INGREDIENTS[s.id].name}</span><small>${INGREDIENTS[s.id].rarity}</small><b>${s.sold ? 'Sold' : s.price + ' gold'}</b></button>`).join('');
  const worn = run.deck.filter(k => Number.isFinite(k.durability) && k.durability < k.maxDurability);
  const repairs = worn.map(k => cardHtml(k, {
    action: `data-act="repair" data-uid="${k.uid}"`, disabled: run.gold < REPAIR_PRICE,
    extra: `<span class="salv">Repair: ${REPAIR_PRICE} gold</span>`,
  })).join('');
  app.innerHTML = `
  <section class="shop">
    <header class="screen-head">
      <h2>The Rag Merchant</h2>
      <p>“Ink, pages, the odd whisper bottled in wax. Coin first.”</p>
    </header>
    ${notice ? `<p class="notice ${notice.tone || ''}" role="status">${notice.text}</p>` : ''}
    <div class="panel"><h3 class="panel-title">Wares</h3><div class="wares">${stock}</div></div>
    <div class="panel"><h3 class="panel-title">Repairs</h3>
      ${repairs ? `<div class="cards">${repairs}</div>` : '<p class="none">None of your cards are worn.</p>'}
    </div>
    <footer class="screen-foot"><button class="primary" data-act="next">Move on</button></footer>
  </section>`;
}

function renderEnd(won) {
  app.innerHTML = `
  <section class="end center">
    <h2>${won ? 'The Grimoire is closed' : 'Your ink runs dry'}</h2>
    <p>${won
      ? 'The first book falls still in your hands. Its pages are blank now, waiting. You could write anything.'
      : `You fell at ${currentNode(run).label}. Another Inkbinder will find your cards in the dust.`}</p>
    <p class="note">Cards in deck: ${run.deck.length} · Spells discovered: ${run.grimoire.size} of ${RECIPES.length}</p>
    <button class="primary" data-act="restart">Begin a new run</button>
  </section>`;
}

function render() {
  renderBar();
  switch (screen) {
    case 'title': renderTitle(); break;
    case 'bench': renderBench(); break;
    case 'fight': renderFight(); break;
    case 'rewards': renderRewards(); break;
    case 'shop': renderShop(); break;
    case 'won': renderEnd(true); break;
    case 'lost': renderEnd(false); break;
  }
}

// ---------- flow ----------

function enterNode() {
  const node = currentNode(run);
  notice = null;
  salvageMode = false;
  if (!node) { screen = 'won'; return; }
  if (node.type === 'bench') { blueprint = emptyBlueprint(); screen = 'bench'; }
  else if (node.type === 'shop') { shop = rollShop(); screen = 'shop'; }
  else if (node.type === 'fight') { combat = createCombat(run, node.enemies); target = 0; screen = 'fight'; }
}

function afterCombatAction() {
  if (!combat.over) {
    if (combat.enemies[target]?.hp <= 0) target = combat.enemies.findIndex(e => e.hp > 0);
    return;
  }
  if (combat.over === 'lost') { screen = 'lost'; return; }
  const node = currentNode(run);
  if (node.boss) { screen = 'won'; return; }
  rewards = rollRewards(node.enemies, node);
  rewards.salvaged = combat.salvaged;
  applyRewards(run, rewards);
  screen = 'rewards';
}

const actions = {
  begin() { run = createRun(); enterNode(); },
  restart() { run = null; screen = 'title'; },
  pick({ kind, key }) {
    const bp = blueprint;
    notice = null;
    if (kind === 'cardMat') {
      bp.cardMat = bp.cardMat === key ? null : key;
      bp.enchants = bp.enchants.slice(0, bp.cardMat ? CARD_MATERIALS[bp.cardMat].slots : 0);
    } else if (kind === 'inkMat') bp.inkMat = bp.inkMat === key ? null : key;
    else if (kind === 'color') {
      if (bp.colors.includes(key)) bp.colors = bp.colors.filter(c => c !== key);
      else if (bp.colors.length < 2) bp.colors.push(key);
      else notice = { text: 'You can mix at most two inks.', tone: 'warn' };
    } else {
      const slots = bp.cardMat ? CARD_MATERIALS[bp.cardMat].slots : 0;
      if (bp.enchants.includes(key)) bp.enchants = bp.enchants.filter(e => e !== key);
      else if (!bp.cardMat) notice = { text: 'Choose a card material first. It decides how many enchantments fit.', tone: 'warn' };
      else if (bp.enchants.length < slots) bp.enchants.push(key);
      else notice = { text: `${CARD_MATERIALS[bp.cardMat].name} holds only ${slots} enchantment${slots === 1 ? '' : 's'}.`, tone: 'warn' };
    }
  },
  unpick({ kind, key }) { actions.pick({ kind, key }); },
  craft() {
    const r = craftIntoDeck(run, blueprint);
    if (r.error) { notice = { text: r.error, tone: 'warn' }; return; }
    notice = r.discovered
      ? { text: `A true name surfaces: you discovered ${r.card.name}. It is written in your Grimoire.`, tone: 'rare' }
      : { text: `${r.card.name} added to your deck.` };
    blueprint = emptyBlueprint();
  },
  toggleSalvage() { salvageMode = !salvageMode; notice = null; },
  salvage({ uid }) {
    const r = salvageCard(run, uid);
    salvageMode = false;
    notice = r.error ? { text: r.error, tone: 'warn' } : { text: `The card comes apart. You recover ${INGREDIENTS[r.part].name}.` };
  },
  leave() { advance(run); enterNode(); },
  next() { advance(run); enterNode(); },
  target({ idx }) { target = +idx; },
  play({ uid }) {
    const err = playCard(combat, uid, target);
    if (!err) afterCombatAction();
  },
  endTurn() { endTurn(combat); afterCombatAction(); },
  buy({ idx }) {
    const s = shop[+idx];
    if (s.sold || run.gold < s.price) return;
    run.gold -= s.price;
    run.inventory[s.id] = (run.inventory[s.id] || 0) + 1;
    s.sold = true;
    notice = { text: `Bought ${INGREDIENTS[s.id].name}.` };
  },
  repair({ uid }) {
    const k = run.deck.find(c => c.uid === uid);
    if (!k || run.gold < REPAIR_PRICE) return;
    run.gold -= REPAIR_PRICE;
    k.durability = k.maxDurability;
    notice = { text: `${k.name} is restored.` };
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  fn({ ...el.dataset });
  render();
});

document.addEventListener('keydown', e => {
  if (screen === 'fight' && (e.key === 'e' || e.key === 'E') && !e.target.closest('input,textarea')) {
    actions.endTurn(); render();
  }
});

// exposed for debugging in the console
window.spellcrafter = { get run() { return run; }, get combat() { return combat; } };

render();
