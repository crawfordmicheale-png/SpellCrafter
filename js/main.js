import {
  INK_COLORS, INK_MATERIALS, CARD_MATERIALS, ENCHANTMENTS, INGREDIENTS, RECIPES, ENEMIES, REPAIR_PRICE,
  REGIONS, REFINING, RAW_MATERIALS, LANTERN, EVENTS, RELICS, REACTIONS, VARIANTS, CORRUPTION, PRISTINE, HINTS,
} from './data.js';
import { resolveEvent } from './events.js';
import { loadMeta, saveMeta, learn, recordRun, forget, loadSoundPref, saveSoundPref, saveRunText, loadRunText, clearRun } from './meta.js';
import { unlock, sfx, setEnabled, isEnabled, startAmbient, stopAmbient } from './audio.js';
import { spriteURL, glyphURL } from './sprites.js';
import { craftCard, validateBlueprint, describeCard, cardComponents, wearName } from './crafting.js';
import { createCombat, playCard, endTurn, canPlay, effectiveCost, currentMove, previewReaction } from './combat.js';
import {
  createRun, currentRegion, descend, craftIntoDeck, salvageCard, rollRewards, applyRewards, rollShop,
  refine, canRefine, reinscribe, mend, rest, scavenge, openChest, burnCard, burnValue, resurface,
  gainRelic, relicChoices, hasRelic, serializeRun, deserializeRun, isUnlocked, oilMax, corruptionState,
} from './run.js';
import { step, findPath, objectAt, BLOCKING } from './world.js';
import { createExploreView, objectName } from './explore-view.js';

const app = document.getElementById('app');
const bar = document.getElementById('bar');

let run = null;
let screen = 'title';
let combat = null;
let fightCtx = null; // { kind: 'random' | 'elite' | 'boss', obj }
let target = 0;
let rewards = null;
let desk = null;      // the desk object being used
let merchant = null;  // the merchant object being visited
let benchTab = 'inscribe';
let blueprint = null;
let notice = null;    // { text, tone }
let salvageMode = false;
let exploreLog = [];
let view = null;      // canvas view while exploring
let walkPath = null;
let walkTimer = 0;
let lastStepAt = 0;
let standingOn = null;
let eventCtx = null;  // { obj, id, result }
let lastScreen = null;
let forgetArmed = false;
let abandonArmed = false;
let meta = loadMeta();
let selectedVariant = VARIANTS[meta.lastVariant] && isUnlocked(meta, meta.lastVariant) ? meta.lastVariant : 'inkbinder';
setEnabled(loadSoundPref());

const STEP_MS = 85;
const emptyBlueprint = () => ({ cardMat: null, colors: [], inkMat: null, enchants: [], pristine: false });
const itemName = id => INGREDIENTS[id].name;
const listItems = ids => {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return Object.entries(counts).map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ''}`).join(', ');
};

// ---------- card rendering ----------

const pips = n => Array.from({ length: n }, () => '<i></i>').join('');

function durabilityLabel(card) {
  if (!Number.isFinite(card.durability)) return '<span class="dur perm" title="Permanent">Permanent</span>';
  const lost = card.maxDurability - card.durability;
  return `<span class="dur" title="${card.durability} casts left">${pips(card.durability)}<b>${pips(lost)}</b></span>`;
}

function sigil(colors) {
  const imgs = colors.map(c => `<img class="px" src="${glyphURL(c)}" alt="">`).join('');
  return `<span class="sigil${colors.length > 1 ? ' two' : ''}" title="${colors.map(c => INK_COLORS[c].name).join(' + ')}">${imgs}</span>`;
}

const portrait = (name, cls = '', swap) => `<img class="px portrait ${cls}" src="${spriteURL(name, swap ? { swap } : undefined)}" alt="">`;
const playerSwap = () => VARIANTS[run?.variant || selectedVariant]?.swap;
const relicIcon = id => `<span class="relic" title="${RELICS[id].name}: ${RELICS[id].desc}">${portrait(`relic_${id}`)}</span>`;
const relicCard = (id, act = '') => `<button class="reliccard" ${act}>${portrait(`relic_${id}`, 'relicart')}<b>${RELICS[id].name}</b><span>${RELICS[id].desc}</span></button>`;
const inkPair = key => key.split('+').map(c => `<img class="px inkpip" src="${glyphURL(c)}" alt="${INK_COLORS[c].short}">`).join('');

function cardHtml(card, { cost = card.cost, disabled = false, action = '', extra = '', cls = '' } = {}) {
  const mat = card.cardMat || 'starter';
  const lines = describeCard(card).map(l => `<li>${l}</li>`).join('');
  const worn = wearName(card);
  const ench = card.enchants.map(e => `<span class="tag" title="${ENCHANTMENTS[e].desc}">${ENCHANTMENTS[e].name}</span>`).join('')
    + (worn ? `<span class="tag worn" title="Cast ${card.casts} times">${worn}</span>` : '')
    + (card.corrupts ? '<span class="tag corrupt" title="+1 Corruption each cast">Corrupting</span>' : '');
  const inkLabel = card.inkMat ? `${INK_MATERIALS[card.inkMat].name} ink on ${CARD_MATERIALS[card.cardMat].name.toLowerCase()}` : 'Starter';
  const tag = action ? 'button' : 'div';
  // Wordy cards get a compact layout so their text stays on the card.
  const dense = describeCard(card).length + (card.flavor ? 1 : 0) >= 4;
  return `<${tag} class="card mat-${mat}${card.recipeId ? ' named' : ''}${dense ? ' dense' : ''}${card.pristine ? ' pristine' : ''}${disabled ? ' disabled' : ''}${cls ? ` ${cls}` : ''}" ${action} ${disabled && action ? 'aria-disabled="true"' : ''}>
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

// ---------- top bar ----------

const soundButton = () => `<button class="soundtoggle" data-act="sound" aria-pressed="${isEnabled()}" title="Sound on or off">${isEnabled() ? 'Sound on' : 'Sound off'}</button>`;

function renderBar() {
  bar.hidden = false;
  if (!run) { bar.innerHTML = `<span class="brand">SpellCrafter</span><span class="spacer"></span>${soundButton()}`; return; }
  const depth = REGIONS.map((r, i) => `<li class="${i < run.regionIdx ? 'done' : i === run.regionIdx ? 'here' : ''}${i === REGIONS.length - 1 ? ' k-boss' : ''}" title="${r.name}"></li>`).join('');
  bar.innerHTML = `
    <span class="brand">SpellCrafter</span>
    <span class="where"><ol class="path" aria-label="Depth">${depth}</ol><span>${currentRegion(run).name}</span></span>
    <span class="stats">
      <span class="stat hp" title="Health">HP <b>${run.hp}/${run.maxHp}</b></span>
      <span class="stat gold" title="Gold">Gold <b>${run.gold}</b></span>
      <span class="stat deck" title="Cards in deck">Deck <b>${run.deck.length}</b></span>
      <span class="stat dread" title="Dread rises as you wander. Monsters find you more often.">Dread <b>${run.dread}</b></span>
      ${run.corruption ? `<span class="stat corruption" title="Corruption ${run.corruption}. Tainted at ${CORRUPTION.tainted}: Black and Blood cards +${CORRUPTION.taintBonus}, but you start fights Weak. Forsaken at ${CORRUPTION.forsaken}: forbidden recipes open, but enemies gain Strength.">Corruption <b>${run.corruption}${corruptionState(run) ? ` · ${corruptionState(run)}` : ''}</b></span>` : ''}
    </span>
    ${run.relics.length ? `<span class="relics">${run.relics.map(relicIcon).join('')}</span>` : ''}
    ${soundButton()}`;
}

