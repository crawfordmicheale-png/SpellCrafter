// Progress that survives between runs: the Grimoire and a few lifetime stats.
// Stored in the player's own browser. Every access is guarded because storage
// can be missing or blocked (private windows, previews).

const KEY = 'spellcrafter.meta.v1';

export const freshMeta = () => ({ grimoire: [], runs: 0, wins: 0, deepest: -1 });

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

export function recordRun(meta, { won, depth }, store) {
  meta.runs++;
  if (won) meta.wins++;
  meta.deepest = Math.max(meta.deepest, depth);
  saveMeta(meta, store);
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
