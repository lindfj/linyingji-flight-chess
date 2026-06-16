const canvas = document.getElementById("gameBoard");
const ctx = canvas.getContext("2d");
const channel = "BroadcastChannel" in window ? new BroadcastChannel("yj-flight-chess") : null;

const ui = {
  actionTitle: document.getElementById("actionTitle"),
  actionHint: document.getElementById("actionHint"),
  roundLabel: document.getElementById("roundLabel"),
  turnLabel: document.getElementById("turnLabel"),
  diceButton: document.getElementById("diceButton"),
  diceFace: document.getElementById("diceFace"),
  rollButton: document.getElementById("rollButton"),
  diceToast: document.getElementById("diceToast"),
  toastDice: document.getElementById("toastDice"),
  toastText: document.getElementById("toastText"),
  winnerOverlay: document.getElementById("winnerOverlay"),
  winnerLabel: document.getElementById("winnerLabel"),
  playerList: document.getElementById("playerList"),
  gameLog: document.getElementById("gameLog"),
  chatList: document.getElementById("chatList"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  rulesDialog: document.getElementById("rulesDialog"),
};

const ROUTE_LENGTH = 52;
const FINISH_START = 52;
const FINISH_DONE = 58;
const SAFE_ABS = new Set([0, 13, 26, 39]);
const FLY_START_PROGRESS = 8;
const FLY_END_PROGRESS = 20;
const ROUTE_CELL = 28;
const ROUTE_HALF = ROUTE_CELL / 2;
const ROUTE_DOT = 8;
const FINISH_DOT = 13;
const PLANE_RADIUS = 12;

const players = [
  { name: "YJ队长", color: "#f1514f", light: "#ffb5ad", start: 0, icon: "Y" },
  { name: "蓝翼", color: "#137cc7", light: "#a9d4ff", start: 26, icon: "蓝" },
  { name: "金色闪电", color: "#f4c538", light: "#ffe991", start: 13, icon: "金" },
  { name: "青空", color: "#33c884", light: "#9eefd0", start: 39, icon: "青" },
];

const state = {
  currentPlayer: 0,
  activePlayers: [0, 1, 2, 3],
  dice: 1,
  rolled: false,
  rolling: false,
  round: 1,
  winner: null,
  sixStreaks: [0, 0, 0, 0],
  planes: [],
  logs: [],
  chats: [],
};

const board = {
  center: { x: 380, y: 380 },
  route: [],
  homes: [],
  finishRoutes: [],
};

let animationFrameId = null;
let toastTimer = null;

function createBoardGeometry() {
  const innerLeft = 166;
  const innerTop = 166;
  const innerRight = 594;
  const innerBottom = 594;
  const nearLeft = 190;
  const nearTop = 190;
  const nearRight = 570;
  const nearBottom = 570;
  const step = (nearRight - nearLeft) / 12;

  const route = [];
  for (let i = 0; i < 13; i += 1) route.push({ x: nearRight - step * i, y: innerBottom });
  for (let i = 0; i < 13; i += 1) route.push({ x: innerLeft, y: nearBottom - step * i });
  for (let i = 0; i < 13; i += 1) route.push({ x: nearLeft + step * i, y: innerTop });
  for (let i = 0; i < 13; i += 1) route.push({ x: innerRight, y: nearTop + step * i });
  board.route = route;

  const homeCenters = [
    { x: 645, y: 645 },
    { x: 115, y: 115 },
    { x: 115, y: 645 },
    { x: 645, y: 115 },
  ];
  const offsets = [{ x: -28, y: -28 }, { x: 28, y: -28 }, { x: -28, y: 28 }, { x: 28, y: 28 }];
  board.homes = homeCenters.map(center => offsets.map(offset => ({
    x: center.x + offset.x,
    y: center.y + offset.y,
  })));

  board.finishRoutes = [
    Array.from({ length: 6 }, (_, i) => ({ x: 594 - i * 36, y: 380 })),
    Array.from({ length: 6 }, (_, i) => ({ x: 166 + i * 36, y: 380 })),
    Array.from({ length: 6 }, (_, i) => ({ x: 380, y: 594 - i * 36 })),
    Array.from({ length: 6 }, (_, i) => ({ x: 380, y: 166 + i * 36 })),
  ];
}

function resetGame(shouldSync = true) {
  const openerRolls = players.map(() => 1 + Math.floor(Math.random() * 6));
  const first = openerRolls.indexOf(Math.max(...openerRolls));
  Object.assign(state, {
    currentPlayer: first,
    dice: 1,
    rolled: false,
    rolling: false,
    round: 1,
    winner: null,
    sixStreaks: [0, 0, 0, 0],
    planes: players.map((_, playerIndex) => Array.from({ length: 4 }, (_, planeIndex) => ({
      playerIndex,
      planeIndex,
      progress: -1,
    }))),
    logs: [],
    chats: state.chats || [],
  });
  ui.winnerOverlay.hidden = true;
  addLog(`先手赛：${players.map((p, i) => `${p.name}${openerRolls[i]}点`).join("，")}。`, first, false);
  addLog(`${players[first].name} 点数最大，率先开局。`, first, false);
  renderDice(1);
  updateUI();
  draw();
  if (shouldSync) syncState();
}

function getRouteColor(absIndex) {
  return [0, 2, 1, 3][absIndex % 4];
}

function getAbsoluteProgress(planeProgress, playerIndex) {
  return (players[playerIndex].start + planeProgress) % ROUTE_LENGTH;
}

function getPlanePosition(plane) {
  if (plane.progress === -1) return board.homes[plane.playerIndex][plane.planeIndex];
  if (plane.progress >= FINISH_DONE) {
    const angle = Math.PI * 2 * plane.planeIndex / 4 - Math.PI / 2;
    return {
      x: board.center.x + Math.cos(angle) * 23,
      y: board.center.y + Math.sin(angle) * 23,
    };
  }
  if (plane.progress >= FINISH_START) {
    return board.finishRoutes[plane.playerIndex][plane.progress - FINISH_START];
  }
  return board.route[getAbsoluteProgress(plane.progress, plane.playerIndex)];
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
  const gradient = ctx.createLinearGradient(0, 0, 760, 760);
  gradient.addColorStop(0, "#f8fdff");
  gradient.addColorStop(.52, "#eaf8fd");
  gradient.addColorStop(1, "#d8f0fa");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 760, 760);
}

