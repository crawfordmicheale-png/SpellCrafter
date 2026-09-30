import { REGIONS, RAW_MATERIALS, ENEMIES, EVENTS } from './data.js';
import { isFloor } from './world.js';
import { sprite, NODE_SPRITES } from './sprites.js';

const PX = 16;          // sprite size
const STEP_MS = 85;     // matches the walking speed in main.js
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function objectName(obj) {
  switch (obj.type) {
    case 'node': return `${obj.pristine ? 'Glinting ' : ''}${RAW_MATERIALS[obj.raw].node}${obj.pristine ? ' (pristine)' : ''}`;
    case 'chest': return 'Reliquary box';
    case 'desk': return 'Writing desk';
    case 'merchant': return 'The Rag Merchant';
    case 'exit': return 'Stairs down';
    case 'up': return 'Stairs up to the surface';
    case 'event': return EVENTS[obj.event].name;
    case 'elite': case 'boss': return ENEMIES[obj.enemy].name;
  }
  return '';
}

function objectSprite(o) {
  switch (o.type) {
    case 'node': { const [name, swap] = NODE_SPRITES[o.raw]; return [name, swap]; }
    case 'chest': return ['chest'];
    case 'desk': return ['desk'];
    case 'merchant': return ['merchant'];
    case 'exit': return ['stairsDown'];
    case 'up': return ['stairsUp'];
    case 'event': return [o.event];
    case 'elite': case 'boss': return [o.enemy];
  }
  return null;
}