// ---------- title ----------

function renderTitle() {
  app.innerHTML = `
  <section class="title-screen">
    <div class="title-art" aria-hidden="true">${portrait('player', 'hero', playerSwap())}</div>
    <h1>SpellCrafter</h1>
    <p class="lede">The old gods wrote the world into being. When they died, their pens fell to the rest of us.</p>
    <p>You are an <strong>Inkbinder</strong>. What you write on a card becomes true, for as long as the card holds together.
    Ink is mixed from ash, silver, gold and blood. Cards are cut from paper, wood, stone and precious metal.
    Every spell you cast wears its page down.</p>
    <p>${['One', 'Two', 'Three', 'Four', 'Five'][REGIONS.length - 1]} floors down, beneath the chapel, the first book has woken. It wants a new hand to hold it.</p>
    <ul class="howto">
      <li><b>Explore</b> by tapping a tile, or with WASD or the arrow keys. Your lantern only reaches so far.</li>
      <li><b>Scavenge</b> raw materials. The longer you wander, the more Dread builds, and the more often things find you.</li>
      <li><b>Mind your lantern.</b> Oil burns down slowly. Feed it a card, or climb back to the surface to refill it.</li>
      <li><b>Refine and craft</b> at writing desks. Monster parts become enchantments.</li>
    </ul>
    <h3 class="section-title">Choose your Inkbinder</h3>
    <div class="variants">${Object.entries(VARIANTS).map(([id, v]) => {
      const open = isUnlocked(meta, id);
      return `<button class="variant${id === selectedVariant ? ' sel' : ''}${open ? '' : ' locked'}" data-act="pickVariant" data-id="${id}" ${open ? '' : 'disabled'} aria-pressed="${id === selectedVariant}">
        ${portrait('player', 'varart', v.swap)}<b>${v.name}</b><span>${open ? v.desc : `Locked. ${v.unlock.text}.`}</span></button>`;
    }).join('')}</div>
    <div class="title-actions">
      ${savedSummary() ? `<button class="primary" data-act="continue">Continue: ${savedSummary()}</button>
        <button data-act="begin">${abandonArmed ? 'Tap again to abandon it and start over' : 'New run'}</button>`
        : '<button class="primary" data-act="begin">Descend into the chapel</button>'}
      <button data-act="codex">Your Grimoire (${meta.grimoire.length} of ${RECIPES.length})</button>
    </div>
    ${meta.runs ? `<p class="note">Runs: ${meta.runs} · Victories: ${meta.wins} · Deepest: ${meta.deepest >= 0 ? REGIONS[meta.deepest].name : 'none'}</p>` : ''}
  </section>`;
}

function savedSummary() {
  const text = loadRunText();
  if (!text) return null;
  try {
    const { run: r } = JSON.parse(text);
    return `${REGIONS[r.regionIdx].name}, ${r.hp}/${r.maxHp} HP`;
  } catch { return null; }
}

function renderCodex() {
  const known = new Set(meta.grimoire);
  const rows = RECIPES.map(r => {
    const card = craftCard({ colors: r.match.colors, inkMat: r.match.inkMat, cardMat: r.match.cardMat, enchants: r.match.enchants || [] }, { corruption: 99 });
    if (!known.has(r.id)) return `<li class="unknown${r.forbidden ? ' forbidden' : ''}"><div class="card ghost"><span>?</span></div><div><b>${r.forbidden ? 'Forbidden spell' : 'Unknown spell'}</b><p><i>${r.hint}</i></p>${r.forbidden ? `<p>Only an Inkbinder with ${CORRUPTION.forsaken} Corruption can write it.</p>` : ''}</div></li>`;
    const how = `${r.match.colors.map(c => INK_COLORS[c].name).join(' + ')}, ${INK_MATERIALS[r.match.inkMat].name} ink, ${CARD_MATERIALS[r.match.cardMat].name} card${r.match.enchants ? `, ${r.match.enchants.map(e => ENCHANTMENTS[e].part).join(', ')}` : ''}`;
    return `<li>${cardHtml(card)}<div><b>${r.name}</b><p>${how}</p></div></li>`;
  }).join('');
  app.innerHTML = `
  <section class="codex">
    <header class="screen-head">
      <h2>Your Grimoire</h2>
      <p>Every spell you discover is written here and stays known in every run after. ${meta.grimoire.length} of ${RECIPES.length} found.</p>
    </header>
    <ul class="codexlist">${rows}</ul>
    <h3 class="section-title">Ink reactions</h3>
    <p class="note">Cast an inscribed card right after one of a different ink, or cast a two-ink card, to set off the reaction for that pair. Starter cards do not react.</p>
    <ul class="reactlist">${Object.entries(REACTIONS).map(([k, r]) => `<li><span class="pair">${inkPair(k)}</span><b>${r.name}</b><span>${r.desc}</span></li>`).join('')}</ul>
    <h3 class="section-title">Relics</h3>
    <ul class="reliclist">${Object.keys(RELICS).map(id => `<li>${portrait(`relic_${id}`, 'relicart')}<div><b>${RELICS[id].name}</b><span>${RELICS[id].desc}</span></div></li>`).join('')}</ul>
    <footer class="screen-foot">
      <button class="danger" data-act="forget">${forgetArmed ? 'Tap again to erase your Grimoire and records' : 'Forget everything'}</button>
      <button class="primary" data-act="restart">Back</button>
    </footer>
  </section>`;
}

// ---------- explore ----------

function mountExplore() {
  const region = currentRegion(run);
  app.innerHTML = `
  <section class="explore">
    <div class="mapwrap">
      <canvas id="map" aria-label="Map of ${region.name}. Use arrow keys or WASD to move."></canvas>
      <span class="hover" id="hover" hidden></span>
    </div>
    <aside class="side" id="side"></aside>
  </section>`;
  view?.destroy();
  view = createExploreView(document.getElementById('map'), run.world, { onTile: walkTo, onHover: hover, playerSwap: playerSwap() });
  view.world = run.world;
}

function hover(x, y, e) {
  const el = document.getElementById('hover');
  if (!el) return;
  const o = x == null ? null : objectAt(run.world, x, y);
  if (!o || !run.world.seen[y * run.world.w + x]) { el.hidden = true; return; }
  const r = el.parentElement.getBoundingClientRect();
  el.textContent = objectName(o);
  el.style.left = `${e.clientX - r.left + 12}px`;
  el.style.top = `${e.clientY - r.top + 12}px`;
  el.hidden = false;
}

// ---------- first-run tips ----------

function hintHtml(id) {
  meta.hints ||= { seen: [], off: false };
  if (meta.hints.off || meta.hints.seen.includes(id)) return '';
  return `<div class="hint" role="note"><p>${HINTS[id]}</p>
    <div class="hint-acts"><button data-act="hintOk" data-id="${id}">Got it</button><button class="linkish" data-act="hintsOff">Turn off tips</button></div></div>`;
}

function exploreHint() {
  const exit = run.world.objects.find(o => o.type === 'exit' && o.guard);
  if (run.corruption >= 3) { const h = hintHtml('corruption'); if (h) return h; }
  if (run.oil < 30) { const h = hintHtml('lantern'); if (h) return h; }
  if (exit && run.world.seen[exit.y * run.world.w + exit.x]) { const h = hintHtml('guardian'); if (h) return h; }
  return hintHtml('explore');
}