function drawHomeAreas() {
  const homes = [
    { x: 585, y: 585 },
    { x: 55, y: 55 },
    { x: 55, y: 585 },
    { x: 585, y: 55 },
  ];
  homes.forEach((home, index) => {
    roundRect(home.x, home.y, 120, 120, 3, "#fff", "#111");
    board.homes[index].forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = players[index].color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#0b2b40";
      ctx.stroke();
    });
  });
}

function drawTrackRibbons() {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = ROUTE_CELL + 4;
  ctx.globalAlpha = .88;

  for (let index = 0; index < board.route.length; index += 1) {
    const current = board.route[index];
    const next = board.route[(index + 1) % board.route.length];
    const colorOwner = getRouteColor(index);
    ctx.beginPath();
    ctx.moveTo(current.x, current.y);
    ctx.lineTo(next.x, next.y);
    ctx.strokeStyle = players[colorOwner].color;
    ctx.stroke();
  }

  ctx.lineWidth = FINISH_DOT * 2 + 5;
  board.finishRoutes.forEach((route, playerIndex) => {
    const path = [...route, board.center];
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    path.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.strokeStyle = players[playerIndex].color;
    ctx.stroke();
  });
  ctx.restore();
}

function drawRoute() {
  board.route.forEach((point, index) => {
    const colorOwner = getRouteColor(index);
    const isTriangle = SAFE_ABS.has(index) || isFlyEndpoint(index, colorOwner);
    roundRect(point.x - ROUTE_HALF, point.y - ROUTE_HALF, ROUTE_CELL, ROUTE_CELL, 5, "#fff", "#0b2b40");
    if (isTriangle) {
      drawTriangleCell(point, players[colorOwner].color, index);
    } else {
      roundRect(point.x - 11, point.y - 11, 22, 22, 4, players[colorOwner].color, "rgba(0,0,0,.18)");
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, SAFE_ABS.has(index) ? 10 : ROUTE_DOT, 0, Math.PI * 2);
    ctx.fillStyle = "#fffbd1";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = SAFE_ABS.has(index) ? "#fff" : "rgba(0,0,0,.18)";
    ctx.stroke();
    if (SAFE_ABS.has(index)) {
      ctx.fillStyle = players[colorOwner].color;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", point.x, point.y + 1);
    }
  });

  board.finishRoutes.forEach((route, playerIndex) => {
    route.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, FINISH_DOT, 0, Math.PI * 2);
      ctx.fillStyle = index === route.length - 1 ? "#fffbd1" : players[playerIndex].light;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = players[playerIndex].color;
      ctx.stroke();
    });
  });

}

