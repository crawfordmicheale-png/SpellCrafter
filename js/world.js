import { REGIONS, RAW_MATERIALS, ENCOUNTER, LANTERN, EVENTS, PRISTINE, DELVE, DELVE_CONDITIONS, TRAPS } from './data.js';

export const WALL = 0, FLOOR = 1;
export const MAP_W = 38, MAP_H = 26;
export const LIGHT_RADIUS = 5;

export function lightRadius(oil) {
  for (const [min, r] of LANTERN.radii) if (oil >= min) return r;
  return 1;
}

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

// One delve: rooms joined by L-shaped corridors, plus a few extra links so there are loops.
// opts.elite puts an elite on the way out; opts.events is the pool of events not yet seen this run;
// opts.cond is a delve condition (DELVE_CONDITIONS).
export function generateRegion(regionIdx, seed, opts = {}) {
  const rng = mulberry32(seed);
  const region = REGIONS[regionIdx];
  const haunted = !!opts.elite;
  const lower = !!opts.lower; // the level beneath a trapdoor
  const cond = lower ? DELVE.lower : DELVE_CONDITIONS[opts.cond] || {};
  const base = lower ? DELVE.lower : haunted ? DELVE.haunted : DELVE.plain;
  const size = {
    rooms: Math.max(4, base.rooms + (lower ? 0 : cond.rooms || 0)),
    nodes: Math.max(3, base.nodes + (lower ? 0 : cond.nodes || 0)),
    chests: Math.max(0, base.chests + (lower ? 0 : cond.chests || 0)),
  };
  const raws = { ...region.raws };
  for (const [k, w] of Object.entries(cond.raws || {})) raws[k] = (raws[k] || 0) + w;
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const at = (x, y) => y * MAP_W + x;
  const carve = (x, y) => { if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1) tiles[at(x, y)] = FLOOR; };

  const rooms = [];
  for (let tries = 0; tries < 200 && rooms.length < size.rooms; tries++) {
    const w = randInt(rng, 4, 8), h = randInt(rng, 4, 6);
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
  for (let i = 0; i < 2; i++) corridor(rooms[randInt(rng, 0, rooms.length - 1)], rooms[randInt(rng, 0, rooms.length - 1)]);

  const world = {
    regionIdx, seed, tiles, rooms, cond: lower ? null : opts.cond || null, lower,
    w: MAP_W, h: MAP_H,
    seen: new Uint8Array(MAP_W * MAP_H),
    objects: [],
    px: rooms[0].cx, py: rooms[0].cy,
    stepsSinceFight: 0,
    radius: LIGHT_RADIUS,
    facing: 1,
    oilSteps: 0,
  };

  // Farthest room from the start holds the way out.
  const dist = distances(world, world.px, world.py);
  const byDistance = rooms.slice(1).sort((a, b) => dist[at(b.cx, b.cy)] - dist[at(a.cx, a.cy)]);
  const exitRoom = byDistance[0];

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

  // The way back up to the surface is where you arrive. The way out is at the far end.
  // There is no climbing back to the surface from a lower level.
  if (!lower) world.objects.push({ id: nextId++, type: 'up', x: world.px, y: world.py });
  place('exit', exitRoom.cx, exitRoom.cy, { guard: opts.elite || null });

  // A writing desk close to the start, so you can craft what you find.
  const nearStart = rooms.slice(1).filter(r => r !== exitRoom)
    .sort((a, b) => dist[at(a.cx, a.cy)] - dist[at(b.cx, b.cy)]);
  const deskRoom = nearStart[0];
  if (deskRoom && !cond.noDesk && !lower) place('desk', deskRoom.cx, deskRoom.cy);
  for (let i = 0; i < size.chests; i++) {
    const spot = freeTileIn(rooms[randInt(rng, 1, rooms.length - 1)]);
    if (spot) place('chest', ...spot);
  }
  const eventPool = [...(opts.events || Object.keys(EVENTS))];
  if (eventPool.length && !lower && rng() < DELVE.eventChance) {
    const spot = freeTileIn(rooms[randInt(rng, 1, rooms.length - 1)]);
    if (spot) place('event', ...spot, { event: eventPool[randInt(rng, 0, eventPool.length - 1)] });
  }
  for (let i = 0; i < size.nodes; i++) {
    const spot = freeTileIn(rooms[randInt(rng, 0, rooms.length - 1)]);
    if (!spot) continue;
    const raw = weightedPick(raws, rng);
    place('node', ...spot, { raw, amount: rng() < 0.35 ? 2 : 1, pristine: rng() < PRISTINE.chance * (lower ? 2 : 1) });
  }

  // ----- secrets -----
  if (rng() < DELVE.secretChance) placeSecretRoom(world, rng, place, occupied);
  const inRoom = (x, y) => rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const halls = []; // corridor tiles, where traps hide
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (tiles[at(x, y)] === FLOOR && !inRoom(x, y) && !occupied.has(at(x, y)) && !world.objects.some(o => o.x === x && o.y === y)) halls.push([x, y]);
  }
  const traps = randInt(rng, ...DELVE.traps);
  const kinds = Object.keys(TRAPS);
  for (let i = 0; i < traps && halls.length; i++) {
    const [x, y] = halls.splice(randInt(rng, 0, halls.length - 1), 1)[0];
    place('trap', x, y, { trap: kinds[randInt(rng, 0, kinds.length - 1)] });
  }
  const quiet = opts.cond === 'hallowed' || opts.cond === 'collapsing';
  if (!lower && !quiet && rng() < DELVE.lowerChance) {
    const r = rooms.slice(1).filter(m => m !== exitRoom)[randInt(rng, 0, Math.max(0, rooms.length - 3))];
    const spot = r && freeTileIn(r);
    if (spot) place('hatch', ...spot);
  }

  reveal(world);
  return world;
}