function renderSide() {
  const side = document.getElementById('side');
  if (!side) return;
  const region = currentRegion(run);
  const raws = Object.keys(RAW_MATERIALS).filter(k => run.inventory[`raw_${k}`])
    .map(k => `<li><span class="swatch" style="--ink:${RAW_MATERIALS[k].color}"></span>${RAW_MATERIALS[k].name}<b>${run.inventory[`raw_${k}`]}</b></li>`).join('');
  const parts = Object.keys(ENCHANTMENTS).filter(k => run.inventory[`ench_${k}`])
    .map(k => `<li title="${ENCHANTMENTS[k].desc}">${ENCHANTMENTS[k].part} <small>${ENCHANTMENTS[k].name}</small><b>${run.inventory[`ench_${k}`]}</b></li>`).join('');
  const refined = Object.entries(run.inventory).filter(([id]) => /^(color|ink|mat)_/.test(id)).reduce((s, [, n]) => s + n, 0);
  let action = '';
  if (standingOn?.type === 'exit' && !standingOn.guard) {
    const next = REGIONS[run.regionIdx + 1];
    action = `<div class="prompt"><p>Stairs lead down into <b>${next.name}</b>. You cannot return to this floor.</p>
      <button class="primary" data-act="descend">Descend</button></div>`;
  } else if (standingOn?.type === 'up') {
    action = run.oil >= oilMax(run)
      ? '<div class="prompt"><p>Daylight, far above. Your lantern is full, so there is no reason to climb.</p></div>'
      : `<div class="prompt"><p>Climb to the surface and refill your lantern. The long way back down will cost you <b>${LANTERN.resurfaceDread} Dread</b>.</p>
        <button class="primary" data-act="resurface">Resurface</button></div>`;
  }
  const dreadPct = Math.min(100, run.dread / 2);
  const oilPct = (run.oil / oilMax(run)) * 100;
  const lanternNote = run.oil <= 0 ? 'Your lantern is out. Things find you twice as often.'
    : run.oil < 12 ? 'Your lantern is guttering.' : '';
  side.innerHTML = `
    ${exploreHint()}
    <h2>${region.name}</h2>
    <p class="intro">${region.intro}</p>
    ${action}
    <div class="meters">
      <div class="meter oil${run.oil < 12 ? ' low' : ''}" title="Lantern oil ${run.oil} of ${oilMax(run)}. Light radius ${run.world.radius}."><span style="width:${oilPct}%"></span><em>Lantern ${run.oil}</em></div>
      <button class="burn" data-act="openBurn" title="Burn a paper, wood or starter card for oil">Burn a card</button>
      <div class="meter dread" title="Dread ${run.dread}"><span style="width:${dreadPct}%"></span><em>Dread ${run.dread}</em></div>
    </div>
    ${lanternNote ? `<p class="warnline">${lanternNote}</p>` : ''}
    ${corruptionState(run) ? `<p class="warnline corrupt">${corruptionState(run) === 'Forsaken' ? 'You are Forsaken. Forbidden recipes answer you, and your enemies grow stronger.' : 'You are Tainted. Black and Blood cards hit harder, but you start every fight Weak.'}</p>` : ''}
    <ol class="elog" aria-live="polite">${exploreLog.slice(-5).map(l => `<li>${l}</li>`).join('')}</ol>
    <div class="satchel-mini">
      <h3 class="panel-title">Raw materials</h3>
      <ul>${raws || '<li class="none">Nothing yet</li>'}</ul>
      <h3 class="panel-title">Monster parts</h3>
      <ul>${parts || '<li class="none">Nothing yet</li>'}</ul>
      <p class="note">${refined} refined ingredients ready to craft.</p>
    </div>
    <ul class="legend">
      ${[['bone', 'Scavenge'], ['chest', 'Reliquary'], ['desk', 'Writing desk'], ['merchant', 'Merchant'],
        ['stairsDown', 'Stairs down'], ['stairsUp', 'To the surface']].map(([s, l]) => `<li>${portrait(s)}${l}</li>`).join('')}
    </ul>`;
}

function logExplore(msg) {
  exploreLog.push(msg);
  if (exploreLog.length > 30) exploreLog.shift();
}

function walkTo(x, y) {
  if (screen !== 'explore') return;
  const path = findPath(run.world, x, y);
  if (!path?.length) return;
  walkPath = path;
  if (!walkTimer) walkTick();
}

function walkTick() {
  walkTimer = 0;
  if (!walkPath?.length || screen !== 'explore') { walkPath = null; return; }
  const [nx, ny] = walkPath.shift();
  moveBy(nx - run.world.px, ny - run.world.py);
  if (walkPath?.length) walkTimer = setTimeout(walkTick, STEP_MS);
}

function moveBy(dx, dy) {
  const res = step(run.world, run, dx, dy);
  if (res.blocked) { walkPath = null; return; }
  if (!res.object || !BLOCKING.has(res.object.type)) sfx('step');
  if (res.encounter) sfx('encounter');
  standingOn = objectAt(run.world, run.world.px, run.world.py);
  if (res.object) { walkPath = null; interact(res.object); }
  else if (res.encounter) { walkPath = null; startFight(res.encounter, { kind: 'random' }); }
  if (screen === 'explore') { renderSide(); renderBar(); autosave(); }
  else render();
}

function interact(obj) {
  switch (obj.type) {
    case 'node': {
      const r = scavenge(run, obj);
      logExplore(`${r.pristine ? 'Pristine! ' : ''}You pick through the ${objectName(obj).toLowerCase()}: ${listItems(r.items)}.`);
      if (r.pristine) view?.float(obj.x, obj.y, 'Pristine Essence', '#bfe8ff');
      view?.float(obj.x, obj.y, `+${r.items.length} ${itemName(r.items[0])}`, '#e0b95c');
      view?.burst(obj.x, obj.y, r.pristine ? '#bfe8ff' : RAW_MATERIALS[obj.raw].color);
      sfx('pickup');
      standingOn = null;
      break;
    }
    case 'chest': {
      const r = openChest(run, obj);
      logExplore(`The reliquary opens: ${listItems(r.items)} and ${r.gold} gold.`);
      r.items.forEach(id => view?.float(obj.x, obj.y, itemName(id), '#e0b95c'));
      view?.float(obj.x, obj.y, `+${r.gold} gold`, '#f0d27a');
      view?.burst(obj.x, obj.y, '#e0b95c', 20);
      if (r.relic) {
        logExplore(`Beneath the rest, wrapped in cloth: ${RELICS[r.relic].name}. ${RELICS[r.relic].desc}`);
        view?.float(obj.x, obj.y, RELICS[r.relic].name, '#c3a2de');
        sfx('relic');
      } else sfx('chest');
      standingOn = null;
      break;
    }
    case 'desk':
      desk = obj; blueprint = emptyBlueprint(); benchTab = 'inscribe'; notice = null; salvageMode = false;
      run.salvagedHere = false;
      screen = 'bench';
      break;
    case 'merchant':
      merchant = obj; merchant.stock ||= rollShop(Math.random, run); notice = null;
      screen = 'shop';
      break;
    case 'elite':
      startFight([obj.enemy], { kind: 'elite', obj });
      break;
    case 'boss':
      startFight([obj.enemy], { kind: 'boss', obj });
      break;
    case 'exit':
      if (obj.guard) {
        logExplore(`${ENEMIES[obj.guard].name} stands between you and the stair.`);
        startFight([obj.guard], { kind: 'guardian', obj });
      } else logExplore('A stair winds down into the dark.');
      break;
    case 'up':
      logExplore('Far above, a square of grey daylight.');
      break;
    case 'event':
      eventCtx = { obj, id: obj.event, result: null };
      sfx('event');
      screen = 'event';
      break;
  }
}

