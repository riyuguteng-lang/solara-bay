// Solara Bay — boot and the one loop. The game moves between four screens
// (title, play, paused, game over / win); the world advances in fixed
// 1/60 s steps, and the camera, HUD and minimap paint what is there.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of the title screen, plays it forward a little
// and sets window.__shotReady for a screenshot.

import * as THREE from 'three';
import { CITY, MISSIONS, PLAYER, START_CASH, HOSPITAL_FEE } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { readSave, writeSave } from './save.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer, updateCamera } from './player.js';
import { driveCar, nearestCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createMissions } from './missions.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

// --- Renderer, scene, lights ---------------------------------------------
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9e8);
scene.fog = new THREE.Fog(0xa8d0e6, 120, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 60, 180);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a6a4a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.0);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
sun.shadow.camera.far = 500;
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game context: every module reads and writes through G ---------------
const G = {
  scene, camera, renderer, rng: createRandom(seed), seed,
  cars: [], enemies: [], health: PLAYER.maxHealth, cash: START_CASH,
  wanted: 0, clockMinutes: 540, packagesFound: 0, time: 0,
  screen: 'title', shot, shotAuto: null, shotCam: null,
  lastDamageAt: -99, won: false,
};
G.input = createInput(canvas);
G.audio = createAudio();
G.world = createWorld(G.rng);
scene.add(G.world.group);
G.player = createPlayer(G);
G.traffic = createTraffic(G);
G.pedestrians = createPedestrians(G);
G.police = createPolice(G);
G.combat = createCombat(G);
for (const ped of G.pedestrians.peds) G.combat.registerTarget(ped);
G.hud = createHud(G);
G.minimap = createMinimap(document.getElementById('minimap'), G);
G.missions = createMissions(G);

function announce(msg) { status.textContent = msg; }

G.setWanted = (n) => { G.wanted = Math.max(0, Math.min(5, n)); };
G.addWanted = (n) => { G.setWanted(G.wanted + n); };

G.damagePlayer = (amount, source) => {
  if (G.screen !== 'play' || G.health <= 0) return;
  G.health -= amount;
  G.lastDamageAt = G.time;
  if (G.health <= 0) { G.health = 0; gameOver(); }
};

G.enterCar = (car) => {
  const p = G.player;
  const wasParked = car.parked;
  car.parked = false; car.driver = 'player';
  p.inCar = car;
  p.mesh.visible = false;
  G.audio.door();
  if (wasParked) {
    G.addWanted(1);
    G.hud.flash('You stole the car! The owner called it in — wanted level up.');
  }
};

G.exitCar = () => {
  const p = G.player, car = p.inCar;
  if (!car) return;
  const side = 2.4;
  const x = car.x + Math.cos(car.heading) * side;
  const z = car.z - Math.sin(car.heading) * side;
  const fixed = G.world.collideCircle(x, z, PLAYER.radius);
  p.x = fixed.x; p.z = fixed.z; p.y = 0; p.vy = 0; p.onGround = true;
  p.camYaw = car.heading + Math.PI;
  p.inCar = null; car.speed = 0; car.driver = null;
  p.mesh.visible = true;
  G.audio.door();
};

G.saveGame = () => {
  const ok = writeSave({
    cash: G.cash, health: G.health, clockMinutes: G.clockMinutes,
    player: { x: G.player.x, z: G.player.z },
    ...G.missions.saveData(),
  });
  if (ok) G.hud.flash('Game saved.');
  return ok;
};

G.loadSave = (data) => {
  G.cash = data.cash ?? START_CASH;
  G.health = data.health ?? PLAYER.maxHealth;
  G.clockMinutes = data.clockMinutes ?? 540;
  G.wanted = 0; G.packagesFound = (data.packages || []).length;
  G.player.x = data.player?.x ?? 0; G.player.z = data.player?.z ?? 12;
  G.player.y = 0; G.player.inCar = null; G.player.mesh.visible = true;
  G.missions.applySave(data);
};

