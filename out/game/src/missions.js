// Solara Bay — the story: five missions in a chain, plus the hidden cash
// packages scattered around the city. A mission has a glowing beacon
// marker, briefing dialogue, an objective, and a cash reward. Completing
// the fifth mission wins the game.

import * as THREE from 'three';
import { MISSIONS, PACKAGES, PACKAGE_CASH } from './config.js';
import { range } from './random.js';

export function createMissions(G) {
  // Beacon: a glowing pillar and a pulsing ring over the current target.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beaconMat);
  beacon.visible = false;
  G.scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.5, 32), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.visible = false;
  G.scene.add(ring);

  // Cash packages: gold spinning octahedrons.
  const packages = [];
  const pkgGeo = new THREE.OctahedronGeometry(0.7, 0);
  const pkgMat = new THREE.MeshLambertMaterial({ color: 0xffd23c, emissive: 0xaa8800 });
  for (const spot of G.world.packageSpots) {
    const mesh = new THREE.Mesh(pkgGeo, pkgMat);
    mesh.position.set(spot.x, 1.1, spot.z);
    G.scene.add(mesh);
    packages.push({ mesh, x: spot.x, z: spot.z, taken: false });
  }

  const state = {
    index: 0,           // mission in progress (0..4), 5 = story done
    stage: 'go',        // go | fight | escape | done
    enemiesLeft: 0,
    dialogue: [], dialogueTimer: 0,
    banner: null,
  };

  function current() { return MISSIONS[state.index] || null; }
  function targetPos() {
    const m = current(); if (!m) return null;
    if (state.stage === 'escape') return m.escapeTarget;
    return m.target;
  }
  function targetRadius() {
    const m = current(); if (!m) return 0;
    return state.stage === 'escape' ? m.escapeRadius : m.radius;
  }

  function say(lines) {
    state.dialogue = [...lines];
    state.dialogueTimer = 0.1;
  }

  function startMission(i) {
    state.index = i;
    state.stage = 'go';
    const m = MISSIONS[i];
    if (!m) { beacon.visible = false; ring.visible = false; return; }
    if (m.wantedOnStart) G.setWanted(m.wantedOnStart);
    say(m.briefing);
    G.hud.setObjective(m.objective);
    G.hud.flash(m.title);
    G.audio.blip();
  }

  function completeMission() {
    const m = current();
    G.cash += m.reward;
    G.hud.flash(`${m.title} — COMPLETE!  +$${m.reward}`);
    G.hud.setObjective('Mission complete');
    G.audio.missionDone();
    G.audio.cash();
    G.saveGame();
    if (state.index >= MISSIONS.length - 1) {
      state.index = MISSIONS.length; // story done
      state.stage = 'done';
      beacon.visible = false; ring.visible = false;
      G.winGame();
      return;
    }
    startMission(state.index + 1);
  }

  function spawnDefenders() {
    const m = current();
    G.enemies.length = 0;
    for (let i = 0; i < (m.enemies || 3); i++) {
      const x = m.target.x + range(G.rng, -12, 12);
      const z = m.target.z + range(G.rng, -12, 12);
      G.enemies.push(G.combat.spawnEnemy(x, z));
    }
    state.enemiesLeft = G.enemies.length;
    state.stage = 'fight';
    G.hud.setObjective(`Take down the buyer's muscle (${state.enemiesLeft} left)`);
    say(['VIC: That was a setup! His friends are here to take the cash back!',
         'MARA: Finish them, kid. All of them.']);
  }

  function playerPos() {
    return G.player.inCar ? { x: G.player.inCar.x, z: G.player.inCar.z } : { x: G.player.x, z: G.player.z };
  }

  function update(dt, time) {
    // Dialogue lines, one at a time.
    if (state.dialogue.length) {
      state.dialogueTimer -= dt;
      if (state.dialogueTimer <= 0) {
        G.hud.say(state.dialogue.shift());
        state.dialogueTimer = 4.5;
      }
    }
    // Beacon follows the current target.
    const t = targetPos();
    if (t && state.stage !== 'done') {
      beacon.visible = true; ring.visible = true;
      beacon.position.set(t.x, 30, t.z);
      ring.position.set(t.x, 0.15, t.z);
      const s = 1 + Math.sin(time * 3) * 0.15;
      ring.scale.set(s, s, 1);
      beaconMat.opacity = 0.25 + Math.sin(time * 3) * 0.1;
    } else { beacon.visible = false; ring.visible = false; }
    // Packages spin; collect on touch.
    const pp = playerPos();
    for (const pkg of packages) {
      if (pkg.taken) continue;
      pkg.mesh.rotation.y += dt * 2;
      pkg.mesh.position.y = 1.1 + Math.sin(time * 2 + pkg.x) * 0.15;
      if (Math.hypot(pkg.x - pp.x, pkg.z - pp.z) < 2.6) {
        pkg.taken = true;
        G.scene.remove(pkg.mesh);
        G.cash += PACKAGE_CASH;
        G.packagesFound++;
        G.audio.cash();
        G.hud.flash(`Hidden package found! +$${PACKAGE_CASH}  (${G.packagesFound}/${PACKAGES})`);
      }
    }
    // Mission progress.
    const m = current();
    if (!m || state.stage === 'done') return;
    const d = Math.hypot(t.x - pp.x, t.z - pp.z);
    G.hud.setDistance(d);
    if (state.stage === 'go') {
      if (d < targetRadius()) {
        if (m.type === 'defend') { spawnDefenders(); return; }
        if (m.type === 'score') {
          G.cash += 5000;
          G.hud.flash('Vault emptied! +$5,000 — now RUN to the yacht!');
          G.setWanted(4);
          state.stage = 'escape';
          G.hud.setObjective('Escape to the yacht "Alba" at Sunset Beach');
          say(['MARA: Four stars, kid. The whole Solara Bay PD is coming.',
               'MARA: The yacht is at Sunset Beach. Do not stop for anything.']);
          return;
        }
        completeMission();
      }
    } else if (state.stage === 'fight') {
      const left = G.enemies.filter((e) => e.alive).length;
      if (left !== state.enemiesLeft) {
        state.enemiesLeft = left;
        G.hud.setObjective(`Take down the buyer's muscle (${left} left)`);
      }
      if (left === 0) completeMission();
    } else if (state.stage === 'escape') {
      if (d < targetRadius()) {
        if (G.wanted > 0) {
          G.hud.setObjective('Lose the police first, then reach the yacht!');
        } else {
          completeMission();
        }
      }
    }
  }

  function applySave(data) {
    state.index = Math.min(data.missionIndex || 0, MISSIONS.length - 1);
    for (const pkg of packages) {
      if ((data.packages || []).includes(`${pkg.x},${pkg.z}`)) {
        pkg.taken = true; G.scene.remove(pkg.mesh);
      }
    }
    startMission(state.index);
  }
  function saveData() {
    return {
      missionIndex: state.index,
      packages: packages.filter((p) => p.taken).map((p) => `${p.x},${p.z}`),
    };
  }

  return { state, current, targetPos, startMission, completeMission, update, applySave, saveData, packages };
}