function startFight(enemies, ctx) {
  fightCtx = { ...ctx, enemies };
  saveNow({ fight: { enemies, kind: ctx.kind, objId: ctx.obj?.id ?? null } });
  combat = createCombat(run, enemies, Math.random, { hpMult: currentRegion(run).hpMult });
  target = 0;
  screen = 'fight';
}

// ---------- bench ----------

function isSelected(kind, key) {
  const bp = blueprint;
  if (kind === 'cardMat') return bp.cardMat === key;
  if (kind === 'inkMat') return bp.inkMat === key;
  if (kind === 'color') return bp.colors.includes(key);
  if (kind === 'catalyst') return !!bp.pristine;
  return bp.enchants.includes(key);
}

function ingredientCounts() {
  const counts = { ...run.inventory };
  const bp = blueprint;
  const used = [
    bp.cardMat && `mat_${bp.cardMat}`, bp.inkMat && `ink_${bp.inkMat}`,
    ...bp.colors.map(c => `color_${c}`), ...bp.enchants.map(e => `ench_${e}`), bp.pristine && 'ess_pristine',
  ].filter(Boolean);
  for (const id of used) counts[id]--;
  return counts;
}

function inscribeTab() {
  const counts = ingredientCounts();
  const groups = [
    ['cardMat', 'Card material', CARD_MATERIALS, 'mat_'],
    ['color', 'Ink color', INK_COLORS, 'color_'],
    ['inkMat', 'Ink material', INK_MATERIALS, 'ink_'],
    ['enchant', 'Enchantments (monster parts)', ENCHANTMENTS, 'ench_'],
    ['catalyst', 'Catalyst', { pristine: { desc: `Makes the card Pristine: x${PRISTINE.mult} power.` } }, 'ess_'],
  ];
  const satchel = groups.map(([kind, label, table, prefix]) => {
    const items = Object.keys(table).filter(k => (run.inventory[prefix + k] || 0) > 0).map(k => {
      const id = prefix + k;
      const left = counts[id] ?? 0;
      const sel = isSelected(kind, k);
      const swatch = kind === 'color' ? `<span class="swatch" style="--ink:${INK_COLORS[k].hue}"></span>` : '';
      const text = kind === 'enchant' ? `${ENCHANTMENTS[k].part} <small>${ENCHANTMENTS[k].name}</small>` : itemName(id);
      if (kind === 'catalyst' && !(run.inventory[id] > 0)) return '';
      return `<button class="ing k-${kind} m-${k}${sel ? ' sel' : ''}" data-act="pick" data-kind="${kind}" data-key="${k}" ${left <= 0 && !sel ? 'disabled' : ''} title="${table[k].desc}">
        ${swatch}<span>${text}</span><b>${left}</b></button>`;
    }).join('');
    if (kind === 'catalyst' && !items) return '';
    return `<div class="group"><h3>${label}</h3><div class="ings">${items || '<em class="none">None. Refine raw materials or find some.</em>'}</div></div>`;
  }).join('');

  const bp = blueprint;
  const slots = bp.cardMat ? CARD_MATERIALS[bp.cardMat].slots : 0;
  const slot = (label, val, kind, key) => `<button class="slot${val ? ' filled' : ''}" data-act="pick" data-kind="${kind}" data-key="${key || ''}" ${val ? '' : 'disabled'}>
      <small>${label}</small><span>${val || 'Empty'}</span></button>`;
  const colorSlots = [0, 1].map(i => slot(i === 0 ? 'Ink color' : 'Mix a 2nd ink', bp.colors[i] && INK_COLORS[bp.colors[i]].name, 'color', bp.colors[i])).join('');
  const enchSlots = Array.from({ length: slots }, (_, i) => slot('Enchantment', bp.enchants[i] && ENCHANTMENTS[bp.enchants[i]].name, 'enchant', bp.enchants[i])).join('');

  const err = validateBlueprint(bp, run.inventory);
  const preview = !validateBlueprint(bp) ? cardHtml(craftCard(bp, { corruption: run.corruption })) : `<div class="card ghost"><span>${err}</span></div>`;

  const grimoire = RECIPES.map(r => run.grimoire.has(r.id)
    ? `<li class="known"><b>${r.name}</b> ${r.match.colors.map(c => INK_COLORS[c].short).join(' + ')} ink, ${INK_MATERIALS[r.match.inkMat].name}, ${CARD_MATERIALS[r.match.cardMat].name}${r.match.enchants ? `, ${r.match.enchants.map(e => ENCHANTMENTS[e].name).join(', ')}` : ''}</li>`
    : `<li><b>Unknown spell</b> <i>${r.hint}</i></li>`).join('');

  return `
    <div class="bench-grid">
      <div class="panel satchel"><h3 class="panel-title">Satchel</h3>${satchel}</div>
      <div class="panel blueprint">
        <h3 class="panel-title">Blueprint</h3>
        ${slot('Card material', bp.cardMat && CARD_MATERIALS[bp.cardMat].name + ' card', 'cardMat', bp.cardMat)}
        ${colorSlots}
        ${slot('Ink material', bp.inkMat && INK_MATERIALS[bp.inkMat].name + ' ink', 'inkMat', bp.inkMat)}
        ${enchSlots}
        ${bp.pristine ? slot('Catalyst', 'Pristine Essence', 'catalyst', 'pristine') : ''}
        ${bp.cardMat && !slots ? '<p class="note">Paper can’t hold enchantments.</p>' : ''}
      </div>
      <div class="panel preview">
        <h3 class="panel-title">Preview</h3>
        ${preview}
        <button class="primary" data-act="craft" ${err ? 'disabled' : ''}>Inscribe card</button>
      </div>
    </div>
    <div class="panel grimoire"><h3 class="panel-title">Grimoire (${run.grimoire.size} of ${RECIPES.length})</h3><ul>${grimoire}</ul></div>`;
}

function refineTab() {
  const rows = REFINING.map(r => {
    const err = canRefine(run, r);
    const from = r.hpCost ? `${r.hpCost} of your HP` : Object.entries(r.from).map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ''}`).join(' + ');
    const to = Object.entries(r.to).map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ''}`).join(', ');
    const haveRaw = r.hpCost || Object.keys(r.from).some(id => run.inventory[id]);
    if (!haveRaw) return '';
    return `<li class="${err ? 'off' : ''}${r.hpCost ? ' bleed' : ''}">
      <span class="from">${from}</span><span class="arrow" aria-hidden="true">→</span><span class="to">${to}</span>
      <button data-act="refine" data-id="${r.id}" ${err ? `disabled title="${err}"` : ''}>${r.hpCost ? 'Bleed' : 'Refine'}</button></li>`;
  }).join('');
  const raws = Object.keys(RAW_MATERIALS).filter(k => run.inventory[`raw_${k}`])
    .map(k => `<li><span class="swatch" style="--ink:${RAW_MATERIALS[k].color}"></span>${RAW_MATERIALS[k].name}<b>${run.inventory[`raw_${k}`]}</b></li>`).join('');
  return `
    <div class="refine-grid">
      <div class="panel"><h3 class="panel-title">Raw materials</h3><ul class="rawlist">${raws || '<li class="none">You carry nothing to refine.</li>'}</ul></div>
      <div class="panel"><h3 class="panel-title">Refining</h3>
        <p class="note">Silver and gold can become ink, or with two of them, a card. Blood can always be had, at a price.</p>
        <ul class="refines">${rows}</ul>
      </div>
    </div>`;
}