G.newGame = () => {
  G.cash = START_CASH; G.health = PLAYER.maxHealth; G.wanted = 0;
  G.clockMinutes = 540; G.packagesFound = 0; G.won = false;
  G.player.x = 0; G.player.z = 12; G.player.y = 0; G.player.vy = 0;
  G.player.inCar = null; G.player.mesh.visible = true;
  G.player.camYaw = Math.PI; G.player.camPitch = 0.32;
  for (const e of G.enemies) { e.alive = false; G.scene.remove(e.mesh); }
  G.enemies.length = 0;
};

function startPlay(fromSave) {
  if (fromSave) {
    const data = readSave();
    if (data) G.loadSave(data);
    else G.newGame();
  } else {
    G.newGame();
    G.missions.startMission(0);
  }
  G.screen = 'play';
  G.hud.showHud();
  G.hud.setObjective(G.missions.current()?.objective || 'Free roam — Solara Bay is yours');
  G.audio.ensure();
  G.input.lock();
  announce('Playing. Follow the objective on the HUD.');
}

function gameOver() {
  G.screen = 'over';
  G.audio.fail();
  G.audio.setEngine(0, false);
  G.audio.setSiren(false);
  G.input.unlock();
  G.hud.showGameOver(HOSPITAL_FEE);
  announce('Game over. You wake up at the hospital.');
}

G.winGame = () => {
  G.won = true;
  G.screen = 'win';
  G.audio.missionDone();
  G.input.unlock();
  G.hud.showWin();
  announce('You finished the story. Solara Bay is yours.');
};

function respawn() {
  G.cash = Math.max(0, G.cash - HOSPITAL_FEE);
  G.health = PLAYER.maxHealth;
  G.wanted = 0;
  G.player.x = -70; G.player.z = 105; // road beside St. Marisol Hospital
  G.player.y = 0; G.player.inCar = null; G.player.mesh.visible = true;
  G.missions.startMission(Math.min(G.missions.state.index, MISSIONS.length - 1));
  G.screen = 'play';
  G.hud.showHud();
  G.input.lock();
  announce('You wake up at St. Marisol Hospital. The story continues.');
}

// --- Menu buttons ----------------------------------------------------------
document.getElementById('start-btn').addEventListener('click', () => startPlay(false));
document.getElementById('continue-btn').addEventListener('click', () => startPlay(true));
document.getElementById('resume-btn').addEventListener('click', () => {
  G.screen = 'play'; G.hud.showHud(); G.input.lock();
});
document.getElementById('save-btn').addEventListener('click', () => G.saveGame());
document.getElementById('restart-btn').addEventListener('click', () => startPlay(false));
document.getElementById('quit-btn').addEventListener('click', () => {
  G.screen = 'title'; G.hud.showMenu(readSave()); G.input.unlock();
});
document.getElementById('respawn-btn').addEventListener('click', respawn);
document.getElementById('again-btn').addEventListener('click', () => startPlay(false));
document.getElementById('free-btn').addEventListener('click', () => {
  G.screen = 'play'; G.hud.showHud(); G.hud.setObjective('Free roam — Solara Bay is yours'); G.input.lock();
});
canvas.addEventListener('click', () => {
  if (G.screen === 'play' && !G.input.locked) G.input.lock();
});

