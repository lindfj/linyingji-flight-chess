const canvas = document.getElementById("gameBoard");
const ctx = canvas.getContext("2d");
const channel = "BroadcastChannel" in window ? new BroadcastChannel("yj-flight-chess") : null;
const LOCAL_STATE_KEY = "yj-flight-chess-state-v4";
const PLAYER_ID_KEY = "yj-flight-chess-player-id";
const AI_DRIVER_KEY = "yj-flight-chess-ai-driver";

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
  roomCode: document.getElementById("roomCode"),
  roomInput: document.getElementById("roomInput"),
  createRoomButton: document.getElementById("createRoomButton"),
  joinRoomButton: document.getElementById("joinRoomButton"),
  copyRoomButton: document.getElementById("copyRoomButton"),
  onlineStatus: document.getElementById("onlineStatus"),
  soundButton: document.getElementById("soundButton"),
  exitGameButton: document.getElementById("exitGameButton"),
  app: document.querySelector(".app"),
  lobbyScreen: document.getElementById("lobbyScreen"),
  battleScreen: document.getElementById("battleScreen"),
  lobbyRoomInput: document.getElementById("lobbyRoomInput"),
  lobbyCreateButton: document.getElementById("lobbyCreateButton"),
  lobbyJoinButton: document.getElementById("lobbyJoinButton"),
  localDemoButton: document.getElementById("localDemoButton"),
  backLobbyButton: document.getElementById("backLobbyButton"),
  ruleTripleSix: document.getElementById("ruleTripleSix"),
  ruleAiTakeover: document.getElementById("ruleAiTakeover"),
  ruleExactFinish: document.getElementById("ruleExactFinish"),
};

const multiplayer = {
  client: null,
  roomId: "",
  subscription: null,
  ready: false,
  applyingRemote: false,
  saveTimer: null,
  playerId: getOrCreatePlayerId(),
  colorIndex: null,
  lastTurnPlayer: null,
  aiTimer: null,
};

const audioState = {
  enabled: localStorage.getItem("yj-flight-chess-sound") !== "off",
  context: null,
  bgmTimer: null,
  bgmStep: 0,
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
  { name: "金色闪电", color: "#f4c538", light: "#ffe991", start: 13, icon: "黄" },
  { name: "青空", color: "#33c884", light: "#9eefd0", start: 39, icon: "青" },
];

const AI_NAME_PARTS = {
  prefix: ["星河", "夜航", "银翼", "云雀", "玄月", "疾风", "墨影", "流光"],
  suffix: ["机长", "巡航者", "飞行员", "领航员", "小队", "航迹", "引擎", "雷达"],
};
const AI_AVATARS = ["航", "翼", "星", "雷", "月", "云", "影", "光"];

const state = {
  currentPlayer: 0,
  activePlayers: [0, 1, 2, 3],
  dice: 1,
  rolled: false,
  rolling: false,
  round: 1,
  winner: null,
  sixStreaks: [0, 0, 0, 0],
  playerSeats: [null, null, null, null],
  aiSeats: [true, true, true, true],
  aiDriverId: null,
  settings: {
    skin: "nebula",
    tripleSixPenalty: true,
    aiTakeover: true,
    exactFinish: true,
  },
  avatars: ["Y", "蓝", "金", "青"],
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
  const cell = 36;
  const origin = { x: 128, y: 128 };
  const p = (x, y) => ({ x: origin.x + x * cell, y: origin.y + y * cell });

  // 标准飞行棋52格外环：围绕四个大本营拐弯，不压住停机区。
  board.route = [
    p(1, 6), p(2, 6), p(3, 6), p(4, 6), p(5, 6),
    p(6, 5), p(6, 4), p(6, 3), p(6, 2), p(6, 1), p(6, 0),
    p(7, 0),
    p(8, 0), p(8, 1), p(8, 2), p(8, 3), p(8, 4), p(8, 5),
    p(9, 6), p(10, 6), p(11, 6), p(12, 6), p(13, 6), p(14, 6),
    p(14, 7),
    p(14, 8), p(13, 8), p(12, 8), p(11, 8), p(10, 8), p(9, 8),
    p(8, 9), p(8, 10), p(8, 11), p(8, 12), p(8, 13), p(8, 14),
    p(7, 14),
    p(6, 14), p(6, 13), p(6, 12), p(6, 11), p(6, 10), p(6, 9),
    p(5, 8), p(4, 8), p(3, 8), p(2, 8), p(1, 8), p(0, 8),
    p(0, 7),
    p(0, 6),
  ];

  const homeCenters = [
    p(2, 2),   // 红：左上
    p(12, 12), // 蓝：右下
    p(12, 2),  // 黄：右上
    p(2, 12),  // 绿：左下
  ];
  const offsets = [{ x: -24, y: -24 }, { x: 24, y: -24 }, { x: -24, y: 24 }, { x: 24, y: 24 }];
  board.homes = homeCenters.map(center => offsets.map(offset => ({
    x: center.x + offset.x,
    y: center.y + offset.y,
  })));

  board.finishRoutes = [
    Array.from({ length: 6 }, (_, i) => p(1 + i, 7)),  // 红：左侧直通中心
    Array.from({ length: 6 }, (_, i) => p(13 - i, 7)), // 蓝：右侧直通中心
    Array.from({ length: 6 }, (_, i) => p(7, 1 + i)),  // 黄：上方直通中心
    Array.from({ length: 6 }, (_, i) => p(7, 13 - i)), // 绿：下方直通中心
  ];
}

