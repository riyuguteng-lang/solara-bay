// Solara Bay — the wanted system: 0–5 stars. Crimes raise it, police cars
// spawn and chase, officers on foot shoot back at higher levels, and the
// heat cools when the player stays out of sight.

import * as THREE from 'three';
import { CITY, WANTED } from './config.js';
import { makeCar } from './vehicles.js';
import { range } from './random.js';

export function createPolice(G) {
  const units = [];   // police cars
  const officers = []; // on-foot police (simple walkers that shoot)
  let quietTimer = 0, decayTimer = 0;

  function spawnCar() {
    // Spawn on a road near the player, facing them — never inside a building.
    const alongZ = G.rng() < 0.5;
    const lines = G.world.roadLines;
    const axisPos = alongZ ? G.player.x : G.player.z;
    const near = lines.filter((v) => Math.abs(axisPos - v) < 140);
    const line = near.length ? near[Math.floor(G.rng() * near.length)] : lines[4];
    const dist = 80 + G.rng() * 30;
    const dir = G.rng() < 0.5 ? 1 : -1;
    const lane = G.rng() < 0.5 ? -3.5 : 3.5;
    const x = alongZ ? line + lane : Math.max(-275, Math.min(275, G.player.x + dir * dist));
    const z = alongZ ? Math.max(-275, Math.min(275, G.player.z + dir * dist)) : line + lane;
    const heading = alongZ ? (G.player.z > z ? 0 : Math.PI) : (G.player.x > x ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(G.rng, x, z, heading, true);
    car.parked = false;
    car.police = true;
    G.scene.add(car.mesh);
    G.cars.push(car);
    units.push(car);
    return car;
  }
  function spawnOfficer() {
    const mesh = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c2f55 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), dark);
    torso.position.y = 1.1; mesh.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8a06a }));
    head.position.y = 1.62; mesh.add(head);
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.48),
      new THREE.MeshLambertMaterial({ color: 0x101828 }));
    hat.position.y = 1.8; mesh.add(hat);
    const a = G.rng() * Math.PI * 2;
    const x = G.player.x + Math.cos(a) * 14, z = G.player.z + Math.sin(a) * 14;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const off = { mesh, x, z, shootTimer: range(G.rng, 0.5, 1.5), alive: true, armed: true, isOfficer: true };
    officers.push(off);
    if (G.combat) G.combat.registerTarget(off);
    return off;
  }

  function spawnForShot(x, z, heading) {
    const car = makeCar(G.rng, x, z, heading, true);
    car.parked = false;
    car.police = true;
    G.scene.add(car.mesh);
    G.cars.push(car);
    units.push(car);
    return car;
  }

  function nearestPoliceDist() {
    let best = Infinity;
    for (const u of units) if (u.alive) best = Math.min(best, Math.hypot(u.x - G.player.x, u.z - G.player.z));
    for (const o of officers) if (o.alive) best = Math.min(best, Math.hypot(o.x - G.player.x, o.z - G.player.z));
    return best;
  }

  function update(dt) {
    const wanted = G.wanted;
    // Spawn to match the wanted level.
    const wantCars = wanted >= 1 ? Math.min(1 + wanted, 5) : 0;
    while (units.filter((u) => u.alive).length < wantCars) spawnCar();
    if (wanted >= 3 && officers.filter((o) => o.alive).length < 2) spawnOfficer();
    // Despawn far or dead units when the heat is gone.
    if (wanted === 0) {
      for (const u of units) if (u.alive && Math.hypot(u.x - G.player.x, u.z - G.player.z) > 160) { u.alive = false; G.scene.remove(u.mesh); }
      for (const o of officers) if (o.alive) { o.alive = false; G.scene.remove(o.mesh); }
    }
    // Chase: steer toward the player, ram on contact.
    for (const u of units) {
      if (!u.alive) continue;
      // Keep police cars from piling onto each other.
      for (const o of units) {
        if (o === u || !o.alive) continue;
        const dx = u.x - o.x, dz = u.z - o.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.5 && d > 0.01) { u.x += (dx / d) * 1.2; u.z += (dz / d) * 1.2; }
      }
      const dx = G.player.x - u.x, dz = G.player.z - u.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      u.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const targetSpeed = dist > 8 ? CITY.policeSpeed : CITY.policeSpeed * 0.5;
      u.speed += (targetSpeed - u.speed) * Math.min(1, dt * 1.5);
      const nx = u.x + Math.sin(u.heading) * u.speed * dt;
      const nz = u.z + Math.cos(u.heading) * u.speed * dt;
      const fixed = G.world.collideCircle(nx, nz, 1.6);
      if (fixed.x !== nx || fixed.z !== nz) { u.speed *= 0.5; }
      u.x = fixed.x; u.z = fixed.z;
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.heading;
      // Flash the light bar.
      const on = Math.floor(performance.now() / 300) % 2 === 0;
      if (u.mesh.userData.lightRed) {
        u.mesh.userData.lightRed.material.emissive.setHex(on ? 0xff0000 : 0x220000);
        u.mesh.userData.lightBlue.material.emissive.setHex(on ? 0x000022 : 0x0022ff);
      }
      // Ram the player: push off them rather than grinding through them.
      if (dist < 3.6) {
        const push = (3.6 - dist) * 0.6;
        u.x -= (dx / (dist || 1)) * push;
        u.z -= (dz / (dist || 1)) * push;
        u.speed = Math.min(u.speed, G.player.inCar ? G.player.inCar.speed : 8);
        if (G.player.inCar) {
          G.damagePlayer(1.2 * dt * 10, 'police');
        } else {
          G.damagePlayer(0.8 * dt * 10, 'police');
        }
      }
    }
    // Officers walk at the player and shoot when close.
    for (const o of officers) {
      if (!o.alive) continue;
      const dx = G.player.x - o.x, dz = G.player.z - o.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 6) {
        o.x += (dx / dist) * 5 * dt; o.z += (dz / dist) * 5 * dt;
        o.mesh.position.set(o.x, 0, o.z);
        o.mesh.rotation.y = Math.atan2(dx, dz);
      }
      o.shootTimer -= dt;
      if (o.shootTimer <= 0 && dist < 42) {
        o.shootTimer = range(G.rng, 1.0, 1.8);
        G.combat.enemyShoot(o);
      }
    }
    // Wanted decay: out of sight for a while, then a star falls.
    const nearest = nearestPoliceDist();
    if (wanted > 0) {
      if (nearest > 70) {
        quietTimer += dt;
        if (quietTimer > WANTED.decayDelay) {
          decayTimer += dt;
          if (decayTimer > WANTED.decayStep) {
            decayTimer = 0;
            G.setWanted(wanted - 1);
            G.hud.flash('The heat is cooling off…');
          }
        }
      } else { quietTimer = 0; decayTimer = 0; }
    } else { quietTimer = 0; decayTimer = 0; }
    // Siren while any police car is near.
    G.audio.setSiren(wanted > 0 && nearest < 120);
  }

  return { units, officers, update, nearestPoliceDist, spawnForShot };
}
