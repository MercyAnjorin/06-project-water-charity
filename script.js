const world = document.getElementById("game-world");
const bucket = document.getElementById("bucket");
const scoreEl = document.getElementById("score");
const impactEl = document.getElementById("impact");
const livesEl = document.getElementById("lives");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const finalScoreEl = document.getElementById("final-score");
const factLineEl = document.getElementById("fact-line");
const playAgainBtn = document.getElementById("play-again-btn");
const settingsBtn = document.getElementById("settings-btn");
const menuBtn = document.getElementById("menu-btn");
const helpBtn = document.getElementById("help-btn");
const modal = document.getElementById("modal-panel");
const modalTitle = document.getElementById("modal-title");
const modalText = document.getElementById("modal-text");
const closeModalBtn = document.getElementById("close-modal-btn");
const settingsControls = document.getElementById("settings-controls");
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundToggleIcon = document.getElementById("sound-toggle-icon");
const soundToggleLabel = document.getElementById("sound-toggle-label");

const MAX_LIVES = 6;

const facts = [
  "Clean water improves health, school attendance, and opportunity.",
  "Access to safe water helps communities spend more time learning and working.",
  "Reliable clean water supports stronger families and healthier futures.",
  "Safe water access can transform a full community for generations."
];

const state = {
  running: false,
  score: 0,
  lives: MAX_LIVES,
  drops: [],
  lastFrame: 0,
  spawnTimer: 0,
  elapsed: 0,
  pollutedChance: 0.22,
  spawnEvery: 900,
  minSpeed: 140,
  maxSpeed: 220,
  bucketX: 0,
  soundsEnabled: true,
  pointerActive: false,
  audioCtx: null
};

function init() {
  const startBucketX = world.clientWidth / 2 - bucket.clientWidth / 2;
  setBucketX(startBucketX);
  renderLives();
  updateHud();
}

function renderLives() {
  const hearts = "❤".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
  livesEl.textContent = hearts;
  livesEl.setAttribute("aria-label", `${state.lives} lives remaining`);
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  impactEl.textContent = String(Math.floor(state.score / 10));
}

function setBucketX(x) {
  const min = 0;
  const max = world.clientWidth - bucket.clientWidth;
  state.bucketX = Math.max(min, Math.min(max, x));
  bucket.style.left = `${state.bucketX}px`;
  bucket.style.transform = "translateX(0)";
}

function showScreen(screenEl) {
  [startScreen, gameOverScreen].forEach((s) => {
    const visible = s === screenEl;
    s.classList.toggle("visible", visible);
    s.setAttribute("aria-hidden", String(!visible));
  });
}

function openModal(title, message, showSettings = false) {
  modalTitle.textContent = title;
  modalText.textContent = message;
  settingsControls.hidden = !showSettings;
  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("visible");
  modal.setAttribute("aria-hidden", "true");
}

function unlockAudio() {
  if (state.audioCtx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    state.soundsEnabled = false;
    return;
  }
  state.audioCtx = new AudioCtx();
}

function beep(type) {
  if (!state.soundsEnabled || !state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();

  osc.type = type === "good" ? "sine" : "square";
  osc.frequency.value = type === "good" ? 540 : 170;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.17, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "good" ? 0.11 : 0.2));

  osc.connect(gain);
  gain.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + (type === "good" ? 0.12 : 0.21));
}

function makeSplash(x, y) {
  for (let i = 0; i < 4; i += 1) {
    const particle = document.createElement("div");
    particle.className = "splash";
    particle.style.left = `${x + (Math.random() * 12 - 6)}px`;
    particle.style.top = `${y + (Math.random() * 12 - 6)}px`;
    world.appendChild(particle);
    setTimeout(() => particle.remove(), 280);
  }
}

function loseLife() {
  state.lives -= 1;
  renderLives();
  beep("bad");

  if (state.lives <= 0) {
    endGame();
  }
}

function spawnDrop() {
  const polluted = Math.random() < state.pollutedChance;
  const size = 20 + Math.random() * 14;
  const x = Math.random() * (world.clientWidth - size);
  const speed = state.minSpeed + Math.random() * (state.maxSpeed - state.minSpeed);

  const el = document.createElement("div");
  el.className = `drop ${polluted ? "polluted" : "clean"}`;
  el.style.width = `${size}px`;
  el.style.height = `${size * 1.3}px`;
  el.style.left = `${x}px`;
  el.style.top = `-${size}px`;
  world.appendChild(el);

  state.drops.push({
    el,
    x,
    y: -size,
    size,
    speed,
    polluted
  });
}

function intersects(drop) {
  const bucketTop = world.clientHeight - 24 - bucket.clientHeight;
  const bucketBottom = bucketTop + bucket.clientHeight;
  const bucketLeft = state.bucketX;
  const bucketRight = state.bucketX + bucket.clientWidth;

  const dropLeft = drop.x;
  const dropRight = drop.x + drop.size;
  const dropTop = drop.y;
  const dropBottom = drop.y + drop.size * 1.3;

  return !(
    dropRight < bucketLeft ||
    dropLeft > bucketRight ||
    dropBottom < bucketTop ||
    dropTop > bucketBottom
  );
}

