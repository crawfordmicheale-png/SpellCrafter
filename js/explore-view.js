import { REGIONS, RAW_MATERIALS, ENEMIES } from './data.js';
import { isFloor, isLit, LIGHT_RADIUS } from './world.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function objectName(obj) {
  switch (obj.type) {
    case 'node': return RAW_MATERIALS[obj.raw].node;
    case 'chest': return 'Reliquary box';
    case 'desk': return 'Writing desk';
    case 'merchant': return 'The Rag Merchant';
    case 'exit': return 'Stairs down';
    case 'elite': case 'boss': return ENEMIES[obj.enemy].name;
  }
  return '';
}

// Draws the world around the player on a canvas. Stateless apart from the camera.
export function createExploreView(canvas, world, { onTile, onHover }) {
  const ctx = canvas.getContext('2d');
  let tile = 24, camX = 0, camY = 0, raf = 0, alive = true;
  let VIEW_COLS = 23, VIEW_ROWS = 15;
  const pal = REGIONS[world.regionIdx].palette;

  function resize() {
    const w = canvas.parentElement.clientWidth;
    // Narrow screens show fewer, bigger tiles so they stay tappable.
    VIEW_COLS = w < 560 ? 13 : 23;
    VIEW_ROWS = w < 560 ? 13 : 15;
    tile = Math.max(14, Math.floor(w / VIEW_COLS));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${tile * VIEW_COLS}px`;
    canvas.style.height = `${tile * VIEW_ROWS}px`;
    canvas.width = tile * VIEW_COLS * dpr;
    canvas.height = tile * VIEW_ROWS * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

  function drawObject(o, sx, sy, t) {
    const c = tile / 2, cx = sx + c, cy = sy + c;
    ctx.save();
    switch (o.type) {
      case 'node': {
        const col = RAW_MATERIALS[o.raw].color;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, cy - tile * 0.28); ctx.lineTo(cx + tile * 0.22, cy);
        ctx.lineTo(cx, cy + tile * 0.28); ctx.lineTo(cx - tile * 0.22, cy); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff55';
        ctx.fillRect(cx - tile * 0.06, cy - tile * 0.16, tile * 0.08, tile * 0.08);
        break;
      }
      case 'chest':
        ctx.fillStyle = '#6b4527'; ctx.fillRect(sx + tile * 0.18, sy + tile * 0.3, tile * 0.64, tile * 0.44);
        ctx.fillStyle = '#c89e55'; ctx.fillRect(sx + tile * 0.18, sy + tile * 0.44, tile * 0.64, tile * 0.08);
        ctx.fillRect(cx - tile * 0.05, sy + tile * 0.4, tile * 0.1, tile * 0.16);
        break;
      case 'desk': {
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(sx + tile * 0.1, sy + tile * 0.4, tile * 0.8, tile * 0.3);
        ctx.fillStyle = '#efe4c9'; ctx.fillRect(sx + tile * 0.2, sy + tile * 0.44, tile * 0.3, tile * 0.16);
        const flick = reduceMotion() ? 1 : 0.85 + Math.sin(t / 110) * 0.08 + Math.sin(t / 37) * 0.05;
        const g = ctx.createRadialGradient(sx + tile * 0.72, sy + tile * 0.3, 0, sx + tile * 0.72, sy + tile * 0.3, tile * 1.2 * flick);
        g.addColorStop(0, '#ffd27a88'); g.addColorStop(1, '#ffd27a00');
        ctx.fillStyle = g; ctx.fillRect(sx - tile, sy - tile, tile * 3, tile * 3);
        ctx.fillStyle = '#ffe3a1'; ctx.beginPath(); ctx.arc(sx + tile * 0.72, sy + tile * 0.3, tile * 0.07, 0, 7); ctx.fill();
        break;
      }
      case 'merchant':
        ctx.fillStyle = '#3d2f45'; ctx.beginPath(); ctx.arc(cx, cy + tile * 0.05, tile * 0.32, Math.PI, 0); ctx.lineTo(cx + tile * 0.32, cy + tile * 0.36); ctx.lineTo(cx - tile * 0.32, cy + tile * 0.36); ctx.fill();
        ctx.fillStyle = '#0c090e'; ctx.beginPath(); ctx.arc(cx, cy - tile * 0.02, tile * 0.14, 0, 7); ctx.fill();
        ctx.fillStyle = '#e0b95c'; ctx.beginPath(); ctx.arc(cx + tile * 0.34, cy + tile * 0.1, tile * 0.07, 0, 7); ctx.fill();
        break;
      case 'exit':
        ctx.fillStyle = '#0a0709'; ctx.fillRect(sx + tile * 0.12, sy + tile * 0.12, tile * 0.76, tile * 0.76);
        ctx.strokeStyle = '#c89e55'; ctx.lineWidth = Math.max(1, tile * 0.06);
        for (let i = 0; i < 4; i++) {
          const y = sy + tile * (0.22 + i * 0.17);
          ctx.beginPath(); ctx.moveTo(sx + tile * (0.2 + i * 0.08), y); ctx.lineTo(sx + tile * (0.8 - i * 0.08), y); ctx.stroke();
        }
        break;
      case 'elite': case 'boss': {
        const big = o.type === 'boss';
        const pulse = reduceMotion() ? 0 : Math.sin(t / 300) * tile * 0.05;
        ctx.strokeStyle = '#b1352f'; ctx.lineWidth = Math.max(1, tile * 0.07);
        ctx.beginPath(); ctx.arc(cx, cy, tile * (big ? 0.46 : 0.38) + pulse, 0, 7); ctx.stroke();
        ctx.fillStyle = big ? '#5a1a17' : '#3a1614';
        ctx.beginPath(); ctx.arc(cx, cy, tile * (big ? 0.34 : 0.28), 0, 7); ctx.fill();
        ctx.fillStyle = '#e7837b';
        ctx.beginPath(); ctx.arc(cx - tile * 0.1, cy - tile * 0.04, tile * 0.05, 0, 7); ctx.arc(cx + tile * 0.1, cy - tile * 0.04, tile * 0.05, 0, 7); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function draw(t = 0) {
    const W = VIEW_COLS * tile, H = VIEW_ROWS * tile;
    camX = world.px - (VIEW_COLS >> 1);
    camY = world.py - (VIEW_ROWS >> 1);
    ctx.fillStyle = '#07050a';
    ctx.fillRect(0, 0, W, H);

    for (let vy = 0; vy < VIEW_ROWS; vy++) {
      for (let vx = 0; vx < VIEW_COLS; vx++) {
        const x = camX + vx, y = camY + vy, i = y * world.w + x;
        const sx = vx * tile, sy = vy * tile;
        if (x < 0 || y < 0 || x >= world.w || y >= world.h || !world.seen[i]) continue;
        if (world.tiles[i]) {
          ctx.fillStyle = hash(x, y) % 5 === 0 ? pal.floor2 : pal.floor;
          ctx.fillRect(sx, sy, tile, tile);
          if (hash(x, y) % 11 === 0) { ctx.fillStyle = '#00000033'; ctx.fillRect(sx + tile * 0.3, sy + tile * 0.55, tile * 0.18, tile * 0.1); }
        } else if (isFloor(world, x, y + 1) || isFloor(world, x, y - 1) || isFloor(world, x + 1, y) || isFloor(world, x - 1, y)) {
          // Masonry: a block face with offset mortar lines, lit edge facing the floor.
          ctx.fillStyle = pal.wall;
          ctx.fillRect(sx, sy, tile, tile);
          ctx.fillStyle = '#00000055';
          const half = tile / 2, off = (y % 2) * half;
          ctx.fillRect(sx, sy + half - 1, tile, 1);
          ctx.fillRect(sx + (off + half / 2) % tile, sy, 1, half);
          ctx.fillRect(sx + (off + half * 1.5) % tile, sy + half, 1, half);
          if (isFloor(world, x, y + 1)) { ctx.fillStyle = pal.edge; ctx.fillRect(sx, sy + tile * 0.8, tile, tile * 0.2); }
        }
      }
    }
    for (const o of world.objects) {
      if (o.gone || !world.seen[o.y * world.w + o.x]) continue;
      const vx = o.x - camX, vy = o.y - camY;
      if (vx < 0 || vy < 0 || vx >= VIEW_COLS || vy >= VIEW_ROWS) continue;
      drawObject(o, vx * tile, vy * tile, t);
    }
    // Remembered-but-dark tiles are dimmed.
    ctx.fillStyle = '#07050a99';
    for (let vy = 0; vy < VIEW_ROWS; vy++) for (let vx = 0; vx < VIEW_COLS; vx++) {
      const x = camX + vx, y = camY + vy;
      if (x >= 0 && y >= 0 && x < world.w && y < world.h && world.seen[y * world.w + x] && !isLit(world, x, y)) ctx.fillRect(vx * tile, vy * tile, tile, tile);
    }

    // The Inkbinder and their lantern.
    const px = (world.px - camX + 0.5) * tile, py = (world.py - camY + 0.5) * tile;
    const flick = reduceMotion() ? 1 : 1 + Math.sin(t / 140) * 0.03 + Math.sin(t / 53) * 0.02;
    const light = ctx.createRadialGradient(px, py, tile * 0.5, px, py, tile * (LIGHT_RADIUS + 0.8) * flick);
    light.addColorStop(0, '#ffcf8025'); light.addColorStop(0.6, '#ffcf800a'); light.addColorStop(1, '#07050a88');
    ctx.fillStyle = light; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1b1420';
    ctx.beginPath(); ctx.arc(px, py + tile * 0.06, tile * 0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c89e55'; ctx.lineWidth = Math.max(1, tile * 0.08);
    ctx.beginPath(); ctx.arc(px, py + tile * 0.06, tile * 0.3, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffe3a1'; ctx.beginPath(); ctx.arc(px + tile * 0.26, py - tile * 0.18, tile * 0.09, 0, 7); ctx.fill();
  }

  function loop(t) {
    if (!alive) return;
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  const toTile = e => {
    const r = canvas.getBoundingClientRect();
    return [camX + Math.floor((e.clientX - r.left) / tile), camY + Math.floor((e.clientY - r.top) / tile)];
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
