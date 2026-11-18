// Solara Bay — the deterministic screenshot scenes behind
// ?shot=start|play|chase|mission (with &seed=N). Each stages the real game
// in a named situation, then the main loop plays it forward a little so the
// frame is what a short game really looks like, and sets window.__shotReady.

// Move any NPC or parked car out of a stretch of road, so the staged car
// has a clear run and the shot is not a traffic jam.
function clearRoad(G, axis, line, from, to) {
  const move = (car) => {
    const lines = G.world.roadLines;
    const other = lines[Math.floor(G.rng() * lines.length)];
    if (axis === 'z') { car.x = other + 3.5; car.z = 260; car.heading = Math.PI; }
    else { car.z = other + 3.5; car.x = 260; car.heading = -Math.PI / 2; }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  };
  for (const car of G.traffic.npc) {
    if (car === G.player.inCar) continue; // never move the player's own car
    const onLine = axis === 'z' ? Math.abs(car.x - line) < 6 : Math.abs(car.z - line) < 6;
    const inRange = axis === 'z' ? (car.z > from && car.z < to) : (car.x > from && car.x < to);
    if (onLine && inRange) move(car);
  }
  for (const car of G.cars) {
    if (!car.parked || car === G.player.inCar) continue;
    const onLine = axis === 'z' ? Math.abs(car.x - line) < 6 : Math.abs(car.z - line) < 6;
    const inRange = axis === 'z' ? (car.z > from && car.z < to) : (car.x > from && car.x < to);
    if (onLine && inRange) move(car);
  }
}

// A parked car near a road line to steal for a shot; any parked car will do
// (the shot repositions it), never an NPC car, which clearRoad may move.
function findParkedCar(G, nearX) {
  const parked = G.cars.filter((c) => c.parked);
  return parked.find((c) => Math.abs(c.x - nearX) < 6) || parked[0] || G.cars[0];
}

export function stageShot(G, name) {
  G.shot = name;
  G.newGame();
  if (name === 'start') {
    G.screen = 'title';
    G.shotCam = { angle: 0 };
    G.hud.showMenu(null);
    return;
  }
  G.screen = 'play';
  G.hud.showHud();
  if (name === 'play') {
    // On foot on the -70 road, looking north along the street: buildings,
    // traffic and pedestrians ahead, beach to the right.
    G.player.x = -70; G.player.z = 35;
    G.player.camYaw = 0; G.player.heading = Math.PI;
    G.missions.startMission(0);
    G.cash = 150;
    return;
  }
  if (name === 'chase') {
    // Driving north on the -70 road at speed, three stars, police behind.
    const car = findParkedCar(G, -70);
    G.enterCar(car);
    car.x = -70; car.z = 150; car.heading = Math.PI; car.speed = 28;
    clearRoad(G, 'z', -70, 40, 170);
    clearRoad(G, 'x', 140, -85, -55); // cross-traffic at the intersection ahead
    G.missions.startMission(2);
    G.setWanted(3);
    G.shotAuto = { forward: true };
    G.shotCam = { mode: 'chase-front' };
    // Four police cars in pursuit, behind the player (this fills the
    // wanted quota, so no more spawn in from random spots during the shot).
    for (let i = 0; i < 4; i++) {
      const pc = G.police.spawnForShot(-70 + (i % 2 === 0 ? 3.5 : -3.5), 180 + i * 15, Math.PI);
      pc.speed = 28;
    }
    G.cash = 1850;
    return;
  }
  // mission: driving south to the South Docks pickup, beacon ahead.
  const car = findParkedCar(G, 0);
  G.enterCar(car);
  car.x = 0; car.z = 120; car.heading = 0; car.speed = 18;
  clearRoad(G, 'z', 0, 110, 260);
  clearRoad(G, 'x', 140, -15, 15); // cross-traffic at the intersection ahead
  G.missions.startMission(1);
  G.setWanted(0); // stealing the car gave a star; this job starts clean
  G.shotAuto = { forward: true };
  G.cash = 650;
}
