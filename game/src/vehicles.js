// Solara Bay — cars: the factory that builds them, the arcade driving model
// the player uses, and enter/exit. A car is a group: body, cabin, wheels,
// headlights and taillights. Physics is simple on purpose: speed, steering
// that tightens at low speed, and building collision through world data.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { pick } from './random.js';

export function buildCarMesh(color, police) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? PALETTE.police : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), paint);
  body.position.y = 0.55; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: police ? 0x1a1a1a : 0x223344 }),
  );
  cabin.position.set(0, 1.15, -0.2); cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.38, z);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0xffedb0 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    h.position.set(x, 0.6, 2.22); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x660000 }));
    t.position.set(x, 0.6, -2.22); g.add(t);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.55, -0.2); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000 }));
    red.position.set(-0.3, 1.56, -0.2); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0022ff }));
    blue.position.set(0.3, 1.56, -0.2); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  return g;
}

export function makeCar(rng, x, z, heading, police) {
  const mesh = buildCarMesh(pick(rng, PALETTE.car), police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh, police: !!police, heading, speed: 0, steer: 0,
    x, z, alive: true, parked: !police, driver: null,
  };
}

/** Arcade driving step: throttle -1..1, steer -1..1. Returns speed. */
export function driveCar(G, car, throttle, steer, dt) {
  const accel = 22, brake = 34, drag = 0.6;
  if (throttle > 0) car.speed += accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= brake * dt;      // brake
    else car.speed -= 10 * dt;                          // reverse
  }
  car.speed -= car.speed * drag * dt;
  car.speed = Math.max(-10, Math.min(CITY.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 0.2) {
    const turn = steer * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed);
    car.heading += turn;
  }
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = G.world.collideCircle(nx, nz, 1.6);
  if ((fixed.x !== nx || fixed.z !== nz) && Math.abs(car.speed) > 6) {
    car.speed *= 0.4; G.audio.crash();
  }
  car.x = fixed.x; car.z = fixed.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return car.speed;
}

export function nearestCar(G, x, z, maxDist, includeParked) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (!car.alive || (!includeParked && car.parked)) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
