// Solara Bay — the player on foot: a third-person character (built from
// boxes and a sphere, with swinging legs), WASD movement relative to the
// camera, running, jumping, and the chase camera that follows them — or
// their car — from behind.

import * as THREE from 'three';
import { PLAYER } from './config.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a06a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.15; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.68; head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xe0b93c }));
  cap.position.y = 1.86; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.16, 0.42, 0); legL.castShadow = true;
  const legR = legL.clone(); legR.position.x = 0.16;
  g.add(legL); g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket);
  armL.position.set(-0.42, 1.18, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  g.add(armL); g.add(armR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

export function createPlayer(G) {
  const mesh = buildPlayerMesh();
  G.scene.add(mesh);
  const p = {
    mesh, x: 0, z: 40, y: 0, vy: 0, heading: 0,
    camYaw: Math.PI, camPitch: 0.32, onGround: true,
    walkPhase: 0, moving: false, inCar: null,
  };
  mesh.position.set(p.x, 0, p.z);
  return p;
}

export function updatePlayer(G, dt) {
  const p = G.player, input = G.input;
  if (p.inCar) return;
  // Mouse look.
  p.camYaw -= input.mouse.dx * 0.0032;
  p.camPitch = Math.max(-0.15, Math.min(0.9, p.camPitch + input.mouse.dy * 0.0028));
  // Move relative to the camera.
  let fx = 0, fz = 0;
  if (input.keys.forward) { fx -= Math.sin(p.camYaw); fz -= Math.cos(p.camYaw); }
  if (input.keys.back) { fx += Math.sin(p.camYaw); fz += Math.cos(p.camYaw); }
  if (input.keys.left) { fx -= Math.cos(p.camYaw); fz += Math.sin(p.camYaw); }
  if (input.keys.right) { fx += Math.cos(p.camYaw); fz -= Math.sin(p.camYaw); }
  const len = Math.hypot(fx, fz);
  p.moving = len > 0;
  const speed = input.keys.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (len > 0) {
    fx /= len; fz /= len;
    const nx = p.x + fx * speed * dt, nz = p.z + fz * speed * dt;
    const fixed = G.world.collideCircle(nx, nz, PLAYER.radius);
    p.x = fixed.x; p.z = fixed.z;
    p.heading = Math.atan2(fx, fz);
    p.walkPhase += dt * speed * 1.6;
  }
  // Jump and gravity.
  if (input.pressed.jump && p.onGround) { p.vy = PLAYER.jumpSpeed; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= 22 * dt; p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  // Walk-cycle animation.
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
  u.torso.position.y = 1.15 + (p.moving ? Math.abs(Math.sin(p.walkPhase)) * 0.04 : 0);
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
}

/** Third-person camera: behind the player, or behind their car. */
export function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.camera;
  let tx, tz, ty, lookY;
  if (p.inCar) {
    const car = p.inCar;
    const back = 9.5, up = 4.2;
    tx = car.x - Math.sin(car.heading) * back;
    tz = car.z - Math.cos(car.heading) * back;
    ty = up; lookY = 1.2;
    // Keep the camera out of buildings: pull it in when it would be inside one.
    const fixed = G.world.collideCircle(tx, tz, 1);
    tx = fixed.x; tz = fixed.z;
  } else {
    const dist = 5.2;
    tx = p.x + Math.sin(p.camYaw) * Math.cos(p.camPitch) * dist;
    tz = p.z + Math.cos(p.camYaw) * Math.cos(p.camPitch) * dist;
    ty = p.y + 1.6 + Math.sin(p.camPitch) * dist;
    lookY = p.y + 1.4;
  }
  const k = 1 - Math.pow(0.0001, dt); // smooth follow
  cam.position.x += (tx - cam.position.x) * k;
  cam.position.y += (ty - cam.position.y) * k;
  cam.position.z += (tz - cam.position.z) * k;
  cam.lookAt(p.inCar ? p.inCar.x : p.x, lookY, p.inCar ? p.inCar.z : p.z);
}
