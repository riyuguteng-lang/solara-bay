// Solara Bay — pedestrians: people walking the sidewalks, each wandering
// between random sidewalk points. They scatter when a car comes at them,
// and a punched pedestrian calls the police.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { pick, range } from './random.js';

function buildPedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a06a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), shirt);
  torso.position.y = 1.05; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.55; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22),
    new THREE.MeshLambertMaterial({ color: 0x333a44 }));
  legL.position.set(-0.13, 0.36, 0);
  const legR = legL.clone(); legR.position.x = 0.13;
  g.add(legL); g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function createPedestrians(G) {
  const peds = [];
  const lines = G.world.roadLines;
  function sidewalkPoint() {
    const line = pick(G.rng, lines);
    const side = pick(G.rng, [-10.5, 10.5]);
    const along = range(G.rng, -260, 260);
    return Math.random() < 0.5 ? { x: line + side, z: along } : { x: along, z: line + side };
  }
  for (let i = 0; i < 18; i++) {
    const mesh = buildPedMesh(pick(G.rng, PALETTE.shirt));
    const start = sidewalkPoint();
    mesh.position.set(start.x, 0, start.z);
    G.scene.add(mesh);
    peds.push({
      mesh, x: start.x, z: start.z, target: sidewalkPoint(),
      speed: range(G.rng, 1.1, 2.0), phase: range(G.rng, 0, 6),
      scared: 0, alive: true, armed: false, isPed: true,
    });
  }

  function update(dt) {
    for (const p of peds) {
      if (!p.alive) continue;
      if (p.scared > 0) p.scared -= dt;
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) { p.target = sidewalkPoint(); continue; }
      const sp = p.scared > 0 ? p.speed * 2.6 : p.speed;
      p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt;
      p.phase += dt * sp * 3;
      const swing = Math.sin(p.phase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = Math.atan2(dx, dz);
      // Scatter from a fast car heading at them.
      for (const car of G.cars) {
        if (!car.alive || Math.abs(car.speed) < 8) continue;
        const cd = Math.hypot(car.x - p.x, car.z - p.z);
        if (cd < 6) { p.scared = 2; break; }
      }
    }
  }
  return { peds, update, sidewalkPoint };
}
