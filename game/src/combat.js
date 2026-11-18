// Solara Bay — combat: fists and a pistol for the player, and the enemies
// who shoot back. Shooting uses a raycast from the camera; every target
// carries its health on its group, so a hit walks up to the group that owns
// the mesh it struck.

import * as THREE from 'three';

export function createCombat(G) {
  const raycaster = new THREE.Raycaster();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
  const tracers = [];
  const state = { weapon: 'fists', ammo: 12, magSize: 12, reloading: 0, punchTimer: 0 };

  function registerTarget(obj) {
    obj.mesh.userData.target = obj;
    obj.mesh.traverse((child) => { child.userData.target = obj; });
  }

  function spawnEnemy(x, z) {
    const mesh = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
    torso.position.y = 1.15; torso.castShadow = true; mesh.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
    head.position.y = 1.68; mesh.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.2, 0.3); mesh.add(gun);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const e = { mesh, x, z, health: 100, alive: true, armed: true, isEnemy: true, shootTimer: 1.2, speed: 4.5 };
    registerTarget(e);
    return e;
  }

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, tracerMat.clone());
    line.userData.life = 0.09;
    G.scene.add(line);
    tracers.push(line);
  }

  function damageTarget(obj, dmg, fromX, fromZ) {
    if (!obj.alive) return;
    obj.health -= dmg;
    // Knockback away from the shooter.
    const dx = obj.x - fromX, dz = obj.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    obj.x += (dx / d) * 0.6; obj.z += (dz / d) * 0.6;
    obj.mesh.position.set(obj.x, 0, obj.z);
    if (obj.health <= 0) {
      obj.alive = false;
      obj.mesh.rotation.x = -Math.PI / 2; // fall over
      obj.mesh.position.y = 0.35;
      if (obj.isOfficer || obj.isEnemy) G.addWanted(1);
      setTimeout(() => { G.scene.remove(obj.mesh); }, 6000);
    }
  }

  function punch() {
    if (state.punchTimer > 0) return;
    state.punchTimer = 0.45;
    G.audio.punch();
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    const facing = p.inCar ? p.inCar.heading : p.heading;
    let hitAny = false;
    for (const obj of [...G.pedestrians.peds, ...G.police.officers, ...G.enemies]) {
      if (!obj.alive) continue;
      const dx = obj.x - px, dz = obj.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > 2.6) continue;
      const ang = Math.atan2(dx, dz) - facing;
      if (Math.abs(((ang + Math.PI) % (Math.PI * 2)) - Math.PI) > 1.1) continue;
      damageTarget(obj, 25, px, pz);
      hitAny = true;
      if (obj.isPed) { obj.scared = 5; G.addWanted(1); G.hud.flash('A witness saw that! Wanted level up.'); }
    }
    if (!hitAny) G.hud.flash('You swing at the air.');
  }

  function shoot() {
    if (state.weapon !== 'pistol') { punch(); return; }
    if (state.reloading > 0) return;
    if (state.ammo <= 0) { reload(); return; }
    state.ammo--;
    G.audio.gunshot();
    const cam = G.camera;
    raycaster.setFromCamera({ x: 0, y: 0 }, cam);
    raycaster.far = 120;
    const meshes = [];
    for (const obj of [...G.pedestrians.peds, ...G.police.officers, ...G.enemies]) {
      if (obj.alive) meshes.push(obj.mesh);
    }
    const hits = raycaster.intersectObjects(meshes, true);
    const from = cam.position.clone();
    let end;
    if (hits.length) {
      const hit = hits[0];
      end = hit.point.clone();
      let obj = hit.object.userData.target;
      if (obj && obj.alive) {
        damageTarget(obj, 34, G.player.x, G.player.z);
        if (obj.isPed) { obj.scared = 5; G.addWanted(1); }
      }
    } else {
      end = from.clone().add(raycaster.ray.direction.clone().multiplyScalar(80));
    }
    addTracer(from, end);
    if (state.ammo === 0) reload();
  }

  function reload() {
    if (state.reloading > 0 || state.ammo === state.magSize) return;
    state.reloading = 1.1;
    G.audio.blip();
  }

  function enemyShoot(shooter) {
    const p = G.player;
    const dist = Math.hypot(p.x - shooter.x, p.z - shooter.z);
    if (dist > 45) return;
    G.audio.enemyShot();
    const from = new THREE.Vector3(shooter.x, 1.4, shooter.z);
    const to = new THREE.Vector3(p.x, 1.2, p.z);
    addTracer(from, to);
    // Hit chance falls with distance; a moving player is harder to hit.
    const moving = p.inCar ? Math.abs(p.inCar.speed) > 5 : p.moving;
    const chance = Math.max(0.12, 0.55 - dist * 0.01) * (moving ? 0.6 : 1);
    if (G.rng() < chance) G.damagePlayer(6 + G.rng() * 7, 'gunfire');
  }

  function update(dt) {
    if (state.punchTimer > 0) state.punchTimer -= dt;
    if (state.reloading > 0) {
      state.reloading -= dt;
      if (state.reloading <= 0) { state.ammo = state.magSize; G.hud.flash('Reloaded.'); }
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.09) * 0.9;
      if (t.userData.life <= 0) { G.scene.remove(t); t.geometry.dispose(); tracers.splice(i, 1); }
    }
    // Enemies walk at the player and shoot.
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const p = G.player;
      const dx = p.x - e.x, dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 5) {
        e.x += (dx / dist) * e.speed * dt; e.z += (dz / dist) * e.speed * dt;
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = Math.atan2(dx, dz);
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 40) {
        e.shootTimer = 1.1 + G.rng() * 0.8;
        enemyShoot(e);
      }
    }
  }

  return { state, spawnEnemy, registerTarget, punch, shoot, reload, enemyShoot, damageTarget, update };
}
