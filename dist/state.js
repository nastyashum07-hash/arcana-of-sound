// Shared instrument state and bounded controls.
"use strict";
const $ = (s) => document.querySelector(s),
  clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const DURATION = 180;
const S = {
  playing: false,
  auto: false,
  loop: false,
  time: 0,
  bpm: 70,
  fate: 0.1,
  cutoff: 0.25,
  attack: 0.25,
  decay: 0.25,
  sustain: 0.3,
  release: 0.25,
  master: 0.55,
  vol: [0.6, 0.3],
  voices: [true, false],
  fx: { reverb: 0, delay: 0, chorus: 0, drive: 0 },
  steps: [true, true, true, true],
};
let ctx,
  out,
  filter,
  compressor,
  analyser,
  data,
  buses = [],
  next = 0,
  beat = 0,
  epoch = 0,
  angle = 0,
  velocity = 0,
  finishing = false,
  muted = false,
  frameTime = 0,
  lastAudio = 0;
const ui = {},
  figures = {},
  touches = new Map(),
  symbolValues = {};
const controlDirections = {};
function nextControlValue(id, value, step = 0.1) {
  let direction = controlDirections[id] || 1;
  if (value >= 1) direction = -1;
  else if (value <= 0) direction = 1;
  const next = clamp(Math.round((value + direction * step) * 100) / 100);
  controlDirections[id] = next >= 1 ? -1 : next <= 0 ? 1 : direction;
  return next;
}
function controlAction(id, value) {
  return value >= 1 || (value > 0 && controlDirections[id] === -1)
    ? "уменьшить"
    : "увеличить";
}
function touch(k) {
  touches.set(k, performance.now() + 7000);
}

// One physical wheel state drives both its drawing and the sounding sequence.
const wheelSound = { direction: 1, speed: 0, sector: 0, pulse: 0 };
function readWheel(delta = 0, dt = 0.05) {
  if (Math.abs(delta) > 0.01) wheelSound.direction = Math.sign(delta);
  wheelSound.speed = Math.min(360, Math.abs(delta) / Math.max(0.001, dt));
  wheelSound.sector = Math.floor(((angle % 360 + 360) % 360) / 45);
}
function wheelCutoff() {
  // Sphinx remains the base brightness; the wheel breathes around that value.
  return clamp(S.cutoff + Math.sin(angle * Math.PI / 180) * 0.18);
}
function wheelPitch(pitch) {
  const offsets = [0, 1, 2, 3, 2, 1, 0, -1];
  return clamp(pitch + offsets[wheelSound.sector], 0, 7);
}

let chaosTarget = 0, chaosSpeed = 0, chaosNext = 0, chaosSign = 1, wheelDragging = false;
function advanceWheel(dt, t) {
  const previousAngle = angle;
  const fate = clamp(S.fate),
    chaos = fate * fate;
  if (t >= chaosNext) {
    chaosSign = Math.random() < 0.85 ? -chaosSign : chaosSign;
    chaosTarget = chaosSign * (30 + Math.random() * 230) * chaos;
    chaosNext = t + (140 + Math.random() * 360) + (1 - fate) * 1800;
  }
  chaosSpeed +=
    (chaosTarget - chaosSpeed) * (1 - Math.exp(-dt * (2 + fate * 24)));
  if (!wheelDragging) {
    angle +=
      dt * ((S.playing ? S.bpm * 0.11 : 3) * (1 - fate) + chaosSpeed * fate);
    angle += velocity * dt * 30;
  }
  readWheel(angle - previousAngle, dt);
  velocity *= Math.exp(-dt * 3);
}
