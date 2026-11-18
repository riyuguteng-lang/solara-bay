// Solara Bay — the HUD: wanted stars, health, cash, clock, speed, mission
// objective, weapon and ammo, plus the menus (start, pause, game over,
// win), subtitles, banners and the damage flash. All DOM, no canvas.

import { MISSIONS } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), stars: $('stars'), healthFill: $('health-fill'), healthText: $('health-text'),
    cash: $('cash'), clock: $('clock'), objective: $('objective'), distance: $('distance'),
    speed: $('speed'), packages: $('packages'), weapon: $('weapon'), ammo: $('ammo'),
    subtitle: $('subtitle'), banner: $('banner'), flash: $('flash'),
    crosshair: $('crosshair'), help: $('help'),
    menu: $('menu'), pauseMenu: $('pause-menu'), overMenu: $('gameover-menu'), winMenu: $('win-menu'),
    menuInfo: $('menu-info'), overText: $('over-text'), winText: $('win-text'),
  };
  let subtitleTimer = 0, bannerTimer = 0, lastHealth = 100;

  function showOnly(name) {
    for (const k of ['menu', 'pauseMenu', 'overMenu', 'winMenu']) el[k].classList.toggle('hidden', k !== name);
    el.hud.classList.toggle('hidden', name === 'menu');
  }
  function starText(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  return {
    showMenu(save) {
      showOnly('menu');
      el.menuInfo.textContent = save
        ? `Save found: $${save.cash} — mission ${MISSIONS[Math.min(save.missionIndex, 4)].title}. Continue or start fresh.`
        : 'No save yet. A new life in Solara Bay begins at Palm Court Plaza.';
      document.getElementById('continue-btn').classList.toggle('hidden', !save);
    },
    showHud() { showOnly(null); },
    showPause() { showOnly('pauseMenu'); },
    showGameOver(fee) {
      el.overText.textContent = `The streets of Solara Bay got the better of you. Hospital bill: $${fee}.`;
      showOnly('overMenu');
    },
    showWin() {
      el.winText.textContent = `All five jobs done. The yacht "Alba" slips out of Solara Bay with $${G.cash} — Mara is already counting it.`;
      showOnly('winMenu');
    },
    setObjective(text) { el.objective.textContent = text; },
    setDistance(d) { el.distance.textContent = d > 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`; },
    flash(text) {
      el.banner.textContent = text;
      el.banner.classList.remove('hidden');
      bannerTimer = 3.2;
    },
    say(text) {
      el.subtitle.textContent = text;
      el.subtitle.classList.remove('hidden');
      subtitleTimer = 4.5;
    },
    damageFlash() {
      el.flash.classList.remove('hidden');
      setTimeout(() => el.flash.classList.add('hidden'), 180);
    },
    update(dt) {
      if (subtitleTimer > 0) { subtitleTimer -= dt; if (subtitleTimer <= 0) el.subtitle.classList.add('hidden'); }
      if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) el.banner.classList.add('hidden'); }
      el.stars.textContent = starText(G.wanted);
      el.stars.classList.toggle('hot', G.wanted > 0);
      el.healthFill.style.width = `${Math.max(0, G.health)}%`;
      el.healthFill.style.background = G.health > 50 ? '#4caf50' : G.health > 25 ? '#ff9800' : '#f44336';
      el.healthText.textContent = `${Math.ceil(Math.max(0, G.health))}`;
      if (G.health < lastHealth) this.damageFlash();
      lastHealth = G.health;
      el.cash.textContent = `$${G.cash.toLocaleString('en-US')}`;
      const mins = Math.floor(G.clockMinutes) % 1440;
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      el.clock.textContent = `${hh}:${mm}`;
      el.packages.textContent = `Packages ${G.packagesFound}/8`;
      const inCar = !!G.player.inCar;
      el.speed.textContent = inCar ? `${Math.round(Math.abs(G.player.inCar.speed) * 3.6)} km/h` : '';
      el.speed.classList.toggle('hidden', !inCar);
      const w = G.combat.state.weapon;
      el.weapon.textContent = w === 'pistol' ? 'PISTOL' : 'FISTS';
      el.ammo.textContent = w === 'pistol'
        ? (G.combat.state.reloading > 0 ? 'RELOADING…' : `${G.combat.state.ammo} / ∞`)
        : '';
      el.crosshair.classList.toggle('hidden', w !== 'pistol' || !G.input.locked);
      el.help.classList.toggle('hidden', G.input.locked);
    },
  };
}
