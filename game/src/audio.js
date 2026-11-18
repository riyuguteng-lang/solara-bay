// Solara Bay — all sound is synthesized with WebAudio. No audio files.
// Engine hum, sirens, gunshots, pickup blips and a procedural music loop.

export function createAudio() {
  let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let muted = false, musicTimer = null, musicStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth'; engineOsc2.frequency.value = 55 * 1.01;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(filter); engineOsc2.connect(filter);
      filter.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Siren: square wave wobbling between two tones.
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'square'; sirenOsc.frequency.value = 800;
      sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.6;
      const sirenLfoGain = ctx.createGain(); sirenLfoGain.gain.value = 180;
      sirenLfo.connect(sirenLfoGain); sirenLfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
      startMusic();
      return true;
    } catch { return false; }
  }

  // Procedural music: Am – F – C – G pads with a walking bass, 8 steps a bar.
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 196, 261.6], [196, 246.9, 293.7]];
  const BASS = [55, 43.65, 65.4, 49];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || muted) { musicStep++; return; }
      const bar = Math.floor(musicStep / 8) % 4, beat = musicStep % 8;
      if (beat === 0) {
        for (const f of CHORDS[bar]) pad(f, 1.9);
        pad(BASS[bar] * 2, 1.9);
      }
      if (beat % 2 === 0) blipNote(BASS[bar] * 4, 0.18, 'triangle', 0.5);
      musicStep++;
    }, 240);
  }
  function pad(freq, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = 4;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.4);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start(); o.stop(ctx.currentTime + dur + 0.1);
  }
  function blipNote(freq, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** speed 0..1 while driving; 0 silences the engine. */
    setEngine(speed, on) {
      if (!ctx || !engineOsc) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed * 0.06 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed * 140, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.3);
    },
    gunshot() { noiseBurst(0.18, 0.5, 900); tone(160, 0.12, 'square', 0.25, 60); },
    enemyShot() { noiseBurst(0.14, 0.25, 700); },
    punch() { noiseBurst(0.09, 0.3, 500); },
    blip() { tone(880, 0.09, 'sine', 0.25, 1320); },
    cash() { tone(660, 0.1, 'sine', 0.25); setTimeout(() => tone(990, 0.14, 'sine', 0.25), 90); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.15), i * 140)); },
    crash() { noiseBurst(0.3, 0.4, 400); },
    door() { tone(220, 0.08, 'square', 0.12, 160); },
  };
}
