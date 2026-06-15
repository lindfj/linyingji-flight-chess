const canvas = document.getElementById("gameBoard");
const ctx = canvas.getContext("2d");

const ui = {
  turnDot: document.getElementById("turnDot"),
  turnLabel: document.getElementById("turnLabel"),
  roundLabel: document.getElementById("roundLabel"),
  diceButton: document.getElementById("diceButton"),
  diceFace: document.getElementById("diceFace"),
  rollButton: document.getElementById("rollButton"),
  actionTitle: document.getElementById("actionTitle"),
  actionHint: document.getElementById("actionHint"),
  playerList: document.getElementById("playerList"),
  gameLog: document.getElementById("gameLog"),
  newGameButton: document.getElementById("newGameButton"),
  rulesButton: document.getElementById("rulesButton"),
  rulesDialog: document.getElementById("rulesDialog"),
  winnerOverlay: document.getElementById("winnerOverlay"),
  winnerLabel: document.getElementById("winnerLabel"),
  playAgainButton: document.getElementById("playAgainButton"),
};

const players = [
  { name: "红队", color: "#ed5a5a", light: "#ffd8d4", start: 0 },
  { name: "蓝队", color: "#4186e6", light: "#d7e8ff", start: 10 },
  { name: "黄队", color: "#f4bd3c", light: "#fff0b8", start: 20 },
  { name: "绿队", color: "#45a879", light: "#d4f1df", start: 30 },
];

const state = {
  currentPlayer: 0,
  dice: 1,
  rolled: false,
  rolling: false,
  round: 1,
  winner: null,
  planes: [],
  logs: [],
};

let animationFrameId = null;

const board = {
  center: { x: 410, y: 410 },
  route: [],
  homes: [],
  finishRoutes: [],
};

function createBoardGeometry() {
  const cx = board.center.x;
  const cy = board.center.y;
  const radius = 286;

  board.route = Array.from({ length: 40 }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 40;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });

  const homeCenters = [
    { x: 160, y: 160 },
    { x: 660, y: 160 },
    { x: 660, y: 660 },
    { x: 160, y: 660 },
  ];
  const offsets = [
    { x: -45, y: -45 }, { x: 45, y: -45 },
    { x: -45, y: 45 }, { x: 45, y: 45 },
  ];

  board.homes = homeCenters.map((home) =>
    offsets.map((offset) => ({ x: home.x + offset.x, y: home.y + offset.y }))
  );

  board.finishRoutes = players.map((player) => {
    const entry = board.route[(player.start + 39) % 40];
    return Array.from({ length: 6 }, (_, i) => {
      const ratio = (i + 1) / 7;
      return {
        x: entry.x + (cx - entry.x) * ratio,
        y: entry.y + (cy - entry.y) * ratio,
      };
    });
  });
}

function resetGame() {
  state.currentPlayer = 0;
  state.dice = 1;
  state.rolled = false;
  state.rolling = false;
  state.round = 1;
  state.winner = null;
  state.logs = [];
  state.planes = players.map((_, playerIndex) =>
    Array.from({ length: 4 }, (_, planeIndex) => ({
      playerIndex,
      planeIndex,
      progress: -1,
    }))
  );
  ui.winnerOverlay.hidden = true;
  addLog("游戏开始，红队率先掷骰子。", 0);
  renderDice(1);
  updateUI();
  draw();
}

function roundRect(x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fbf8f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 173) % 820;
    const y = (i * 97) % 820;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fillStyle = "#dfd8c8";
    ctx.fill();
  }
  ctx.restore();
}

function drawHomeAreas() {
  const homes = [
    { x: 58, y: 58 },
    { x: 562, y: 58 },
    { x: 562, y: 562 },
    { x: 58, y: 562 },
  ];

  homes.forEach((home, index) => {
    roundRect(home.x, home.y, 200, 200, 35, players[index].light);
    roundRect(home.x + 21, home.y + 21, 158, 158, 27, "rgba(255,255,255,0.65)");

    ctx.fillStyle = players[index].color;
    ctx.font = "700 15px Microsoft YaHei";
    ctx.textAlign = "center";
    ctx.fillText(players[index].name, home.x + 100, home.y + 32);

    board.homes[index].forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 27, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = players[index].color;
      ctx.stroke();
    });
  });
}

