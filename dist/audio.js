// Web Audio graph, synthesis and smooth parameter updates.
function curve(a) {
  let c = new Float32Array(1024),
    k = a * 20;
  for (let n = 0; n < c.length; n++) {
    let x = (n * 2) / 1023 - 1;
    c[n] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}
// Context injection also allows real OfflineAudioContext regression tests.
function buildAudioGraph(context) {
  ctx = context;
  buses = [];
  out = ctx.createGain();
  out.gain.value = 0;
  filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.6;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -13;
  compressor.ratio.value = 6;
  // Transparent below 0.7; soft ceiling prevents stacked long notes clipping.
  const ceiling = ctx.createWaveShaper();
  const transfer = new Float32Array(8193);
  for (let j = 0; j < transfer.length; j++) {
    const x = 2 * j / (transfer.length - 1) - 1;
    const a = Math.abs(x);
    transfer[j] = Math.sign(x) * (a <= 0.7 ? a : 0.7 + 0.28 * (1 - Math.exp(-(a - 0.7) / 0.28)));
  }
  ceiling.curve = transfer;
  filter.connect(compressor).connect(out).connect(ceiling).connect(ctx.destination);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  data = new Float32Array(256);
  ceiling.connect(analyser);
  for (let i = 0; i < 2; i++) {
    let input = ctx.createGain(),
      lp = ctx.createBiquadFilter(),
      sh = ctx.createWaveShaper(),
      pan = ctx.createStereoPanner(),
      voiceGain = ctx.createGain(),
      mix = ctx.createGain(),
      dry = ctx.createGain(),
      driveWet = ctx.createGain(),
      compensation = ctx.createGain(),
      delay = ctx.createDelay(2),
      fb = ctx.createGain(),
      wet = ctx.createGain(),
      rev = ctx.createGain(),
      conv = ctx.createConvolver(),
      ch = ctx.createDelay(0.1),
      cw = ctx.createGain(),
      lfo = ctx.createOscillator(),
      depth = ctx.createGain();
    // Distortion is a level-matched parallel colour, before voice volume.
    input.connect(lp);
    lp.connect(dry).connect(mix);
    lp.connect(sh).connect(compensation).connect(driveWet).connect(mix);
    compensation.gain.value = 0.38;
    sh.curve = curve(0.2);
    dry.gain.value = 1;
    driveWet.gain.value = 0;
    mix.connect(voiceGain).connect(pan);
    mix.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(voiceGain);
    mix.connect(conv).connect(rev).connect(voiceGain);
    mix.connect(ch).connect(cw).connect(voiceGain);
    pan.pan.value = i ? 0.82 : -0.82;
    pan.connect(filter);
    sh.oversample = "2x";
    lp.type = "lowpass";
    lp.frequency.value = i ? 7000 : 1700;
    delay.delayTime.value = 0.58;
    fb.gain.value = 0.48;
    ch.delayTime.value = 0.02;
    lfo.frequency.value = 0.27 + i * 0.13;
    depth.gain.value = 0.003;
    lfo.connect(depth).connect(ch.delayTime);
    lfo.start();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const a = ir.getChannelData(c);
      for (let n = 0; n < a.length; n++)
        a[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / a.length, 3);
    }
    conv.buffer = ir;
    voiceGain.gain.value = 0;
    wet.gain.value = rev.gain.value = cw.gain.value = 0;
    buses.push({ input, lp, sh, pan, voiceGain, mix, dry, driveWet, delay, fb, wet, rev, cw });
  }
}
async function audio() {
  if (!ctx) buildAudioGraph(new AudioContext());
  await ctx.resume();
  applyAudio();
}
function applyAudio(at) {
  if (!ctx) return;
  const t = at === undefined ? ctx.currentTime : at;
  filter.frequency.setTargetAtTime(170 * Math.pow(65, wheelCutoff()), t, 0.5);
  out.gain.setTargetAtTime(muted ? 0 : S.master * 0.65, t, 0.3);
  buses.forEach((b, i) => {
    b.voiceGain.gain.setTargetAtTime(S.voices[i] ? S.vol[i] : 0, t, 0.7);
    b.lp.frequency.setTargetAtTime(i ? 7500 : 450 + wheelCutoff() * 2200, t, 0.4);
    const blend = clamp(S.fx.drive) * 0.55;
    b.dry.gain.setTargetAtTime(1 - blend, t, 0.3);
    b.driveWet.gain.setTargetAtTime(blend, t, 0.3);
    b.wet.gain.setTargetAtTime(S.fx.delay * 0.9, t, 0.3);
    b.rev.gain.setTargetAtTime(S.fx.reverb * 2.3, t, 0.3);
    b.cw.gain.setTargetAtTime(S.fx.chorus * 0.4, t, 0.7);
  });
}
function envelopeShape(s) {
  return {
    attack: 0.008 + 2.0 * s.attack ** 2,
    decay: 0.04 + 1.6 * s.decay ** 2,
    sustain: 0.025 + 0.925 * s.sustain,
    release: 0.08 + 3.8 * s.release ** 2,
  };
}
function note(i, t, n, slide = false, level = 1) {
  let osc = ctx.createOscillator(),
    sub = ctx.createOscillator(),
    env = ctx.createGain(),
    tone = ctx.createBiquadFilter(),
    g = ctx.createGain(),
    freq =
      (i ? 293.665 : 73.416) * 2 ** ((scale[n % 8] + melody.transpose) / 12);
  osc.type = i ? "sine" : "triangle";
  sub.type = i ? "triangle" : "sine";
  g.gain.value = i ? 0.12 : 0.5;
  osc.frequency.setValueAtTime(slide ? freq * (i ? 0.5 : 1.5) : freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.5);
  sub.frequency.value = freq * (i ? 2.003 : 0.5);
  osc.connect(env);
  sub.connect(g).connect(env);
  env.connect(tone).connect(buses[i].input);
  const shape = envelopeShape(S),
    a = shape.attack, d = shape.decay, r = shape.release,
    hold = 0.08 + 0.82 * S.sustain,
    peak = (i ? 0.19 : 0.3) * level;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + a);
  env.gain.exponentialRampToValueAtTime(peak * shape.sustain, t + a + d);
  env.gain.setValueAtTime(peak * shape.sustain, t + a + d + hold);
  // A genuinely audible tail: avoid losing most of the release to -100 dB.
  const tail = t + a + d + hold;
  env.gain.exponentialRampToValueAtTime(Math.max(0.00001, peak * shape.sustain * 0.08), tail + r * 0.85);
  env.gain.linearRampToValueAtTime(0, tail + r);
  // The seals also articulate the brightness of each note, not only its level.
  tone.type = "lowpass";
  tone.Q.value = 0.5;
  const bright = i ? 6500 : 2400;
  const dark = i ? 380 : 150;
  tone.frequency.setValueAtTime(S.attack > 0.1 ? dark : bright, t);
  tone.frequency.exponentialRampToValueAtTime(bright, t + a);
  tone.frequency.exponentialRampToValueAtTime(dark + (bright - dark) * S.sustain, t + a + d);
  tone.frequency.setValueAtTime(dark + (bright - dark) * S.sustain, tail);
  tone.frequency.exponentialRampToValueAtTime(dark, tail + r);
  osc.start(t);
  sub.start(t);
  osc.stop(t + a + d + hold + r + 0.1);
  sub.stop(t + a + d + hold + r + 0.1);
  osc.onended = () => {
    osc.disconnect();
    sub.disconnect();
    env.disconnect();
    tone.disconnect();
    g.disconnect();
  };
  setTimeout(
    () => {
      let f = figures[i ? "anubis" : "snake"];
      f.classList.add("pulse");
      setTimeout(() => f.classList.remove("pulse"), 200);
    },
    Math.max(0, (t - ctx.currentTime) * 1000),
  );
}
async function manual(i) {
  muted = false;
  await audio();
  let was = S.voices[i];
  S.voices[i] = true;
  applyAudio();
  note(i, ctx.currentTime, i ? 4 : 0, true);
  if (!was) sync();
}
