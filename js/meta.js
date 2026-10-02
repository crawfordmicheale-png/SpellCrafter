// Progress that survives between runs: the Grimoire and a few lifetime stats.
// Stored in the player's own browser. Every access is guarded because storage
// can be missing or blocked (private windows, previews).

const KEY = 'spellcrafter.meta.v1';

// depthUnlocked: the hardest Depth you may choose. Winning at your highest opens the next.
export const freshMeta = () => ({ grimoire: [], runs: 0, wins: 0, deepest: -1, depthUnlocked: 0, bestDepth: -1 });

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function loadMeta(store = storage()) {
  try {
    const m = JSON.parse(store?.getItem(KEY) || 'null');
    if (!m || !Array.isArray(m.grimoire)) return freshMeta();
    return { ...freshMeta(), ...m };
  } catch {
    return freshMeta();
  }
}

export function saveMeta(meta, store = storage()) {
  try { store?.setItem(KEY, JSON.stringify(meta)); } catch { /* storage unavailable */ }
}

export function learn(meta, recipeId, store) {
  if (!meta.grimoire.includes(recipeId)) {
    meta.grimoire.push(recipeId);
    saveMeta(meta, store);
  }
}

// depth: how far you got (act index). level: the Depth you played at.
export function recordRun(meta, { won, depth, level = 0, maxLevel = 0 }, store) {
  meta.runs++;
  meta.deepest = Math.max(meta.deepest, depth);
  let unlocked = null;
  if (won) {
    meta.wins++;
    meta.bestDepth = Math.max(meta.bestDepth ?? -1, level);
    if (level >= meta.depthUnlocked && level < maxLevel) unlocked = meta.depthUnlocked = level + 1;
  }
  saveMeta(meta, store);
  return { unlocked };
}

export function forget(store) {
  const meta = freshMeta();
  saveMeta(meta, store);
  return meta;
}

// The sound on/off preference lives here too.
const SOUND_KEY = 'spellcrafter.sound';
export function loadSoundPref(store = storage()) {
  try { return store?.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
export function saveSoundPref(on, store = storage()) {
  try { store?.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

// The run in progress, so a closed tab can be continued.
const RUN_KEY = 'spellcrafter.run.v1';
export function saveRunText(text, store = storage()) {
  try { store?.setItem(RUN_KEY, text); } catch { /* storage unavailable */ }
}
export function loadRunText(store = storage()) {
  try { return store?.getItem(RUN_KEY) || null; } catch { return null; }
}
export function clearRun(store = storage()) {
  try { store?.removeItem(RUN_KEY); } catch { /* storage unavailable */ }
}