function clearDrops() {
  state.drops.forEach((d) => d.el.remove());
  state.drops = [];
}

function updateDifficulty() {
  const t = state.elapsed / 1000;
  state.pollutedChance = Math.min(0.65, 0.22 + t * 0.0053);
  state.spawnEvery = Math.max(290, 900 - t * 18);
  state.minSpeed = Math.min(420, 140 + t * 6);
  state.maxSpeed = Math.min(650, 220 + t * 7.5);
}

function gameFrame(ts) {
  if (!state.running) return;
  if (!state.lastFrame) state.lastFrame = ts;
  const dt = (ts - state.lastFrame) / 1000;
  state.lastFrame = ts;
  const dtMs = dt * 1000;

  state.elapsed += dtMs;
  state.spawnTimer += dtMs;

  updateDifficulty();

  while (state.spawnTimer >= state.spawnEvery) {
    state.spawnTimer -= state.spawnEvery;
    spawnDrop();
  }

  for (let i = state.drops.length - 1; i >= 0; i -= 1) {
    const drop = state.drops[i];
    drop.y += drop.speed * dt;
    drop.el.style.top = `${drop.y}px`;

    if (intersects(drop)) {
      if (drop.polluted) {
        loseLife();
      } else {
        state.score += 1;
        updateHud();
        makeSplash(drop.x + drop.size / 2, drop.y + drop.size / 2);
        beep("good");
      }

      drop.el.remove();
      state.drops.splice(i, 1);
      continue;
    }

    if (drop.y > world.clientHeight + 40) {
      if (!drop.polluted) {
        loseLife();
      }
      drop.el.remove();
      state.drops.splice(i, 1);
    }
  }

  if (state.running) {
    requestAnimationFrame(gameFrame);
  }
}

function startGame() {
  if (state.running) return;

  closeModal();
  unlockAudio();
  showScreen(null);
  state.running = true;
  state.lastFrame = 0;
  requestAnimationFrame(gameFrame);
}

function resetGame() {
  state.running = false;
  state.score = 0;
  state.lives = MAX_LIVES;
  state.lastFrame = 0;
  state.spawnTimer = 0;
  state.elapsed = 0;
  state.pollutedChance = 0.22;
  state.spawnEvery = 900;
  state.minSpeed = 140;
  state.maxSpeed = 220;
  clearDrops();
  renderLives();
  updateHud();
  showScreen(startScreen);
}

function endGame() {
  state.running = false;
  clearDrops();
  finalScoreEl.textContent = String(state.score);
  factLineEl.textContent = facts[Math.floor(Math.random() * facts.length)];
  showScreen(gameOverScreen);
}

function pointerToBucketX(clientX) {
  const rect = world.getBoundingClientRect();
  return clientX - rect.left - bucket.clientWidth / 2;
}

world.addEventListener("pointerdown", (event) => {
  if (modal.classList.contains("visible")) return;

  state.pointerActive = true;
  world.setPointerCapture(event.pointerId);

  if (!state.running && startScreen.classList.contains("visible")) {
    startGame();
  }

  if (state.running) {
    setBucketX(pointerToBucketX(event.clientX));
  }
});

world.addEventListener("pointermove", (event) => {
  if (!state.running || !state.pointerActive) return;
  setBucketX(pointerToBucketX(event.clientX));
});

world.addEventListener("pointerup", (event) => {
  state.pointerActive = false;
  if (world.hasPointerCapture(event.pointerId)) {
    world.releasePointerCapture(event.pointerId);
  }
});

window.addEventListener("resize", () => {
  setBucketX(state.bucketX);
});

playAgainBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
playAgainBtn.addEventListener("click", resetGame);

function updateSoundToggle() {
  const on = state.soundsEnabled;
  soundToggleBtn.setAttribute("aria-pressed", String(on));
  soundToggleIcon.textContent = on ? "🔊" : "🔇";
  soundToggleLabel.textContent = on ? "ON" : "OFF";
}

settingsBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
settingsBtn.addEventListener("click", () => {
  updateSoundToggle();
  openModal("Settings", "", true);
});

soundToggleBtn.addEventListener("click", () => {
  state.soundsEnabled = !state.soundsEnabled;
  unlockAudio();
  updateSoundToggle();
});

menuBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
menuBtn.addEventListener("click", () => {
  openModal(
    "Menu",
    "Goal: Catch clean blue drops for points, avoid green polluted drops, and do not miss clean drops."
  );
});

helpBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
helpBtn.addEventListener("click", () => {
  openModal(
    "Help",
    "Drag the bucket left or right. +1 for each clean drop caught. Lose 1 life for each polluted drop caught or clean drop missed."
  );
});

closeModalBtn.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

resetGame();
init();
