// Wheel motion and live output level.
function frame(t) {
  let dt = Math.min(0.05, (t - frameTime) / 1000 || 0);
  frameTime = t;
  advanceWheel(dt, t);
  wheelSound.pulse *= Math.exp(-dt * 5);
  $("#wheelArt").style.filter = `drop-shadow(0 0 ${wheelSound.pulse * 9}px rgba(255,235,167,${wheelSound.pulse * .65}))`;
  $("#wheelArt").style.transform = `rotate(${angle}deg)`;
  if (ctx && !S.playing && !finishing && t - lastAudio > 150) {
    applyAudio();
    lastAudio = t;
  }
  if (analyser) {
    analyser.getFloatTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length);
    $("#stage").dataset.signal = rms.toFixed(5);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
