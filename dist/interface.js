// Symbol controls, tooltips, keyboard and wheel gestures.
function notice(s) {
  $("#notice").textContent = s;
  clearTimeout(notice.timeout);
  notice.timeout = setTimeout(() => ($("#notice").textContent = ""), 4500);
}
function figure(id, art, label, fn) {
  const b = document.createElement("button");
  b.className = "figure " + id;
  b.id = id;
  b.title = label;
  b.setAttribute("aria-label", label);
  b.innerHTML = `<i class="sprite ${art}-art"></i>`;
  b.onclick = async () => {
    fn();
    if (!S.playing) await start(false);
  };
  $("#controls").append(b);
  figures[id] = b;
  return b;
}
const fxMap = {
  angel: "reverb",
  eagle: "chorus",
  bull: "delay",
  lion: "drive",
};
for (const [id, label] of [
  ["angel", "Небесный свод · пространство"],
  ["eagle", "Двойник · расслоение звука"],
  ["bull", "Память · эхо"],
  ["lion", "Пламя · искажение"],
])
  figure(id, id, label, () => {
    let key = fxMap[id];
    S.fx[key] = S.playing && S.fx[key] > 0.1 ? 0 : 0.65;
    touch("fx." + key);
    sync();
  });
figure("snake", "snake", "Нисхождение · голос тени слева", () => {
  S.voices[0] = !S.playing || !S.voices[0];
  touch("voice0");
  if (S.voices[0]) {
    if (S.vol[0] === 0) S.vol[0] = 0.3;
    if (S.playing) manual(0);
  }
  sync();
});
figure("anubis", "anubis", "Вознесение · голос света справа", () => {
  S.voices[1] = !S.playing || !S.voices[1];
  touch("voice1");
  if (S.voices[1]) {
    if (S.vol[1] === 0) S.vol[1] = 0.3;
    if (S.playing) manual(1);
  }
  sync();
});
figure("sphinx", "sphinx", "Завеса · открыть / прикрыть звук", () => {
  S.cutoff = S.cutoff > 0.5 ? 0.25 : 0.8;
  touch("cutoff");
  sync();
});
for (let i = 0; i < 2; i++) {
  const b = document.createElement("button");
  b.id = "vol" + i;
  b.className = "voice-diamond";
  b.innerHTML =
    '<svg viewBox="0 0 56 40" aria-hidden="true"><path d="M3 20L28 3L53 20L28 37Z"/></svg>';
  b.setAttribute("aria-label", (i ? "Вес света" : "Вес тени") + " · увеличить");
  b.onclick = (e) => {
    S.vol[i] = e.shiftKey ? clamp(S.vol[i] - 0.1) : nextControlValue("vol" + i, S.vol[i]);
    touch("vol" + i);
    sync();
    applyAudio();
  };
  $("#controls").append(b);
  ui["vol" + i] = b;
}
function celestial(id, glyph, label) {
  const group = document.createElement("div");
  group.id = id + "Control";
  group.className = "celestial";
  const up = document.createElement("button");
  up.id = id;
  up.className = "celestial-up";
  up.innerHTML = glyph;
  up.setAttribute("aria-label", label + " · увеличить");
  const change = (d, decrease) => {
    S[id] = decrease ? clamp(S[id] - d) : nextControlValue(id, S[id], d);
    touch(id);
    if (id === "fate") chaosNext = 0;
    sync();
    applyAudio();
  };
  up.onclick = (e) => change(0.1, e.shiftKey);
  group.append(up);
  $("#controls").append(group);
  ui[id] = up;
}
celestial("fate", "✶", "Судьба");
celestial(
  "master",
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M43 5A28 28 0 1 0 43 59A30 30 0 0 1 43 5Z"/></svg>',
  "Присутствие",
);
function syncCelestial() {
  const f = S.fate,
    m = S.master;
  ui.master.style.filter =
    "drop-shadow(0 0 " +
    (3 + 13 * m) +
    "px rgba(255,255,255," +
    (0.3 + 0.7 * m) +
    ")) drop-shadow(0 0 " +
    (8 + 22 * m) +
    "px rgba(255,255,255," +
    (0.15 + 0.5 * m) +
    "))";
  for (let i = 0; i < 2; i++) {
    const b = ui["vol" + i],
      v = S.vol[i];
    b.dataset.value = Math.round(v * 100);
    b.title =
      (i ? "Вес света" : "Вес тени") +
      " · " +
      Math.round(v * 100) +
      "% · " +
      controlAction("vol" + i, v) + " · Shift + клик: уменьшить";
    b.setAttribute("aria-label", b.title);
    b.style.color =
      "rgb(" +
      Math.round(180 + 75 * v) +
      "," +
      Math.round(149 + 94 * v) +
      "," +
      Math.round(78 + 122 * v) +
      ")";
    b.style.filter =
      "drop-shadow(0 0 " +
      (2 + 12 * v) +
      "px rgba(255,224,139," +
      (0.15 + 0.75 * v) +
      "))";
  }
  ui.master.style.color = "#fff";
  ui.fate.style.color =
    "rgb(" +
    Math.round(190 + 65 * f) +
    "," +
    Math.round(172 + 72 * f) +
    "," +
    Math.round(104 + 101 * f) +
    ")";
  ui.fate.style.textShadow =
    "0 0 " +
    (3 + 17 * f) +
    "px rgba(255,231,140," +
    (0.25 + 0.75 * f) +
    "),0 0 " +
    (5 + 35 * f) +
    "px rgba(255,207,82," +
    f * 0.8 +
    ")";
  ui.fate.style.transform = "scale(" + (1 + f * 0.14) + ")";
  for (const [id, label] of [
    ["fate", "Судьба"],
    ["master", "Присутствие"],
  ]) {
    const percent = Math.round(S[id] * 100);
    ui[id].title = label + " · " + percent + "% · " + controlAction(id, S[id]) + " · Shift + клик: уменьшить";
    ui[id].setAttribute("aria-label", ui[id].title);
    ui[id].dataset.value = percent;
  }
}
const sealSymbols = [
  [
    "attack",
    50,
    28,
    "Пробуждение",
    "M15 4C11 13 29 13 25 4M20 2V40M14 20C14 12 26 12 26 20C26 27 14 27 14 20M13 32H27",
  ],
  ["decay", 72, 50, "Уступка", "M10 10L32 22L10 34ZM5 22H35"],
  [
    "sustain",
    28,
    50,
    "Опора",
    "M9 22C9 11 31 11 31 22C31 33 9 33 9 22ZM5 22H35",
  ],
  [
    "release",
    50,
    72,
    "Растворение",
    "M20 3V41M5 15C10 9 14 21 20 15S30 21 35 15M5 25C10 19 14 31 20 25S30 31 35 25",
  ],
];
for (const [id, x, y, label, path] of sealSymbols) {
  const b = document.createElement("button");
  b.className = "tarot-symbol";
  b.id = id;
  b.style.left = x + "%";
  b.style.top = y + "%";
  b.innerHTML =
    '<svg viewBox="0 0 40 44" aria-hidden="true"><path d="' +
    path +
    '"/></svg>';
  b.title = label + " · изменить";
  b.setAttribute("aria-label", label);
  b.onclick = (e) => {
    S[id] = e.shiftKey ? clamp(S[id] - 0.5) : nextControlValue(id, S[id], 0.5);
    touch(id);
    sync();
    applyAudio();
    requestArticulation();
    b.classList.remove("pressed");
    void b.offsetWidth;
    b.classList.add("pressed");
  };
  $("#wheelControls").append(b);
  ui[id] = b;
}

