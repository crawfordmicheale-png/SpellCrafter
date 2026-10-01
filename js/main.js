import {
  INK_COLORS, INK_MATERIALS, CARD_MATERIALS, ENCHANTMENTS, INGREDIENTS, RECIPES, ENEMIES, REPAIR_PRICE,
  REGIONS, RAW_MATERIALS, LANTERN, EVENTS, RELICS, REACTIONS, VARIANTS, CORRUPTION, PRISTINE, HINTS,
  STORY, NODE_TYPES, OIL_WARE, CAMP, MAP, DELVE_CONDITIONS, ALT_SOURCES, SECOND_INK_COST, SIGNATURES, NAME_MAX,
} from './data.js';
import { resolveEvent } from './events.js';
import { availableNodes, guardianOf } from './overworld.js';
import { loadMeta, saveMeta, learn, recordRun, forget, loadSoundPref, saveSoundPref, saveRunText, loadRunText, clearRun } from './meta.js';
import { unlock, sfx, setEnabled, isEnabled, startAmbient, stopAmbient } from './audio.js';
import { spriteURL, glyphURL } from './sprites.js';
import {
  craftCard, validateBlueprint, describeCard, cardComponents, wearName, spendPlan, available, recipeHint,
  chooseSignature, renameCard, canRename,
} from './crafting.js';
import { createCombat, playCard, endTurn, canPlay, effectiveCost, currentMove, previewReaction } from './combat.js';
import {
  createRun, currentRegion, descend, craftIntoDeck, salvageCard, rollRewards, applyRewards,
  reinscribe, mend, scavenge, openChest, burnCard, burnValue, resurface,
  gainRelic, relicChoices, hasRelic, serializeRun, deserializeRun, isUnlocked, oilMax, corruptionState,
  currentNode, enterNode, leaveDelve, campChoice, buyOil,
} from './run.js';
import { step, findPath, objectAt, BLOCKING } from './world.js';
import { createExploreView, objectName } from './explore-view.js';

const app = document.getElementById('app');
const bar = document.getElementById('bar');

