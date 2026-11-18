// Solara Bay — the city itself: a procedural grid of blocks with varied
// buildings, roads, sidewalks, streetlights, palms, a beach and an ocean,
// plus the collision data the rest of the game drives on. Seeded, so the
// same seed always builds the same city.

import * as THREE from 'three';
import { CITY, PALETTE, PLACES } from './config.js';
import { pick, range, rangeInt } from './random.js';

const ROAD_LINES = [];
for (let v = -CITY.half; v <= CITY.half; v += CITY.block) ROAD_LINES.push(v);
// Block centres sit between the roads: a block spans road+7 to road+63.
const BLOCK_CENTERS = [];
for (let v = -CITY.half + CITY.block / 2; v <= CITY.half; v += CITY.block) BLOCK_CENTERS.push(v);

function makeWindowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      g.fillStyle = Math.random() < 0.28 ? '#ffd98a' : '#2c3e50';
      g.fillRect(x, y, 12, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeGroundTexture() {
  const S = 2048, W = 720; // world -360..360 maps to the canvas
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + 360) / W) * S;
  const px = (v) => (v / W) * S;
  g.fillStyle = '#6f9e57'; g.fillRect(0, 0, S, S);           // grass base
  // Sand and ocean on the east edge.
  g.fillStyle = '#e8d29a'; g.fillRect(toPx(CITY.beachX - 6), 0, px(60), S);
  g.fillStyle = '#1e6fa8'; g.fillRect(toPx(CITY.oceanX), 0, S - toPx(CITY.oceanX), S);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let y = 0; y < S; y += 64) g.fillRect(toPx(CITY.oceanX + 4), y, px(6), 26);
  // Sidewalk slabs around every block.
  g.fillStyle = '#9aa0a3';
  for (const bx of ROAD_LINES) for (const bz of ROAD_LINES) {
    g.fillRect(toPx(bx - 32), toPx(bz - 32), px(64), px(64));
  }
  // Roads.
  g.fillStyle = '#3a3f46';
  for (const v of ROAD_LINES) {
    g.fillRect(toPx(v - 7), 0, px(14), S);
    g.fillRect(0, toPx(v - 7), S, px(14));
  }
  // Lane dashes.
  g.fillStyle = '#e8d23c';
  for (const v of ROAD_LINES) {
    for (let t = -350; t < 360; t += 24) {
      g.fillRect(toPx(v - 0.7), toPx(t), px(1.4), px(12));
      g.fillRect(toPx(t), toPx(v - 0.7), px(12), px(1.4));
    }
  }
  // Palm Court Plaza: a green square in the (-35,-35) block.
  g.fillStyle = '#5da24a'; g.fillRect(toPx(-67), toPx(-67), px(64), px(64));
  g.fillStyle = '#7fb8d8';
  g.beginPath(); g.arc(toPx(-35), toPx(-35), px(9), 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createWorld(rng) {
  const group = new THREE.Group();
  const colliders = [];
  const buildings = [];   // {x,z,w,d,h} for the minimap and collisions
  const packageSpots = [];
  const parkSpots = [];

  // Ground: one painted plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 720),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean swell: a translucent plane that breathes over the painted water.
  const swell = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 720),
    new THREE.MeshLambertMaterial({ color: 0x2a86c8, transparent: true, opacity: 0.35 }),
  );
  swell.rotation.x = -Math.PI / 2;
  swell.position.set(CITY.oceanX + 180, -0.4, 0);
  group.add(swell);

  // Buildings, instanced: one box, tinted per instance, window texture shared.
  const winTex = makeWindowTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const placements = [];
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (bx === -35 && bz === -35) continue; // Palm Court Plaza stays open
      const count = rangeInt(rng, 1, 3);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 16, 30), d = range(rng, 16, 30);
        // Keep the whole footprint inside the block (roads start 28 m from
        // the block centre), so no building ever intrudes into a road.
        const maxOffX = Math.max(0, 27 - w / 2);
        const maxOffZ = Math.max(0, 27 - d / 2);
        const cx = bx + range(rng, -maxOffX, maxOffX);
        const cz = bz + range(rng, -maxOffZ, maxOffZ);
        // Keep every named place reachable: no building within 18 m of one.
        let nearPlace = false;
        for (const key in PLACES) {
          if (Math.hypot(cx - PLACES[key].x, cz - PLACES[key].z) < 18 + Math.max(w, d) / 2) { nearPlace = true; break; }
        }
        if (nearPlace) continue;
        const dist = Math.hypot(cx, cz);
        const h = range(rng, 8, dist < 120 ? 58 : 30);
        placements.push({ x: cx, z: cz, w, d, h, color: pick(rng, PALETTE.building) });
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        buildings.push({ x: cx, z: cz, w, d, h });
      }
    }
  }
  const buildingMesh = new THREE.InstancedMesh(
    boxGeo,
    new THREE.MeshLambertMaterial({ map: winTex }),
    placements.length,
  );
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  placements.forEach((b, i) => {
    p.set(b.x, 0, b.z); s.set(b.w, b.h, b.d);
    m.compose(p, q, s);
    buildingMesh.setMatrixAt(i, m);
    buildingMesh.setColorAt(i, col.setHex(b.color));
  });
  buildingMesh.castShadow = true; buildingMesh.receiveShadow = true;
  group.add(buildingMesh);

  // Rooftop boxes on the tallest towers, for a skyline that reads at a glance.
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofs = placements.filter((b) => b.h > 34);
  const roofMesh = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5a6068 }), roofs.length);
  roofs.forEach((b, i) => {
    p.set(b.x, b.h, b.z); s.set(b.w * 0.3, 3, b.d * 0.3);
    m.compose(p, q, s); roofMesh.setMatrixAt(i, m);
  });
  group.add(roofMesh);

  // Palm trees along the beach and the plaza.
  const palmSpots = [];
  for (let z = -260; z <= 260; z += 28) palmSpots.push({ x: CITY.beachX - 14, z: z + range(rng, -6, 6) });
  for (let i = 0; i < 10; i++) palmSpots.push({ x: -35 + range(rng, -24, 24), z: -35 + range(rng, -24, 24) });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6a42 }), palmSpots.length);
  const leafGeo = new THREE.IcosahedronGeometry(2.6, 0);
  leafGeo.scale(1, 0.55, 1); leafGeo.translate(0, 7.4, 0);
  const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: 0x2f8f4e }), palmSpots.length);
  palmSpots.forEach((pt, i) => {
    p.set(pt.x, 0, pt.z); s.set(1, 1, 1);
    m.compose(p, q, s);
    trunkMesh.setMatrixAt(i, m); leafMesh.setMatrixAt(i, m);
  });
  group.add(trunkMesh); group.add(leafMesh);

  // Streetlights along the roads.
  const lampSpots = [];
  for (const v of ROAD_LINES) {
    for (let t = -245; t <= 245; t += 70) {
      lampSpots.push({ x: v + 8.5, z: t }); lampSpots.push({ x: t, z: v + 8.5 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 5);
  poleGeo.translate(0, 3, 0);
  const poleMesh = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x30343a }), lampSpots.length);
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  lampGeo.translate(0, 6.2, 0);
  const lampMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe9a0 }), lampSpots.length);
  lampSpots.forEach((pt, i) => {
    p.set(pt.x, 0, pt.z); s.set(1, 1, 1);
    m.compose(p, q, s);
    poleMesh.setMatrixAt(i, m); lampMesh.setMatrixAt(i, m);
  });
  group.add(poleMesh); group.add(lampMesh);

  // Park benches and a fountain ring in the plaza.
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
    bench.position.set(-35 + Math.cos(a) * 16, 0.5, -35 + Math.sin(a) * 16);
    bench.rotation.y = -a + Math.PI / 2;
    group.add(bench);
  }

  // Hidden cash packages: seeded sidewalk spots, away from the plaza.
  for (let i = 0; i < 8; i++) {
    const bx = pick(rng, ROAD_LINES), bz = pick(rng, ROAD_LINES);
    if (bx === 0 && bz === 0) { i--; continue; }
    packageSpots.push({ x: bx + pick(rng, [-38, 38]), z: bz + range(rng, -30, 30) });
  }
  // Parked cars live on the roads; parking spots are handed to vehicles.js.
  for (let i = 0; i < 14; i++) {
    const v = pick(rng, ROAD_LINES);
    parkSpots.push({ x: v + pick(rng, [-5.2, 5.2]), z: range(rng, -260, 260), along: 'z' });
    parkSpots.push({ x: range(rng, -260, 260), z: v + pick(rng, [-5.2, 5.2]), along: 'x' });
  }

  function collideCircle(px, pz, r) {
    // Push a circle out of every building AABB it overlaps; clamp to the map.
    let x = px, z = pz;
    for (const b of colliders) {
      const nx = Math.max(b.minX, Math.min(x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the shallowest axis.
        const l = x - b.minX, ri = b.maxX - x, t = z - b.minZ, bo = b.maxZ - z;
        const min = Math.min(l, ri, t, bo);
        if (min === l) x = b.minX - r; else if (min === ri) x = b.maxX + r;
        else if (min === t) z = b.minZ - r; else z = b.maxZ + r;
      }
    }
    x = Math.max(-290, Math.min(360, x));
    z = Math.max(-290, Math.min(290, z));
    return { x, z };
  }

  function onRoad(x, z) {
    for (const v of ROAD_LINES) {
      if (Math.abs(x - v) < 7.5 || Math.abs(z - v) < 7.5) return true;
    }
    return false;
  }

  function update(dt, time) {
    swell.material.opacity = 0.3 + Math.sin(time * 0.7) * 0.08;
    swell.position.y = -0.4 + Math.sin(time * 0.5) * 0.08;
  }

  return { group, colliders, buildings, packageSpots, parkSpots, roadLines: ROAD_LINES, collideCircle, onRoad, update };
}