function drawRoute() {
  board.route.forEach((point, index) => {
    const owner = Math.floor(index / 10);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = index % 10 === 0 ? players[owner].color : "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = index % 10 === 0 ? "#fff" : players[owner].light;
    ctx.stroke();

    if (index % 10 === 0) {
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✦", point.x, point.y + 1);
    }
  });

  board.finishRoutes.forEach((route, playerIndex) => {
    route.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = index === route.length - 1 ? players[playerIndex].color : players[playerIndex].light;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    });
  });
}

function drawCenter() {
  const center = board.center;
  players.forEach((player, index) => {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    const angleA = -Math.PI / 2 + index * Math.PI / 2;
    const angleB = angleA + Math.PI / 2;
    ctx.arc(center.x, center.y, 72, angleA, angleB);
    ctx.closePath();
    ctx.fillStyle = player.light;
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(center.x, center.y, 39, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "rgba(32,49,59,0.08)";
  ctx.stroke();
  ctx.fillStyle = "#34444b";
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✈", center.x, center.y);
}

function getPlanePosition(plane) {
  if (plane.progress === -1) {
    return board.homes[plane.playerIndex][plane.planeIndex];
  }

  if (plane.progress >= 46) {
    const angle = (Math.PI * 2 * plane.planeIndex) / 4 - Math.PI / 2;
    return {
      x: board.center.x + Math.cos(angle) * 22,
      y: board.center.y + Math.sin(angle) * 22,
    };
  }

  if (plane.progress >= 40) {
    return board.finishRoutes[plane.playerIndex][plane.progress - 40];
  }

  const player = players[plane.playerIndex];
  return board.route[(player.start + plane.progress) % 40];
}

function isPlaneMovable(plane, dice = state.dice) {
  if (plane.progress >= 46) return false;
  if (plane.progress === -1) return dice === 6;
  return plane.progress + dice <= 46;
}

function drawPlane(plane) {
  const pos = getPlanePosition(plane);
  const player = players[plane.playerIndex];
  const selectable =
    state.rolled &&
    plane.playerIndex === state.currentPlayer &&
    isPlaneMovable(plane);

  ctx.save();
  if (selectable) {
    const pulse = 5 + Math.sin(Date.now() / 180) * 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 24 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = `${player.color}28`;
    ctx.fill();
  }

  ctx.translate(pos.x, pos.y);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✈", 0, 1);
  ctx.restore();
}

function draw() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  drawBackground();
  drawHomeAreas();
  drawRoute();
  drawCenter();
  state.planes.flat().forEach(drawPlane);

  if (state.rolled && !state.winner) {
    animationFrameId = requestAnimationFrame(draw);
  }
}

function renderDice(value) {
  const pipPositions = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };
  ui.diceFace.innerHTML = "";
  for (let cell = 1; cell <= 9; cell += 1) {
    const spot = document.createElement("span");
    if (pipPositions[value].includes(cell)) spot.className = "pip";
    ui.diceFace.appendChild(spot);
  }
}

function rollDice() {
  if (state.rolled || state.rolling || state.winner !== null) return;
  state.rolling = true;
  ui.rollButton.disabled = true;
  ui.diceButton.classList.add("rolling");
  ui.actionTitle.textContent = "骰子飞行中…";
  ui.actionHint.textContent = "看看天空送来几点";

  let ticks = 0;
  const timer = setInterval(() => {
    renderDice(1 + Math.floor(Math.random() * 6));
    ticks += 1;
    if (ticks < 9) return;

    clearInterval(timer);
    state.dice = 1 + Math.floor(Math.random() * 6);
    state.rolling = false;
    state.rolled = true;
    renderDice(state.dice);
    ui.diceButton.classList.remove("rolling");
    addLog(`${players[state.currentPlayer].name}掷出了 ${state.dice} 点。`, state.currentPlayer);

    const movable = state.planes[state.currentPlayer].filter((plane) => isPlaneMovable(plane));
    if (movable.length === 0) {
      ui.actionTitle.textContent = `掷出 ${state.dice} 点`;
      ui.actionHint.textContent = "没有飞机可以移动";
      updateUI();
      draw();
      setTimeout(nextTurn, 900);
      return;
    }

    ui.actionTitle.textContent = `掷出 ${state.dice} 点`;
    ui.actionHint.textContent = "点击发光的飞机移动";
    updateUI();
    draw();
  }, 75);
}

function movePlane(plane) {
  if (!state.rolled || plane.playerIndex !== state.currentPlayer || !isPlaneMovable(plane)) return;

  if (plane.progress === -1) {
    plane.progress = 0;
    addLog(`${players[plane.playerIndex].name}的一架飞机起飞了！`, plane.playerIndex);
  } else {
    plane.progress += state.dice;
    addLog(`${players[plane.playerIndex].name}的飞机前进 ${state.dice} 格。`, plane.playerIndex);
  }

  handleCollision(plane);
  state.rolled = false;
  draw();
  updateUI();

  const finishedCount = state.planes[plane.playerIndex].filter((item) => item.progress === 46).length;
  if (finishedCount === 4) {
    declareWinner(plane.playerIndex);
    return;
  }

  if (state.dice === 6) {
    addLog(`${players[plane.playerIndex].name}掷出 6 点，获得额外机会。`, plane.playerIndex);
    ui.actionTitle.textContent = `${players[state.currentPlayer].name}再飞一次`;
    ui.actionHint.textContent = "点击骰子继续";
  } else {
    nextTurn();
  }
}

function handleCollision(movedPlane) {
  if (movedPlane.progress < 0 || movedPlane.progress >= 40) return;
  const absolutePosition = (players[movedPlane.playerIndex].start + movedPlane.progress) % 40;

  state.planes.flat().forEach((other) => {
    if (
      other.playerIndex !== movedPlane.playerIndex &&
      other.progress >= 0 &&
      other.progress < 40 &&
      (players[other.playerIndex].start + other.progress) % 40 === absolutePosition
    ) {
      other.progress = -1;
      addLog(
        `${players[movedPlane.playerIndex].name}撞回了${players[other.playerIndex].name}的飞机！`,
        movedPlane.playerIndex
      );
    }
  });
}

function nextTurn() {
  if (state.winner !== null) return;
  state.rolled = false;
  state.currentPlayer = (state.currentPlayer + 1) % players.length;
  if (state.currentPlayer === 0) state.round += 1;
  ui.actionTitle.textContent = `轮到${players[state.currentPlayer].name}`;
  ui.actionHint.textContent = "点击骰子开始飞行";
  updateUI();
  draw();
}

function declareWinner(playerIndex) {
  state.winner = playerIndex;
  const player = players[playerIndex];
  addLog(`${player.name}让全部飞机抵达终点，赢得胜利！`, playerIndex);
  ui.winnerLabel.textContent = `${player.name}胜利`;
  ui.winnerOverlay.style.setProperty("--winner-color", player.color);
  ui.winnerOverlay.hidden = false;
  updateUI();
}

function addLog(message, playerIndex) {
  state.logs.unshift({ message, playerIndex });
  state.logs = state.logs.slice(0, 8);
  renderLogs();
}

function renderLogs() {
  ui.gameLog.innerHTML = state.logs
    .map(
      (log) => `
        <li>
          <span class="log-bullet" style="--log-color:${players[log.playerIndex].color}"></span>
          <span>${log.message}</span>
        </li>`
    )
    .join("");
}

function updateUI() {
  const current = players[state.currentPlayer];
  ui.turnDot.style.background = current.color;
  ui.turnDot.style.boxShadow = `0 0 0 5px ${current.color}24`;
  ui.turnLabel.textContent = current.name;
  ui.roundLabel.textContent = `第 ${state.round} 回合`;
  ui.rollButton.disabled = state.rolled || state.rolling || state.winner !== null;
  ui.diceButton.disabled = ui.rollButton.disabled;

  ui.playerList.innerHTML = players
    .map((player, index) => {
      const finished = state.planes[index].filter((plane) => plane.progress === 46).length;
      const flying = state.planes[index].filter((plane) => plane.progress >= 0 && plane.progress < 46).length;
      return `
        <div class="player-item ${index === state.currentPlayer ? "active" : ""}" style="--player-color:${player.color}">
          <span class="player-color"></span>
          <span class="player-name">${player.name}</span>
          <span class="player-progress">终点 ${finished}/4 · 飞行中 ${flying}</span>
        </div>`;
    })
    .join("");
}

function findClickedPlane(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  return state.planes[state.currentPlayer].find((plane) => {
    if (!isPlaneMovable(plane)) return false;
    const pos = getPlanePosition(plane);
    return Math.hypot(x - pos.x, y - pos.y) <= 38;
  });
}

canvas.addEventListener("click", (event) => {
  if (!state.rolled) return;
  const plane = findClickedPlane(event);
  if (plane) movePlane(plane);
});

ui.rollButton.addEventListener("click", rollDice);
ui.diceButton.addEventListener("click", rollDice);
ui.newGameButton.addEventListener("click", resetGame);
ui.playAgainButton.addEventListener("click", resetGame);
ui.rulesButton.addEventListener("click", () => ui.rulesDialog.showModal());

createBoardGeometry();
resetGame();
