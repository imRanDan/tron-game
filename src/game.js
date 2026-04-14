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
      "You are the Blue Rider. Use WASD to steer and trap the gold AI pilot. First to 5 rounds wins the match.",
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
  overlay.classList.remove("hidden");
  menuPanel.classList.remove("hidden");
  statusPanel.classList.add("hidden");
  updateInstructions();
  updateHud();
  render();
}

function showStatus(kicker, title, message, buttonText = "Next Round") {
  state.screen = "status";
  overlay.classList.remove("hidden");
  menuPanel.classList.add("hidden");
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
  state.lastTick = 0;
  hideOverlay();
  requestAnimationFrame(frame);
}

function startMode(mode) {
  state.mode = mode;
  state.aiEnabled = mode === "single";
  resetScores();
  updateHud();
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

function scoreDirection(player, direction, target) {
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

  return clearance * 3 - distanceFromTarget * 0.4 - edgePenalty + turnBonus;
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

  let bestDirection = aiPlayer.direction;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const direction of orderedDirections) {
    const directionScore = scoreDirection(aiPlayer, direction, target);
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

  if (!state.running) {
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

  if (state.screen !== "game") {
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

updateInstructions();
updateScores();
updateHud();
resetRound();
showMenu();
