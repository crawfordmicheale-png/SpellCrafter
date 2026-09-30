import { REGIONS, RAW_MATERIALS, ENCOUNTER } from './data.js';

export const WALL = 0, FLOOR = 1;
export const MAP_W = 46, MAP_H = 32;
export const LIGHT_RADIUS = 5;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

function weightedPick(weights, rng) {
  const entries = Object.entries(weights);
  let r = rng() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}

// Rooms joined by L-shaped corridors, plus a few extra links so there are loops.
export function generateRegion(regionIdx, seed) {
  const rng = mulberry32(seed);
  const region = REGIONS[regionIdx];
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const at = (x, y) => y * MAP_W + x;
  const carve = (x, y) => { if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1) tiles[at(x, y)] = FLOOR; };

  const rooms = [];
  for (let tries = 0; tries < 200 && rooms.length < 11; tries++) {
    const w = randInt(rng, 4, 9), h = randInt(rng, 4, 7);
    const x = randInt(rng, 1, MAP_W - w - 2), y = randInt(rng, 1, MAP_H - h - 2);
    const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    if (rooms.some(o => x - 1 < o.x + o.w && x + w + 1 > o.x && y - 1 < o.y + o.h && y + h + 1 > o.y)) continue;
    rooms.push(r);
  }
  rooms.sort((a, b) => a.cx - b.cx);
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);

  const corridor = (a, b) => {
    const horizFirst = rng() < 0.5;
    let x = a.cx, y = a.cy;
    const stepX = () => { while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); } };
    const stepY = () => { while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    carve(x, y);
  };
  for (let i = 1; i < rooms.length; i++) corridor(rooms[i - 1], rooms[i]);
  for (let i = 0; i < 3; i++) corridor(rooms[randInt(rng, 0, rooms.length - 1)], rooms[randInt(rng, 0, rooms.length - 1)]);

  const world = {
    regionIdx, seed, tiles, rooms,
    w: MAP_W, h: MAP_H,
    seen: new Uint8Array(MAP_W * MAP_H),
    objects: [],
    px: rooms[0].cx, py: rooms[0].cy,
    stepsSinceFight: 0,
  };

  // Farthest room from the start holds the way down (or the boss).
  const dist = distances(world, world.px, world.py);
  const byDistance = rooms.slice(1).sort((a, b) => dist[at(b.cx, b.cy)] - dist[at(a.cx, a.cy)]);
  const exitRoom = byDistance[0];
  const middle = byDistance.slice(1);
  const takeRoom = () => middle.splice(randInt(rng, 0, middle.length - 1), 1)[0];

  const occupied = new Set([at(world.px, world.py)]);
  let nextId = 1;
  const place = (type, x, y, extra = {}) => {
    occupied.add(at(x, y));
    world.objects.push({ id: nextId++, type, x, y, ...extra });
  };
  const freeTileIn = (r) => {
    for (let i = 0; i < 40; i++) {
      const x = randInt(rng, r.x, r.x + r.w - 1), y = randInt(rng, r.y, r.y + r.h - 1);
      if (!occupied.has(at(x, y))) return [x, y];
    }
    return null;
  };

  if (region.boss) place('boss', exitRoom.cx, exitRoom.cy, { enemy: region.boss });
  else place('exit', exitRoom.cx, exitRoom.cy);

  // The desk sits close to the start so you can craft early, the merchant further in.
  const nearStart = rooms.slice(1).filter(r => r !== exitRoom)
    .sort((a, b) => dist[at(a.cx, a.cy)] - dist[at(b.cx, b.cy)]);
  const deskRoom = nearStart[0];
  middle.splice(middle.indexOf(deskRoom), 1);
  place('desk', deskRoom.cx, deskRoom.cy);
  if (region.merchant && middle.length) { const r = takeRoom(); place('merchant', r.cx, r.cy); }
  if (region.elite && middle.length) {
    const r = takeRoom();
    place('elite', r.cx, r.cy, { enemy: region.elite });
  }
  for (let i = 0; i < region.chests; i++) {
    const spot = freeTileIn(rooms[randInt(rng, 1, rooms.length - 1)]);
    if (spot) place('chest', ...spot);
  }
  for (let i = 0; i < region.nodes; i++) {
    const spot = freeTileIn(rooms[randInt(rng, 0, rooms.length - 1)]);
    if (!spot) continue;
    const raw = weightedPick(region.raws, rng);
    place('node', ...spot, { raw, amount: rng() < 0.35 ? 2 : 1 });
  }

  reveal(world);
  return world;
}

