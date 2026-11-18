// Solara Bay — the deterministic screenshot scenes behind
// ?shot=start|play|chase|mission (with &seed=N). Each stages the real game
// in a named situation, then the main loop plays it forward a little so the
// frame is what a short game really looks like, and sets window.__shotReady.

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
    // On foot at Palm Court Plaza, looking east toward the beach and Marina.
    G.player.x = 0; G.player.z = 12;
    G.player.camYaw = -Math.PI / 2; G.player.heading = Math.PI / 2;
    G.missions.startMission(0);
    G.cash = 150;
    return;
  }
  if (name === 'chase') {
    // Driving north on the -70 road at speed, three stars, police behind.
    const car = G.cars.find((c) => c.parked && Math.abs(c.x + 70) < 6) || G.cars[0];
    G.enterCar(car);
    car.x = -70; car.z = 150; car.heading = Math.PI; car.speed = 24;
    G.missions.startMission(2);
    G.setWanted(3);
    G.shotAuto = { forward: true };
    // Two police cars in pursuit, right behind.
    for (let i = 0; i < 2; i++) {
      const pc = G.police.spawnForShot(-70 + (i === 0 ? 3.5 : -3.5), 185 + i * 18, Math.PI);
      pc.speed = 26;
    }
    G.cash = 1850;
    return;
  }
  // mission: driving to the South Docks pickup, beacon ahead.
  const car = G.cars.find((c) => c.parked && Math.abs(c.x - 0) < 6) || G.cars[0];
  G.enterCar(car);
  car.x = 0; car.z = 120; car.heading = Math.PI; car.speed = 18;
  G.missions.startMission(1);
  G.shotAuto = { forward: true };
  G.cash = 650;
}