// --- One fixed step ----------------------------------------------------------
function step(dt) {
  G.time += dt;
  G.world.update(dt, G.time);
  if (G.screen === 'title') {
    G.traffic.update(dt);
    G.pedestrians.update(dt);
    return;
  }
  if (G.screen !== 'play') return;
  G.clockMinutes += dt / 4;

  const input = G.input;
  const p = G.player;

  // Shot autopilot: hold the throttle for chase / mission scenes.
  if (G.shotAuto) {
    input.keys.forward = !!G.shotAuto.forward;
  }

  if (input.pressed.pause) {
    G.screen = 'paused'; G.hud.showPause(); G.input.unlock();
    announce('Paused.');
    return;
  }
  if (input.pressed.mute) G.audio.toggleMute();
  if (input.pressed.fists) G.combat.state.weapon = 'fists';
  if (input.pressed.pistol) G.combat.state.weapon = 'pistol';
  if (input.pressed.reload) G.combat.reload();
  if (input.pressed.punch || input.mouse.clicked) {
    if (G.combat.state.weapon === 'pistol' && input.locked) G.combat.shoot();
    else if (input.pressed.punch) G.combat.punch();
  }

  if (p.inCar) {
    const car = p.inCar;
    const throttle = (input.keys.forward ? 1 : 0) - (input.keys.back ? 1 : 0);
    const steer = (input.keys.left ? 1 : 0) - (input.keys.right ? 1 : 0);
    driveCar(G, car, throttle, steer, dt);
    p.x = car.x; p.z = car.z;
    G.audio.setEngine(Math.abs(car.speed) / CITY.maxSpeed, true);
    // Bump into other cars.
    for (const other of G.cars) {
      if (other === car || !other.alive) continue;
      const dx = car.x - other.x, dz = car.z - other.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.6 && d > 0.01) {
        car.x += (dx / d) * (3.6 - d) * 0.5;
        car.z += (dz / d) * (3.6 - d) * 0.5;
        if (Math.abs(car.speed) > 8) { car.speed *= 0.55; G.audio.crash(); }
      }
    }
    // Run over a pedestrian: they go down, and the law notices.
    for (const ped of G.pedestrians.peds) {
      if (!ped.alive) continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.4 && Math.abs(car.speed) > 3) {
        G.combat.damageTarget(ped, 100, car.x, car.z);
        G.addWanted(1);
        G.hud.flash('You hit a pedestrian! Wanted level up.');
        G.audio.crash();
      }
    }
    if (input.pressed.interact) G.exitCar();
  } else {
    updatePlayer(G, dt);
    G.audio.setEngine(0, false);
    // A fast car hitting the player on foot.
    for (const car of G.cars) {
      if (!car.alive || Math.abs(car.speed) < 3) continue;
      if (Math.hypot(car.x - p.x, car.z - p.z) < 1.6) {
        G.damagePlayer(25, 'traffic');
        p.x += (p.x - car.x) * 0.8; p.z += (p.z - car.z) * 0.8;
      }
    }
    if (input.pressed.interact) {
      const car = nearestCar(G, p.x, p.z, 4.5, true);
      if (car && Math.abs(car.speed) < 4) G.enterCar(car);
      else if (car) G.hud.flash('Too fast — wait for it to slow down.');
      else G.hud.flash('No car close enough. Find one on the street.');
    }
  }

  // Slow health regen out of combat.
  if (G.time - G.lastDamageAt > 8 && G.health > 0 && G.health < PLAYER.maxHealth) {
    G.health = Math.min(PLAYER.maxHealth, G.health + 3 * dt);
  }

  G.traffic.update(dt);
  G.pedestrians.update(dt);
  G.police.update(dt);
  G.combat.update(dt);
  G.missions.update(dt, G.time);
}

// --- Frame -------------------------------------------------------------------
let accumulator = 0, last = performance.now();
let shotElapsed = 0, shotReady = false;

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  // Enter starts from the title screen (the button does the same).
  if (G.screen === 'title' && G.input.pressed.confirm) startPlay(false);
  while (accumulator >= STEP) {
    if (G.screen === 'paused') break;
    step(STEP);
    G.input.endFrame(); // edge presses live for exactly one fixed step
    accumulator -= STEP;
  }
  if (G.screen === 'paused') accumulator = 0;

  // Camera.
  if (G.screen === 'title' || (shot === 'start' && G.screen === 'title')) {
    const a = G.time * 0.05 + (G.shotCam ? G.shotCam.angle : 0);
    camera.position.set(Math.cos(a) * 240, 95, Math.sin(a) * 240);
    camera.lookAt(60, 12, 0);
  } else {
    updateCamera(G, Math.min(0.05, (now - last) / 1000 + 0.016));
  }

  renderer.render(scene, camera);
  if (G.screen === 'play') {
    G.hud.update(STEP);
    G.minimap.draw();
  }
  if (shot && !shotReady) {
    shotElapsed += 1 / 60;
    if (shotElapsed > 2.0) { shotReady = true; window.__shotReady = true; }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.screen === 'play') {
    G.screen = 'paused'; G.hud.showPause(); G.input.unlock();
  }
});

if (shot) {
  stageShot(G, shot);
  announce(`Solara Bay, screenshot scene ${shot}.`);
} else {
  G.hud.showMenu(readSave());
  announce('Solara Bay. Press Enter or click Start to play.');
}
requestAnimationFrame(frame);
