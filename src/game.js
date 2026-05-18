const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const menuPanel = document.getElementById("menu-panel");
const statusPanel = document.getElementById("status-panel");
const statusKicker = document.getElementById("status-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");
const singlePlayerButton = document.getElementById("single-player-button");
const multiplayerButton = document.getElementById("multiplayer-button");
const instructionsTitle = document.getElementById("instructions-title");
const instructionsText = document.getElementById("instructions-text");
const scoreLeft = document.getElementById("score-left");
const scoreRight = document.getElementById("score-right");
const leftLabel = document.getElementById("left-label");
const rightLabel = document.getElementById("right-label");
const gameControls = document.getElementById("game-controls");
const pauseButton = document.getElementById("pause-button");
const menuButton = document.getElementById("menu-button");
const pausePanel = document.getElementById("pause-panel");
const resumeButton = document.getElementById("resume-button");
const pauseMenuButton = document.getElementById("pause-menu-button");
const difficultyControl = document.getElementById("difficulty-control");
const difficultySlider = document.getElementById("difficulty-slider");
const difficultyValue = document.getElementById("difficulty-value");

const cellSize = 16;
const columns = canvas.width / cellSize;
const rows = canvas.height / cellSize;
const roundsToWin = 5;
const tickRateMs = 84;

const directionVectors = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const orderedDirections = ["up", "right", "down", "left"];

const oppositeDirection = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const keyMap = {
  w: { player: "left", direction: "up" },
  a: { player: "left", direction: "left" },
  s: { player: "left", direction: "down" },
  d: { player: "left", direction: "right" },
  ArrowUp: { player: "right", direction: "up" },
  ArrowLeft: { player: "right", direction: "left" },
  ArrowDown: { player: "right", direction: "down" },
  ArrowRight: { player: "right", direction: "right" },
};

const modeInstructions = {
  single: {
    title: "Single Player",
    text:
      "You are the Blue Rider. Use WASD to steer and trap the gold AI pilot. Set AI difficulty from 0 (easiest) to 9 (hardest). First to 5 rounds wins the match.",
  },
  multiplayer: {
    title: "Multiplayer",
    text:
      "Blue Rider uses WASD. Gold Rider uses the arrow keys. Try to wall off your rival without crashing into trails or the arena edge.",
  },
};

const state = {
  screen: "menu",
  mode: "single",
  running: false,
  paused: false,
  difficulty: 5,
  aiTick: 0,
  scores: {
    left: 0,
    right: 0,
  },
  players: [],
  occupied: new Set(),
  lastTick: 0,
  aiEnabled: true,
};