let run = null;
let screen = 'title';
let combat = null;
let fightCtx = null; // { kind: 'random' | 'elite' | 'guardian' | 'boss', obj }
let target = 0;
let rewards = null;
let desk = null;      // the desk being used: a delve's desk, or a scriptorium node on the map
let merchant = null;  // the merchant node being visited
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
let eventCtx = null;  // { obj, id, result }: obj is a delve object or a map node
let mapNote = null;   // a line of news shown on the map
let deckOpen = false; // the deck viewer is showing
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
    + (card.corrupts ? '<span class="tag corrupt" title="+1 Corruption each cast">Corrupting</span>' : '')
    + (card.signature ? `<span class="tag sig" title="${SIGNATURES[card.signature].desc}">${SIGNATURES[card.signature].name}</span>` : '')
    + (card.signaturePending ? '<span class="tag sig" title="Choose its signature at a writing desk">Signature?</span>' : '');
  const inkLabel = card.inkMat ? `${INK_MATERIALS[card.inkMat].name} ink on ${CARD_MATERIALS[card.cardMat].name.toLowerCase()}` : 'Starter';
  const tag = action ? 'button' : 'div';
  // Wordy cards get a compact layout so their text stays on the card.
  const dense = describeCard(card).length + (card.flavor ? 1 : 0) >= 4;
  return `<${tag} class="card mat-${mat}${card.recipeId ? ' named' : ''}${dense ? ' dense' : ''}${card.pristine ? ' pristine' : ''}${disabled ? ' disabled' : ''}${cls ? ` ${cls}` : ''}" ${action} ${disabled && action ? 'aria-disabled="true"' : ''}>
    <span class="cost${cost < card.cost ? ' free' : cost > card.cost ? ' dear' : ''}">${cost}</span>
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
      case 'devour': return '<span class="intent pest" title="Eats a paper card from your deck for this fight, and wears it down">Devour paper</span>';
      case 'smudge': return '<span class="intent pest" title="A paper or wood card works at half strength for this fight">Drain ink</span>';
      case 'tarnish': return '<span class="intent pest" title="Silver and gold cards cost 1 more next turn">Tarnish</span>';
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
      <button class="stat deck deckbtn" data-act="openDeck" title="See your deck (V)" aria-haspopup="dialog">Deck <b>${run.deck.length}</b></button>
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
    <p>${['One', 'Two', 'Three', 'Four', 'Five'][REGIONS.length - 1]} levels down, beneath the chapel, the first book has woken. It wants a new hand to hold it. Another Inkbinder went down a year ago. Nobody has heard from her since.</p>
    <ul class="howto">
      <li><b>Choose your path</b> on each act's map: delves, strange events, merchants, scriptoria, and the guardian at the top.</li>
      <li><b>Delve</b> into dungeons by tapping a tile, or with WASD or the arrow keys. Your lantern only reaches so far.</li>
      <li><b>Scavenge</b> raw materials. The longer you wander, the more Dread builds, and the more often things find you.</li>
      <li><b>Mind your lantern.</b> Oil burns down slowly. Feed it a card, or climb back to the surface to refill it.</li>
      <li><b>Craft</b> at writing desks: a page, an ink color and an ink material. Monster parts become enchantments.</li>
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

// ---------- the overworld map ----------

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
// A small, stable offset per node so the map looks hand-drawn rather than gridded.
const jitter = (seed, span) => ((((seed * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * span;

function nodePos(n) {
  if (n.type === 'guardian') return [50, (0.5 / MAP.rows) * 100 + 1];
  return [((n.col + 0.5) / MAP.cols) * 100 + jitter(n.id + 1, 8), (1 - (n.row + 0.5) / MAP.rows) * 100 + jitter(n.id + 11, 3)];
}

const nodeInfo = n => {
  if (n.type === 'guardian') {
    return { name: ENEMIES[guardianOf(run.regionIdx)].name, desc: run.regionIdx === REGIONS.length - 1 ? 'The first book. Beat it to end the run.' : NODE_TYPES.guardian.desc, sprite: guardianOf(run.regionIdx) };
  }
  const cond = DELVE_CONDITIONS[n.cond];
  const t = NODE_TYPES[n.type];
  return cond ? { ...t, name: `${t.name}, ${cond.name.toLowerCase()}`, desc: `${cond.desc} ${t.desc}` } : t;
};

function renderOverworld(scroll) {
  const map = run.map;
  const region = currentRegion(run);
  const open = new Set(availableNodes(map).map(n => n.id));
  const visited = new Set(map.visited);
  const lines = map.nodes.flatMap(n => n.next.map(id => {
    const m = map.nodes[id];
    const [x1, y1] = nodePos(n), [x2, y2] = nodePos(m);
    const cls = visited.has(n.id) && visited.has(m.id) ? 'walked' : n.id === map.pos && open.has(m.id) ? 'open' : '';
    return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  })).join('');
  const nodes = map.nodes.map(n => {
    const [x, y] = nodePos(n);
    const info = nodeInfo(n);
    const state = n.id === map.pos ? 'here' : visited.has(n.id) ? 'visited' : open.has(n.id) ? 'open' : 'locked';
    const go = state === 'open';
    return `<button class="ownode t-${n.type} ${state}" style="left:${x}%;top:${y}%" ${go ? `data-act="goNode" data-id="${n.id}"` : 'aria-disabled="true" tabindex="-1"'}
      title="${info.name}: ${info.desc}" aria-label="${info.name}${go ? '. Go here.' : ''}">${portrait(info.sprite)}${n.cond ? `<span class="cond c-${n.cond}" aria-hidden="true">${DELVE_CONDITIONS[n.cond].glyph}</span>` : ''}</button>`;
  }).join('');
  const legend = ['delve', 'haunted', 'unknown', 'shop', 'camp', 'story']
    .map(t => `<li>${portrait(NODE_TYPES[t].sprite)}<span><b>${NODE_TYPES[t].name}</b>${NODE_TYPES[t].desc}</span></li>`).join('');
  const t = region.tiles;
  app.innerHTML = `
  <section class="overworld">
    <div class="owmain">
      <header class="screen-head">
        <h2>Act ${ROMAN[run.regionIdx]}: ${region.name}</h2>
        <p>${region.intro}</p>
      </header>
      ${mapNote ? `<p class="notice" role="status">${mapNote}</p>` : ''}
      <div class="owmap" style="--t1:${t[1]};--t2:${t[3]};--t3:${t[5]}">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        ${nodes}
      </div>
    </div>
    <aside class="side owside">
      ${hintHtml('map')}
      <h3 class="panel-title">Where to?</h3>
      <p class="note">Pick a lit node. You can only follow the lines upward. The guardian waits at the top.</p>
      <div class="meters">
        <div class="meter oil${run.oil < 12 ? ' low' : ''}" title="Lantern oil ${run.oil} of ${oilMax(run)}"><span style="width:${(run.oil / oilMax(run)) * 100}%"></span><em>Lantern ${run.oil}</em></div>
        <div class="meter dread" title="Dread ${run.dread}"><span style="width:${Math.min(100, run.dread / 2)}%"></span><em>Dread ${run.dread}</em></div>
      </div>
      <ul class="owlegend">${legend}</ul>
      <h3 class="panel-title">Delve conditions</h3>
      <ul class="condlegend">${Object.entries(DELVE_CONDITIONS).map(([k, c]) => `<li><span class="cond c-${k}">${c.glyph}</span><span><b>${c.name}</b>${c.desc}</span></li>`).join('')}</ul>
    </aside>
  </section>`;
  const target = app.querySelector('.ownode.open');
  if (scroll && target) target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
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
  const row = id => `<li title="${INGREDIENTS[id].hint || ''}">${INGREDIENTS[id].kind === 'color' ? `<span class="swatch" style="--ink:${INK_COLORS[INGREDIENTS[id].key].hue}"></span>` : ''}${itemName(id)}${INGREDIENTS[id].kind === 'enchant' ? ` <small>${ENCHANTMENTS[INGREDIENTS[id].key].name}</small>` : ''}<b>${run.inventory[id]}</b></li>`;
  const held = prefix => Object.keys(INGREDIENTS).filter(id => id.startsWith(prefix) && run.inventory[id] > 0).map(row).join('');
  const inks = held('color_') + held('ink_');
  const pages = held('mat_') + held('raw_');
  const parts = held('ench_') + held('ess_');
  let action = '';
  if (standingOn?.type === 'exit' && !standingOn.guard) {
    action = `<div class="prompt"><p>The way out. Climb back up to the map. You cannot return to this delve.</p>
      <button class="primary" data-act="leaveDelve">Climb out</button></div>`;
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
    <h2>${currentNode(run)?.type === 'haunted' ? 'A haunted delve' : 'A delve'}</h2>
    <p class="intro">${region.name}. Find the way out at the far end.</p>
    ${run.world.cond ? `<p class="condline"><span class="cond c-${run.world.cond}">${DELVE_CONDITIONS[run.world.cond].glyph}</span><b>${DELVE_CONDITIONS[run.world.cond].name}.</b> ${DELVE_CONDITIONS[run.world.cond].desc}</p>` : ''}
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
      <h3 class="panel-title">Inks</h3>
      <ul>${inks || '<li class="none">Nothing yet</li>'}</ul>
      <h3 class="panel-title">Pages and metals</h3>
      <ul>${pages || '<li class="none">Nothing yet</li>'}</ul>
      <h3 class="panel-title">Monster parts</h3>
      <ul>${parts || '<li class="none">Nothing yet</li>'}</ul>
    </div>
    <ul class="legend">
      ${[['bone', 'Scavenge'], ['chest', 'Reliquary'], ['desk', 'Writing desk'],
        ['stairsDown', 'The way out'], ['stairsUp', 'To the surface']].map(([s, l]) => `<li>${portrait(s)}${l}</li>`).join('')}
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
    case 'exit':
      if (obj.guard) {
        logExplore(`${ENEMIES[obj.guard].name} stands between you and the way out.`);
        startFight([obj.guard], { kind: 'elite', obj });
      } else logExplore('A stair climbs toward grey light. The way out.');
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
  saveNow({ fight: fightResume(fightCtx) });
  combat = createCombat(run, enemies, Math.random, {
    hpMult: currentRegion(run).hpMult,
    paperWear: DELVE_CONDITIONS[run.world?.cond]?.paperWear || 0,
  });
  if (combat.paperWear) combat.log.push('The water seeps into everything. Paper cards wear twice as fast here.');
  if (ctx.kind === 'boss') storyAtBoss(combat);
  target = 0;
  screen = 'fight';
}

// What became of Sister Vell changes the last fight.
function storyAtBoss(c) {
  if (run.story?.ally) {
    for (const e of c.enemies) { e.maxHp = Math.round(e.maxHp * 0.75); e.hp = Math.min(e.hp, e.maxHp); e.weak += 2; }
    c.log.push('Sister Vell holds the Grimoire open. Its pages tear as it moves.');
  }
  if (run.story?.hollowAhead) {
    for (const e of c.enemies) e.strength += 2;
    c.log.push('What was Vell kneels beside the Grimoire, writing for it.');
  }
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

// What is left once the current blueprint is paid for.
function remainingInventory() {
  const plan = spendPlan(blueprint, run.inventory, run.hp);
  if (plan.error) return { ...run.inventory };
  const left = { ...run.inventory };
  for (const [id, n] of Object.entries(plan.items)) left[id] -= n;
  return left;
}

// Where a slot option comes from, when it isn't the ready-made item.
function sourceNote(kind, key) {
  const alt = ALT_SOURCES[kind]?.[key];
  const id = { cardMat: 'mat_', inkMat: 'ink_' }[kind] + key;
  if (!alt || run.inventory[id] > 0) return '';
  if (alt.hp) return `<small>bleed ${alt.hp} HP</small>`;
  const [aid, n] = Object.entries(alt)[0];
  return `<small>${n} ${itemName(aid)}</small>`;
}

const HINT_TEXT = {
  color: { add: 'another ink wants in.', swap: 'a different ink would answer.' },
  ink: { add: 'it wants a different ink material.', swap: 'the ink itself is wrong.' },
  card: { add: 'it wants a different page.', swap: 'it wants a different page.' },
  ench: { add: 'it wants something from a monster.', swap: 'it wants something from a monster.' },
};

function hintLine() {
  const h = recipeHint(blueprint, run.grimoire, run.corruption);
  if (!h) return '';
  const known = run.grimoire.has(h.recipe.id);
  return `<p class="inkstir" role="status"><b>The ink stirs.</b> ${known ? `One part from <i>${h.recipe.name}</i>: ` : 'You are one part from a named spell: '}${HINT_TEXT[h.kind][h.change]}</p>`;
}

function inscribeTab() {
  const left = remainingInventory();
  const groups = [
    ['cardMat', 'Card material', CARD_MATERIALS],
    ['color', 'Ink color', INK_COLORS],
    ['inkMat', 'Ink material', INK_MATERIALS],
    ['enchant', 'Enchantments (monster parts)', ENCHANTMENTS],
  ];
  const satchel = groups.map(([kind, label, table]) => {
    const items = Object.keys(table).filter(k => available(kind, k, run.inventory) > 0 || isSelected(kind, k)).map(k => {
      const n = available(kind, k, left);
      const sel = isSelected(kind, k);
      const swatch = kind === 'color' ? `<span class="swatch" style="--ink:${INK_COLORS[k].hue}"></span>` : '';
      const id = { cardMat: 'mat_', color: 'color_', inkMat: 'ink_', enchant: 'ench_' }[kind] + k;
      const text = kind === 'enchant' ? `${ENCHANTMENTS[k].part} <small>${ENCHANTMENTS[k].name}</small>` : `${itemName(id)} ${sourceNote(kind, k)}`;
      return `<button class="ing k-${kind} m-${k}${sel ? ' sel' : ''}" data-act="pick" data-kind="${kind}" data-key="${k}" ${n <= 0 && !sel ? 'disabled' : ''} title="${table[k].desc}">
        ${swatch}<span>${text}</span><b>${Number.isFinite(n) ? n : ''}</b></button>`;
    }).join('');
    return `<div class="group"><h3>${label}</h3><div class="ings">${items || '<em class="none">None yet. Scavenge or find some.</em>'}</div></div>`;
  }).join('') + (run.inventory.ess_pristine > 0 || blueprint.pristine ? `<div class="group"><h3>Catalyst</h3><div class="ings">
    <button class="ing k-catalyst${blueprint.pristine ? ' sel' : ''}" data-act="pick" data-kind="catalyst" data-key="pristine" title="Makes the card Pristine: stronger.">
      <span>Pristine Essence</span><b>${(run.inventory.ess_pristine || 0) - (blueprint.pristine ? 1 : 0)}</b></button></div></div>` : '');

  const bp = blueprint;
  const slots = bp.cardMat ? CARD_MATERIALS[bp.cardMat].slots : 0;
  const slot = (label, val, kind, key) => `<button class="slot${val ? ' filled' : ''}" data-act="pick" data-kind="${kind}" data-key="${key || ''}" ${val ? '' : 'disabled'}>
      <small>${label}</small><span>${val || 'Empty'}</span></button>`;
  const colorSlots = [0, 1].map(i => slot(i === 0 ? 'Ink color' : `Second ink (+${SECOND_INK_COST} mana)`, bp.colors[i] && INK_COLORS[bp.colors[i]].name, 'color', bp.colors[i])).join('');
  const enchSlots = Array.from({ length: slots }, (_, i) => slot('Enchantment', bp.enchants[i] && ENCHANTMENTS[bp.enchants[i]].name, 'enchant', bp.enchants[i])).join('');

  const err = validateBlueprint(bp, run.inventory, run.hp);
  const preview = !validateBlueprint(bp) ? cardHtml(craftCard(bp, { corruption: run.corruption })) : `<div class="card ghost"><span>${err}</span></div>`;
  const plan = spendPlan(bp, run.inventory, run.hp);
  const bleed = !plan.error && plan.hp ? `<p class="note warnline">Writing this takes ${plan.hp} HP of your own blood.</p>` : '';
  const pair = bp.colors.length === 2 ? REACTIONS[[...bp.colors].sort().join('+')] : null;

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
        ${pair ? `<p class="note">Two inks: sets off <b>${pair.name}</b> every cast. ${pair.desc}</p>` : ''}
      </div>
      <div class="panel preview">
        <h3 class="panel-title">Preview</h3>
        ${preview}
        ${hintLine()}
        ${bleed}
        <button class="primary" data-act="craft" ${err ? 'disabled' : ''}>Inscribe card</button>
      </div>
    </div>
    <div class="panel grimoire"><h3 class="panel-title">Grimoire (${run.grimoire.size} of ${RECIPES.length})</h3><ul>${grimoire}</ul></div>`;
}