function deckTab() {
  const enchInv = Object.keys(ENCHANTMENTS).filter(k => run.inventory[`ench_${k}`]);
  const deck = run.deck.map(k => {
    const btns = [];
    if (salvageMode) btns.push(`<button data-act="salvage" data-uid="${k.uid}">Salvage</button>`);
    else {
      if (k.crafted && Number.isFinite(k.durability) && k.durability < k.maxDurability) {
        const mat = `mat_${k.cardMat}`;
        btns.push(`<button data-act="mend" data-uid="${k.uid}" ${run.inventory[mat] ? '' : `disabled title="Needs a ${itemName(mat)}"`}>Mend (1 ${itemName(mat)})</button>`);
      }
      if (k.crafted && k.enchants.length < CARD_MATERIALS[k.cardMat].slots) {
        for (const e of enchInv.filter(e => !k.enchants.includes(e))) {
          btns.push(`<button data-act="reinscribe" data-uid="${k.uid}" data-ench="${e}" title="${ENCHANTMENTS[e].desc}">+ ${ENCHANTMENTS[e].name}</button>`);
        }
      }
    }
    return `<div class="deckcard">${cardHtml(k, {
      extra: salvageMode ? `<span class="salv">Gives one of: ${[...new Set(cardComponents(k))].map(itemName).join(', ')}</span>` : '',
    })}<div class="cardacts">${btns.join('')}</div></div>`;
  }).join('');
  return `
    <div class="panel deckview">
      <div class="deckhead">
        <h3 class="panel-title">Your deck (${run.deck.length})</h3>
        <button data-act="toggleSalvage" ${run.salvagedHere ? 'disabled' : ''}>${salvageMode ? 'Cancel salvage' : run.salvagedHere ? 'Salvaged' : 'Salvage a card'}</button>
      </div>
      <p class="note">${salvageMode ? 'Pick a card to break down. You get back one of its ingredients at random.'
        : 'Add monster parts to cards with a free enchantment slot. Mend worn paper and wood with the same material.'}</p>
      <div class="cards">${deck}</div>
    </div>`;
}

function renderBench() {
  const tabs = [['inscribe', 'Inscribe'], ['refine', 'Refine'], ['deck', 'Deck']]
    .map(([id, label]) => `<button role="tab" aria-selected="${benchTab === id}" class="tab${benchTab === id ? ' on' : ''}" data-act="tab" data-tab="${id}">${label}</button>`).join('');
  const body = benchTab === 'refine' ? refineTab() : benchTab === 'deck' ? deckTab() : inscribeTab();
  app.innerHTML = `
  <section class="bench">
    ${hintHtml('desk')}
    <header class="screen-head bench-head">
      <div>
        <h2>The Writing Desk</h2>
        <p>A candle, a blotter, and a knife for cutting pages.</p>
      </div>
      <button data-act="rest" ${desk.rested || run.hp >= run.maxHp ? 'disabled' : ''} title="Heal 30% of your max HP and calm your Dread. Once per desk.">${desk.rested ? 'Rested' : 'Rest by the candle'}</button>
    </header>
    <div class="tabs" role="tablist">${tabs}</div>
    ${notice ? `<p class="notice ${notice.tone || ''}" role="status">${notice.text}</p>` : ''}
    ${body}
    <footer class="screen-foot"><button class="primary" data-act="toMap">Back to exploring</button></footer>
  </section>`;
}

// ---------- fight, rewards, shop, end ----------

function renderFight() {
  const c = combat;
  const enemies = c.enemies.map((e, i) => {
    const dead = e.hp <= 0;
    const def = ENEMIES[e.key];
    return `<button class="enemy${dead ? ' dead' : ''}${i === target && !dead ? ' targeted' : ''}${def.boss ? ' boss' : def.elite ? ' elite' : ''}" data-act="target" data-idx="${i}" ${dead ? 'disabled' : ''}>
      ${portrait(e.key, 'foe')}
      <span class="ename">${e.name}</span>
      <span class="edesc">${def.desc}</span>
      ${dead ? '<span class="intent">Unwritten</span>' : `<span class="intents">${intentText(e)}</span>`}
      ${bars(Math.max(0, e.hp), e.maxHp)}
      <span class="chips">${statusChips(e)}</span>
    </button>`;
  }).join('');

  const hand = c.hand.map(k => {
    const why = canPlay(c, k);
    const react = previewReaction(c, k);
    return cardHtml(k, {
      cost: effectiveCost(c, k), disabled: !!why, cls: react ? 'reacts' : '',
      action: `data-act="play" data-uid="${k.uid}" title="${why || (react ? `Cast. Sets off ${REACTIONS[react].name}: ${REACTIONS[react].desc}` : 'Cast')}"`,
      extra: react ? `<span class="reacttag">${REACTIONS[react].name}</span>` : '',
    });
  }).join('');
  const lastInk = c.lastColors ? `<span class="chip ink">Last ink ${c.lastColors.map(col => `<img class="px inkpip" src="${glyphURL(col)}" alt="${INK_COLORS[col].short}">`).join('')}</span>` : '';

  const mana = Array.from({ length: Math.max(run.energy, c.player.energy) }, (_, i) => `<i class="${i < c.player.energy ? 'on' : ''}"></i>`).join('');
  const recent = c.log.slice(-7).map(l => `<li>${l}</li>`).join('');
  const title = { random: 'Something finds you in the dark', elite: 'Something guards this room', guardian: 'The guardian of the stair', boss: 'The Last Library' }[fightCtx.kind];

  app.innerHTML = `
  <section class="fight">
    ${hintHtml('fight')}
    <p class="fight-title">${title}</p>
    <div class="enemies">${enemies}</div>
    <div class="table">
      <div class="panel player">
        <span class="pname">${portrait('player', 'me', playerSwap())}${VARIANTS[run.variant]?.name || 'The Inkbinder'}</span>
        ${bars(run.hp, run.maxHp, 'you')}
        <span class="chips">${statusChips(c.player)}${c.player.nextFree ? '<span class="chip free">Next card free</span>' : ''}${lastInk}</span>
        ${run.relics.length ? `<span class="relics">${run.relics.map(relicIcon).join('')}</span>` : ''}
        <span class="mana" title="Mana: ${c.player.energy}">${mana}<em>${c.player.energy} mana</em></span>
        <span class="piles">Draw ${c.drawPile.length} · Discard ${c.discard.length}${c.exhaust.length ? ` · Exhausted ${c.exhaust.length}` : ''} · Turn ${c.turn}</span>
      </div>
      <ol class="panel log" aria-live="polite">${recent}</ol>
    </div>
    <div class="hand">${hand || '<p class="none">Your hand is empty.</p>'}</div>
    <footer class="screen-foot"><span class="keyhint">E ends your turn</span><button class="primary" data-act="endTurn">End turn</button></footer>
  </section>`;
}