function createPlayer({ id, color, glow, x, y, direction, isAi = false }) {
  return {
    id,
    color,
    glow,
    x,
    y,
    direction,
    nextDirection: direction,
    alive: true,
    trail: [{ x, y }],
    isAi,
  };
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function updateInstructions() {
  const content = modeInstructions[state.mode];
  instructionsTitle.textContent = content.title;
  instructionsText.textContent = content.text;
}

function updateHud() {
  leftLabel.textContent = "WASD";
  rightLabel.textContent = state.mode === "single" ? "AI Pilot" : "Arrows";
}

function updateDifficultyDisplay() {
  difficultySlider.value = String(state.difficulty);
  difficultyValue.textContent = String(state.difficulty);
  difficultyControl.classList.toggle("is-disabled", state.mode !== "single");
}

function setGameControlsVisible(visible) {
  gameControls.classList.toggle("hidden", !visible);
}

function setPaused(paused) {
  state.paused = paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
}

function resetScores() {
  state.scores.left = 0;
  state.scores.right = 0;
  updateScores();
}

function resetRound() {
  state.occupied = new Set();
  state.players = [
    createPlayer({
      id: "left",
      color: "#5ae5ff",
      glow: "rgba(90, 229, 255, 0.35)",
      x: 8,
      y: Math.floor(rows / 2),
      direction: "right",
    }),
    createPlayer({
      id: "right",
      color: "#ffb000",
      glow: "rgba(255, 176, 0, 0.35)",
      x: columns - 9,
      y: Math.floor(rows / 2),
      direction: "left",
      isAi: state.aiEnabled,
    }),
  ];

  for (const player of state.players) {
    state.occupied.add(cellKey(player.x, player.y));
  }
}

function updateScores() {
  scoreLeft.textContent = String(state.scores.left);
  scoreRight.textContent = String(state.scores.right);
}

function showMenu() {
  state.screen = "menu";
  state.running = false;
  setPaused(false);
  setGameControlsVisible(false);
  overlay.classList.remove("hidden");
  menuPanel.classList.remove("hidden");
  statusPanel.classList.add("hidden");
  pausePanel.classList.add("hidden");
  updateInstructions();
  updateHud();
  updateDifficultyDisplay();
  render();
}

function showPause() {
  if (state.screen !== "game" || !state.running) {
    return;
  }

  state.screen = "pause";
  setPaused(true);
  setGameControlsVisible(false);
  overlay.classList.remove("hidden");
  menuPanel.classList.add("hidden");
  statusPanel.classList.add("hidden");
  pausePanel.classList.remove("hidden");
}

function resumeGame() {
  if (state.screen !== "pause") {
    return;
  }

  state.screen = "game";
  setPaused(false);
  setGameControlsVisible(true);
  hideOverlay();
  state.lastTick = 0;
  requestAnimationFrame(frame);
}

function returnToMenu() {
  setPaused(false);
  showMenu();
}

function showStatus(kicker, title, message, buttonText = "Next Round") {
  state.screen = "status";
  setPaused(false);
  setGameControlsVisible(false);
  overlay.classList.remove("hidden");
  menuPanel.classList.add("hidden");
  pausePanel.classList.add("hidden");
  statusPanel.classList.remove("hidden");
  statusKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  startButton.textContent = buttonText;
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function beginRound() {
  resetRound();
  state.screen = "game";
  state.running = true;
  state.aiTick = 0;
  state.lastTick = 0;
  setPaused(false);
  setGameControlsVisible(true);
  hideOverlay();
  pausePanel.classList.add("hidden");
  requestAnimationFrame(frame);
}

function startMode(mode) {
  state.mode = mode;
  state.aiEnabled = mode === "single";
  resetScores();
  updateHud();
  updateDifficultyDisplay();
  beginRound();
}

function startNextRound() {
  if (state.scores.left >= roundsToWin || state.scores.right >= roundsToWin) {
    resetScores();
  }

  beginRound();
}

function queueDirection(playerId, direction) {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || !player.alive) {
    return;
  }

  if (oppositeDirection[player.direction] === direction) {
    return;
  }

  player.nextDirection = direction;
}

function isSafeCell(x, y) {
  if (x < 0 || x >= columns || y < 0 || y >= rows) {
    return false;
  }

  return !state.occupied.has(cellKey(x, y));
}

function distanceToObstacle(player, direction) {
  const vector = directionVectors[direction];
  let x = player.x;
  let y = player.y;
  let distance = 0;

  while (true) {
    x += vector.x;
    y += vector.y;

    if (!isSafeCell(x, y)) {
      return distance;
    }

    distance += 1;
  }
}

function scoreDirection(player, direction, target, difficulty = state.difficulty) {
  if (oppositeDirection[player.direction] === direction) {
    return Number.NEGATIVE_INFINITY;
  }

  const vector = directionVectors[direction];
  const nextX = player.x + vector.x;
  const nextY = player.y + vector.y;

  if (!isSafeCell(nextX, nextY)) {
    return Number.NEGATIVE_INFINITY;
  }

  const clearance = distanceToObstacle({ x: nextX, y: nextY }, direction);
  const distanceFromTarget =
    Math.abs(nextX - target.x) + Math.abs(nextY - target.y);
  const edgePenalty =
    Math.min(nextX, columns - 1 - nextX, nextY, rows - 1 - nextY) <= 1 ? 1.5 : 0;
  const turnBonus = direction !== player.direction ? 0.35 : 0;
  const clearanceWeight = 2 + difficulty * 0.35;
  const pursuitWeight = 0.25 + difficulty * 0.05;

  return (
    clearance * clearanceWeight -
    distanceFromTarget * pursuitWeight -
    edgePenalty +
    turnBonus
  );
}

function getSafeDirections(player) {
  return orderedDirections.filter((direction) => {
    if (oppositeDirection[player.direction] === direction) {
      return false;
    }

    const vector = directionVectors[direction];
    return isSafeCell(player.x + vector.x, player.y + vector.y);
  });
}

function updateAi() {
  if (!state.aiEnabled) {
    return;
  }

  const aiPlayer = state.players.find((player) => player.id === "right");
  const target = state.players.find((player) => player.id === "left");
  if (!aiPlayer || !target || !aiPlayer.alive) {
    return;
  }

  state.aiTick += 1;
  const reactionDelay = Math.max(1, Math.ceil((9 - state.difficulty) / 2));
  if (state.aiTick % reactionDelay !== 0) {
    return;
  }

  const mistakeChance = ((9 - state.difficulty) / 9) * 0.62;
  const safeDirections = getSafeDirections(aiPlayer);

  if (safeDirections.length > 0 && Math.random() < mistakeChance) {
    aiPlayer.nextDirection =
      safeDirections[Math.floor(Math.random() * safeDirections.length)];
    return;
  }

  const rankedDirections = orderedDirections
    .map((direction) => ({
      direction,
      score: scoreDirection(aiPlayer, direction, target),
    }))
    .filter((entry) => entry.score > Number.NEGATIVE_INFINITY)
    .sort((left, right) => right.score - left.score);

  if (rankedDirections.length === 0) {
    return;
  }

  const hesitationChance = ((9 - state.difficulty) / 9) * 0.45;
  if (rankedDirections.length > 1 && Math.random() < hesitationChance) {
    const weakerPick = rankedDirections[Math.floor(Math.random() * rankedDirections.length)];
    aiPlayer.nextDirection = weakerPick.direction;
    return;
  }

  const scoreNoise = ((9 - state.difficulty) / 9) * 4;
  let bestDirection = rankedDirections[0].direction;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const direction of orderedDirections) {
    let directionScore = scoreDirection(aiPlayer, direction, target);
    if (directionScore === Number.NEGATIVE_INFINITY) {
      continue;
    }

    directionScore += (Math.random() * 2 - 1) * scoreNoise;

    if (directionScore > bestScore) {
      bestScore = directionScore;
      bestDirection = direction;
    }
  }

  aiPlayer.nextDirection = bestDirection;
}

