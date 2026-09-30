import { REGIONS, RAW_MATERIALS, ENEMIES } from './data.js';
import { isFloor } from './world.js';
import { sprite, NODE_SPRITES } from './sprites.js';

const PX = 16;          // sprite size
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function objectName(obj) {
  switch (obj.type) {
    case 'node': return RAW_MATERIALS[obj.raw].node;
    case 'chest': return 'Reliquary box';
    case 'desk': return 'Writing desk';
    case 'merchant': return 'The Rag Merchant';
    case 'exit': return 'Stairs down';
    case 'up': return 'Stairs up to the surface';
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
    case 'elite': case 'boss': return [o.enemy];
  }
  return null;
}

// Draws the world around the player on a canvas.
export function createExploreView(canvas, world, { onTile, onHover }) {
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

  function draw(t = 0) {
    const W = cols * TILE, H = rows * TILE;
    camX = world.px - (cols >> 1);
    camY = world.py - (rows >> 1);
    ctx.fillStyle = '#07050a';
    ctx.fillRect(0, 0, W, H);
    const inMap = (x, y) => x >= 0 && y >= 0 && x < world.w && y < world.h;

    for (let vy = 0; vy < rows; vy++) {
      for (let vx = 0; vx < cols; vx++) {
        const x = camX + vx, y = camY + vy;
        if (!inMap(x, y) || !world.seen[y * world.w + x]) continue;
        const sx = vx * TILE, sy = vy * TILE;
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
    for (const o of world.objects) {
      if (o.gone || !inMap(o.x, o.y) || !world.seen[o.y * world.w + o.x]) continue;
      const vx = o.x - camX, vy = o.y - camY;
      if (vx < 0 || vy < 0 || vx >= cols || vy >= rows) continue;
      const sx = vx * TILE, sy = vy * TILE;
      if (o.type === 'desk') glow(sx + TILE * 0.8, sy + TILE * 0.1, TILE * (1.4 + flicker * 0.1), '#ffcf7a55');
      if (o.type === 'boss' || o.type === 'elite') {
        const pulse = reduceMotion() ? 0 : Math.sin(t / 300) * 0.15;
        glow(sx + TILE / 2, sy + TILE / 2, TILE * (0.9 + pulse), '#b1352f66');
      }
      if (o.type === 'up') glow(sx + TILE / 2, sy + TILE * 0.1, TILE * 0.9, '#fff1b833');
      const [name, swap] = objectSprite(o);
      blit(sprite(name, { swap }), sx, sy);
    }

    // The Inkbinder, facing the way they last walked.
    const pvx = world.px - camX, pvy = world.py - camY;
    blit(sprite('player'), pvx * TILE, pvy * TILE, world.facing < 0);

    // Lantern light in stepped bands, the way old dungeon crawlers did it.
    const r = world.radius;
    for (let vy = 0; vy < rows; vy++) {
      for (let vx = 0; vx < cols; vx++) {
        const x = camX + vx, y = camY + vy;
        if (!inMap(x, y) || !world.seen[y * world.w + x]) continue;
        const d = Math.hypot(x - world.px, y - world.py);
        let a;
        if (d <= r - 1.5) a = 0;
        else if (d <= r - 0.5) a = 0.22;
        else if (d <= r + 0.5 + flicker * 0.4) a = 0.45;
        else a = 0.74;
        if (a) { ctx.fillStyle = `rgba(7,5,10,${a})`; ctx.fillRect(vx * TILE, vy * TILE, TILE, TILE); }
      }
    }
    const lx = pvx * TILE + TILE * (world.facing < 0 ? 0.1 : 0.9), ly = pvy * TILE + TILE * 0.55;
    glow(lx, ly, TILE * (r + 0.5 + flicker * 0.15), '#ffc46a26');
    glow(lx, ly, TILE * 0.6, '#ffd27a55');
  }

  function loop(t) {
    if (!alive) return;
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  const toTile = e => {
    const rect = canvas.getBoundingClientRect();
    return [camX + Math.floor((e.clientX - rect.left) / TILE), camY + Math.floor((e.clientY - rect.top) / TILE)];
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
  };
}