function renderRewards() {
  const r = rewards;
  const items = r.items.map(id => `<li class="loot r-${INGREDIENTS[id].rarity}">${itemName(id)}${INGREDIENTS[id].kind === 'enchant' ? ` <small>${ENCHANTMENTS[INGREDIENTS[id].key].name}</small>` : ''}</li>`).join('');
  const salv = (r.salvaged || []).map(id => `<li class="loot">${itemName(id)} <small>(from a broken card)</small></li>`).join('');
  app.innerHTML = `
  <section class="rewards center">
    <h2>The page falls silent</h2>
    <p>You search what's left.</p>
    <ul class="loots">${items}${salv}${r.gold ? `<li class="loot gold">${r.gold} gold</li>` : ''}${r.healed ? `<li class="loot heal">Chapel Candle: +${r.healed} HP</li>` : ''}</ul>
    ${!items && !salv && !r.gold ? '<p>Nothing worth keeping.</p>' : ''}
    ${r.relicChoices?.length && !r.relicTaken ? `
      <h3 class="section-title">The guardian kept something. Choose one.</h3>
      <div class="relicpick">${r.relicChoices.map(id => relicCard(id, `data-act="takeRelic" data-id="${id}"`)).join('')}</div>
      <button data-act="toMap">Leave them all</button>`
      : `${r.relicTaken ? `<p class="notice rare">You take the ${RELICS[r.relicTaken].name}.</p>` : ''}<button class="primary" data-act="toMap">Back to exploring</button>`}
  </section>`;
}