function resetGame(shouldSync = true) {
  const existingSeats = Array.isArray(state.playerSeats) ? [...state.playerSeats] : [null, null, null, null];
  const existingAiSeats = Array.isArray(state.aiSeats) ? [...state.aiSeats] : existingSeats.map(seat => !seat);
  const existingDriver = state.aiDriverId || multiplayer.playerId;
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
    playerSeats: existingSeats,
    aiSeats: existingAiSeats,
    aiDriverId: existingDriver,
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

// 根据创建页设置生成可同步的房间规则。
function readLobbySettings() {
  return {
    skin: document.querySelector(".skin-card.active")?.dataset.skin || "nebula",
    tripleSixPenalty: ui.ruleTripleSix.checked,
    aiTakeover: ui.ruleAiTakeover.checked,
    exactFinish: ui.ruleExactFinish.checked,
  };
}

function applySettings(settings = state.settings) {
  state.settings = { ...state.settings, ...settings };
  document.body.dataset.skin = state.settings.skin;
  document.querySelectorAll(".skin-card").forEach(button => {
    button.classList.toggle("active", button.dataset.skin === state.settings.skin);
  });
  ui.ruleTripleSix.checked = Boolean(state.settings.tripleSixPenalty);
  ui.ruleAiTakeover.checked = Boolean(state.settings.aiTakeover);
  ui.ruleExactFinish.checked = Boolean(state.settings.exactFinish);
}

function showScreen(screen) {
  const battle = screen === "battle";
  ui.app.dataset.screen = screen;
  ui.lobbyScreen.hidden = battle;
  ui.battleScreen.hidden = !battle;
}

function randomAiName() {
  const { prefix, suffix } = AI_NAME_PARTS;
  return `${prefix[Math.floor(Math.random() * prefix.length)]}${suffix[Math.floor(Math.random() * suffix.length)]}`;
}

function assignAiProfiles() {
  if (!Array.isArray(state.avatars)) state.avatars = players.map(player => player.icon);
  players.forEach((player, index) => {
    if (state.aiSeats?.[index]) {
      player.name = randomAiName();
      state.avatars[index] = AI_AVATARS[Math.floor(Math.random() * AI_AVATARS.length)];
    } else {
      state.avatars[index] ||= player.icon;
    }
  });
}

function isOnlineRoom() {
  return Boolean(multiplayer.ready && multiplayer.roomId);
}

function getOwnedColorIndex() {
  if (!Array.isArray(state.playerSeats)) state.playerSeats = [null, null, null, null];
  return state.playerSeats.indexOf(multiplayer.playerId);
}

function normalizeAiSeats() {
  if (!Array.isArray(state.playerSeats)) state.playerSeats = [null, null, null, null];
  if (!Array.isArray(state.aiSeats)) state.aiSeats = [true, true, true, true];
  state.aiSeats = state.aiSeats.map((isAi, index) => Boolean(state.settings.aiTakeover && (isAi || !state.playerSeats[index])));
}

function canControlPlayer(playerIndex) {
  if (!isOnlineRoom()) return true;
  if (isAiPlayer(playerIndex)) return false;
  return getOwnedColorIndex() === playerIndex;
}

function canControlCurrentTurn() {
  return canControlPlayer(state.currentPlayer);
}

function claimSeat(preferredIndex = null) {
  if (!Array.isArray(state.playerSeats)) state.playerSeats = [null, null, null, null];
  normalizeAiSeats();
  const current = getOwnedColorIndex();
  if (current >= 0) {
    state.aiSeats[current] = false;
    multiplayer.colorIndex = current;
    return current;
  }
  const candidates = [];
  if (Number.isInteger(preferredIndex)) candidates.push(preferredIndex);
  candidates.push(0, 1, 2, 3);
  const seat = candidates.find(index => index >= 0 && index < 4 && (!state.playerSeats[index] || state.aiSeats[index]));
  if (seat === undefined) {
    multiplayer.colorIndex = null;
    return null;
  }
  state.playerSeats[seat] = multiplayer.playerId;
  state.aiSeats[seat] = false;
  if (!state.aiDriverId) state.aiDriverId = multiplayer.playerId;
  multiplayer.colorIndex = seat;
  addLog(`${players[seat].name} 已由真人玩家接管。`, seat, false);
  return seat;
}

function takeAiSeat(index) {
  if (!isOnlineRoom()) return;
  if (getOwnedColorIndex() >= 0) {
    showToast("你已经有阵营了");
    playSound("deny");
    return;
  }
  if (!state.aiSeats?.[index]) {
    showToast("这个阵营已被玩家占用");
    playSound("deny");
    return;
  }
  claimSeat(index);
  playSound("join");
  updateUI();
  syncState();
}

async function exitCurrentGameToLobby() {
  if (isOnlineRoom()) {
    const seat = getOwnedColorIndex();
    if (seat >= 0) {
      state.aiSeats[seat] = true;
      multiplayer.colorIndex = null;
      addLog(`${players[seat].name} 已退出，本席位由 AI 托管。`, seat, false);
      updateUI();
      await saveRoomState(buildSyncPayload());
    }
    if (multiplayer.subscription && multiplayer.client) {
      await multiplayer.client.removeChannel(multiplayer.subscription);
      multiplayer.subscription = null;
    }
  }
  clearTimeout(multiplayer.aiTimer);
  multiplayer.roomId = "";
  multiplayer.ready = Boolean(multiplayer.client);
  multiplayer.colorIndex = null;
  localStorage.removeItem("yj-flight-chess-room");
  ui.roomInput.value = "";
  ui.lobbyRoomInput.value = "";
  updateRoomLabel();
  showScreen("lobby");
}

function getSeatLabel(playerIndex) {
  if (!isOnlineRoom()) return "本地";
  if (state.aiSeats?.[playerIndex]) return "AI托管";
  if (!state.playerSeats?.[playerIndex]) return "空位";
  if (state.playerSeats[playerIndex] === multiplayer.playerId) return "你";
  return "玩家";
}

function isAiPlayer(playerIndex) {
  return isOnlineRoom() && Boolean(state.aiSeats?.[playerIndex]);
}

function isAiDriver() {
  return isOnlineRoom() && state.aiDriverId === multiplayer.playerId;
}

function humanSeatCount() {
  normalizeAiSeats();
  return state.playerSeats.filter((seat, index) => seat && !state.aiSeats[index]).length;
}

function setSoundEnabled(enabled) {
  audioState.enabled = enabled;
  localStorage.setItem("yj-flight-chess-sound", enabled ? "on" : "off");
  ui.soundButton.textContent = enabled ? "🔊" : "🔇";
  ui.soundButton.classList.toggle("muted", !enabled);
  if (enabled) startBgm();
  else stopBgm();
}

function playSound(type) {
  if (!audioState.enabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioState.context ||= new AudioContext();
  const ctxAudio = audioState.context;
  const now = ctxAudio.currentTime;
  const patterns = {
    join: [[523, .08], [659, .11]],
    turn: [[392, .07], [523, .12]],
    dice: [[220, .05], [330, .05], [440, .08]],
    move: [[330, .05], [370, .05], [415, .06]],
    deny: [[160, .11]],
  };
  let offset = 0;
  (patterns[type] || patterns.move).forEach(([frequency, duration]) => {
    const oscillator = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    oscillator.type = type === "deny" ? "sawtooth" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(.08, now + offset + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
    oscillator.connect(gain).connect(ctxAudio.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + duration + .02);
    offset += duration + .025;
  });
}

function ensureAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioState.context ||= new AudioContext();
  if (audioState.context.state === "suspended") audioState.context.resume();
  return audioState.context;
}

// 循环纯音乐 BGM：使用 WebAudio 合成，不依赖版权音乐文件。
function startBgm() {
  if (!audioState.enabled || audioState.bgmTimer) return;
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio) return;
  const scale = [196, 246.94, 293.66, 369.99, 440, 369.99, 293.66, 246.94];
  audioState.bgmTimer = setInterval(() => {
    const now = ctxAudio.currentTime;
    const frequency = scale[audioState.bgmStep % scale.length];
    const oscillator = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.025, now + .03);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .62);
    oscillator.connect(gain).connect(ctxAudio.destination);
    oscillator.start(now);
    oscillator.stop(now + .68);
    audioState.bgmStep += 1;
  }, 520);
}