function movePlayers() {
  const proposals = [];

  for (const player of state.players) {
    if (!player.alive) {
      continue;
    }

    if (oppositeDirection[player.direction] !== player.nextDirection) {
      player.direction = player.nextDirection;
    }

    const vector = directionVectors[player.direction];
    proposals.push({
      player,
      x: player.x + vector.x,
      y: player.y + vector.y,
    });
  }

  const proposalCounts = new Map();

  for (const move of proposals) {
    const key = cellKey(move.x, move.y);
    proposalCounts.set(key, (proposalCounts.get(key) ?? 0) + 1);
  }

  for (const move of proposals) {
    const outOfBounds =
      move.x < 0 || move.x >= columns || move.y < 0 || move.y >= rows;
    const hitsTrail = state.occupied.has(cellKey(move.x, move.y));
    const headOnCollision = proposalCounts.get(cellKey(move.x, move.y)) > 1;

    if (outOfBounds || hitsTrail || headOnCollision) {
      move.player.alive = false;
    }
  }

  for (const move of proposals) {
    if (!move.player.alive) {
      continue;
    }

    move.player.x = move.x;
    move.player.y = move.y;
    move.player.trail.push({ x: move.x, y: move.y });
    state.occupied.add(cellKey(move.x, move.y));
  }
}

