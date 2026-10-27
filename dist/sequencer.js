// Generative motifs, 180-second score and look-ahead scheduler.
const scale = [0, 3, 5, 7, 10, 12, 15, 17];
let melody;
let articulationPending = false;
function requestArticulation() {
  if (!ctx || !S.playing || !S.voices.some(Boolean)) return;
  articulationPending = true;
  next = Math.min(next, ctx.currentTime + 0.06);
}
function renewMelody(keepTonic = false) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  melody = new FortuneMelody(
    seed,
    keepTonic && melody ? melody.transpose : undefined,
  );
}
renewMelody();
// Continuous score: interpolate every parameter across overlapping musical sections.
const score = [
  // seconds, bpm, fate, cutoff, A, D, S, R, shadow, light, reverb, delay, chorus, drive, master
  [0,   60, .04, .18, .70, .65, .80, .90, .40, 0,   .25, .10, 0,   0,   .46],
  [18,  62, .08, .26, .55, .50, .75, .85, .55, 0,   .65, .45, 0,   0,   .50],
  [35,  66, .15, .36, .40, .45, .65, .72, .60, .14, .72, .60, .08, 0,   .54],
  [60,  70, .25, .47, .28, .36, .60, .62, .58, .35, .65, .60, .25, .08, .54],
  [72,  66, .16, .55, .55, .45, .72, .85, .24, .52, .80, .65, .40, 0,   .53],
  [96,  72, .30, .60, .35, .40, .65, .75, .30, .55, .72, .68, .42, .12, .54],
  [116, 80, .55, .69, .20, .30, .50, .55, .50, .50, .62, .68, .60, .25, .55],
  [140, 92, .90, .82, .10, .22, .45, .45, .55, .58, .55, .70, .75, .48, .56],
  [150, 84, .62, .67, .22, .35, .60, .65, .52, .46, .65, .68, .50, .25, .54],
  [164, 68, .18, .38, .50, .55, .75, .88, .44, .18, .78, .65, .12, 0,   .50],
  [174, 60, .04, .23, .65, .70, .80, 1,   .23, .08, .85, .60, 0,   0,   .46],
  [180, 60, 0,   .18, .70, .80, .80, 1,   0,   0,   .85, .60, 0,   0,   .38],
];
// Give slow phrases room, then bring voices into a measured call and response.
function scoreVoiceActive(voice, beat, t) {
  if (t < 35) return voice === 0 && beat % 4 === 0;
  if (t < 65) return beat % 2 === 0 && (voice === 0 || beat % 8 === 4);
  if (t < 100) return voice === 1 ? beat % 2 === 0 : beat % 8 === 0;
  if (t < 130) return beat % 2 === 0 && voice === Math.floor(beat / 4) % 2;
  if (t < 150) return true;
  return beat % 4 === 0 && (voice === 0 || t < 166);
}
const keys = [
  "bpm",
  "fate",
  "cutoff",
  "attack",
  "decay",
  "sustain",
  "release",
  "vol0",
  "vol1",
  "fx.reverb",
  "fx.delay",
  "fx.chorus",
  "fx.drive",
  "master",
];
function automate(t) {
  let b = score.findIndex((p) => p[0] > t);
  if (b < 0) b = score.length - 1;
  let a = Math.max(0, b - 1),
    v = clamp((t - score[a][0]) / (score[b][0] - score[a][0] || 1));
  v = v * v * (3 - 2 * v);
  keys.forEach((k, j) => {
    if ((touches.get(k) || 0) > performance.now()) return;
    let n = score[a][j + 1] + (score[b][j + 1] - score[a][j + 1]) * v;
    if (k.startsWith("fx.")) S.fx[k.slice(3)] = n;
    else if (k.startsWith("vol")) S.vol[+k.slice(3)] = n;
    else S[k] = n;
  });
  if ((touches.get("voice0") || 0) < performance.now()) S.voices[0] = true;
  if ((touches.get("voice1") || 0) < performance.now()) S.voices[1] = t >= 35;
  if ((touches.get("steps") || 0) < performance.now()) {
    S.steps = [true, true, true, true];

  }
}
async function start(auto = false) {
  const ended = S.time >= DURATION;
  if (auto || !S.playing) renewMelody();
  if (auto) {
    touches.clear();
    automate(0);
    S.voices = [true, false];
  } else if (ended && S.vol.every((value) => value === 0)) {
    // An effect click after the final fade must also restart an audible voice.
    S.vol = [0.48, 0.4];
  }
  if (auto || ended) {
    S.time = 0;
    beat = 0;
  }
  articulationPending = false;
  muted = false;
  await audio();
  finishing = false;
  S.playing = true;
  S.auto = auto;
  epoch = ctx.currentTime - S.time;
  next = ctx.currentTime + 0.08;
  sync();
}
function finish() {
  if (finishing) return;
  articulationPending = false;
  finishing = true;
  muted = true;
  S.playing = false;
  S.auto = false;
  S.loop = false;
  if (ctx) {
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.65);
  }
  sync();
  setTimeout(() => {
    finishing = false;
  }, 2500);
}
setInterval(() => {
  if (!ctx || !S.playing) return;
  S.time = ctx.currentTime - epoch;
  if (S.auto) automate(S.time);
  if (S.auto && S.time >= DURATION) {
    if (S.loop) {
      renewMelody(true);
      epoch += DURATION;
      S.time = ctx.currentTime - epoch;
      beat = 0;
      touches.clear();
      automate(S.time);
    } else {
      S.time = DURATION;
      muted = true;
      S.playing = false;
      S.auto = false;
      sync();
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      return;
    }
  }
  while (next < ctx.currentTime + 0.14) {
    const s = beat % 4;
    let level = S.auto && !S.loop ? clamp((DURATION - 4 - S.time) / 9) : 1;
    // In manual performance, Fate controls density without a timed score.
    const stride = S.auto ? 1 : S.fate < 0.25 ? 4 : S.fate < 0.6 ? 2 : 1;
    if (S.steps[s] && level > 0 && (beat % stride === 0 || articulationPending)) {
      for (let i = 0; i < 2; i++)
        if (S.voices[i] && (!S.auto || articulationPending || scoreVoiceActive(i, beat, S.time))) {
          const event = melody.next(
            i,
            beat,
            S.fate,
            S.auto ? S.time / DURATION : 0,
            wheelSound.direction,
          );
          note(i, next, wheelPitch(event.pitch), false, level * event.level);
          wheelSound.pulse = 1;
        }
    }
    articulationPending = false;
    next += 60 / (S.auto ? S.bpm : 60 + 42 * S.fate) / 2;
    beat++;
  }
  sync();
  applyAudio();
}, 50);