export const isFloor = (world, x, y) =>
  x >= 0 && y >= 0 && x < world.w && y < world.h && world.tiles[y * world.w + x] === FLOOR;

export function objectAt(world, x, y) {
  return world.objects.find(o => o.x === x && o.y === y && !o.gone) || null;
}

function distances(world, sx, sy) {
  const d = new Int32Array(world.w * world.h).fill(1e9);
  const q = [[sx, sy]];
  d[sy * world.w + sx] = 0;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!isFloor(world, nx, ny) || d[ny * world.w + nx] <= d[y * world.w + x] + 1) continue;
      d[ny * world.w + nx] = d[y * world.w + x] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const BLOCKING = new Set(['merchant', 'elite', 'boss', 'desk']);

// Shortest walkable path from the player to (tx, ty), excluding the start tile.
// Only goes through tiles you have seen.
export function findPath(world, tx, ty) {
  if (!isFloor(world, tx, ty) || !world.seen[ty * world.w + tx]) return null;
  const prev = new Int32Array(world.w * world.h).fill(-1);
  const start = world.py * world.w + world.px, goal = ty * world.w + tx;
  const q = [start];
  prev[start] = start;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (cur === goal) break;
    const x = cur % world.w, y = (cur / world.w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, n = ny * world.w + nx;
      if (!isFloor(world, nx, ny) || prev[n] !== -1 || !world.seen[n]) continue;
      // Walk around people and monsters unless they are the destination.
      if (n !== goal && BLOCKING.has(objectAt(world, nx, ny)?.type)) continue;
      prev[n] = cur;
      q.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let cur = goal; cur !== start; cur = prev[cur]) path.push([cur % world.w, (cur / world.w) | 0]);
  return path.reverse();
}

export function reveal(world) {
  const r = LIGHT_RADIUS;
  for (let y = world.py - r; y <= world.py + r; y++) {
    for (let x = world.px - r; x <= world.px + r; x++) {
      if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue;
      if ((x - world.px) ** 2 + (y - world.py) ** 2 <= r * r + 1) world.seen[y * world.w + x] = 1;
    }
  }
}

export const isLit = (world, x, y) => (x - world.px) ** 2 + (y - world.py) ** 2 <= LIGHT_RADIUS ** 2 + 1;

// Moves the player one tile. Returns what happened:
//   { blocked } | { object } | { encounter: [enemyKeys] } | {}
export function step(world, run, dx, dy, rng = Math.random) {
  const nx = world.px + dx, ny = world.py + dy;
  if (!isFloor(world, nx, ny)) return { blocked: true };
  const obj = objectAt(world, nx, ny);
  // People and monsters stay put; you stop next to them and interact.
  if (obj && BLOCKING.has(obj.type)) return { object: obj };
  world.px = nx; world.py = ny;
  reveal(world);
  if (obj) return { object: obj };

  run.dread += ENCOUNTER.dreadPerStep;
  world.stepsSinceFight++;
  if (world.stepsSinceFight < ENCOUNTER.graceSteps) return {};
  const chance = Math.min(ENCOUNTER.max, ENCOUNTER.base + run.dread * ENCOUNTER.perDread);
  if (rng() < chance) {
    world.stepsSinceFight = 0;
    const pool = REGIONS[world.regionIdx].encounters;
    return { encounter: pool[Math.floor(rng() * pool.length)] };
  }
  return {};
}

export function nodeLabel(obj) {
  return RAW_MATERIALS[obj.raw].node;
}