function sync() {
  syncCelestial();
  for (const [id, k] of Object.entries(fxMap)) {
    figures[id].classList.toggle("active", S.playing && S.fx[k] > 0.08);
    figures[id].setAttribute("aria-pressed", S.playing && S.fx[k] > 0.08);
    figures[id].style.setProperty("--energy", S.fx[k]);
  }
  ["snake", "anubis"].forEach((id, i) => {
    figures[id].classList.toggle("active", S.voices[i] && S.playing);
    figures[id].setAttribute("aria-pressed", S.voices[i]);
  });
  figures.sphinx.classList.toggle("active", S.playing);
  for (const id of ["attack", "decay", "sustain", "release"]) {
    ui[id].dataset.value = Math.round(S[id] * 100);
    const names = {attack: "Пробуждение · атака", decay: "Уступка · спад", sustain: "Опора · удержание", release: "Растворение · хвост"};
    const value = envelopeShape(S)[id];
    ui[id].title = names[id] + " · " + (id === "sustain" ? Math.round(value * 100) + "%" : value.toFixed(2) + " с") + " · Shift + клик: уменьшить";
    ui[id].setAttribute("aria-label", ui[id].title);
    ui[id].classList.toggle("lit", S.playing && S[id] >= 0.5);
    symbolValues[id] = S[id];
  }
  $("#start").classList.toggle("active", S.playing);
  $("#demo").classList.toggle("active", S.loop);
  $("#start").setAttribute("aria-pressed", S.playing);
  $("#demo").setAttribute("aria-pressed", S.loop);
}
$("#start").onclick = () => start(true);
$("#demo").onclick = () => {
  S.loop = !S.loop;
  if (S.loop && (!S.playing || !S.auto)) start(true);
  else sync();
};
$("#stop").onclick = finish;
let lastPolar, lastWheelNote = -Infinity;
const wheel = $("#wheel");
function polar(e) {
  let r = wheel.getBoundingClientRect();
  return Math.atan2(
    e.clientY - r.top - r.height / 2,
    e.clientX - r.left - r.width / 2,
  );
}
wheel.onpointerdown = (e) => {
  wheelDragging = true;
  wheel.setPointerCapture(e.pointerId);
  lastPolar = polar(e);
};
wheel.onpointermove = (e) => {
  if (wheel.hasPointerCapture(e.pointerId)) {
    let p = polar(e),
      d = p - lastPolar;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    angle += (d * 180) / Math.PI;
    velocity = d * 22;
    readWheel(d * 180 / Math.PI);
    applyAudio();
    if (performance.now() - lastWheelNote > 220) {
      requestArticulation();
      lastWheelNote = performance.now();
    }
    lastPolar = p;
    sync();
  }
};
wheel.onpointerup = wheel.onpointercancel = () => {
  wheelDragging = false;
};
wheel.onlostpointercapture = () => {
  wheelDragging = false;
};
wheel.onkeydown = (e) => {
  if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    const delta = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -45 : 45;
    angle += delta;
    velocity = delta / 15;
    readWheel(delta);
    applyAudio();
    requestArticulation();
    sync();
  }
};
$("#helpBtn").onclick = () => $("#help").showModal();
$("#closeHelp").onclick = () => $("#help").close();
document.addEventListener("keydown", (e) => {
  if (
    $("#help").open ||
    e.target.matches("input") ||
    e.target.getAttribute("role") === "slider"
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    S.playing ? finish() : start(true);
  }
  if (e.key === "Escape") finish();
  if (e.key.toLowerCase() === "z") manual(0);
  if (e.key.toLowerCase() === "x") manual(1);
});
