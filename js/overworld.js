import { MAP, REGIONS, DELVE_CONDITIONS } from './data.js';
import { mulberry32 } from './world.js';

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const LIMITED = new Set(['shop', 'camp', 'haunted']); // never two of these in a row

function weightedPick(weights, rng) {
  const entries = Object.entries(weights);
  let r = rng() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}

// A Slay the Spire style map for one act. Rows run from the bottom (0) to the guardian at the top.
// Several paths climb from the bottom row, each moving at most one column per row,
// and never crossing another path. Where they meet, they share a node.
export function generateMap(act, seed) {
  const rng = mulberry32((seed ^ 0x5bd1e995) + act * 104729);
  const { rows, cols, paths } = MAP;
  const choiceRows = rows - 2;
  const nodes = [];
  const grid = new Map();
  const nodeAt = (row, col) => {
    const key = `${row},${col}`;
    if (!grid.has(key)) {
      const n = { id: nodes.length, row, col, type: null, next: [] };
      nodes.push(n);
      grid.set(key, n);
    }
    return grid.get(key);
  };
  const link = (a, b) => { if (!a.next.includes(b.id)) a.next.push(b.id); };
  const crosses = (row, c, d) => nodes.some(n => n.row === row && n.next.some(id => {
    const m = nodes[id];
    return (n.col < c && m.col > d) || (n.col > c && m.col < d);
  }));

  const starts = [];
  for (let p = 0; p < paths; p++) starts.push(p < 2 ? (p === 0 ? randInt(rng, 0, 1) : randInt(rng, cols - 2, cols - 1)) : randInt(rng, 0, cols - 1));
  for (const start of starts) {
    let col = start;
    for (let row = 0; row < choiceRows - 1; row++) {
      let nc = Math.max(0, Math.min(cols - 1, col + randInt(rng, -1, 1)));
      if (crosses(row, col, nc)) nc = col;
      link(nodeAt(row, col), nodeAt(row + 1, nc));
      col = nc;
    }
    nodeAt(choiceRows - 1, col);
  }
  // The camp row sits right under the guardian; every path passes one.
  for (const n of nodes.filter(m => m.row === choiceRows - 1)) link(n, nodeAt(choiceRows, n.col));
  const guardian = nodeAt(rows - 1, Math.floor(cols / 2));
  for (const n of nodes.filter(m => m.row === choiceRows)) link(n, guardian);

  const parents = id => nodes.filter(n => n.next.includes(id));
  for (const n of [...nodes].sort((a, b) => a.row - b.row)) {
    if (n.row === 0) n.type = 'delve';
    else if (n.row === choiceRows) n.type = 'camp';
    else if (n.row === rows - 1) n.type = 'guardian';
    else {
      const weights = { ...MAP.weights };
      if (n.row < 2) delete weights.haunted;
      if (n.row === choiceRows - 1) delete weights.camp;
      for (const p of parents(n.id)) if (LIMITED.has(p.type)) delete weights[p.type];
      n.type = weightedPick(weights, rng);
    }
  }

  // Every act has one meeting with Vell, and at least one haunted delve and one merchant.
  const storyRow = nodes.filter(n => n.row === 3);
  storyRow[randInt(rng, 0, storyRow.length - 1)].type = 'story';
  const convert = (type, minRow) => {
    if (nodes.some(n => n.type === type)) return;
    const pool = nodes.filter(n => n.row >= minRow && n.row < choiceRows && ['delve', 'unknown'].includes(n.type));
    const apart = pool.filter(n => !parents(n.id).some(p => p.type === type) && !n.next.some(id => nodes[id].type === type));
    const from = apart.length ? apart : pool;
    if (from.length) from[randInt(rng, 0, from.length - 1)].type = type;
  };
  convert('haunted', 2);
  convert('shop', 1);

  // Most delves show a condition on the map. The very first choice stays plain.
  const conds = Object.keys(DELVE_CONDITIONS);
  for (const n of nodes) {
    if ((n.type === 'delve' || n.type === 'haunted') && n.row > 0 && rng() < MAP.conditionChance) {
      n.cond = conds[randInt(rng, 0, conds.length - 1)];
    }
  }

  return { act, nodes, pos: null, visited: [] };
}

// Nodes you can move to next.
export function availableNodes(map) {
  if (map.pos == null) return map.nodes.filter(n => n.row === 0);
  return map.nodes[map.pos].next.map(id => map.nodes[id]);
}

export const guardianOf = act => REGIONS[act].boss || REGIONS[act].guardian;