function renderShop() {
  const stock = merchant.stock.map((s, i) => s.relic
    ? `<button class="ware relicware" data-act="buy" data-idx="${i}" ${s.sold || run.gold < s.price || hasRelic(run, s.relic) ? 'disabled' : ''} title="${RELICS[s.relic].desc}">
      ${portrait(`relic_${s.relic}`, 'wareart')}<span>${RELICS[s.relic].name}</span><small>relic</small><b>${s.sold ? 'Sold' : s.price + ' gold'}</b></button>`
    : `<button class="ware r-${INGREDIENTS[s.id].rarity}" data-act="buy" data-idx="${i}" ${s.sold || run.gold < s.price ? 'disabled' : ''}>
      <span>${itemName(s.id)}</span><small>${INGREDIENTS[s.id].kind === 'raw' ? 'raw material' : INGREDIENTS[s.id].kind === 'enchant' ? ENCHANTMENTS[INGREDIENTS[s.id].key].name : INGREDIENTS[s.id].rarity}</small><b>${s.sold ? 'Sold' : s.price + ' gold'}</b></button>`).join('');
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
    <footer class="screen-foot"><button class="primary" data-act="toMap">Back to exploring</button></footer>
  </section>`;
}

function renderBurn() {
  const cards = run.deck.map(k => {
    const v = burnValue(k);
    const why = !v ? `${CARD_MATERIALS[k.cardMat].name} will not burn` : run.oil >= oilMax(run) ? 'Your lantern is full' : run.deck.length <= LANTERN.minDeck ? 'You cannot spare another card' : '';
    return cardHtml(k, {
      action: `data-act="burn" data-uid="${k.uid}" title="${why || `Burn for ${v} oil`}"`, disabled: !!why,
      extra: `<span class="salv">${v ? `+${v} oil` : 'Will not burn'}</span>`,
    });
  }).join('');
  app.innerHTML = `
  <section class="burnscreen">
    <header class="screen-head">
      <h2>Feed the Lantern</h2>
      <p>Paper and wood burn, and so do the starter cards. Stone and metal will not. Lantern oil: <b>${run.oil} / ${oilMax(run)}</b>.</p>
    </header>
    ${notice ? `<p class="notice ${notice.tone || ''}" role="status">${notice.text}</p>` : ''}
    <div class="panel"><div class="cards">${cards}</div></div>
    <footer class="screen-foot"><button class="primary" data-act="toMap">Back to exploring</button></footer>
  </section>`;
}

function renderEvent() {
  const ev = EVENTS[eventCtx.id];
  const r = eventCtx.result;
  const body = r
    ? `<p class="result">${r.text}</p>
       ${r.items?.length ? `<ul class="loots">${r.items.map(id => `<li class="loot r-${INGREDIENTS[id].rarity}">${itemName(id)}</li>`).join('')}</ul>` : ''}
       ${r.relic ? `<div class="relicpick">${relicCard(r.relic)}</div>` : ''}
       ${r.learned ? `<p class="notice rare">${RECIPES.find(x => x.id === r.learned).name} is now written in your Grimoire, for this run and every run after.</p>` : ''}
       <button class="primary" data-act="${r.fight ? 'eventFight' : 'toMap'}">${r.fight ? 'Face it' : 'Continue'}</button>`
    : `<ul class="choices">${ev.options.map(o => `<li><button data-act="choose" data-opt="${o.id}"><b>${o.label}</b>${o.desc ? `<span>${o.desc}</span>` : ''}</button></li>`).join('')}</ul>`;
  app.innerHTML = `
  <section class="event center">
    ${portrait(eventCtx.id, 'eventart')}
    <h2>${ev.name}</h2>
    <p class="lede">${ev.text}</p>
    ${body}
  </section>`;
}

function renderEnd(won) {
  app.innerHTML = `
  <section class="end center">
    <h2>${won ? 'The Grimoire is closed' : 'Your ink runs dry'}</h2>
    <p>${won
      ? 'The first book falls still in your hands. Its pages are blank now, waiting. You could write anything.'
      : `You fell in ${currentRegion(run).name}. Another Inkbinder will find your cards in the dust.`}</p>
    <p class="note">Cards in deck: ${run.deck.length} · New spells this run: ${meta.grimoire.length - run.startKnown} · Grimoire: ${meta.grimoire.length} of ${RECIPES.length}</p>
    <button class="primary" data-act="restart">Begin a new run</button>
  </section>`;
}

function render() {
  renderBar();
  if (screen !== 'explore' && view) { view.destroy(); view = null; }
  const changed = screen !== lastScreen;
  lastScreen = screen;
  switch (screen) {
    case 'title': renderTitle(); break;
    case 'explore':
      if (!view || view.world !== run.world || !document.getElementById('map')) mountExplore();
      renderSide();
      break;
    case 'bench': renderBench(); break;
    case 'fight': renderFight(); break;
    case 'rewards': renderRewards(); break;
    case 'shop': renderShop(); break;
    case 'won': renderEnd(true); break;
    case 'lost': renderEnd(false); break;
    case 'burn': renderBurn(); break;
    case 'event': renderEvent(); break;
    case 'codex': renderCodex(); break;
  }
  if (changed && screen !== 'explore') app.firstElementChild?.classList.add('enter');
  autosave();
}

// ---------- saving ----------

let saveTimer = 0;
function saveNow(extra = {}) {
  if (!run || ['won', 'lost', 'title', 'codex'].includes(screen) && !extra.fight) return;
  const resume = { log: exploreLog.slice(-5), ...extra };
  if (screen === 'fight' && !extra.fight && fightCtx) {
    resume.fight = { enemies: fightCtx.enemies, kind: fightCtx.kind, objId: fightCtx.obj?.id ?? null };
  }
  if (screen === 'event' && eventCtx && !eventCtx.result) resume.eventObjId = eventCtx.obj.id;
  if (screen === 'rewards' && rewards?.relicChoices?.length && !rewards.relicTaken) resume.relicChoices = rewards.relicChoices;
  try { saveRunText(serializeRun(run, resume)); } catch { /* ignore */ }
}
function autosave() {
  if (!run || screen === 'fight') return; // the fight was saved when it began
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(), 250);
}

// ---------- flow ----------

function afterCombatAction() {
  if (!combat.over) {
    if (combat.enemies[target]?.hp <= 0) target = combat.enemies.findIndex(e => e.hp > 0);
    return;
  }
  if (combat.over === 'lost') { endRun(false); return; }
  if (fightCtx.kind === 'boss') { endRun(true); return; }
  const big = fightCtx.kind === 'elite' || fightCtx.kind === 'guardian';
  if (fightCtx.kind === 'guardian') fightCtx.obj.guard = null; // the stairs stay, now open
  else if (fightCtx.obj) fightCtx.obj.gone = true;
  rewards = rollRewards(fightCtx.enemies, { elite: big, dice: hasRelic(run, 'dice') });
  if (big) rewards.relicChoices = relicChoices(run, 3);
  rewards.salvaged = combat.salvaged;
  applyRewards(run, rewards);
  logExplore(fightCtx.kind === 'guardian' ? `The ${ENEMIES[fightCtx.enemies[0]].name} falls. The stair is open.`
    : fightCtx.kind === 'elite' ? `The ${ENEMIES[fightCtx.enemies[0]].name} falls.` : 'You survive the encounter.');
  screen = 'rewards';
}

function endRun(won) {
  clearRun();
  recordRun(meta, { won, depth: run.regionIdx });
  stopAmbient();
  sfx(won ? 'win' : 'lose');
  screen = won ? 'won' : 'lost';
}

function noteDiscovery(r) {
  if (r.discovered) { learn(meta, r.card.recipeId); sfx('discover'); }
  else if (!r.error) sfx('craft');
}

const actions = {
  begin() {
    if (loadRunText() && !abandonArmed) { abandonArmed = true; return; }
    abandonArmed = false;
    clearRun();
    run = createRun(undefined, meta.grimoire, selectedVariant);
    meta.lastVariant = selectedVariant;
    saveMeta(meta);
    run.startKnown = meta.grimoire.length;
    startAmbient(0);
    sfx('descend');
    exploreLog = ['You light your lantern at the top of the stair. Tap a tile to walk there, or use WASD or the arrow keys.'];
    standingOn = objectAt(run.world, run.world.px, run.world.py);
    screen = 'explore';
  },
  restart() { run = null; forgetArmed = false; abandonArmed = false; stopAmbient(); screen = 'title'; },
  continue() {
    let loaded;
    try { loaded = deserializeRun(loadRunText()); } catch { clearRun(); return; }
    run = loaded.run;
    const res = loaded.resume || {};
    run.startKnown ??= meta.grimoire.length;
    for (const id of meta.grimoire) run.grimoire.add(id);
    exploreLog = res.log || ['You pick up where you left off.'];
    standingOn = objectAt(run.world, run.world.px, run.world.py);
    startAmbient(run.regionIdx);
    screen = 'explore';
    if (res.fight) {
      const obj = run.world.objects.find(o => o.id === res.fight.objId) || null;
      startFight(res.fight.enemies, { kind: res.fight.kind, obj });
      logExplore('The fight you fled from starts over.');
    } else if (res.eventObjId != null) {
      const obj = run.world.objects.find(o => o.id === res.eventObjId);
      if (obj && !obj.gone) { eventCtx = { obj, id: obj.event, result: null }; screen = 'event'; }
    } else if (res.relicChoices?.length) {
      rewards = { items: [], gold: 0, relicChoices: res.relicChoices };
      screen = 'rewards';
    }
  },
  takeRelic({ id }) {
    if (!rewards?.relicChoices?.includes(id) || rewards.relicTaken) return;
    gainRelic(run, id);
    rewards.relicTaken = id;
    sfx('relic');
    logExplore(`You take the ${RELICS[id].name}.`);
  },
  codex() { forgetArmed = false; screen = 'codex'; },
  hintOk({ id }) { meta.hints ||= { seen: [], off: false }; meta.hints.seen.push(id); saveMeta(meta); },
  hintsOff() { meta.hints ||= { seen: [], off: false }; meta.hints.off = true; saveMeta(meta); },
  pickVariant({ id }) { if (isUnlocked(meta, id)) { selectedVariant = id; sfx('click'); } },
  forget() {
    if (!forgetArmed) { forgetArmed = true; return; }
    meta = forget();
    forgetArmed = false;
  },
  sound() {
    setEnabled(!isEnabled());
    saveSoundPref(isEnabled());
    if (isEnabled()) { unlock(); if (run && !['won', 'lost'].includes(screen)) startAmbient(run.regionIdx); }
    else stopAmbient();
  },
  choose({ opt }) {
    const r = resolveEvent(run, eventCtx.id, opt);
    eventCtx.result = r;
    eventCtx.obj.gone = true;
    standingOn = null;
    if (r.relic) { gainRelic(run, r.relic); sfx('relic'); }
    else if (r.learned) { learn(meta, r.learned); sfx('discover'); }
    else if (r.items?.length) sfx('pickup');
    logExplore(`${EVENTS[eventCtx.id].name}: ${r.text}`);
  },
  eventFight() { sfx('encounter'); startFight(eventCtx.result.fight, { kind: 'random' }); },
  toMap() { notice = null; screen = 'explore'; },
  openBurn() { walkPath = null; notice = null; screen = 'burn'; },
  burn({ uid }) {
    const r = burnCard(run, uid);
    if (r.error) { notice = { text: r.error, tone: 'warn' }; return; }
    notice = { text: `${r.card.name} curls into the flame. +${r.oil} oil.` };
    sfx('burn');
    logExplore(`You burn ${r.card.name}. The light swells.`);
  },
  resurface() {
    const r = resurface(run);
    if (r.error) { logExplore(r.error); return; }
    walkPath = null;
    sfx('descend');
    logExplore(`You climb to the surface and refill your lantern. The climb back down frays your nerves (+${r.dread} Dread).`);
  },
  descend() {
    const r = descend(run);
    sfx('descend');
    startAmbient(run.regionIdx);
    standingOn = objectAt(run.world, run.world.px, run.world.py);
    exploreLog = [`You catch your breath on the long stair and recover ${r.heal} HP.`];
    screen = 'explore';
  },
  tab({ tab }) { benchTab = tab; notice = null; salvageMode = false; },
  rest() {
    const r = rest(run, desk);
    notice = r.error ? { text: r.error, tone: 'warn' } : { text: `You rest by the candle and recover ${r.heal} HP. The dread eases.` };
    if (!r.error) sfx('heal');
  },
  refine({ id }) {
    const r = refine(run, id);
    if (!r.error) sfx(id === 'bleed' ? 'hurt' : 'pickup');
    notice = r.error ? { text: r.error, tone: 'warn' }
      : { text: `Refined into ${Object.entries(r.made).map(([k, n]) => `${itemName(k)}${n > 1 ? ` ×${n}` : ''}`).join(', ')}.` };
  },
  pick({ kind, key }) {
    const bp = blueprint;
    notice = null;
    if (kind === 'catalyst') { bp.pristine = !bp.pristine; return; }
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
  craft() {
    const r = craftIntoDeck(run, blueprint);
    if (r.error) { notice = { text: r.error, tone: 'warn' }; return; }
    noteDiscovery(r);
    notice = r.discovered
      ? { text: `A true name surfaces: you discovered ${r.card.name}. It is written in your Grimoire.`, tone: 'rare' }
      : { text: `${r.card.name} added to your deck.` };
    blueprint = emptyBlueprint();
  },
  reinscribe({ uid, ench }) {
    const r = reinscribe(run, uid, ench);
    if (!r.error) noteDiscovery(r);
    notice = r.error ? { text: r.error, tone: 'warn' }
      : r.discovered ? { text: `The card shifts under your pen. You discovered ${r.card.name}.`, tone: 'rare' }
      : { text: `${r.card.name} now carries ${ENCHANTMENTS[ench].name}.` };
  },
  mend({ uid }) {
    const r = mend(run, uid);
    if (!r.error) sfx('craft');
    notice = r.error ? { text: r.error, tone: 'warn' } : { text: `${r.card.name} is whole again.` };
  },
  toggleSalvage() { salvageMode = !salvageMode; notice = null; },
  salvage({ uid }) {
    const r = salvageCard(run, uid);
    salvageMode = false;
    notice = r.error ? { text: r.error, tone: 'warn' } : { text: `The card comes apart. You recover ${itemName(r.part)}.` };
  },
  target({ idx }) { target = +idx; },
  play({ uid }) {
    const err = playCard(combat, uid, target);
    if (!err) afterCombatAction();
  },
  endTurn() { endTurn(combat); afterCombatAction(); },
  buy({ idx }) {
    const s = merchant.stock[+idx];
    if (s.sold || run.gold < s.price) return;
    run.gold -= s.price;
    s.sold = true;
    if (s.relic) {
      gainRelic(run, s.relic);
      sfx('relic');
      notice = { text: `The ${RELICS[s.relic].name} is yours. ${RELICS[s.relic].desc}`, tone: 'rare' };
      return;
    }
    run.inventory[s.id] = (run.inventory[s.id] || 0) + 1;
    sfx('pickup');
    notice = { text: `Bought ${itemName(s.id)}.` };
  },
  repair({ uid }) {
    const k = run.deck.find(c => c.uid === uid);
    if (!k || run.gold < REPAIR_PRICE) return;
    run.gold -= REPAIR_PRICE;
    k.durability = k.maxDurability;
    notice = { text: `${k.name} is restored.` };
  },
};

// ---------- combat effects ----------

function shake(size) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  app.classList.remove('shake-s', 'shake-l');
  void app.offsetWidth; // restart the animation
  app.classList.add(size === 'l' ? 'shake-l' : 'shake-s');
  setTimeout(() => app.classList.remove('shake-s', 'shake-l'), 450);
}

// Ink-colored sparks that fly out of an element.
function burst(el, color, n = 14) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'burst';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * d - 20}px`);
    p.style.background = color;
    box.appendChild(p);
  }
  el.appendChild(box);
  setTimeout(() => box.remove(), 800);
}