// A small room behind a cracked wall: two tiles out from an existing room, joined by a
// short passage whose first tile is the crack. Holds a reliquary and a glinting spot.
function placeSecretRoom(world, rng, place, occupied) {
  const { tiles, rooms } = world;
  const at = (x, y) => y * MAP_W + x;
  const wallAt = (x, y) => x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1 && tiles[at(x, y)] === WALL;
  const clear = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!wallAt(x, y)) return false;
    return true;
  };
  for (let tries = 0; tries < 40; tries++) {
    const r = rooms[randInt(rng, 1, rooms.length - 1)];
    const dir = randInt(rng, 0, 3);
    let crack, pass, room; // tiles: crack, the passage tile after it, and the 3x3 room's top-left
    if (dir === 0) { const y = randInt(rng, r.y, r.y + r.h - 1); crack = [r.x + r.w, y]; pass = [r.x + r.w + 1, y]; room = [r.x + r.w + 2, y - 1]; }
    else if (dir === 1) { const y = randInt(rng, r.y, r.y + r.h - 1); crack = [r.x - 1, y]; pass = [r.x - 2, y]; room = [r.x - 5, y - 1]; }
    else if (dir === 2) { const x = randInt(rng, r.x, r.x + r.w - 1); crack = [x, r.y + r.h]; pass = [x, r.y + r.h + 1]; room = [x - 1, r.y + r.h + 2]; }
    else { const x = randInt(rng, r.x, r.x + r.w - 1); crack = [x, r.y - 1]; pass = [x, r.y - 2]; room = [x - 1, r.y - 5]; }
    const [rx, ry] = room;
    // The passage and room (plus a wall's width around them) must be solid rock.
    const [px, py] = pass, [cx, cy] = crack;
    const box = [Math.min(px, rx) - 1, Math.min(py, ry) - 1, Math.max(px, rx + 2) + 1, Math.max(py, ry + 2) + 1];
    if (!clear(...box) || !wallAt(cx, cy)) continue;
    const side = dir < 2 ? [[cx, cy - 1], [cx, cy + 1]] : [[cx - 1, cy], [cx + 1, cy]];
    if (side.some(([x, y]) => !wallAt(x, y))) continue;
    tiles[at(cx, cy)] = FLOOR; tiles[at(px, py)] = FLOOR;
    for (let y = ry; y < ry + 3; y++) for (let x = rx; x < rx + 3; x++) tiles[at(x, y)] = FLOOR;
    place('crack', cx, cy);
    place('chest', rx + 1, ry + 1, { secret: true });
    const raws = ['silver', 'gold', 'slate', 'mirror'];
    place('node', rx, ry + 2, { raw: raws[randInt(rng, 0, raws.length - 1)], amount: 2, pristine: true });
    world.secret = { x: rx + 1, y: ry + 1 };
    return true;
  }
  return false;
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
export const BLOCKING = new Set(['merchant', 'elite', 'boss', 'desk', 'crack']);

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
  const r = world.radius;
  for (let y = world.py - r; y <= world.py + r; y++) {
    for (let x = world.px - r; x <= world.px + r; x++) {
      if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue;
      if ((x - world.px) ** 2 + (y - world.py) ** 2 <= r * r + 1) world.seen[y * world.w + x] = 1;
    }
  }
}

export const isLit = (world, x, y) => (x - world.px) ** 2 + (y - world.py) ** 2 <= world.radius ** 2 + 1;

// Moves the player one tile. Returns what happened:
//   { blocked } | { object } | { encounter: [enemyKeys] } | {}
export function step(world, run, dx, dy, rng = Math.random) {
  const nx = world.px + dx, ny = world.py + dy;
  if (!isFloor(world, nx, ny)) return { blocked: true };
  const obj = objectAt(world, nx, ny);
  // People and monsters stay put; you stop next to them and interact.
  if (obj && BLOCKING.has(obj.type)) return { object: obj };
  world.px = nx; world.py = ny;
  if (dx) world.facing = Math.sign(dx);
  burnOil(world, run);
  reveal(world);
  if (obj) return { object: obj };

  run.dread += ENCOUNTER.dreadPerStep;
  // The Moth Lantern draws things to you: an extra point of Dread every other step.
  if (run.relics?.includes('mothlantern') && world.oilSteps % 2 === 0) run.dread += 1;
  world.stepsSinceFight++;
  if (world.stepsSinceFight < ENCOUNTER.graceSteps) return {};
  let chance = Math.min(ENCOUNTER.max, ENCOUNTER.base + run.dread * ENCOUNTER.perDread);
  chance *= DELVE_CONDITIONS[world.cond]?.encounterMult ?? 1;
  if (world.lower) chance *= DELVE.lower.encounterMult;
  if ((run.depth || 0) >= 6) chance *= 1.25; // Depth 6: restless dead
  if (run.oil <= 0) chance *= LANTERN.darkEncounterMult;
  if (rng() < chance) {
    world.stepsSinceFight = 0;
    const pool = REGIONS[world.regionIdx].encounters;
    return { encounter: pool[Math.floor(rng() * pool.length)] };
  }
  return {};
}

function burnOil(world, run) {
  const oilMult = DELVE_CONDITIONS[world.cond]?.oilMult || 1;
  const perOil = LANTERN.stepsPerOil * (run.relics?.includes('mothlantern') ? 2 : 1);
  if (++world.oilSteps >= perOil) {
    world.oilSteps = 0;
    run.oil = Math.max(0, run.oil - oilMult); // a lightless delve drinks twice as much
  }
  world.radius = lightRadius(run.oil);
}

export function nodeLabel(obj) {
  return RAW_MATERIALS[obj.raw].node;
}