function stopBgm() {
  clearInterval(audioState.bgmTimer);
  audioState.bgmTimer = null;
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
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(.55, "#f7fbff");
  gradient.addColorStop(1, "#eef6fb");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 760, 760);

  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(8,18,32,.75)";
  roundRect(86, 86, 588, 588, 6, null, "rgba(8,18,32,.75)");
  ctx.restore();
}

function drawHomeAreas() {
  const homes = [
    { x: 148, y: 148 },
    { x: 544, y: 544 },
    { x: 544, y: 148 },
    { x: 148, y: 544 },
  ];
  homes.forEach((home, index) => {
    roundRect(home.x, home.y, 120, 120, 10, players[index].color, "rgba(255,255,255,.72)");
    board.homes[index].forEach(point => {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#fffbed";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = players[index].light;
      ctx.stroke();
      ctx.fillStyle = players[index].color;
      ctx.font = "bold 19px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✈", point.x, point.y + 1);
      ctx.restore();
    });
  });
}

function drawTrackRibbons() {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = ROUTE_CELL + 4;
  ctx.globalAlpha = .72;
  ctx.shadowColor = "rgba(0,0,0,.38)";
  ctx.shadowBlur = 8;

  for (let index = 0; index < board.route.length; index += 1) {
    const current = board.route[index];
    const next = board.route[(index + 1) % board.route.length];
    if (Math.hypot(current.x - next.x, current.y - next.y) > ROUTE_CELL * 2.05) continue;
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
    roundRect(point.x - ROUTE_HALF, point.y - ROUTE_HALF, ROUTE_CELL, ROUTE_CELL, 4, "#fffdf4", "rgba(9,24,36,.75)");
    if (isTriangle) {
      drawTriangleCell(point, players[colorOwner].color, index);
    } else {
      roundRect(point.x - 11, point.y - 11, 22, 22, 5, players[colorOwner].color, "rgba(255,255,255,.22)");
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
      ctx.fillText("GO", point.x, point.y + 1);
    }
  });

  board.finishRoutes.forEach((route, playerIndex) => {
    route.forEach((point, index) => {
      ctx.save();
      ctx.shadowColor = players[playerIndex].color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(point.x, point.y, FINISH_DOT, 0, Math.PI * 2);
      ctx.fillStyle = index === route.length - 1 ? "#fffbd1" : players[playerIndex].light;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = players[playerIndex].color;
      ctx.stroke();
      ctx.restore();
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
  const safeDirections = { 0: "right", 13: "down", 26: "left", 39: "up" };
  const direction = safeDirections[index] || (index < 13 ? "right" : index < 26 ? "down" : index < 39 ? "left" : "up");
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
  drawCenterArrow(x, y, 2, "up");
  drawCenterArrow(x, y, 1, "right");
  drawCenterArrow(x, y, 3, "down");
  drawCenterArrow(x, y, 0, "left");
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fillStyle = "#fffbd1";
  ctx.fill();
  ctx.strokeStyle = "rgba(12,28,50,.95)";
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
  const selectable = state.rolled && canControlCurrentTurn() && plane.playerIndex === state.currentPlayer && isPlaneMovable(plane);
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

function announceTurnChange(previousPlayer = null) {
  if (previousPlayer === state.currentPlayer) return;
  const current = players[state.currentPlayer];
  if (canControlCurrentTurn()) {
    showToast("轮到你了", state.dice);
    playSound("turn");
  } else {
    showToast(`轮到 ${current.name}`, state.dice);
  }
  multiplayer.lastTurnPlayer = state.currentPlayer;
  scheduleAiTurn();
}

function scheduleAiTurn(delay = 700) {
  clearTimeout(multiplayer.aiTimer);
  if (!shouldRunAiTurn()) return;
  multiplayer.aiTimer = setTimeout(runAiTurn, delay);
}

function shouldRunAiTurn() {
  return isOnlineRoom() &&
    state.settings.aiTakeover &&
    isAiDriver() &&
    humanSeatCount() >= 2 &&
    isAiPlayer(state.currentPlayer) &&
    state.winner === null &&
    !state.rolling;
}

function runAiTurn() {
  if (!shouldRunAiTurn()) return;
  const playerIndex = state.currentPlayer;
  if (!state.rolled) {
    addLog(`${players[playerIndex].name}（AI）正在掷骰。`, playerIndex, false);
    rollDiceForCurrent(true);
    scheduleAiTurn(1350);
    return;
  }

  const movable = state.planes[playerIndex].filter(plane => isPlaneMovable(plane));
  if (!movable.length) {
    nextTurn();
    return;
  }
  const chosen = chooseAiPlane(movable);
  addLog(`${players[playerIndex].name}（AI）移动了一架飞机。`, playerIndex, false);
  movePlaneForCurrent(chosen, true);
  scheduleAiTurn(1250);
}

function chooseAiPlane(movable) {
  return movable
    .map(plane => ({ plane, score: scoreAiMove(plane) }))
    .sort((a, b) => b.score - a.score)[0].plane;
}

function scoreAiMove(plane) {
  if (plane.progress === -1) return 20 + Math.random();
  const target = plane.progress + state.dice;
  let score = target;
  if (target >= FINISH_DONE) score += 1000;
  if (target >= FINISH_START) score += 120;
  if (target < ROUTE_LENGTH) {
    const abs = getAbsoluteProgress(target, plane.playerIndex);
    const enemies = getPlanesAtRouteAbs(abs).filter(item => item.playerIndex !== plane.playerIndex);
    if (enemies.length === 1 && !SAFE_ABS.has(abs)) score += 180;
    if (getRouteColor(abs) === plane.playerIndex) score += 45;
    if (target === FLY_START_PROGRESS || target === FLY_END_PROGRESS) score += 55;
  }
  return score + Math.random();
}

function rollDice() {
  return rollDiceForCurrent(false);
}

function rollDiceForCurrent(systemAction = false) {
  if (!systemAction && !canControlCurrentTurn()) {
    showToast(`还没轮到你：当前是 ${players[state.currentPlayer].name}`);
    playSound("deny");
    return;
  }
  if (state.rolled || state.rolling || state.winner !== null) return;
  state.rolling = true;
  updateUI();
  ui.diceButton.classList.add("rolling");
  playSound("dice");

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
      if (state.settings.tripleSixPenalty && state.sixStreaks[state.currentPlayer] >= 3) {
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
  return movePlaneForCurrent(plane, false);
}

function movePlaneForCurrent(plane, systemAction = false) {
  if (!systemAction && !canControlCurrentTurn()) {
    showToast("只能操作自己的回合");
    playSound("deny");
    return;
  }
  if (!state.rolled || plane.playerIndex !== state.currentPlayer || !isPlaneMovable(plane)) return;

  if (plane.progress === -1) {
    plane.progress = 0;
    addLog(`${players[plane.playerIndex].name} 派出一架飞机到起飞点。`, plane.playerIndex, false);
    playSound("move");
    afterMove();
    return;
  }

  const result = moveAlongPath(plane, state.dice);
  if (result === "blocked-crash") {
    afterMove();
    return;
  }

  resolveLandingEffects(plane);
  playSound("move");
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
  if (!state.settings.exactFinish && progress >= FINISH_DONE) return FINISH_DONE;
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
  const previousPlayer = state.currentPlayer;
  state.rolled = false;
  const currentIndex = state.activePlayers.indexOf(state.currentPlayer);
  const nextIndex = (currentIndex + 1) % state.activePlayers.length;
  state.currentPlayer = state.activePlayers[nextIndex];
  if (nextIndex === 0) state.round += 1;
  updateUI();
  draw();
  announceTurnChange(previousPlayer);
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

function addChat(message, playerIndex = (getOwnedColorIndex() >= 0 ? getOwnedColorIndex() : state.currentPlayer), shouldSync = true) {
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
    seat.classList.toggle("your-seat", getOwnedColorIndex() === index);
    seat.classList.toggle("locked-seat", isOnlineRoom() && getOwnedColorIndex() !== index);
    seat.classList.toggle("ai-seat", isAiPlayer(index));
    seat.innerHTML = `<span class="avatar">${escapeHtml(state.avatars?.[index] || player.icon)}</span>
      <strong class="seat-name">${escapeHtml(player.name)}</strong>
      <span class="seat-score">${getSeatLabel(index)} · 飞行 ${flying} · 到达 ${finished}/4</span>`;
  });
  ui.playerList.innerHTML = players.map((player, index) =>
    `<label class="player-editor" style="--editor-color:${player.color}">
      <i></i><input data-player="${index}" maxlength="10" value="${escapeHtml(player.name)}" ${isOnlineRoom() && getOwnedColorIndex() !== index ? "disabled" : ""}>
      ${isOnlineRoom() && isAiPlayer(index) && getOwnedColorIndex() < 0 ? `<button class="take-seat-button" data-seat="${index}" type="button">接管AI</button>` : ""}
    </label>`
  ).join("");
}

function updateUI() {
  const current = players[state.currentPlayer];
  const allowed = canControlCurrentTurn();
  ui.actionTitle.textContent = state.rolled ? `${current.name} 选择飞机` : `轮到 ${current.name}`;
  if (isOnlineRoom() && humanSeatCount() < 2) {
    ui.actionHint.textContent = "等待至少 2 名真人玩家加入，空位将由 AI 托管";
  } else if (state.rolled) {
    ui.actionHint.textContent = isAiPlayer(state.currentPlayer)
      ? `AI 托管中 · 掷出 ${state.dice || ""}`
      : (allowed ? `掷出 ${state.dice} 点，点击你的飞机` : `等待 ${current.name} 走棋`);
  } else {
    ui.actionHint.textContent = isAiPlayer(state.currentPlayer)
      ? `AI 自动行动 · 连续6：${state.sixStreaks[state.currentPlayer]}/2`
      : (allowed ? `你的回合 · 连续6：${state.sixStreaks[state.currentPlayer]}/2` : `等待 ${current.name} 掷骰`);
  }
  ui.roundLabel.textContent = `第 ${state.round} 回合`;
  ui.turnLabel.textContent = current.name;
  const disabled = state.rolled || state.rolling || state.winner !== null || !allowed;
  ui.rollButton.disabled = disabled;
  ui.diceButton.disabled = disabled;
  ui.rollButton.textContent = allowed ? "掷骰子" : "等待中";
  ui.rollButton.classList.toggle("available", !disabled);
  ui.diceButton.classList.toggle("available", !disabled);
  renderPlayers();
  renderLogs();
  renderChats();
  updateRoomLabel();
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

function buildSyncPayload() {
  normalizeAiSeats();
  return {
    version: 4,
    state: JSON.parse(JSON.stringify(state)),
    names: players.map(player => player.name),
    avatars: state.avatars,
    updatedBy: multiplayer.playerId,
    updatedAt: Date.now(),
  };
}

function syncState() {
  if (multiplayer.applyingRemote) return;
  const payload = buildSyncPayload();
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(payload));
  if (channel) channel.postMessage(payload);
  scheduleCloudSave(payload);
}

function applyRemote(payload, force = false) {
  if (!payload || !payload.state) return;
  if (!force && payload.updatedBy === multiplayer.playerId) return;
  if (payload.version !== 3 && payload.version !== 4) return;
  const previousPlayer = state.currentPlayer;
  multiplayer.applyingRemote = true;
  Object.assign(state, payload.state, { rolling: false });
  if (!Array.isArray(state.playerSeats)) state.playerSeats = [null, null, null, null];
  normalizeAiSeats();
  if (!state.aiDriverId) state.aiDriverId = multiplayer.playerId;
  multiplayer.colorIndex = getOwnedColorIndex();
  if (payload.names) payload.names.forEach((name, index) => { players[index].name = name; });
  if (payload.avatars) state.avatars = payload.avatars;
  applySettings(state.settings);
  renderDice(state.dice);
  updateUI();
  draw();
  if (previousPlayer !== state.currentPlayer) announceTurnChange(previousPlayer);
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(payload));
  multiplayer.applyingRemote = false;
  scheduleAiTurn();
}

function scheduleCloudSave(payload = buildSyncPayload()) {
  if (!multiplayer.ready || !multiplayer.roomId || !multiplayer.client) return;
  clearTimeout(multiplayer.saveTimer);
  multiplayer.saveTimer = setTimeout(() => saveRoomState(payload), 180);
}

async function saveRoomState(payload = buildSyncPayload()) {
  if (!multiplayer.roomId || !multiplayer.client) return;
  const { error } = await multiplayer.client
    .from("rooms")
    .upsert({
      id: multiplayer.roomId,
      state: payload,
      updated_at: new Date().toISOString(),
    });
  if (error) setOnlineStatus(`同步失败：${error.message}`, false);
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

function getOrCreatePlayerId() {
  const saved = localStorage.getItem(PLAYER_ID_KEY);
  if (saved) return saved;
  const id = `p_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

function initMultiplayer() {
  const config = window.YJ_SUPABASE_CONFIG || {};
  const hasConfig = config.url && config.anonKey && window.supabase;
  if (!hasConfig) {
    setOnlineStatus("本地模式：未配置云端", false);
    return;
  }
  multiplayer.client = window.supabase.createClient(config.url, config.anonKey);
  setOnlineStatus("云端已就绪", true);

  const urlRoom = new URLSearchParams(location.search).get("room");
  const savedRoom = localStorage.getItem("yj-flight-chess-room");
  if (urlRoom || savedRoom) joinRoom((urlRoom || savedRoom).toUpperCase());
}

function makeRoomId() {
  return `YJ-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function createOnlineRoom() {
  if (!ensureCloudReady()) return;
  const roomId = makeRoomId();
  multiplayer.roomId = roomId;
  state.settings = readLobbySettings();
  applySettings(state.settings);
  state.playerSeats = [null, null, null, null];
  state.aiSeats = state.settings.aiTakeover ? [true, true, true, true] : [false, false, false, false];
  state.aiDriverId = multiplayer.playerId;
  claimSeat(state.currentPlayer);
  assignAiProfiles();
  ui.roomInput.value = roomId;
  updateRoomLabel();
  await saveRoomState(buildSyncPayload());
  await subscribeRoom(roomId);
  localStorage.setItem("yj-flight-chess-room", roomId);
  setOnlineStatus("房间已创建", true);
  playSound("join");
  startBgm();
  showScreen("battle");
  updateUI();
  scheduleAiTurn();
}

async function joinRoom(rawRoomId) {
  if (!ensureCloudReady()) return;
  const roomId = String(rawRoomId || ui.roomInput.value).trim().toUpperCase();
  if (!roomId) {
    setOnlineStatus("请输入房间号", false);
    return;
  }

  multiplayer.roomId = roomId;
  ui.roomInput.value = roomId;
  updateRoomLabel();

  const { data, error } = await multiplayer.client
    .from("rooms")
    .select("state")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    setOnlineStatus(`加入失败：${error.message}`, false);
    return;
  }

  if (data?.state) {
    applyRemote(data.state, true);
  } else {
    state.settings = readLobbySettings();
    applySettings(state.settings);
    state.aiDriverId = multiplayer.playerId;
    assignAiProfiles();
    await saveRoomState(buildSyncPayload());
  }

  claimSeat();
  await saveRoomState(buildSyncPayload());

  await subscribeRoom(roomId);
  localStorage.setItem("yj-flight-chess-room", roomId);
  setOnlineStatus("已加入房间", true);
  playSound("join");
  startBgm();
  showScreen("battle");
  updateUI();
  scheduleAiTurn();
}

async function subscribeRoom(roomId) {
  if (multiplayer.subscription) {
    await multiplayer.client.removeChannel(multiplayer.subscription);
    multiplayer.subscription = null;
  }
  multiplayer.ready = true;
  multiplayer.subscription = multiplayer.client
    .channel(`room-${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      event => applyRemote(event.new?.state)
    )
    .subscribe(status => {
      if (status === "SUBSCRIBED") setOnlineStatus(`联机中：${roomId}`, true);
    });
}

function ensureCloudReady() {
  if (multiplayer.client) return true;
  setOnlineStatus("请先填写 multiplayer-config.js 里的 Supabase 参数", false);
  return false;
}

function setOnlineStatus(text, online) {
  ui.onlineStatus.textContent = text;
  ui.onlineStatus.classList.toggle("is-online", Boolean(online));
}

function updateRoomLabel() {
  const humans = humanSeatCount();
  const aiCount = state.aiSeats?.filter(Boolean).length || 0;
  ui.roomCode.textContent = multiplayer.roomId ? `房间 ${multiplayer.roomId} · 真人${humans}/4 · AI${aiCount}` : "本地模式";
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
ui.exitGameButton.addEventListener("click", () => {
  if (confirm("确定退出本局并交给 AI 托管吗？")) exitCurrentGameToLobby();
});
ui.createRoomButton.addEventListener("click", createOnlineRoom);
ui.joinRoomButton.addEventListener("click", () => joinRoom(ui.roomInput.value));
ui.lobbyCreateButton.addEventListener("click", createOnlineRoom);
ui.lobbyJoinButton.addEventListener("click", () => joinRoom(ui.lobbyRoomInput.value));
ui.lobbyRoomInput.addEventListener("keydown", event => {
  if (event.key === "Enter") joinRoom(ui.lobbyRoomInput.value);
});
ui.localDemoButton.addEventListener("click", () => {
  state.settings = readLobbySettings();
  applySettings(state.settings);
  resetGame(false);
  showScreen("battle");
  startBgm();
});
ui.backLobbyButton.addEventListener("click", exitCurrentGameToLobby);
document.querySelectorAll(".skin-card").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".skin-card").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    applySettings({ ...state.settings, skin: button.dataset.skin });
  });
});
ui.roomInput.addEventListener("keydown", event => {
  if (event.key === "Enter") joinRoom(ui.roomInput.value);
});
ui.copyRoomButton.addEventListener("click", async event => {
  const roomText = multiplayer.roomId || ui.roomInput.value || "YJ-2026";
  await navigator.clipboard?.writeText(roomText);
  event.currentTarget.textContent = "已复制";
  setTimeout(() => { event.currentTarget.textContent = "复制"; }, 1200);
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
  if (isOnlineRoom() && getOwnedColorIndex() !== index) {
    event.target.value = players[index].name;
    showToast("只能修改自己的昵称");
    playSound("deny");
    return;
  }
  players[index].name = event.target.value.trim() || `玩家${index + 1}`;
  updateUI();
  syncState();
});
ui.playerList.addEventListener("click", event => {
  const button = event.target.closest(".take-seat-button");
  if (!button) return;
  takeAiSeat(Number(button.dataset.seat));
});
ui.soundButton.addEventListener("click", () => {
  setSoundEnabled(!audioState.enabled);
  if (audioState.enabled) playSound("join");
});
if (channel) channel.addEventListener("message", event => applyRemote(event.data));
window.addEventListener("storage", event => {
  if ((event.key === LOCAL_STATE_KEY || event.key === "yj-flight-chess-state-v3") && event.newValue) {
    applyRemote(JSON.parse(event.newValue));
  }
});

createBoardGeometry();
setSoundEnabled(audioState.enabled);
initMultiplayer();
const saved = localStorage.getItem(LOCAL_STATE_KEY) || localStorage.getItem("yj-flight-chess-state-v3");
if (saved) {
  try {
    applyRemote(JSON.parse(saved), true);
  } catch {
    resetGame();
  }
} else {
  resetGame();
  addChat("欢迎来到 YJ飞行器！", 0);
}
