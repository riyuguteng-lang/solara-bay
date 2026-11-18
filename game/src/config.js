// Solara Bay — every tuning number, colour and story beat in one place.
// Original open-world crime game: a sun-soaked coastal city. No Rockstar/GTA
// names, characters, maps, art or music anywhere in this game.

export const CITY = {
  half: 280,          // city extends -280..280 on x and z
  block: 70,          // road centre spacing
  roadWidth: 14,
  beachX: 300,        // sand starts here (east edge)
  oceanX: 345,        // water starts here
  maxSpeed: 38,       // player car top speed (m/s)
  npcSpeed: 11,
  policeSpeed: 30,
};

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9.5,
  jumpSpeed: 7.5,
  radius: 0.6,
  height: 1.8,
  maxHealth: 100,
};

export const WANTED = {
  decayDelay: 15,     // seconds out of sight before stars start falling
  decayStep: 5,       // seconds per star lost
  maxStars: 5,
};

export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8d0e6,
  sun: 0xfff2d0,
  asphalt: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  ocean: 0x1e6fa8,
  grass: 0x5da24a,
  building: [0xd8c9a8, 0xb8c4cc, 0xe0a878, 0xa8b8a0, 0xc9a0a0, 0x9fb4c8, 0xe8dcc0, 0x8fa8b8],
  car: [0xc23b2e, 0x2e6fc2, 0xe0b93c, 0x3aa655, 0xe8e8e8, 0x222226, 0x7a4fc2, 0xe07a2e],
  shirt: [0xe05a4e, 0x4e7de0, 0x53b06a, 0xe0c34e, 0x9b5fb0, 0x4ec2c2, 0xe08ab0, 0x8a8a8a],
  playerJacket: 0x2e6fc2,
  police: 0xf2f2f2,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solara-bay.save.v1';

// Named places in Solara Bay (all original).
export const PLACES = {
  plaza:    { x: -35,  z: -35,  name: 'Palm Court Plaza' },
  marina:   { x: 315,  z: -70,  name: 'Solara Marina' },
  docks:    { x: -35,  z: 245,  name: 'South Docks' },
  cafe:     { x: 105,  z: 35,   name: 'Cafe Lumen' },
  safehouse:{ x: -245, z: -175, name: 'Safehouse — Coral Row' },
  harbor:   { x: 175,  z: 245,  name: 'Harbor Yard' },
  bank:     { x: 35,   z: -35,  name: 'Solara Trust Bank' },
  hospital: { x: -105, z: 105,  name: 'St. Marisol Hospital' },
  beach:    { x: 322,  z: 140,  name: 'Sunset Beach' },
  yacht:    { x: 330,  z: 140,  name: 'The yacht "Alba"' },
};

// The story: five missions. Each has a target, a briefing, a reward and the
// wanted level it leaves the player at. `type` drives the mission logic.
export const MISSIONS = [
  {
    id: 'wheels', title: '1 — First Wheels', type: 'drive', reward: 500,
    target: PLACES.marina, radius: 14,
    objective: 'Steal a car and drive it to Solara Marina',
    briefing: [
      'MARA: You are new in Solara Bay, kid. Nobody walks here.',
      'MARA: Take any car on the street — keys are a suggestion — and bring it to the Marina.',
    ],
  },
  {
    id: 'pickup', title: '2 — The Pickup', type: 'pickup', reward: 1200,
    target: PLACES.docks, radius: 12,
    objective: 'Pick up the package at the South Docks',
    briefing: [
      'MARA: A crate is waiting at the South Docks. No questions, no peeking.',
      'MARA: On foot or by car — just get there and grab it.',
    ],
  },
  {
    id: 'getaway', title: '3 — The Getaway', type: 'escape', reward: 2500,
    target: PLACES.safehouse, radius: 14, wantedOnStart: 2,
    objective: 'Lose the police, then reach the Safehouse on Coral Row',
    briefing: [
      'MARA: The docks were watched. Cops are on you — two stars, kid.',
      'MARA: Break line of sight, let the heat cool, then get to Coral Row.',
    ],
  },
  {
    id: 'deal', title: '4 — The Harbor Deal', type: 'defend', reward: 5000,
    target: PLACES.harbor, radius: 14, enemies: 3,
    objective: 'Meet the buyer at the Harbor Yard — then deal with his friends',
    briefing: [
      'VIC: The buyer waits at the Harbor Yard. He pays in cash, up front.',
      'VIC: Word is he brings muscle. Bring your pistol, and keep it out of sight.',
    ],
  },
  {
    id: 'score', title: '5 — The Final Score', type: 'score', reward: 20000,
    target: PLACES.bank, radius: 12, wantedOnStart: 0,
    objective: 'Hit Solara Trust Bank, then escape to the yacht at Sunset Beach',
    briefing: [
      'MARA: This is the one, kid. Solara Trust. In and out in sixty seconds.',
      'MARA: The whole city will be looking for you. The yacht "Alba" is waiting at the beach.',
    ],
    escapeTarget: PLACES.yacht, escapeRadius: 16,
  },
];

export const PACKAGES = 8;        // hidden cash packages around the city
export const PACKAGE_CASH = 250;
export const START_CASH = 150;
export const HOSPITAL_FEE = 500;
