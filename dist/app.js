// Illustration loading, introduction and startup.
document
  .querySelectorAll(".cloud")
  .forEach((e) => e.classList.add("intro-cloud"));
// Explicit source rectangles prevent neighbouring atlas cells from clipping characters.
const regions = {
  angel: [0, 0, 418, 420],
  eagle: [425, 0, 410, 407],
  bull: [837, 40, 417, 356],
  lion: [0, 425, 420, 382],
  snake: [540, 418, 205, 420],
  anubis: [835, 417, 410, 395],
  sphinx: [0, 807, 418, 420],
  cloud: [429, 843, 405, 379],
};
for (const [name, box] of Object.entries(regions))
  document.querySelectorAll("." + name + "-art").forEach((el) => {
    const clip =
      "sprite-clip-" + name + "-" + Math.random().toString(36).slice(2);
    el.innerHTML = `<svg viewBox="${box.join(" ")}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><clipPath id="${clip}"><rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"/></clipPath></defs><image href="assets/atlas.png" x="0" y="0" width="1254" height="1254" clip-path="url(#${clip})"/></svg>`;
  });
const introPhrase = "My secrets are the reward for your courage.";
function revealInstrument() {
  document.body.classList.add("ready");
  document.removeEventListener("pointerdown", introGesture, true);
  document.removeEventListener("keydown", introGesture, true);
  if (introAudioContext && !introSoundPlayed && introAudioContext.state !== "closed")
    introAudioContext.close().catch(() => {});
  setTimeout(() => {
    $("#intro")?.remove();
    document
      .querySelectorAll(".intro-cloud")
      .forEach((el) => el.classList.remove("intro-cloud"));
  }, 1600);
}
function revealIntro() {
  const text = $("#introText");
  text.lang = "en";
  text.replaceChildren(
    document.createTextNode("My secrets are the"),
    document.createElement("br"),
    document.createTextNode("reward for your courage."),
  );
  setTimeout(() => text.classList.add("revealing"), 1400);
  setTimeout(playIntroSound, 650);
  setTimeout(revealInstrument, 5200);
}
// An independent, quiet intro cue never starts the sequencer or its effects.
let introAudioContext, introSoundPlayed = false;
async function playIntroSound() {
  if (introSoundPlayed || document.body.classList.contains("ready")) return;
  try {
    introAudioContext ||= new AudioContext();
    if (introAudioContext.state !== "running") await introAudioContext.resume();
    if (introSoundPlayed || document.body.classList.contains("ready")) {
      if (introAudioContext.state !== "closed") await introAudioContext.close();
      return;
    }
    introSoundPlayed = true;
    const c = introAudioContext, t = c.currentTime;
    const soft = c.createBiquadFilter(), gain = c.createGain();
    soft.type = "lowpass";
    soft.Q.value = 0.4;
    soft.frequency.setValueAtTime(190, t);
    soft.frequency.linearRampToValueAtTime(850, t + 2.3);
    soft.frequency.linearRampToValueAtTime(160, t + 7.3);
    soft.connect(gain).connect(c.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 1.2);
    // Five-second eased fade: no sudden drop after the sustained peak.
    gain.gain.setValueAtTime(0.14, t + 2.3);
    for (let step = 1; step <= 80; step++) {
      const x = step / 80;
      const eased = x * x * (3 - 2 * x);
      gain.gain.linearRampToValueAtTime(0.14 * (1 - eased) ** 2, t + 2.3 + x * 5);
    }
    // Low unison/octave drone: no stepped melody or notification-like arpeggio.
    [55, 55.3, 110, 164.81, 220].forEach((frequency, i) => {
      const oscillator = c.createOscillator(), weight = c.createGain();
      oscillator.type = i === 2 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      weight.gain.value = [0.65, 0.45, 0.4, 0.24, 0.12][i];
      if (i >= 3) {
        weight.gain.setValueAtTime(0, t);
        weight.gain.linearRampToValueAtTime([0, 0, 0, 0.24, 0.12][i], t + 2.3);
      }
      oscillator.connect(weight).connect(soft);
      oscillator.start(t);
      oscillator.stop(t + 7.6);
      oscillator.onended = () => {
        oscillator.disconnect(); weight.disconnect();
        if (i === 4 && c.state !== "closed") c.close().catch(() => {});
      };
    });

  } catch { /* Silent intro remains usable when audio is unavailable. */ }
}
function introGesture(e) {
  if (e.type === "keydown" && !["Enter", "Space"].includes(e.code)) return;
  if (document.body.classList.contains("ready")) return;
  if (e.type === "keydown") { e.preventDefault(); e.stopImmediatePropagation(); }
  playIntroSound();
}
document.addEventListener("pointerdown", introGesture, {capture:true});
document.addEventListener("keydown", introGesture, {capture:true});
let im = new Image();
im.src = "assets/atlas.png";
im.decode()
  .then(revealIntro)
  .catch(() => {
    revealInstrument();
    notice("Не удалось загрузить иллюстрации. Обнови страницу.");
  });
sync();