// Draws the world around the player on a canvas.
export function createExploreView(canvas, world, { onTile, onHover, playerSwap }) {
  const ctx = canvas.getContext('2d');
  const tiles = REGIONS[world.regionIdx].tiles;
  let cols = 17, rows = 11, camX = 0, camY = 0, raf = 0, alive = true;
  // Screen pixels per sprite pixel. Whole numbers keep the pixels crisp.
  let TILE = PX * 3;

  function resize() {
    const w = canvas.parentElement.clientWidth;
    TILE = PX * (w >= 700 ? 3 : 2);
    cols = Math.max(9, Math.floor(w / TILE));
    if (cols % 2 === 0) cols--; // odd, so the player sits in the middle
    rows = 11;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cols * TILE}px`;
    canvas.style.height = `${rows * TILE}px`;
    canvas.width = cols * TILE * dpr;
    canvas.height = rows * TILE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const blit = (canvasSprite, sx, sy, flip = false) => {
    if (!flip) { ctx.drawImage(canvasSprite, sx, sy, TILE, TILE); return; }
    ctx.save();
    ctx.translate(sx + TILE, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(canvasSprite, 0, 0, TILE, TILE);
    ctx.restore();
  };

  function glow(cx, cy, radius, color) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  // Smooth movement: the drawn position glides toward the real tile.
  let rx = world.px, ry = world.py, lastT = 0, walkT = 0;
  const floats = []; // rising text for pickups

  function draw(t = 0) {
    const dt = lastT ? Math.min(100, t - lastT) : 16;
    lastT = t;
    const dx = world.px - rx, dy = world.py - ry;
    const dist = Math.hypot(dx, dy);
    if (dist > 2.5 || reduceMotion()) { rx = world.px; ry = world.py; }
    else if (dist > 0) {
      const stepLen = Math.min(dist, dt / STEP_MS);
      rx += (dx / dist) * stepLen; ry += (dy / dist) * stepLen;
      walkT += dt;
    }
    const moving = Math.hypot(world.px - rx, world.py - ry) > 0.02;
    if (!moving) walkT = 0;

    const W = cols * TILE, H = rows * TILE;
    const scale = TILE / PX;
    // Camera in screen pixels, snapped to the sprite-pixel grid so nothing shimmers.
    const camPX = Math.round(((rx + 0.5) * TILE - W / 2) / scale) * scale;
    const camPY = Math.round(((ry + 0.5) * TILE - H / 2) / scale) * scale;
    camX = camPX / TILE; camY = camPY / TILE;
    const x0 = Math.floor(camX), y0 = Math.floor(camY);
    const sxOf = x => x * TILE - camPX, syOf = y => y * TILE - camPY;
    ctx.fillStyle = '#07050a';
    ctx.fillRect(0, 0, W, H);
    const inMap = (x, y) => x >= 0 && y >= 0 && x < world.w && y < world.h;

    for (let y = y0; y <= y0 + rows; y++) {
      for (let x = x0; x <= x0 + cols; x++) {
        if (!inMap(x, y) || !world.seen[y * world.w + x]) continue;
        const sx = sxOf(x), sy = syOf(y);
        if (world.tiles[y * world.w + x]) {
          const h = hash(x, y) % 9;
          blit(sprite(h < 5 ? 'floor1' : h < 7 ? 'floor3' : 'floor2', { tiles }), sx, sy);
        } else if (isFloor(world, x, y + 1)) {
          blit(sprite('wallFace', { tiles }), sx, sy);
        } else if (isFloor(world, x, y - 1) || isFloor(world, x + 1, y) || isFloor(world, x - 1, y)
          || isFloor(world, x + 1, y + 1) || isFloor(world, x - 1, y + 1)) {
          blit(sprite('wallTop', { tiles }), sx, sy);
        }
      }
    }

    const flicker = reduceMotion() ? 0 : Math.sin(t / 170) * 0.5 + Math.sin(t / 61) * 0.3;
    const bobbing = reduceMotion() ? 0 : Math.round(Math.sin(t / 420)) * scale; // idle hover for creatures
    for (const o of world.objects) {
      if (o.gone || !inMap(o.x, o.y) || !world.seen[o.y * world.w + o.x]) continue;
      if (o.x < x0 - 1 || o.y < y0 - 1 || o.x > x0 + cols + 1 || o.y > y0 + rows + 1) continue;
      const sx = sxOf(o.x), sy = syOf(o.y);
      if (o.type === 'desk') glow(sx + TILE * 0.8, sy + TILE * 0.1, TILE * (1.4 + flicker * 0.1), '#ffcf7a55');
      if (o.type === 'boss' || o.type === 'elite') {
        const pulse = reduceMotion() ? 0 : Math.sin(t / 300) * 0.15;
        glow(sx + TILE / 2, sy + TILE / 2, TILE * (0.9 + pulse), '#b1352f66');
      }
      if (o.type === 'event') glow(sx + TILE / 2, sy + TILE / 2, TILE * (0.8 + flicker * 0.05), '#8e5fb055');
      if (o.type === 'up') glow(sx + TILE / 2, sy + TILE * 0.1, TILE * 0.9, '#fff1b833');
      const [name, swap] = objectSprite(o);
      if (o.pristine && !reduceMotion()) {
        // A pristine spot glints: a small four-point star that pulses.
        const phase = (Math.sin(t / 260 + o.id) + 1) / 2;
        const px = TILE / PX, cx = sx + TILE * 0.72, cy = sy + TILE * 0.22;
        ctx.fillStyle = `rgba(220, 240, 255, ${0.35 + phase * 0.65})`;
        ctx.fillRect(cx - px * 2, cy, px * 5, px);
        ctx.fillRect(cx, cy - px * 2, px, px * 5);
      }
      const lift = (o.type === 'elite' || o.type === 'boss' || o.type === 'event') ? bobbing : 0;
      blit(sprite(name, { swap }), sx, sy + lift);
    }

    // The Inkbinder, facing the way they last walked, with a step bob.
    const bob = moving && Math.floor(walkT / (STEP_MS / 2)) % 2 ? -scale : 0;
    const ppx = Math.round((rx * TILE - camPX) / scale) * scale;
    const ppy = Math.round((ry * TILE - camPY) / scale) * scale;
    blit(sprite('player', { swap: playerSwap }), ppx, ppy + bob, world.facing < 0);

    // Lantern light in stepped bands, centred on where the lantern is drawn.
    const r = world.radius;
    for (let y = y0; y <= y0 + rows; y++) {
      for (let x = x0; x <= x0 + cols; x++) {
        if (!inMap(x, y) || !world.seen[y * world.w + x]) continue;
        const d = Math.hypot(x - rx, y - ry);
        let a;
        if (d <= r - 1.5) a = 0;
        else if (d <= r - 0.5) a = 0.22;
        else if (d <= r + 0.5 + flicker * 0.4) a = 0.45;
        else a = 0.74;
        if (a) { ctx.fillStyle = `rgba(7,5,10,${a})`; ctx.fillRect(sxOf(x), syOf(y), TILE, TILE); }
      }
    }
    const lx = ppx + TILE * (world.facing < 0 ? 0.1 : 0.9), ly = ppy + TILE * 0.55 + bob;
    glow(lx, ly, TILE * (r + 0.5 + flicker * 0.15), '#ffc46a26');
    glow(lx, ly, TILE * 0.6, '#ffd27a55');

    // Floating pickup text.
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      const age = (t - (f.start ??= t)) / 1100;
      if (age >= 1) { floats.splice(i, 1); continue; }
      const fx = sxOf(f.x) + TILE / 2, fy = syOf(f.y) - age * TILE * 0.9 - f.row * 18;
      ctx.globalAlpha = age < 0.7 ? 1 : (1 - age) / 0.3;
      ctx.font = `600 ${Math.max(13, TILE * 0.34)}px 'Alegreya SC', Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#0d0a10';
      ctx.strokeText(f.text, fx, fy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, fx, fy);
      ctx.globalAlpha = 1;
    }
  }

  function loop(t) {
    if (!alive) return;
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  const toTile = e => {
    const rect = canvas.getBoundingClientRect();
    return [Math.floor(camX + (e.clientX - rect.left) / TILE), Math.floor(camY + (e.clientY - rect.top) / TILE)];
  };
  canvas.addEventListener('click', e => onTile(...toTile(e)));
  canvas.addEventListener('mousemove', e => onHover?.(...toTile(e), e));
  canvas.addEventListener('mouseleave', () => onHover?.(null));

  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(canvas.parentElement);
  resize();
  raf = requestAnimationFrame(loop);

  return {
    destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); },
    draw,
    // Show rising text over a tile, e.g. "+2 Ash". Several at once stack upward.
    float(x, y, text, color = '#e6dcc6') {
      floats.push({ x, y, text, color, row: floats.filter(f => f.x === x && f.y === y).length });
    },
  };
}