function finishRound() {
  const [left, right] = state.players;
  let kicker = "Round Complete";
  let title = "Double crash";
  let message = "Both riders collided. Press Space or the button below for a rematch.";

  if (left.alive && !right.alive) {
    state.scores.left += 1;
    title = "Blue Rider wins the round";
    message = "Press Space or launch the next duel from here.";
  } else if (!left.alive && right.alive) {
    state.scores.right += 1;
    title = "Gold Rider wins the round";
    message = "Press Space or launch the next duel from here.";
  }

  updateScores();
  state.running = false;

  if (state.scores.left >= roundsToWin || state.scores.right >= roundsToWin) {
    kicker = "Match Finished";
    const champion = state.scores.left > state.scores.right ? "Blue Rider" : "Gold Rider";
    showStatus(
      kicker,
      `${champion} takes the match`,
      `Final score ${state.scores.left} - ${state.scores.right}. Press Space to start a fresh match.`,
      "Restart Match",
    );
    return;
  }

  showStatus(kicker, title, message);
}

function tick() {
  updateAi();
  movePlayers();
  const survivors = state.players.filter((player) => player.alive);

  if (survivors.length <= 1) {
    finishRound();
  }
}

function drawGrid() {
  context.save();
  context.strokeStyle = "rgba(110, 177, 255, 0.08)";
  context.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += cellSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }

  for (let y = 0; y <= canvas.height; y += cellSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  context.restore();
}

function drawTrail(player) {
  context.save();
  context.shadowBlur = 18;
  context.shadowColor = player.glow;
  context.fillStyle = player.color;

  for (const segment of player.trail) {
    context.fillRect(
      segment.x * cellSize + 2,
      segment.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4,
    );
  }

  context.restore();
}

function drawHead(player) {
  context.save();
  context.fillStyle = "#f7fcff";
  context.shadowBlur = 24;
  context.shadowColor = player.color;
  context.beginPath();
  context.arc(
    player.x * cellSize + cellSize / 2,
    player.y * cellSize + cellSize / 2,
    cellSize * 0.34,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawCenterMark() {
  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.setLineDash([8, 12]);
  context.beginPath();
  context.moveTo(canvas.width / 2, 0);
  context.lineTo(canvas.width / 2, canvas.height);
  context.stroke();
  context.restore();
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#07101b");
  background.addColorStop(1, "#030507");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawCenterMark();

  for (const player of state.players) {
    drawTrail(player);
  }

  for (const player of state.players) {
    if (player.alive) {
      drawHead(player);
    }
  }
}

function frame(timestamp) {
  render();

  if (!state.running || state.paused) {
    if (state.running && state.paused) {
      requestAnimationFrame(frame);
    }

    return;
  }

  if (!state.lastTick) {
    state.lastTick = timestamp;
  }

  if (timestamp - state.lastTick >= tickRateMs) {
    tick();
    state.lastTick = timestamp;
  }

  if (state.running) {
    requestAnimationFrame(frame);
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    event.preventDefault();

    if (state.screen === "game") {
      showPause();
    } else if (state.screen === "pause") {
      resumeGame();
    }

    return;
  }

  if (event.code === "Space") {
    event.preventDefault();

    if (state.screen === "status") {
      startNextRound();
    }

    return;
  }

  const action = keyMap[event.key];
  if (!action) {
    return;
  }

  if (state.screen !== "game" || state.paused) {
    return;
  }

  if (state.aiEnabled && action.player === "right") {
    return;
  }

  event.preventDefault();
  queueDirection(action.player, action.direction);
});

singlePlayerButton.addEventListener("click", () => {
  startMode("single");
});

multiplayerButton.addEventListener("click", () => {
  startMode("multiplayer");
});

startButton.addEventListener("click", startNextRound);

pauseButton.addEventListener("click", () => {
  if (state.screen === "pause") {
    resumeGame();
    return;
  }

  showPause();
});

menuButton.addEventListener("click", returnToMenu);
resumeButton.addEventListener("click", resumeGame);
pauseMenuButton.addEventListener("click", returnToMenu);

difficultySlider.addEventListener("input", () => {
  state.difficulty = Number(difficultySlider.value);
  difficultyValue.textContent = String(state.difficulty);
});

updateInstructions();
updateScores();
updateHud();
updateDifficultyDisplay();
resetRound();
showMenu();
