// Solara Bay — traffic: NPC cars that drive the road lanes in straight
// lines and wrap around at the city edge, plus the parked cars the player
// can steal. NPC cars slow for the car ahead of them.

import { CITY } from './config.js';
import { makeCar } from './vehicles.js';
import { range, pick } from './random.js';

export function createTraffic(G) {
  const npc = [];
  const lines = G.world.roadLines;
  function spawnNpc(i) {
    const alongZ = i % 2 === 0;
    const line = pick(G.rng, lines);
    const lane = pick(G.rng, [-3.5, 3.5]);
    const dir = pick(G.rng, [-1, 1]);
    const car = makeCar(G.rng,
      alongZ ? line + lane : range(G.rng, -260, 260),
      alongZ ? range(G.rng, -260, 260) : line + lane,
      alongZ ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      false);
    car.parked = false;
    car.npc = { alongZ, line, lane, dir, speed: range(G.rng, 8, CITY.npcSpeed + 3) };
    G.scene.add(car.mesh);
    npc.push(car);
    G.cars.push(car);
  }
  for (let i = 0; i < 16; i++) spawnNpc(i);

  // Parked cars along the roads, waiting to be stolen.
  for (const spot of G.world.parkSpots) {
    const car = makeCar(G.rng, spot.x, spot.z, spot.along === 'z' ? 0 : Math.PI / 2, false);
    car.parked = true;
    G.scene.add(car.mesh);
    G.cars.push(car);
  }

  function update(dt) {
    for (const car of npc) {
      if (!car.alive) continue;
      const n = car.npc;
      // Slow for a car ahead in the same lane.
      let target = n.speed;
      for (const other of G.cars) {
        if (other === car || !other.alive) continue;
        const dx = other.x - car.x, dz = other.z - car.z;
        const ahead = n.alongZ ? dz * n.dir : dx * n.dir;
        const side = n.alongZ ? Math.abs(dx) : Math.abs(dz);
        if (ahead > 0 && ahead < 12 && side < 3) { target = 0; break; }
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      const step = car.speed * n.dir * dt;
      if (n.alongZ) car.z += step; else car.x += step;
      if (car.z > 285) car.z = -285; if (car.z < -285) car.z = 285;
      if (car.x > 285) car.x = -285; if (car.x < -285) car.x = 285;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt * 2.6;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
  return { npc, update };
}