function deckTab() {
  const enchInv = Object.keys(ENCHANTMENTS).filter(k => run.inventory[`ench_${k}`]);
  const deck = run.deck.map(k => {
    const btns = [];
    if (salvageMode) btns.push(`<button data-act="salvage" data-uid="${k.uid}">Salvage</button>`);
    else {
      if (k.crafted && Number.isFinite(k.durability) && k.durability < k.maxDurability) {
        const mat = `mat_${k.cardMat}`;
        const ok = available('cardMat', k.cardMat, run.inventory) > 0;
        btns.push(`<button data-act="mend" data-uid="${k.uid}" ${ok ? '' : `disabled title="Needs a ${itemName(mat)}"`}>Mend (1 ${itemName(mat)})</button>`);
      }
      if (k.signaturePending) {
        for (const [id, sig] of Object.entries(SIGNATURES)) {
          btns.push(`<button class="sig" data-act="signature" data-uid="${k.uid}" data-id="${id}" title="${sig.desc}"><b>${sig.name}</b> <small>${sig.desc}</small></button>`);
        }
      }
      if (canRename(k)) {
        btns.push(`<span class="rename"><input type="text" maxlength="${NAME_MAX}" id="nm-${k.uid}" placeholder="Rename" aria-label="New name for ${k.name}"><button data-act="rename" data-uid="${k.uid}">Name it</button></span>`);
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
        : 'Add monster parts to cards with a free enchantment slot. Mend worn paper and wood with the same material. Cards you cast often become Well-Worn and can be renamed; Heirlooms get a signature.'}</p>
      <div class="cards">${deck}</div>
    </div>`;
}

function campButtons() {
  if (desk.campUsed) return `<p class="note">${desk.campUsed === 'rest' ? 'You have rested.' : 'Your lantern is full.'}</p>`;
  const heal = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * CAMP.heal));
  return `<div class="campacts">
    <button data-act="campRest" title="Heal ${Math.round(CAMP.heal * 100)}% of your max HP, ease ${CAMP.dread} Dread and lift ${CAMP.corruption} Corruption">Rest (+${heal} HP)</button>
    <button data-act="campOil" ${run.oil >= oilMax(run) ? 'disabled' : ''} title="Fill your lantern">Refill lantern (${run.oil}/${oilMax(run)})</button>
  </div>`;
}

function renderBench() {
  const isCamp = desk.type === 'camp';
  const pending = run.deck.some(k => k.signaturePending);
  const tabs = [['inscribe', 'Inscribe'], ['deck', pending ? 'Deck ✦' : 'Deck']]
    .map(([id, label]) => `<button role="tab" aria-selected="${benchTab === id}" class="tab${benchTab === id ? ' on' : ''}" data-act="tab" data-tab="${id}">${label}</button>`).join('');
  const body = benchTab === 'deck' ? deckTab() : inscribeTab();
  app.innerHTML = `
  <section class="bench">
    ${hintHtml(isCamp ? 'camp' : 'desk')}
    <header class="screen-head bench-head">
      <div>
        <h2>${isCamp ? 'The Scriptorium' : 'The Writing Desk'}</h2>
        <p>${isCamp ? 'Candles, a long table, and quiet. Craft what you like. Then rest, or refill your lantern: there is only time for one.' : 'A cold desk, a blotter, and a knife for cutting pages. Too exposed to rest here.'}</p>
      </div>
      ${isCamp ? campButtons() : ''}
    </header>
    <div class="tabs" role="tablist">${tabs}</div>
    ${notice ? `<p class="notice ${notice.tone || ''}" role="status">${notice.text}</p>` : ''}
    ${body}
    <footer class="screen-foot"><button class="primary" data-act="toMap">${backLabel()}</button></footer>
  </section>`;
}

function backLabel() {
  if (run.world) return 'Back to exploring';
  const n = currentNode(run);
  if (n?.type === 'guardian' && n.cleared) return `Descend into ${REGIONS[run.regionIdx + 1].name}`;
  return 'Back to the map';
}

// ---------- deck viewer ----------

// Crafted cards first, then by name, so the order never gives away the draw pile.
const sortCards = cards => [...cards].sort((a, b) => (b.crafted - a.crafted) || a.name.localeCompare(b.name));

function deckOverlay() {
  const grid = cards => cards.length ? `<div class="cards">${sortCards(cards).map(k => cardHtml(k, { cost: combat && screen === 'fight' ? effectiveCost(combat, k) : k.cost })).join('')}</div>` : '<p class="none">None.</p>';
  const crafted = run.deck.filter(k => k.crafted).length;
  const body = screen === 'fight' && combat
    ? `<h3 class="section-title">Draw pile (${combat.drawPile.length})</h3>${grid(combat.drawPile)}
       <h3 class="section-title">Discard pile (${combat.discard.length})</h3>${grid(combat.discard)}
       ${combat.exhaust.length ? `<h3 class="section-title">Gone for this fight (${combat.exhaust.length})</h3>${grid(combat.exhaust)}` : ''}`
    : grid(run.deck);
  return `<div id="deckov" class="deckov">
    <div class="deckov-back" data-act="closeDeck"></div>
    <section class="deckov-panel" role="dialog" aria-modal="true" aria-labelledby="deckov-title">
      <header class="screen-head">
        <h2 id="deckov-title">Your deck</h2>
        <p>${run.deck.length} cards: ${crafted} crafted, ${run.deck.length - crafted} starters.${screen === 'fight' ? ' Your hand is on the table.' : ''}</p>
        <button class="primary deckov-close" data-act="closeDeck">Close</button>
      </header>
      ${body}
    </section>
  </div>`;
}

// ---------- fight, rewards, shop, end ----------

const PESTS = new Set(['papermoth', 'inkleech', 'rustwraith']);

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
    const smudged = c.smudged.has(k.uid);
    return cardHtml(k, {
      cost: effectiveCost(c, k), disabled: !!why, cls: `${react ? 'reacts' : ''}${smudged ? ' smudged' : ''}`,
      action: `data-act="play" data-uid="${k.uid}" title="${why || (react ? `Cast. Sets off ${REACTIONS[react].name}: ${REACTIONS[react].desc}` : 'Cast')}"`,
      extra: (react ? `<span class="reacttag">${REACTIONS[react].name}</span>` : '') + (smudged ? '<span class="smudgetag">Smudged</span>' : ''),
    });
  }).join('');
  const lastInk = c.lastColors ? `<span class="chip ink">Last ink ${c.lastColors.map(col => `<img class="px inkpip" src="${glyphURL(col)}" alt="${INK_COLORS[col].short}">`).join('')}</span>` : '';

  const mana = Array.from({ length: Math.max(run.energy, c.player.energy) }, (_, i) => `<i class="${i < c.player.energy ? 'on' : ''}"></i>`).join('');
  const recent = c.log.slice(-7).map(l => `<li>${l}</li>`).join('');
  const title = { random: 'Something finds you in the dark', elite: 'Something stands in your way', guardian: `The guardian of ${currentRegion(run).name}`, boss: 'The Last Library' }[fightCtx.kind];

  app.innerHTML = `
  <section class="fight">
    ${hintHtml(c.enemies.some(e => PESTS.has(e.key)) ? 'pests' : 'fight') || hintHtml('fight')}
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
    <h2>${r.title || 'The page falls silent'}</h2>
    <p>${r.lede || 'You search what\'s left.'}</p>
    <ul class="loots">${items}${salv}${r.gold ? `<li class="loot gold">${r.gold} gold</li>` : ''}${r.healed ? `<li class="loot heal">Chapel Candle: +${r.healed} HP</li>` : ''}</ul>
    ${!items && !salv && !r.gold ? '<p>Nothing worth keeping.</p>' : ''}
    ${r.relicChoices?.length && !r.relicTaken ? `
      <h3 class="section-title">It kept something. Choose one.</h3>
      <div class="relicpick">${r.relicChoices.map(id => relicCard(id, `data-act="takeRelic" data-id="${id}"`)).join('')}</div>
      <button data-act="toMap">Leave them all</button>`
      : `${r.relicTaken ? `<p class="notice rare">You take the ${RELICS[r.relicTaken].name}.</p>` : ''}${r.relicFound ? `<div class="relicpick">${relicCard(r.relicFound)}</div>` : ''}<button class="primary" data-act="toMap">${backLabel()}</button>`}
  </section>`;
}

function renderShop() {
  const oilWare = `<button class="ware oilware" data-act="buyOil" ${run.gold < OIL_WARE.price || run.oil >= oilMax(run) ? 'disabled' : ''} title="+${OIL_WARE.oil} lantern oil">
      ${portrait('lanterns', 'wareart')}<span>Lantern oil</span><small>+${OIL_WARE.oil} (you have ${run.oil}/${oilMax(run)})</small><b>${OIL_WARE.price} gold</b></button>`;
  const stock = oilWare + merchant.stock.map((s, i) => s.relic
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
    <footer class="screen-foot"><button class="primary" data-act="toMap">${backLabel()}</button></footer>
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
  const ev = EVENTS[eventCtx.id] || STORY[eventCtx.id];
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
    ${portrait(ev.art || eventCtx.id, 'eventart')}
    ${STORY[eventCtx.id] ? '<p class="storytag">Sister Vell</p>' : ''}
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
    case 'map': renderOverworld(changed); break;
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
  document.getElementById('deckov')?.remove();
  if (deckOpen && run && !['title', 'codex', 'won', 'lost'].includes(screen)) document.body.insertAdjacentHTML('beforeend', deckOverlay());
  else deckOpen = false;
  autosave();
}

// ---------- saving ----------

let saveTimer = 0;
// Fights restart from the beginning on load. Remember who, and what they were guarding.
const fightResume = ctx => ({ enemies: ctx.enemies, kind: ctx.kind, objId: ctx.obj?.id ?? null, onMap: !run.world });
function saveNow(extra = {}) {
  if (!run || ['won', 'lost', 'title', 'codex'].includes(screen) && !extra.fight) return;
  const resume = { log: exploreLog.slice(-5), ...extra };
  if (screen === 'fight' && !extra.fight && fightCtx) resume.fight = fightResume(fightCtx);
  if (screen === 'event' && eventCtx && !eventCtx.result && run.world) resume.eventObjId = eventCtx.obj.id;
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
  const obj = fightCtx.obj;
  if (obj?.type === 'exit') obj.guard = null;   // the way out stays, now open
  else if (obj && 'row' in obj) obj.cleared = true; // a node on the map
  else if (obj) obj.gone = true;
  rewards = rollRewards(fightCtx.enemies, { elite: big, dice: hasRelic(run, 'dice') });
  if (big) rewards.relicChoices = relicChoices(run, 3);
  rewards.salvaged = combat.salvaged;
  applyRewards(run, rewards);
  const name = ENEMIES[fightCtx.enemies[0]].name;
  logExplore(fightCtx.kind === 'guardian' ? `${name} falls. The way down is open.`
    : obj?.type === 'exit' ? `${name} falls. The way out is open.`
    : fightCtx.kind === 'elite' ? `${name} falls.` : 'You survive the encounter.');
  if (fightCtx.kind === 'guardian') mapNote = `${name} falls. The way down to ${REGIONS[run.regionIdx + 1].name} is open.`;
  screen = 'rewards';
}

// Route into whatever a map node turned out to be.
function openNode(node) {
  const o = node.outcome;
  notice = null;
  switch (o.type) {
    case 'delve':
      sfx('descend');
      exploreLog = [o.elite ? `You go down. Somewhere ahead, ${ENEMIES[o.elite].name} waits by the way out.` : 'You go down into the dark. Find the way out at the far end.'];
      if (o.cond) exploreLog.push(`${DELVE_CONDITIONS[o.cond].name}: ${DELVE_CONDITIONS[o.cond].desc}`);
      standingOn = objectAt(run.world, run.world.px, run.world.py);
      screen = 'explore';
      break;
    case 'shop':
      merchant = node; screen = 'shop';
      break;
    case 'camp':
      desk = node; blueprint = emptyBlueprint(); benchTab = 'inscribe'; salvageMode = false;
      run.salvagedHere = false;
      screen = 'bench';
      break;
    case 'event':
    case 'story':
      eventCtx = { obj: node, id: o.event, result: null };
      sfx('event');
      screen = 'event';
      break;
    case 'fight':
      if (o.kind !== 'random') sfx('encounter');
      startFight(o.enemies, { kind: o.kind, obj: node });
      break;
    case 'cache':
      node.finished = true;
      sfx(o.relic ? 'relic' : 'chest');
      rewards = { title: 'A forgotten cache', lede: 'Someone hid this here and never came back for it.', items: o.items, gold: o.gold, relicFound: o.relic };
      screen = 'rewards';
      break;
    default:
      screen = 'map';
  }
}

function nextAct() {
  const r = descend(run);
  sfx('descend');
  startAmbient(run.regionIdx);
  standingOn = null;
  exploreLog = [];
  mapNote = `You go down the long stair into ${currentRegion(run).name} and recover ${r.heal} HP on the way.`;
  screen = 'map';
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
    exploreLog = [];
    mapNote = 'You light your lantern at the chapel gate. Below you, the ruins branch in every direction.';
    standingOn = null;
    screen = 'map';
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
    standingOn = run.world ? objectAt(run.world, run.world.px, run.world.py) : null;
    startAmbient(run.regionIdx);
    mapNote = null;
    screen = run.world ? 'explore' : 'map';
    const node = currentNode(run);
    if (res.fight) {
      const obj = res.fight.onMap ? (res.fight.objId != null ? node : null)
        : run.world?.objects.find(o => o.id === res.fight.objId) || null;
      startFight(res.fight.enemies, { kind: res.fight.kind, obj });
      logExplore('The fight you fled from starts over.');
    } else if (res.relicChoices?.length) {
      rewards = { items: [], gold: 0, relicChoices: res.relicChoices };
      screen = 'rewards';
    } else if (!run.world && node?.type === 'guardian' && node.cleared) {
      nextAct();
    } else if (!run.world && node && !node.finished && node.outcome) {
      openNode(node);
    } else if (res.eventObjId != null) {
      const obj = run.world.objects.find(o => o.id === res.eventObjId);
      if (obj && !obj.gone) { eventCtx = { obj, id: obj.event, result: null }; screen = 'event'; }
    }
  },
  goNode({ id }) {
    const r = enterNode(run, +id);
    if (r.error) return;
    mapNote = null;
    openNode(currentNode(run));
  },
  leaveDelve() {
    const r = leaveDelve(run);
    walkPath = null;
    standingOn = null;
    const node = currentNode(run);
    if (node) node.finished = true;
    sfx('descend');
    mapNote = `You climb out into the grey light. The open air steadies you${r.eased ? ` (-${r.eased} Dread)` : ''}.`;
    screen = 'map';
  },
  campRest() {
    const r = campChoice(run, desk, 'rest');
    if (r.error) { notice = { text: r.error, tone: 'warn' }; return; }
    sfx('heal');
    notice = { text: `You sleep under the candles and recover ${r.heal} HP. The dread eases${r.cleansed ? `, and ${r.cleansed} Corruption lifts` : ''}.` };
  },
  campOil() {
    const r = campChoice(run, desk, 'oil');
    if (r.error) { notice = { text: r.error, tone: 'warn' }; return; }
    sfx('burn');
    notice = { text: `You fill your lantern from the scriptorium lamps (+${r.oil} oil).` };
  },
  buyOil() {
    const r = buyOil(run);
    notice = r.error ? { text: r.error, tone: 'warn' } : { text: `The merchant tops up your lantern (+${r.oil} oil).` };
    if (!r.error) sfx('pickup');
  },
  takeRelic({ id }) {
    if (!rewards?.relicChoices?.includes(id) || rewards.relicTaken) return;
    gainRelic(run, id);
    rewards.relicTaken = id;
    sfx('relic');
    logExplore(`You take the ${RELICS[id].name}.`);
  },
  codex() { forgetArmed = false; screen = 'codex'; },
  openDeck() { walkPath = null; deckOpen = true; },
  closeDeck() { deckOpen = false; },
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
    if (!run.world) eventCtx.obj.finished = true;
    standingOn = null;
    if (r.relic) { gainRelic(run, r.relic); sfx('relic'); }
    else if (r.learned) { learn(meta, r.learned); sfx('discover'); }
    else if (r.items?.length) sfx('pickup');
    logExplore(`${(EVENTS[eventCtx.id] || STORY[eventCtx.id]).name}: ${r.text}`);
  },
  eventFight() {
    sfx('encounter');
    const r = eventCtx.result;
    startFight(r.fight, { kind: r.elite ? 'elite' : 'random', obj: run.world ? null : eventCtx.obj });
  },
  toMap() {
    notice = null;
    if (run.world) { screen = 'explore'; return; }
    const node = currentNode(run);
    if (node) node.finished = true;
    if (node?.type === 'guardian' && node.cleared) { nextAct(); return; }
    screen = 'map';
  },
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

  tab({ tab }) { benchTab = tab; notice = null; salvageMode = false; },

  signature({ uid, id }) {
    const k = run.deck.find(c => c.uid === uid);
    const r = k ? chooseSignature(k, id) : { error: 'No such card.' };
    if (r.error) { notice = { text: r.error, tone: 'warn' }; return; }
    sfx('discover');
    notice = { text: `${k.name} is ${SIGNATURES[id].name} now. It is yours in a way no other card is.`, tone: 'rare' };
  },
  rename({ uid }) {
    const k = run.deck.find(c => c.uid === uid);
    const before = k?.name;
    const r = k ? renameCard(k, document.getElementById(`nm-${uid}`)?.value) : { error: 'No such card.' };
    if (r.error) { notice = { text: r.error, tone: 'warn' }; return; }
    sfx('craft');
    notice = { text: `${before} is now called ${k.name}.` };
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
    if (r.bled) sfx('hurt');
    notice = r.discovered
      ? { text: `A true name surfaces: you discovered ${r.card.name}. It is written in your Grimoire.`, tone: 'rare' }
      : { text: `${r.card.name} added to your deck.${r.bled ? ` You wrote it in your own blood (${r.bled} HP).` : ''}` };
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
    pest: combat.pestEvent?.n,
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
  const pe = combat.pestEvent;
  if (pe && pe.n !== before.pest) {
    sfx('burn');
    const banner = document.createElement('div');
    banner.className = 'reaction-banner pest-banner';
    banner.textContent = pe.label;
    (app.querySelector('.table') || app).appendChild(banner);
    setTimeout(() => banner.remove(), 1600);
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
  if (deckOpen) {
    if (e.key === 'Escape') { deckOpen = false; render(); }
    return;
  }
  if ((e.key === 'v' || e.key === 'V') && run && !['title', 'codex', 'won', 'lost'].includes(screen)) {
    deckOpen = true; walkPath = null; render(); return;
  }
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
window.spellcrafter = { get run() { return run; }, get combat() { return combat; }, get screen() { return screen; }, walkTo, BLOCKING, availableNodes, startFight };

render();