function isFlyEndpoint(absIndex, colorOwner) {
  return players.some((player, playerIndex) =>
    playerIndex === colorOwner &&
    (getAbsoluteProgress(FLY_START_PROGRESS, playerIndex) === absIndex ||
      getAbsoluteProgress(FLY_END_PROGRESS, playerIndex) === absIndex)
  );
}

function drawTriangleCell(point, color, index) {
  const direction = index < 13 ? "up" : index < 26 ? "left" : index < 39 ? "down" : "right";
  ctx.beginPath();
  if (direction === "up") {
    ctx.moveTo(point.x - 12, point.y + 12);
    ctx.lineTo(point.x + 12, point.y + 12);
    ctx.lineTo(point.x + 12, point.y - 12);
  } else if (direction === "left") {
    ctx.moveTo(point.x + 12, point.y - 12);
    ctx.lineTo(point.x + 12, point.y + 12);
    ctx.lineTo(point.x - 12, point.y + 12);
  } else if (direction === "down") {
    ctx.moveTo(point.x + 12, point.y - 12);
    ctx.lineTo(point.x - 12, point.y - 12);
    ctx.lineTo(point.x - 12, point.y + 12);
  } else {
    ctx.moveTo(point.x - 12, point.y + 12);
    ctx.lineTo(point.x - 12, point.y - 12);
    ctx.lineTo(point.x + 12, point.y - 12);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawFlyMarkers() {
  players.forEach((player, playerIndex) => {
    [FLY_START_PROGRESS, FLY_END_PROGRESS].forEach(progress => {
      const point = board.route[getAbsoluteProgress(progress, playerIndex)];
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.lineTo(9, 0);
      ctx.lineTo(-7, -7);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  });
}

function drawCenter() {
  const { x, y } = board.center;
  drawCenterArrow(x, y, 3, "up");
  drawCenterArrow(x, y, 0, "right");
  drawCenterArrow(x, y, 2, "down");
  drawCenterArrow(x, y, 1, "left");
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fillStyle = "#fffbd1";
  ctx.fill();
  ctx.strokeStyle = "#0d4264";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#0874b7";
  ctx.font = "bold 17px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("YJ", x, y);
}

function drawCenterArrow(x, y, playerIndex, direction) {
  const color = players[playerIndex].color;
  ctx.beginPath();
  if (direction === "up") {
    ctx.moveTo(x, y - 55); ctx.lineTo(x + 34, y - 22); ctx.lineTo(x + 15, y - 22); ctx.lineTo(x + 15, y); ctx.lineTo(x - 15, y); ctx.lineTo(x - 15, y - 22); ctx.lineTo(x - 34, y - 22);
  } else if (direction === "right") {
    ctx.moveTo(x + 55, y); ctx.lineTo(x + 22, y + 34); ctx.lineTo(x + 22, y + 15); ctx.lineTo(x, y + 15); ctx.lineTo(x, y - 15); ctx.lineTo(x + 22, y - 15); ctx.lineTo(x + 22, y - 34);
  } else if (direction === "down") {
    ctx.moveTo(x, y + 55); ctx.lineTo(x - 34, y + 22); ctx.lineTo(x - 15, y + 22); ctx.lineTo(x - 15, y); ctx.lineTo(x + 15, y); ctx.lineTo(x + 15, y + 22); ctx.lineTo(x + 34, y + 22);
  } else {
    ctx.moveTo(x - 55, y); ctx.lineTo(x - 22, y - 34); ctx.lineTo(x - 22, y - 15); ctx.lineTo(x, y - 15); ctx.lineTo(x, y + 15); ctx.lineTo(x - 22, y + 15); ctx.lineTo(x - 22, y + 34);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

function isPlaneMovable(plane, dice = state.dice) {
  if (plane.progress >= FINISH_DONE) return false;
  if (plane.progress === -1) return dice === 6;
  return true;
}

function drawPlane(plane) {
  const pos = getPlanePosition(plane);
  const player = players[plane.playerIndex];
  const selectable = state.rolled && plane.playerIndex === state.currentPlayer && isPlaneMovable(plane);
  if (selectable) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 22 + Math.sin(Date.now() / 160) * 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.fill();
  }
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate([-Math.PI / 2, Math.PI, Math.PI / 2, 0][plane.playerIndex]);
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(7, -8, 5, 8);
  ctx.lineTo(15, 17);
  ctx.lineTo(6, 15);
  ctx.lineTo(0, 10);
  ctx.lineTo(-6, 15);
  ctx.lineTo(-15, 17);
  ctx.lineTo(-5, 8);
  ctx.quadraticCurveTo(-7, -8, 0, -18);
  ctx.closePath();
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "white";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -7, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fill();
  ctx.restore();
}

function draw() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  drawBackground();
  drawHomeAreas();
  drawTrackRibbons();
  drawRoute();
  drawFlyMarkers();
  drawCenter();
  state.planes.flat().forEach(drawPlane);
  if (state.rolled && state.winner === null) animationFrameId = requestAnimationFrame(draw);
}

function renderDice(value) {
  const positions = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  ui.diceFace.innerHTML = "";
  for (let cell = 1; cell <= 9; cell += 1) {
    const pip = document.createElement("i");
    if (positions[value].includes(cell)) pip.className = "pip";
    ui.diceFace.appendChild(pip);
  }
}

function showToast(text, dice = state.dice) {
  const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  clearTimeout(toastTimer);
  ui.toastDice.textContent = faces[dice - 1] || "⚀";
  ui.toastText.textContent = text;
  ui.diceToast.hidden = false;
  toastTimer = setTimeout(() => { ui.diceToast.hidden = true; }, 950);
}

function rollDice() {
  if (state.rolled || state.rolling || state.winner !== null) return;
  state.rolling = true;
  updateUI();
  ui.diceButton.classList.add("rolling");

  let ticks = 0;
  const timer = setInterval(() => {
    renderDice(1 + Math.floor(Math.random() * 6));
    if (++ticks < 9) return;

    clearInterval(timer);
    state.dice = 1 + Math.floor(Math.random() * 6);
    renderDice(state.dice);
    ui.diceButton.classList.remove("rolling");
    state.rolling = false;
    addLog(`${players[state.currentPlayer].name} 掷出了 ${state.dice} 点。`, state.currentPlayer, false);
    showToast(`掷出 ${state.dice} 点`);

    if (state.dice === 6) {
      state.sixStreaks[state.currentPlayer] += 1;
      if (state.sixStreaks[state.currentPlayer] >= 3) {
        punishTripleSix();
        return;
      }
    } else {
      state.sixStreaks[state.currentPlayer] = 0;
    }

    const movable = state.planes[state.currentPlayer].filter(plane => isPlaneMovable(plane));
    if (!movable.length) {
      addLog(`${players[state.currentPlayer].name} 没有可移动飞机，轮次结束。`, state.currentPlayer, false);
      updateUI();
      draw();
      syncState();
      setTimeout(nextTurn, 950);
      return;
    }

    state.rolled = true;
    updateUI();
    draw();
    syncState();
  }, 72);
}

function punishTripleSix() {
  state.planes[state.currentPlayer].forEach(plane => {
    if (plane.progress < FINISH_DONE) plane.progress = -1;
  });
  state.sixStreaks[state.currentPlayer] = 0;
  state.rolled = false;
  addLog(`${players[state.currentPlayer].name} 连续三次掷出 6，场上飞机全部退回机场。`, state.currentPlayer, false);
  showToast("三连6作废");
  updateUI();
  draw();
  syncState();
  setTimeout(nextTurn, 1100);
}

function movePlane(plane) {
  if (!state.rolled || plane.playerIndex !== state.currentPlayer || !isPlaneMovable(plane)) return;

  if (plane.progress === -1) {
    plane.progress = 0;
    addLog(`${players[plane.playerIndex].name} 派出一架飞机到起飞点。`, plane.playerIndex, false);
    afterMove();
    return;
  }

  const result = moveAlongPath(plane, state.dice);
  if (result === "blocked-crash") {
    afterMove();
    return;
  }

  resolveLandingEffects(plane);
  afterMove();
}

function moveAlongPath(plane, dice) {
  const startProgress = plane.progress;
  if (startProgress >= FINISH_START) {
    plane.progress = bounceFinish(startProgress + dice);
    addLog(`${players[plane.playerIndex].name} 在终点通道前进 ${dice} 格。`, plane.playerIndex, false);
    return "moved";
  }

  const planned = startProgress + dice;
  const routeSteps = Math.min(dice, Math.max(0, ROUTE_LENGTH - 1 - startProgress));
  const blocker = findFirstEnemyStackOnRoute(plane, routeSteps);
  if (blocker) {
    if (blocker.step === dice) {
      plane.progress = -1;
      blocker.planes.forEach(item => { item.progress = -1; });
      addLog(`${players[plane.playerIndex].name} 刚好撞上叠子，双方全部回机场。`, plane.playerIndex, false);
      return "blocked-crash";
    }
    const reversed = startProgress + blocker.step - (dice - blocker.step);
    plane.progress = Math.max(0, reversed);
    addLog(`${players[plane.playerIndex].name} 被叠子挡住，反向退回 ${dice - blocker.step} 格。`, plane.playerIndex, false);
    return "moved";
  }

  plane.progress = planned > FINISH_DONE ? bounceFinish(planned) : planned;
  addLog(`${players[plane.playerIndex].name} 前进 ${dice} 格。`, plane.playerIndex, false);
  return "moved";
}

function bounceFinish(progress) {
  if (progress <= FINISH_DONE) return progress;
  return FINISH_DONE - (progress - FINISH_DONE);
}

function findFirstEnemyStackOnRoute(plane, maxSteps) {
  for (let step = 1; step <= maxSteps; step += 1) {
    const abs = getAbsoluteProgress(plane.progress + step, plane.playerIndex);
    const stack = getPlanesAtRouteAbs(abs).filter(item => item.playerIndex !== plane.playerIndex);
    const grouped = groupByPlayer(stack).find(group => group.planes.length >= 2);
    if (grouped) return { step, planes: grouped.planes };
  }
  return null;
}

function groupByPlayer(planesAtCell) {
  return players.map((_, playerIndex) => ({
    playerIndex,
    planes: planesAtCell.filter(plane => plane.playerIndex === playerIndex),
  })).filter(group => group.planes.length > 0);
}

function getPlanesAtRouteAbs(abs) {
  return state.planes.flat().filter(plane =>
    plane.progress >= 0 &&
    plane.progress < ROUTE_LENGTH &&
    getAbsoluteProgress(plane.progress, plane.playerIndex) === abs
  );
}

function resolveLandingEffects(plane) {
  if (plane.progress >= ROUTE_LENGTH) return;
  const landingAbs = getAbsoluteProgress(plane.progress, plane.playerIndex);
  if (!SAFE_ABS.has(landingAbs)) hitSingleEnemiesAt(landingAbs, plane.playerIndex, "撞回了");

  if (tryFlyLine(plane)) return;

  if (getRouteColor(landingAbs) === plane.playerIndex) trySameColorJump(plane);
}

function trySameColorJump(plane) {
  const nextProgress = plane.progress + 4;
  if (nextProgress >= ROUTE_LENGTH) return false;
  const nextAbs = getAbsoluteProgress(nextProgress, plane.playerIndex);
  plane.progress = nextProgress;
  addLog(`${players[plane.playerIndex].name} 触发同色跳跃，跳到下一格同色赛道。`, plane.playerIndex, false);
  if (!SAFE_ABS.has(nextAbs)) hitSingleEnemiesAt(nextAbs, plane.playerIndex, "跳跃撞回了");
  return true;
}

function tryFlyLine(plane) {
  if (plane.progress !== FLY_START_PROGRESS && plane.progress !== FLY_END_PROGRESS) return false;
  const from = plane.progress;
  const to = from === FLY_START_PROGRESS ? FLY_END_PROGRESS : FLY_START_PROGRESS;
  const endAbs = getAbsoluteProgress(to, plane.playerIndex);
  const endEnemies = groupByPlayer(getPlanesAtRouteAbs(endAbs).filter(item => item.playerIndex !== plane.playerIndex));
  if (endEnemies.some(group => group.planes.length >= 2)) {
    addLog(`${players[plane.playerIndex].name} 飞棋终点有敌方叠子，无法飞行。`, plane.playerIndex, false);
    return false;
  }
  const begin = Math.min(from, to) + 1;
  const finish = Math.max(from, to);
  for (let progress = begin; progress <= finish; progress += 1) {
    const abs = getAbsoluteProgress(progress, plane.playerIndex);
    hitAllEnemiesAt(abs, plane.playerIndex, "飞行途中击落了");
  }
  plane.progress = to;
  addLog(`${players[plane.playerIndex].name} 沿虚线双向箭头飞到另一端同色三角格。`, plane.playerIndex, false);
  return true;
}

function hitSingleEnemiesAt(abs, playerIndex, verb) {
  groupByPlayer(getPlanesAtRouteAbs(abs).filter(plane => plane.playerIndex !== playerIndex)).forEach(group => {
    if (group.planes.length === 1) {
      group.planes[0].progress = -1;
      addLog(`${players[playerIndex].name} ${verb} ${players[group.playerIndex].name} 的飞机。`, playerIndex, false);
    }
  });
}

function hitAllEnemiesAt(abs, playerIndex, verb) {
  groupByPlayer(getPlanesAtRouteAbs(abs).filter(plane => plane.playerIndex !== playerIndex)).forEach(group => {
    group.planes.forEach(plane => { plane.progress = -1; });
    addLog(`${players[playerIndex].name} ${verb} ${players[group.playerIndex].name} 的飞机。`, playerIndex, false);
  });
}

function afterMove() {
  state.rolled = false;
  const finished = state.planes[state.currentPlayer].filter(plane => plane.progress >= FINISH_DONE).length;
  if (finished === 4) {
    declareWinner(state.currentPlayer);
    return;
  }
  if (state.dice === 6) {
    addLog(`${players[state.currentPlayer].name} 掷出 6，获得额外行动。`, state.currentPlayer, false);
    showToast("再掷一次");
    updateUI();
    draw();
    syncState();
  } else {
    nextTurn();
  }
}

function nextTurn() {
  if (state.winner !== null) return;
  state.rolled = false;
  const currentIndex = state.activePlayers.indexOf(state.currentPlayer);
  const nextIndex = (currentIndex + 1) % state.activePlayers.length;
  state.currentPlayer = state.activePlayers[nextIndex];
  if (nextIndex === 0) state.round += 1;
  updateUI();
  draw();
  syncState();
}

function declareWinner(index) {
  state.winner = index;
  state.rolled = false;
  ui.winnerLabel.textContent = `${players[index].name} 获胜`;
  ui.winnerOverlay.hidden = false;
  addLog(`${players[index].name} 的 4 架飞机全部抵达中心终点，游戏结束！`, index, false);
  updateUI();
  draw();
  syncState();
}

function addLog(message, playerIndex, shouldSync = true) {
  state.logs.unshift({ message, playerIndex });
  state.logs = state.logs.slice(0, 40);
  renderLogs();
  if (shouldSync) syncState();
}

function renderLogs() {
  ui.gameLog.innerHTML = state.logs.map(log =>
    `<li style="border-left:3px solid ${players[log.playerIndex].color}">${escapeHtml(log.message)}</li>`
  ).join("");
}

function addChat(message, playerIndex = state.currentPlayer, shouldSync = true) {
  const clean = message.trim().slice(0, 48);
  if (!clean) return;
  state.chats.push({ message: clean, playerIndex });
  state.chats = state.chats.slice(-30);
  renderChats();
  if (shouldSync) syncState();
}

function renderChats() {
  ui.chatList.innerHTML = state.chats.map(chat =>
    `<div class="message" style="--message-color:${players[chat.playerIndex].color}">
      <strong>${escapeHtml(players[chat.playerIndex].name)}</strong><span>${escapeHtml(chat.message)}</span>
    </div>`
  ).join("");
  ui.chatList.scrollTop = ui.chatList.scrollHeight;
}

function renderPlayers() {
  players.forEach((player, index) => {
    const finished = state.planes[index].filter(plane => plane.progress >= FINISH_DONE).length;
    const flying = state.planes[index].filter(plane => plane.progress >= 0 && plane.progress < FINISH_DONE).length;
    const seat = document.getElementById(`seat${index}`);
    seat.style.setProperty("--seat-color", player.color);
    seat.classList.toggle("active", index === state.currentPlayer);
    seat.innerHTML = `<span class="avatar">${player.icon}</span>
      <strong class="seat-name">${escapeHtml(player.name)}</strong>
      <span class="seat-score">飞行 ${flying} · 到达 ${finished}/4</span>`;
  });
  ui.playerList.innerHTML = players.map((player, index) =>
    `<label class="player-editor" style="--editor-color:${player.color}">
      <i></i><input data-player="${index}" maxlength="10" value="${escapeHtml(player.name)}">
    </label>`
  ).join("");
}

function updateUI() {
  const current = players[state.currentPlayer];
  ui.actionTitle.textContent = state.rolled ? `${current.name} 选择飞机` : `轮到 ${current.name}`;
  ui.actionHint.textContent = state.rolled
    ? `掷出 ${state.dice} 点，点击发光飞机`
    : `连续6：${state.sixStreaks[state.currentPlayer]}/2`;
  ui.roundLabel.textContent = `第 ${state.round} 回合`;
  ui.turnLabel.textContent = current.name;
  const disabled = state.rolled || state.rolling || state.winner !== null;
  ui.rollButton.disabled = disabled;
  ui.diceButton.disabled = disabled;
  renderPlayers();
  renderLogs();
  renderChats();
}

function findClickedPlane(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * canvas.width / rect.width;
  const y = (event.clientY - rect.top) * canvas.height / rect.height;
  return state.planes[state.currentPlayer].find(plane => {
    const pos = getPlanePosition(plane);
    return isPlaneMovable(plane) && Math.hypot(x - pos.x, y - pos.y) <= 28;
  });
}

function syncState() {
  const payload = { version: 3, state, names: players.map(player => player.name) };
  localStorage.setItem("yj-flight-chess-state-v3", JSON.stringify(payload));
  if (channel) channel.postMessage(payload);
}

function applyRemote(payload) {
  if (!payload || payload.version !== 3 || !payload.state) return;
  Object.assign(state, payload.state, { rolling: false });
  if (payload.names) payload.names.forEach((name, index) => { players[index].name = name; });
  renderDice(state.dice);
  updateUI();
  draw();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

canvas.addEventListener("click", event => {
  if (!state.rolled) return;
  const plane = findClickedPlane(event);
  if (plane) movePlane(plane);
});

ui.rollButton.addEventListener("click", rollDice);
ui.diceButton.addEventListener("click", rollDice);
document.getElementById("newGameButton").addEventListener("click", () => {
  if (confirm("确定重新开始这一局吗？")) resetGame();
});
document.getElementById("playAgainButton").addEventListener("click", resetGame);
document.getElementById("rulesButton").addEventListener("click", () => ui.rulesDialog.showModal());
document.getElementById("copyRoomButton").addEventListener("click", async event => {
  await navigator.clipboard?.writeText("YJ-2026");
  event.currentTarget.textContent = "已复制";
  setTimeout(() => { event.currentTarget.textContent = "复制房间号"; }, 1200);
});
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab,.panel").forEach(item => item.classList.remove("active"));
  tab.classList.add("active");
  document.getElementById(tab.dataset.panel).classList.add("active");
}));
ui.chatForm.addEventListener("submit", event => {
  event.preventDefault();
  addChat(ui.chatInput.value);
  ui.chatInput.value = "";
});
document.querySelectorAll(".quick-chat button").forEach(button =>
  button.addEventListener("click", () => addChat(button.textContent))
);
ui.playerList.addEventListener("change", event => {
  const index = Number(event.target.dataset.player);
  if (!Number.isInteger(index)) return;
  players[index].name = event.target.value.trim() || `玩家${index + 1}`;
  updateUI();
  syncState();
});
if (channel) channel.addEventListener("message", event => applyRemote(event.data));
window.addEventListener("storage", event => {
  if (event.key === "yj-flight-chess-state-v3" && event.newValue) applyRemote(JSON.parse(event.newValue));
});

createBoardGeometry();
const saved = localStorage.getItem("yj-flight-chess-state-v3");
if (saved) {
  try {
    applyRemote(JSON.parse(saved));
  } catch {
    resetGame();
  }
} else {
  resetGame();
  addChat("欢迎来到 YJ飞行器！", 0);
}