function snapshot(colors = null) {
  return {
    colors,
    phase: combat.phaseEvent?.n,
    enemies: combat.enemies.map(e => ({ hp: e.hp })),
    hp: run.hp, block: combat.player.block,
    reactions: combat.lastReaction?.n,
    worn: combat.wornUp?.n,
  };
}

function floatAt(el, text, cls) {
  if (!el) return;
  const f = document.createElement('span');
  f.className = `fx-float ${cls}`;
  f.textContent = text;
  el.appendChild(f);
  f.addEventListener('animationend', () => f.remove());
  setTimeout(() => f.remove(), 1500);
}

function flyCard(clone, rect) {
  if (!clone || !rect) return;
  clone.classList.add('fly');
  clone.removeAttribute('data-act');
  clone.inert = true;
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  document.body.appendChild(clone);
  clone.addEventListener('animationend', () => clone.remove());
  setTimeout(() => clone.remove(), 800);
}

function combatFx(before) {
  const enemyEls = app.querySelectorAll('.enemy');
  let hit = false, killed = false;
  combat.enemies.forEach((e, i) => {
    const d = before.enemies[i].hp - Math.max(0, e.hp);
    if (d > 0) {
      hit = true;
      enemyEls[i]?.classList.add('hit');
      floatAt(enemyEls[i], `-${d}`, 'dmg');
      burst(enemyEls[i], before.colors ? INK_COLORS[before.colors[0]].hue : '#7fa24a');
      if (d >= 15) shake('s');
      if (e.hp <= 0) { killed = true; enemyEls[i]?.classList.add('dying'); }
    }
  });
  const playerEl = app.querySelector('.player') || app.querySelector('section');
  const dhp = run.hp - before.hp;
  if (dhp < 0) {
    sfx('hurt');
    floatAt(playerEl, `${dhp}`, 'dmg');
    shake(dhp <= -10 ? 'l' : 's');
    const v = document.createElement('div');
    v.className = 'hurt-vignette';
    document.body.appendChild(v);
    setTimeout(() => v.remove(), 600);
  } else if (dhp > 0) {
    sfx('heal');
    floatAt(playerEl, `+${dhp}`, 'heal');
  }
  if (combat.player.block > before.block && screen === 'fight') {
    sfx('block');
    floatAt(playerEl, `+${combat.player.block - before.block} Block`, 'blk');
  }
  if (killed) sfx('kill'); else if (hit) sfx('hit');
  if (combat.wornUp && combat.wornUp.n !== before.worn) {
    floatAt(app.querySelector('.player'), `${combat.wornUp.name}: ${combat.wornUp.tier}`, 'worn');
    sfx('craft');
  }
  const ph = combat.phaseEvent;
  if (ph && ph.n !== before.phase) {
    sfx('encounter');
    shake('l');
    const banner = document.createElement('div');
    banner.className = 'reaction-banner phase-banner';
    banner.textContent = ph.name;
    (app.querySelector('.enemies') || app).appendChild(banner);
    setTimeout(() => banner.remove(), 1800);
  }
  const rx = combat.lastReaction;
  if (rx && rx.n !== before.reactions) {
    sfx('react');
    const banner = document.createElement('div');
    banner.className = 'reaction-banner';
    banner.innerHTML = `<span>${inkPair(rx.key)}</span>${rx.name}`;
    (app.querySelector('.enemies') || app).appendChild(banner);
    setTimeout(() => banner.remove(), 1400);
  }
}

document.addEventListener('click', e => {
  unlock();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const act = el.dataset.act;
  const fn = actions[act];
  if (!fn) return;
  const inFight = screen === 'fight' && (act === 'play' || act === 'endTurn');
  const playedColors = act === 'play' ? combat?.hand.find(k => k.uid === el.dataset.uid)?.colors : null;
  const before = inFight ? snapshot(playedColors) : null;
  const clone = act === 'play' ? el.cloneNode(true) : null;
  const rect = act === 'play' ? el.getBoundingClientRect() : null;
  fn({ ...el.dataset });
  render();
  if (inFight) {
    if (act === 'play') { sfx('cast'); flyCard(clone, rect); }
    combatFx(before);
  }
});

const KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};

document.addEventListener('keydown', e => {
  unlock();
  if (e.target.closest('input,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (screen === 'fight' && (e.key === 'e' || e.key === 'E')) {
    const before = snapshot();
    actions.endTurn(); render();
    if (screen === 'fight') combatFx(before);
    return;
  }
  if (screen === 'explore' && KEYS[e.key]) {
    e.preventDefault();
    const now = performance.now();
    if (now - lastStepAt < STEP_MS) return;
    lastStepAt = now;
    walkPath = null;
    moveBy(...KEYS[e.key]);
  }
});

// exposed for debugging in the console
window.spellcrafter = { get run() { return run; }, get combat() { return combat; }, get screen() { return screen; }, walkTo, BLOCKING };

render();
