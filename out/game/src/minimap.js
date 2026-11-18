// Solara Bay — the minimap: a top-down canvas in the HUD corner. Roads,
// blocks, the beach and the ocean, the player arrow, cars, police, the
// mission marker and the hidden packages, all drawn from the live world.

import { CITY } from './config.js';

export function createMinimap(canvas, G) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width; // square canvas
  const scale = S / 760;  // world -380..380
  const toMap = (x, z) => [(x + 380) * scale, (z + 380) * scale];

  function draw() {
    ctx.clearRect(0, 0, S, S);
    // Ocean and sand.
    ctx.fillStyle = '#1e6fa8';
    ctx.fillRect((CITY.oceanX + 380) * scale, 0, S, S);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect((CITY.beachX + 380) * scale, 0, (CITY.oceanX - CITY.beachX) * scale, S);
    // Blocks.
    ctx.fillStyle = '#7d8a7a';
    for (const b of G.world.buildings) {
      const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(x, y, b.w * scale, b.d * scale);
    }
    // Roads.
    ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 14 * scale;
    for (const v of G.world.roadLines) {
      const [x1] = toMap(v, -380); const [, y1] = toMap(-380, v);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(S, y1); ctx.stroke();
    }
    // Packages.
    ctx.fillStyle = '#ffd23c';
    for (const pkg of G.missions.packages) {
      if (pkg.taken) continue;
      const [x, y] = toMap(pkg.x, pkg.z);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Mission marker, pulsing.
    const t = G.missions.targetPos();
    if (t) {
      const [x, y] = toMap(t.x, t.z);
      const r = 7 + Math.sin(performance.now() / 250) * 2;
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // NPC cars (white) and police (red).
    for (const car of G.cars) {
      if (!car.alive) continue;
      const [x, y] = toMap(car.x, car.z);
      ctx.fillStyle = car.police ? '#ff2222' : '#ffffff';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Pedestrians, faint.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const p of G.pedestrians.peds) {
      if (!p.alive) continue;
      const [x, y] = toMap(p.x, p.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Player arrow.
    const px = G.player.inCar ? G.player.inCar.x : G.player.x;
    const pz = G.player.inCar ? G.player.inCar.z : G.player.z;
    const heading = G.player.inCar ? G.player.inCar.heading : G.player.heading;
    const [x, y] = toMap(px, pz);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.fillStyle = '#00e676';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  return { draw };
}
