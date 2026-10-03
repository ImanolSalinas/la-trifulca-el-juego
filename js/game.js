const { TILE, CHARACTERS, MAPS } = window.GAME_DATA;
const VIEW_W = 256;
const VIEW_H = 224;
const SPEED = 78;
const audio = new Audio();
let trackIndex = 0;
let musicStarted = false;
let musicMuted = false;
const muteButton = document.getElementById("mute");

function updateMuteButton() {
  muteButton.setAttribute("aria-pressed", musicMuted ? "true" : "false");
  muteButton.setAttribute("aria-label", musicMuted ? "Activar música" : "Silenciar música");
  muteButton.textContent = musicMuted ? "Mudo" : "Sonido";
}

function setMusicMuted(muted) {
  musicMuted = muted;
  audio.muted = muted;
  updateMuteButton();
  if (!muted) {
    startMusic();
  }
}

function startMusic() {
  const tracks = window.TRIFULCA.tracks;
  if (!tracks || tracks.length === 0) {
    return;
  }
  if (!musicStarted) {
    musicStarted = true;
    audio.volume = 0.45;
    audio.muted = musicMuted;
    audio.src = encodeURI(tracks[0]);
    audio.addEventListener("ended", () => {
      trackIndex = (trackIndex + 1) % tracks.length;
      audio.src = encodeURI(tracks[trackIndex]);
      audio.play().catch(() => {});
    });
  }
  audio.muted = musicMuted;
  if (musicMuted) {
    return;
  }
  audio.play().catch(() => {});
}

muteButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setMusicMuted(!musicMuted);
});

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const keys = new Set();
let talkQueued = false;

const player = {
  x: 0,
  y: 0,
  dir: "down",
  character: CHARACTERS[0],
  moving: false,
  walkTime: 0,
};

const state = {
  screen: "title",
  map: MAPS.pasillo,
  coins: new Set(),
  deposited: false,
  dialogue: null,
  suppressDoor: false,
  suppressBoleteria: false,
  suppressJose: false,
  gates: { frawens: false },
  returnSpawn: { tx: 8, ty: 20 },
  hover: -1,
  /** @type {{ id: string, mapId: string, tx: number, ty: number, x: number, y: number, toss: null | { fromX: number, fromY: number, toX: number, toY: number, t: number, dur: number } }[]} */
  worldCoins: [],
};

function tileCenter(tile) {
  return {
    x: tile.tx * TILE + TILE / 2,
    y: tile.ty * TILE + TILE / 2,
  };
}

function placePlayer(tile) {
  const point = tileCenter(tile);
  player.x = point.x;
  player.y = point.y;
  state.suppressDoor = true;
  state.suppressJose = true;
}

const TILOS_PLACE = {
  tent: { x: 64, y: 72, w: 512, h: 236 },
  path: { x: 292, y: 286, w: 56, h: 190 },
};

const BRAND = {
  black: "#000000",
  cyan: "#45b1d1",
  cyanDeep: "#2a8fb0",
  orange: "#e07a2a",
  orangeHot: "#ff9a3c",
  cream: "#f4efe6",
};

const TITLE_ART = new Image();
TITLE_ART.src = "assets/brand/title.jpg?v=51";

/** Hit zone for the baked-in JUGAR button on the title splash. */
const TITLE_PLAY = { x: 80, y: 160, w: 96, h: 36 };

const PASILLO_ART = new Image();
PASILLO_ART.src = "assets/places/pasillo/pasillo.png?v=80";

const FRAWENS_ART = new Image();
FRAWENS_ART.src = "assets/places/frawens/salon.png?v=81";

const FRAWENS_BALLS = new Image();
FRAWENS_BALLS.src = "assets/places/frawens/balls.png?v=82";

const FRAWENS_COLLISION = new Image();
FRAWENS_COLLISION.src = "assets/places/frawens/collision-game.png?v=83";
/** @type {Uint8ClampedArray | null} */
let frawensCollisionPixels = null;
FRAWENS_COLLISION.addEventListener("load", () => {
  const board = document.createElement("canvas");
  board.width = FRAWENS_COLLISION.naturalWidth;
  board.height = FRAWENS_COLLISION.naturalHeight;
  const boardCtx = board.getContext("2d");
  boardCtx.drawImage(FRAWENS_COLLISION, 0, 0);
  frawensCollisionPixels = boardCtx.getImageData(0, 0, board.width, board.height).data;
});

function frawensSolid(x, y) {
  const mapW = state.map.rows[0].length * TILE;
  const mapH = state.map.rows.length * TILE;
  if (x < 0 || y < 0 || x >= mapW || y >= mapH) {
    return true;
  }
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const doorClosed = !state.gates.frawens && ty === 24 && tx >= 8 && tx <= 11;
  const joseStands = ty === 25 && tx === 12;
  if (doorClosed || joseStands) {
    return true;
  }
  if (frawensCollisionPixels && FRAWENS_COLLISION.naturalWidth) {
    const px = Math.min(FRAWENS_COLLISION.naturalWidth - 1, Math.max(0, Math.floor(x)));
    const py = Math.min(FRAWENS_COLLISION.naturalHeight - 1, Math.max(0, Math.floor(y)));
    return frawensCollisionPixels[(py * FRAWENS_COLLISION.naturalWidth + px) * 4] < 128;
  }
  const cell = state.map.rows[ty]?.[tx];
  return !cell || cell === "#" || cell === "B" || cell === "T" || cell === "P" || cell === "S";
}

const UNIVERSAL_ART = new Image();
UNIVERSAL_ART.src = "assets/places/universal/street.png?v=45";

const UNIVERSAL_COLLISION = new Image();
UNIVERSAL_COLLISION.src = "assets/places/universal/collision-game.png?v=50";
/** @type {Uint8ClampedArray | null} */
let universalCollisionPixels = null;
UNIVERSAL_COLLISION.addEventListener("load", () => {
  const board = document.createElement("canvas");
  board.width = UNIVERSAL_COLLISION.naturalWidth;
  board.height = UNIVERSAL_COLLISION.naturalHeight;
  const boardCtx = board.getContext("2d");
  boardCtx.drawImage(UNIVERSAL_COLLISION, 0, 0);
  universalCollisionPixels = boardCtx.getImageData(0, 0, board.width, board.height).data;
});

function universalSolid(x, y) {
  const mapW = 24 * TILE;
  const mapH = 30 * TILE;
  if (x < 0 || y < 0 || x >= mapW || y >= mapH) {
    return true;
  }
  if (universalCollisionPixels && UNIVERSAL_COLLISION.naturalWidth) {
    const px = Math.min(UNIVERSAL_COLLISION.naturalWidth - 1, Math.max(0, Math.floor(x)));
    const py = Math.min(UNIVERSAL_COLLISION.naturalHeight - 1, Math.max(0, Math.floor(y)));
    return universalCollisionPixels[(py * UNIVERSAL_COLLISION.naturalWidth + px) * 4] < 128;
  }
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const cell = state.map.rows[ty]?.[tx];
  return !cell || cell === "#";
}

const MORENO_ART = new Image();
MORENO_ART.src = "assets/places/moreno/plaza.png?v=67";

const MORENO_COLLISION = new Image();
MORENO_COLLISION.src = "assets/places/moreno/collision-game.png?v=72";
/** @type {Uint8ClampedArray | null} */
let morenoCollisionPixels = null;
MORENO_COLLISION.addEventListener("load", () => {
  const board = document.createElement("canvas");
  board.width = MORENO_COLLISION.naturalWidth;
  board.height = MORENO_COLLISION.naturalHeight;
  const boardCtx = board.getContext("2d");
  boardCtx.drawImage(MORENO_COLLISION, 0, 0);
  morenoCollisionPixels = boardCtx.getImageData(0, 0, board.width, board.height).data;
});

const GATOS_ART = new Image();
GATOS_ART.src = "assets/places/gatos/ciudad.png?v=1";

const GATOS_COLLISION = new Image();
GATOS_COLLISION.src = "assets/places/gatos/collision-game.png?v=1";
/** @type {Uint8ClampedArray | null} */
let gatosCollisionPixels = null;
GATOS_COLLISION.addEventListener("load", () => {
  const board = document.createElement("canvas");
  board.width = GATOS_COLLISION.naturalWidth;
  board.height = GATOS_COLLISION.naturalHeight;
  const boardCtx = board.getContext("2d");
  boardCtx.drawImage(GATOS_COLLISION, 0, 0);
  gatosCollisionPixels = boardCtx.getImageData(0, 0, board.width, board.height).data;
});

function gatosSolid(x, y) {
  const mapW = 18 * TILE;
  const mapH = 12 * TILE;
  if (x < 0 || y < 0 || x >= mapW || y >= mapH) {
    return true;
  }
  if (gatosCollisionPixels && GATOS_COLLISION.naturalWidth) {
    const px = Math.min(GATOS_COLLISION.naturalWidth - 1, Math.max(0, Math.floor(x / mapW * GATOS_COLLISION.naturalWidth)));
    const py = Math.min(GATOS_COLLISION.naturalHeight - 1, Math.max(0, Math.floor(y / mapH * GATOS_COLLISION.naturalHeight)));
    return gatosCollisionPixels[(py * GATOS_COLLISION.naturalWidth + px) * 4] < 128;
  }
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const cell = state.map.rows[ty]?.[tx];
  return !cell || cell === "#";
}

function morenoSolid(x, y) {
  const mapW = 110 * TILE;
  const mapH = 55 * TILE;
  if (x < 0 || y < 0 || x >= mapW || y >= mapH) {
    return true;
  }
  if (morenoCollisionPixels && MORENO_COLLISION.naturalWidth) {
    const px = Math.min(MORENO_COLLISION.naturalWidth - 1, Math.max(0, Math.floor(x)));
    const py = Math.min(MORENO_COLLISION.naturalHeight - 1, Math.max(0, Math.floor(y)));
    return morenoCollisionPixels[(py * MORENO_COLLISION.naturalWidth + px) * 4] < 128;
  }
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const cell = state.map.rows[ty]?.[tx];
  return !cell || cell === "#";
}

const TILOS_ART = {};
for (const [name, file] of [
  ["grass", "grass.jpg"],
  ["path", "path.jpg"],
  ["tent", "tent.png"],
  ["tree", "tree.png"],
  ["lamp", "lamp.png"],
  ["car", "car.png"],
  ["goal", "goal.png"],
]) {
  const image = new Image();
  image.src = `assets/places/tilos/${file}?v=31`;
  TILOS_ART[name] = image;
}

const TILOS_AWNING = new Image();
TILOS_AWNING.src = "assets/places/tilos/tent-awning.png?v=76";

const TILOS_COLLISION = new Image();
TILOS_COLLISION.src = "assets/places/tilos/tent-collision.png?v=78";
/** @type {Uint8ClampedArray | null} */
let tilosCollisionPixels = null;
TILOS_COLLISION.addEventListener("load", () => {
  const board = document.createElement("canvas");
  board.width = TILOS_COLLISION.naturalWidth;
  board.height = TILOS_COLLISION.naturalHeight;
  const boardCtx = board.getContext("2d");
  boardCtx.drawImage(TILOS_COLLISION, 0, 0);
  tilosCollisionPixels = boardCtx.getImageData(0, 0, board.width, board.height).data;
});

function tilosSprite(kind, x, y, height) {
  const image = TILOS_ART[kind];
  const ratio = image.naturalWidth > 0 ? image.naturalWidth / image.naturalHeight : 0.5;
  const h = height;
  const w = Math.round(h * ratio);
  return { kind, x, y, w, h, foot: y + h };
}

function tilosProps() {
  const props = [];
  for (let x = 4; x < 630; x += 58) {
    props.push(tilosSprite("tree", x, -8, 54));
    if (x < 270 || x > 360) {
      props.push(tilosSprite("tree", x, 498, 54));
    }
  }
  for (let y = 48; y < 470; y += 70) {
    props.push(tilosSprite("tree", -6, y, 54));
    props.push(tilosSprite("tree", 596, y, 54));
  }
  for (const x of [48, 108, 500, 560]) {
    props.push(tilosSprite("car", x, 16, 46));
    props.push(tilosSprite("car", x, 478, 46));
  }
  for (const point of [
    [78, 58],
    [548, 58],
    [78, 430],
    [548, 430],
  ]) {
    props.push(tilosSprite("lamp", point[0], point[1], 62));
  }
  props.push(tilosSprite("goal", 18, 168, 70));
  props.push(tilosSprite("goal", 586, 168, 70));
  return props;
}

function tilosHits(rect, x, y) {
  return x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;
}

function tilosSolid(x, y) {
  const mapW = 40 * TILE;
  const mapH = 34 * TILE;
  if (x < 12 || y < 12 || x > mapW - 12 || y > mapH - 12) {
    return true;
  }
  const tent = TILOS_PLACE.tent;
  const ix = x - tent.x;
  const iy = y - tent.y;
  if (ix >= 0 && iy >= 0 && ix < tent.w && iy < tent.h && tilosCollisionPixels) {
    const px = Math.min(TILOS_COLLISION.naturalWidth - 1, Math.floor(ix));
    const py = Math.min(TILOS_COLLISION.naturalHeight - 1, Math.floor(iy));
    if (tilosCollisionPixels[(py * TILOS_COLLISION.naturalWidth + px) * 4] < 128) {
      return true;
    }
  }
  for (const prop of tilosProps()) {
    if (prop.kind === "tree" || prop.kind === "lamp") {
      continue;
    }
    const body = {
      x: prop.x + prop.w * 0.15,
      y: prop.foot - 16,
      w: prop.w * 0.7,
      h: 16,
    };
    if (tilosHits(body, x, y)) {
      return true;
    }
  }
  return false;
}

function solidAt(map, x, y) {
  if (map.id === "tilos") {
    return tilosSolid(x, y);
  }
  if (map.id === "frawens") {
    return frawensSolid(x, y);
  }
  if (map.id === "universal") {
    return universalSolid(x, y);
  }
  if (map.id === "moreno") {
    return morenoSolid(x, y);
  }
  if (map.id === "gatos") {
    return gatosSolid(x, y);
  }
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= map.rows[0].length || ty >= map.rows.length) {
    return true;
  }
  const cell = map.rows[ty][tx];
  return cell === "#" || cell === "B" || cell === "T" || cell === "P" || cell === "S" || cell === "W" || cell === "C" || cell === "L" || cell === "K" || cell === "G";
}

function canStand(map, x, y) {
  const left = x - 3;
  const right = x + 3;
  const feet = y + 3;
  return !solidAt(map, left, feet) && !solidAt(map, right, feet) && !solidAt(map, x, feet);
}

function move(dt) {
  if (state.screen !== "play" || state.dialogue) {
    player.moving = false;
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keys.has("left")) dx -= 1;
  if (keys.has("right")) dx += 1;
  if (keys.has("up")) dy -= 1;
  if (keys.has("down")) dy += 1;
  if (dx === 0 && dy === 0) {
    player.moving = false;
    return;
  }

  player.moving = true;
  player.walkTime += dt;

  if (Math.abs(dx) > Math.abs(dy)) {
    player.dir = dx < 0 ? "left" : "right";
  } else {
    player.dir = dy < 0 ? "up" : "down";
  }

  const length = Math.hypot(dx, dy);
  const step = SPEED * dt;
  const vx = (dx / length) * step;
  const vy = (dy / length) * step;
  if (canStand(state.map, player.x + vx, player.y)) {
    player.x += vx;
  }
  if (canStand(state.map, player.x, player.y + vy)) {
    player.y += vy;
  }
}

function playerTile() {
  return {
    tx: Math.floor(player.x / TILE),
    ty: Math.floor(player.y / TILE),
  };
}

function sameTile(a, b) {
  return a.tx === b.tx && a.ty === b.ty;
}

function checkTransitions() {
  const here = playerTile();
  const onDoor = state.map.doors.some((door) => sameTile(door, here));
  const onExit = state.map.exits.some((exit) => sameTile(exit, here));
  if (!onDoor && !onExit) {
    state.suppressDoor = false;
    return;
  }
  if (state.suppressDoor || state.dialogue) {
    return;
  }

  const door = state.map.doors.find((item) => sameTile(item, here));
  if (door) {
    state.returnSpawn = door.spawnBack;
    state.map = MAPS[door.to];
    placePlayer(door.spawnThere);
    return;
  }
  if (onExit) {
    state.map = MAPS.pasillo;
    placePlayer(state.returnSpawn);
  }
}

function nearbyNpc() {
  let found = null;
  let best = 26;
  for (const npc of state.map.npcs) {
    const point = tileCenter(npc);
    const distance = Math.hypot(player.x - point.x, player.y - point.y);
    if (npc.silent || distance >= best) {
      continue;
    }
    best = distance;
    found = npc;
  }
  return found;
}

function atCounter() {
  if (!state.map.counter) {
    return false;
  }
  const here = playerTile();
  const cell = state.map.rows[here.ty]?.[here.tx];
  return cell === "b";
}

function coinCount() {
  return state.coins.size;
}

const COIN_TOTAL = 6;

function mapCoins(map) {
  if (Array.isArray(map.coins) && map.coins.length) {
    return map.coins;
  }
  return map.coin ? [map.coin] : [];
}

function takeCoin() {
  for (const coin of mapCoins(state.map)) {
    if (!state.coins.has(coin.id) && sameTile(playerTile(), coin)) {
      state.coins.add(coin.id);
    }
  }
  state.worldCoins = state.worldCoins.filter((world) => {
    if (
      !world.toss &&
      world.mapId === state.map.id &&
      !state.coins.has(world.id) &&
      sameTile(playerTile(), world)
    ) {
      state.coins.add(world.id);
      return false;
    }
    return true;
  });
}

function openDialogue(lines, action, quiz) {
  state.dialogue = {
    lines,
    index: 0,
    action: action ?? null,
    quiz: quiz ?? null,
    choiceRects: null,
  };
}

function quizCoinPending(quiz) {
  if (!quiz?.coinId) {
    return false;
  }
  if (state.coins.has(quiz.coinId)) {
    return true;
  }
  return state.worldCoins.some((coin) => coin.id === quiz.coinId);
}

function tossCoinFromNpc(npc, quiz) {
  const coinId = quiz.coinId;
  if (!coinId || quizCoinPending(quiz)) {
    return;
  }
  const land = quiz.land || { tx: npc.tx + 1, ty: npc.ty + 1 };
  const from = tileCenter(npc);
  const to = tileCenter(land);
  state.worldCoins.push({
    id: coinId,
    mapId: state.map.id,
    tx: land.tx,
    ty: land.ty,
    x: from.x,
    y: from.y - 20,
    toss: {
      fromX: from.x + 4,
      fromY: from.y - 22,
      toX: to.x,
      toY: to.y,
      t: 0,
      dur: 0.75,
    },
  });
}

function updateWorldCoin(dt) {
  for (const coin of state.worldCoins) {
    if (!coin.toss) {
      continue;
    }
    coin.toss.t += dt;
    const u = Math.min(1, coin.toss.t / coin.toss.dur);
    const arc = Math.sin(u * Math.PI) * 34;
    coin.x = coin.toss.fromX + (coin.toss.toX - coin.toss.fromX) * u;
    coin.y = coin.toss.fromY + (coin.toss.toY - coin.toss.fromY) * u - arc;
    if (u >= 1) {
      coin.x = coin.toss.toX;
      coin.y = coin.toss.toY;
      coin.toss = null;
    }
  }
}

function answerQuiz(optionIndex) {
  const dialogue = state.dialogue;
  if (!dialogue?.quiz) {
    return;
  }
  const quiz = dialogue.quiz;
  if (optionIndex === quiz.correct) {
    openDialogue(quiz.win);
    if (quiz.gate) {
      state.gates[quiz.gate] = true;
      return;
    }
    const npc = state.map.npcs.find((entry) => entry.quiz === quiz) || nearbyNpc();
    if (npc) {
      tossCoinFromNpc(npc, quiz);
    }
    return;
  }
  openDialogue(quiz.lose);
}

function openBoleteriaDialogue() {
  const count = coinCount();
  if (count < COIN_TOTAL) {
    const falta = COIN_TOTAL - count;
    const llevas =
      count === 0 ? "Todavía no trajiste monedas." : `Llevás ${count} de ${COIN_TOTAL}.`;
    const faltaLine =
      falta === 1 ? "Te falta 1 moneda." : `Te faltan ${falta} monedas.`;
    openDialogue([
      "Boletería",
      "Acá se cambian las monedas por la entrada a Medusa.",
      llevas,
      faltaLine,
      "Son 6 en total. Volvé cuando las tengas.",
    ]);
    return;
  }
  state.deposited = true;
  const url = window.TRIFULCA.ticketUrl;
  openDialogue(
    url
      ? [
          "Boletería",
          "Las 6 monedas. Perfecto.",
          "Listo. Sacá tu entrada a Medusa.",
        ]
      : [
          "Boletería",
          "Las 6 monedas. Perfecto.",
          "Listo. Falta cargar el link de Medusa.",
        ],
    url ? "ticket" : null,
  );
}

function checkBoleteria() {
  if (state.map.id !== "pasillo" || state.dialogue) {
    return;
  }
  if (!atCounter()) {
    state.suppressBoleteria = false;
    return;
  }
  if (state.suppressBoleteria) {
    return;
  }
  state.suppressBoleteria = true;
  openBoleteriaDialogue();
}

function checkJose() {
  if (state.map.id !== "frawens" || state.dialogue || state.gates.frawens) {
    return;
  }
  const jose = state.map.npcs.find((npc) => npc.id === "jose");
  if (!jose) {
    return;
  }
  const here = playerTile();
  const atDoor = here.ty === 24 || here.ty === 25;
  if (!atDoor || !keys.has("up")) {
    if (!keys.has("up")) {
      state.suppressJose = false;
    }
    return;
  }
  if (state.suppressJose) {
    return;
  }
  state.suppressJose = true;
  openDialogue(jose.lines, "quiz", jose.quiz);
}

function talk() {
  if (state.screen !== "play") {
    return;
  }
  if (state.dialogue) {
    if (state.dialogue.quiz && state.dialogue.index >= state.dialogue.lines.length - 1) {
      // Waiting for an option tap; ignore plain talk advances.
      return;
    }
    const last = state.dialogue.index >= state.dialogue.lines.length - 1;
    if (!last) {
      state.dialogue.index += 1;
      return;
    }
    state.dialogue = null;
    return;
  }

  const npc = nearbyNpc();
  if (npc) {
    if (npc.quiz) {
      if (npc.quiz.gate && state.gates[npc.quiz.gate]) {
        openDialogue(npc.quiz.done || ["Pasá."]);
      } else if (quizCoinPending(npc.quiz)) {
        openDialogue(npc.quiz.done || ["Ya te di la moneda."]);
      } else {
        openDialogue(npc.lines, "quiz", npc.quiz);
      }
    } else {
      openDialogue([npc.name, ...npc.lines]);
    }
    return;
  }
  if (!atCounter()) {
    return;
  }
  openBoleteriaDialogue();
}

function openTicket() {
  const url = window.TRIFULCA.ticketUrl;
  if (!url) {
    return;
  }
  window.open(url, "_blank", "noopener");
}

function camera() {
  const map = state.map;
  const width = map.rows[0].length * TILE;
  const height = map.rows.length * TILE;
  const zoom = map.id === "moreno" ? 0.5 : map.id === "tilos" || map.id === "universal" ? 0.72 : 1;
  const viewW = VIEW_W / zoom;
  const viewH = VIEW_H / zoom;
  const x = viewW >= width ? (width - viewW) / 2 : Math.max(0, Math.min(player.x - viewW / 2, width - viewW));
  const y = viewH >= height ? (height - viewH) / 2 : Math.max(0, Math.min(player.y - viewH / 2, height - viewH));
  return { x, y, zoom };
}

function checker(colors, tx, ty) {
  return (tx + ty) % 2 === 0 ? colors[0] : colors[1];
}

function drawTilosGround() {
  const mapW = 40 * TILE;
  const mapH = 34 * TILE;
  const grass = TILOS_ART.grass;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (grass.complete && grass.naturalWidth) {
    ctx.drawImage(grass, 0, 0, mapW, mapH);
    ctx.fillStyle = "rgba(8, 28, 18, 0.2)";
    ctx.fillRect(0, 0, mapW, mapH);
  } else {
    ctx.fillStyle = "#2f7a45";
    ctx.fillRect(0, 0, mapW, mapH);
  }

  ctx.fillStyle = "#f7f3e8";
  ctx.fillRect(36, 52, mapW - 72, 2);
  ctx.fillRect(36, 492, mapW - 72, 2);
  ctx.fillRect(36, 52, 2, 442);
  ctx.fillRect(mapW - 38, 52, 2, 442);
  ctx.fillRect(318, 52, 2, 160);
  ctx.fillRect(318, 330, 2, 164);

  const pathImage = TILOS_ART.path;
  const path = TILOS_PLACE.path;
  if (pathImage.complete && pathImage.naturalWidth) {
    const cell = 40;
    for (let y = path.y; y < path.y + path.h; y += cell) {
      for (let x = path.x; x < path.x + path.w; x += cell) {
        ctx.drawImage(
          pathImage,
          180,
          180,
          420,
          420,
          x,
          y,
          Math.min(cell, path.x + path.w - x),
          Math.min(cell, path.y + path.h - y),
        );
      }
    }
  }

  const tentImage = TILOS_ART.tent;
  const tent = TILOS_PLACE.tent;
  if (tentImage.complete && tentImage.naturalWidth) {
    ctx.drawImage(tentImage, tent.x, tent.y, tent.w, tent.h);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#f2d24b";
  tilosProps()
    .filter((prop) => prop.kind === "lamp")
    .forEach((lamp) => {
      ctx.beginPath();
      ctx.arc(lamp.x + lamp.w / 2, lamp.y + 10, 26, 0, Math.PI * 2);
      ctx.fill();
    });
  ctx.restore();
}

function drawTilosAwning() {
  if (state.map.id !== "tilos" || !TILOS_AWNING.complete || !TILOS_AWNING.naturalWidth) {
    return;
  }
  const tent = TILOS_PLACE.tent;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(TILOS_AWNING, tent.x, tent.y, tent.w, tent.h);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function drawTilosProps(beforePlayer) {
  if (state.map.id !== "tilos") {
    return;
  }
  ctx.imageSmoothingEnabled = false;
  tilosProps().forEach((prop) => {
    const behind = prop.foot - 8 <= player.y;
    if (behind !== beforePlayer) {
      return;
    }
    const image = TILOS_ART[prop.kind];
    if (!image.complete || image.naturalWidth === 0) {
      return;
    }
    ctx.drawImage(image, prop.x, prop.y, prop.w, prop.h);
  });
}

function drawVenueArt(image, fallback) {
  const mapW = state.map.rows[0].length * TILE;
  const mapH = state.map.rows.length * TILE;
  if (image.complete && image.naturalWidth) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, mapW, mapH);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    return;
  }
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, mapW, mapH);
}

function drawPasillo() {
  drawVenueArt(PASILLO_ART, "#241810");
}

function drawFrawens() {
  drawVenueArt(FRAWENS_ART, "#2a2438");
}

function drawFrawensBalls() {
  if (state.map.id !== "frawens" || !FRAWENS_BALLS.complete || !FRAWENS_BALLS.naturalWidth) {
    return;
  }
  const mapW = state.map.rows[0].length * TILE;
  const mapH = state.map.rows.length * TILE;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(FRAWENS_BALLS, 0, 0, mapW, mapH);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function drawUniversal() {
  drawVenueArt(UNIVERSAL_ART, "#2a2e34");
}

function drawGatos() {
  drawVenueArt(GATOS_ART, "#3a2a22");
}

function drawMoreno() {
  const mapW = state.map.rows[0].length * TILE;
  const mapH = state.map.rows.length * TILE;
  if (MORENO_ART.complete && MORENO_ART.naturalWidth) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(MORENO_ART, 0, 0, mapW, mapH);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    return;
  }
  ctx.fillStyle = "#c4b49a";
  ctx.fillRect(0, 0, mapW, mapH);
}

function drawFloorAndWalls(map) {
  if (map.id === "pasillo") {
    drawPasillo();
    return;
  }
  if (map.id === "frawens") {
    drawFrawens();
    return;
  }
  if (map.id === "universal") {
    drawUniversal();
    return;
  }
  if (map.id === "moreno") {
    drawMoreno();
    return;
  }
  if (map.id === "gatos") {
    drawGatos();
    return;
  }
  if (map.id === "tilos") {
    drawTilosGround();
    return;
  }
  for (let ty = 0; ty < map.rows.length; ty += 1) {
    for (let tx = 0; tx < map.rows[ty].length; tx += 1) {
      const cell = map.rows[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (map.id === "tilos") {
        drawTilosTile(map, cell, tx, ty, x, y);
        continue;
      }
      if (cell === "#" || cell === "B") {
        ctx.fillStyle = map.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = cell === "B" ? "#c9a227" : "#3a2c24";
        ctx.fillRect(x, y, TILE, 3);
        continue;
      }
      ctx.fillStyle = checker(map.floor, tx, ty);
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
  if (map.id === "tilos") {
    drawTilosLights(map);
  }
}

function drawFrawensTile(map, cell, tx, ty, x, y) {
  if (cell === "#") {
    ctx.fillStyle = "#16141c";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#2c2838";
    ctx.fillRect(x, y, TILE, 3);
    return;
  }

  let ground = ["#3a3058", "#463868"];
  if (cell === "o" || cell === "P") ground = ["#2a3330", "#24302c"];
  if (cell === "," || cell === "T" || cell === "d") ground = ["#4a4038", "#40362f"];
  if (cell === "S") ground = ["#6a4a32", "#5c402c"];
  if (cell === "B") ground = ["#1a1420", "#1a1420"];
  ctx.fillStyle = checker(ground, tx, ty);
  ctx.fillRect(x, y, TILE, TILE);

  if (cell === "." && (tx + ty) % 4 === 0) {
    ctx.fillStyle = (tx + ty) % 8 === 0 ? "#7a6ad8" : "#5a88d0";
    ctx.fillRect(x + 6, y + 6, 4, 4);
  }
  if (cell === "S" && map.rows[ty + 1]?.[tx] !== "S") {
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x, y + TILE - 3, TILE, 3);
  }
  if (cell === "B") {
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(x, y, TILE, 4);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(x + 2, y + 6, 12, 6);
  }
  if (cell === "T") {
    ctx.fillStyle = "#2a2018";
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6d2a8";
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (cell === "P") {
    ctx.fillStyle = "#1e3a28";
    ctx.fillRect(x + 6, y + 8, 4, 6);
    ctx.fillStyle = "#3d8a48";
    ctx.fillRect(x + 3, y + 2, 10, 8);
  }
}

function drawTilosTile(map, cell, tx, ty, x, y) {
  if (cell === "#") {
    ctx.fillStyle = "#0c2016";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#1a3a24";
    ctx.fillRect(x + 2, y + 2, 12, 12);
    ctx.fillStyle = "#245c34";
    ctx.fillRect(x + 4, y + 4, 8, 8);
    return;
  }

  let ground = ["#2f7a45", "#27703e"];
  if (cell === "," || cell === "T" || cell === "B" || cell === "P") ground = ["#6b4330", "#5c3828"];
  if (cell === "." || cell === "K") ground = ["#3a1870", "#4c2288"];
  if (cell === "S") ground = ["#1c1030", "#24143c"];
  if (cell === "p" || cell === "d") ground = ["#6a5c4c", "#5c5042"];
  if (cell === "W") ground = ["#f6f1e6", "#f6f1e6"];
  if (cell === "C") ground = ["#2a2e34", "#2a2e34"];
  ctx.fillStyle = cell === "W" || cell === "C" ? ground[0] : checker(ground, tx, ty);
  ctx.fillRect(x, y, TILE, TILE);

  if (cell === "=") {
    const horizontal = map.rows[ty][tx - 1] === "=" || map.rows[ty][tx + 1] === "=";
    const vertical = map.rows[ty - 1]?.[tx] === "=" || map.rows[ty + 1]?.[tx] === "=";
    ctx.fillStyle = "#efe8d4";
    if (horizontal || !vertical) {
      ctx.fillRect(x, y + 7, TILE, 2);
    }
    if (vertical) {
      ctx.fillRect(x + 7, y, 2, TILE);
    }
  }
  if (cell === "." && (tx + ty) % 5 === 0) {
    ctx.fillStyle = "rgba(210, 140, 255, 0.55)";
    ctx.fillRect(x + 2, y + 7, 12, 2);
  }
  if (cell === "," && (tx * 3 + ty) % 7 === 0) {
    ctx.fillStyle = "rgba(242, 210, 75, 0.45)";
    ctx.fillRect(x + 6, y + 6, 4, 4);
  }
  if (cell === "S" && map.rows[ty][tx - 1] !== "S" && map.rows[ty][tx - 1] !== "K") {
    ctx.fillStyle = "#e7b4ff";
    ctx.fillRect(x, y, 3, TILE);
  }
  if (cell === "W") {
    const south = map.rows[ty + 1]?.[tx];
    const north = map.rows[ty - 1]?.[tx];
    if (south !== "W") {
      ctx.fillStyle = "#d9d0c0";
      ctx.fillRect(x, y + TILE - 4, TILE, 4);
      ctx.fillStyle = "#fffaf2";
      ctx.fillRect(x + 2, y + TILE - 4, 4, 3);
      ctx.fillRect(x + 10, y + TILE - 4, 4, 3);
    }
    if (north !== "W") {
      ctx.fillStyle = "#fffaf2";
      ctx.fillRect(x, y, TILE, 2);
    }
  }
  if (cell === "B") {
    ctx.fillStyle = "#c48a3a";
    ctx.fillRect(x, y, TILE, 5);
    ctx.fillStyle = "#3a2414";
    ctx.fillRect(x + 2, y + 7, 12, 6);
  }
  if (cell === "T") {
    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6d2a8";
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (cell === "P") {
    ctx.fillStyle = "#3d8a48";
    ctx.fillRect(x + 3, y + 3, 10, 10);
    ctx.fillStyle = "#1e3a28";
    ctx.fillRect(x + 6, y + 10, 4, 4);
  }
  if (cell === "C") {
    ctx.fillStyle = "#8aa0b0";
    if (map.rows[ty - 1]?.[tx] !== "C") {
      ctx.fillRect(x + 2, y + 2, 12, 5);
    }
    if (map.rows[ty + 1]?.[tx] !== "C") {
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(x + 2, y + 12, 4, 2);
      ctx.fillRect(x + 10, y + 12, 4, 2);
    }
  }
  if (cell === "L") {
    ctx.fillStyle = "#2a2418";
    ctx.fillRect(x + 7, y + 4, 2, 12);
    ctx.fillStyle = "#f2d24b";
    ctx.beginPath();
    ctx.arc(x + 8, y + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (cell === "K") {
    ctx.fillStyle = "#121018";
    ctx.fillRect(x + 2, y + 2, 12, 12);
    ctx.fillStyle = "#c080ff";
    ctx.fillRect(x + 4, y + 5, 8, 3);
  }
  if (cell === "G") {
    ctx.fillStyle = "#f4f0e8";
    if (map.rows[ty - 1]?.[tx] === "G" || map.rows[ty + 1]?.[tx] === "G") {
      ctx.fillRect(x + 6, y, 4, TILE);
    }
    if (map.rows[ty][tx - 1] === "G" || map.rows[ty][tx + 1] === "G") {
      ctx.fillRect(x, y + 6, TILE, 4);
    }
  }
}

function drawTilosLights(map) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#e7b4ff";
  [
    [26, 12, 19, 13],
    [26, 15, 19, 16],
    [26, 18, 19, 17],
  ].forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0 * TILE, y0 * TILE);
    ctx.lineTo(x0 * TILE, y0 * TILE + 10);
    ctx.lineTo(x1 * TILE, y1 * TILE + 8);
    ctx.lineTo(x1 * TILE, y1 * TILE);
    ctx.fill();
  });
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#f2d24b";
  map.rows.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx += 1) {
      if (row[tx] !== "L") continue;
      ctx.beginPath();
      ctx.arc(tx * TILE + 8, ty * TILE + 4, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

function morenoExitPoint() {
  const exits = MAPS.moreno.exits;
  let x = 0;
  let y = 0;
  for (const exit of exits) {
    const point = tileCenter(exit);
    x += point.x;
    y += point.y;
  }
  return { x: x / exits.length, y: y / exits.length };
}

function nearMorenoExit() {
  if (state.map.id !== "moreno" || state.dialogue || !state.map.exits.length) {
    return false;
  }
  const point = morenoExitPoint();
  return Math.hypot(player.x - point.x, player.y - point.y) < 72;
}

function drawSecretExit() {
  const point = morenoExitPoint();
  const x = point.x;
  const y = point.y;
  ctx.fillStyle = "#3a3228";
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#14110e";
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#050403";
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDoors(map) {
  if (map.id === "moreno") {
    if (map.exits.length) {
      drawSecretExit();
    }
    return;
  }
  if (map.id === "gatos") {
    if (map.exits.length) {
      let x = 0;
      let y = 0;
      for (const exit of map.exits) {
        const point = tileCenter(exit);
        x += point.x;
        y += point.y;
      }
      x /= map.exits.length;
      y /= map.exits.length;
      ctx.fillStyle = "#1a120e";
      ctx.fillRect(x - 7, y - 7, 14, 14);
      ctx.fillStyle = "#e6c36a";
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
    return;
  }
  if (map.id === "pasillo" || map.id === "frawens" || map.id === "universal") {
    if (map.id === "frawens" || map.id === "universal") {
      for (const exit of map.exits) {
        ctx.fillStyle = "rgba(230, 195, 106, 0.55)";
        ctx.fillRect(exit.tx * TILE + 3, exit.ty * TILE + 3, 10, 10);
      }
    }
    return;
  }
  for (const door of map.doors) {
    const x = door.tx * TILE;
    const y = door.ty * TILE;
    ctx.fillStyle = "#8a5a28";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#e6c36a";
    ctx.fillRect(x + 3, y + 2, 10, 12);
  }
  for (const exit of map.exits) {
    ctx.fillStyle = "#e6c36a";
    ctx.fillRect(exit.tx * TILE + 2, exit.ty * TILE + 2, 12, 12);
  }
}

function paintCoin(x, y, flying) {
  const bob = flying ? 0 : Math.sin(performance.now() / 180) * 1.2;
  const squash = flying ? 0.75 + Math.abs(Math.sin(performance.now() / 50)) * 0.35 : 1;
  const rx = 5 * squash;
  const ry = 5 / squash;
  ctx.fillStyle = "#1a120e";
  ctx.beginPath();
  ctx.ellipse(x, y + bob, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2d24b";
  ctx.beginPath();
  ctx.ellipse(x, y + bob, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(map) {
  for (const coin of mapCoins(map)) {
    if (!state.coins.has(coin.id)) {
      paintCoin(coin.tx * TILE + 8, coin.ty * TILE + 8, false);
    }
  }
  for (const world of state.worldCoins) {
    if (world.mapId !== map.id || state.coins.has(world.id)) {
      continue;
    }
    paintCoin(world.x, world.y, Boolean(world.toss));
  }
}

const PIXEL = {
  k: "#14110f",
  s: "#e4b898",
  e: "#1c140f",
  b: "#8a5a40",
  h: "#2a1c16",
  m: "#7a3044",
  g: "#5c3a22",
  y: "#c4a574",
  w: "#e6e0d4",
  p: "#2c261f",
  r: "#6a4030",
};

const NPC_SPRITE = [
  "................",
  ".....hhhhhh.....",
  "....hhsssshh....",
  ".....ssssss.....",
  ".....ssssss.....",
  "....rrrrrrrr....",
  "...rrrrrrrrrr...",
  "...rrrrrrrrrr...",
  "....pp..pp......",
  "....kk..kk......",
];

function drawSprite(sprite, left, top, dir, scale = 1) {
  const height = sprite.length;
  const width = sprite[0].length;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const sourceCol = dir === "left" ? width - 1 - col : col;
      const color = PIXEL[sprite[row][sourceCol]];
      if (!color) {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(left + col * scale, top + row * scale, scale, scale);
    }
  }
}

function drawActor(sprite, x, y, dir) {
  const width = sprite[0].length;
  const height = sprite.length;
  drawSprite(sprite, Math.round(x - width / 2), Math.round(y - height + 4), dir, 1);
}

const portraits = {};
for (const character of CHARACTERS) {
  const image = new Image();
  image.src = character.portrait;
  portraits[character.id] = image;
}

function drawPhoto(image, x, y, width, height, flip) {
  if (!image.complete || image.naturalWidth === 0) {
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (flip) {
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(image, Math.round(-width / 2), Math.round(-height), width, height);
  } else {
    ctx.drawImage(image, Math.round(x - width / 2), Math.round(y - height), width, height);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function walkFrame(character, moving, time) {
  const sheet = character.sheet;
  if (!moving) {
    return sheet.idle;
  }
  return sheet.walk[Math.floor(time * 8) % sheet.walk.length];
}

function drawWalkSheet(image, character, feetX, feetY, dir, frame) {
  if (!image.complete || image.naturalWidth === 0) {
    return;
  }
  const { cellW, cellH, foot, dirs, scale } = character.sheet;
  const row = dirs[dir] ?? 0;
  const dw = cellW * scale;
  const dh = cellH * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    frame * cellW,
    row * cellH,
    cellW,
    cellH,
    Math.round(feetX - dw / 2),
    Math.round(feetY - dh + foot * scale),
    dw,
    dh,
  );
}

/** @type {Record<string, HTMLImageElement>} */
const npcPortraits = {};
for (const map of Object.values(MAPS)) {
  for (const npc of map.npcs) {
    if (!npc.portrait || npcPortraits[npc.id]) {
      continue;
    }
    const image = new Image();
    image.src = npc.portrait;
    npcPortraits[npc.id] = image;
  }
}

function drawTalkMark(feetX, feetY, spriteH) {
  const x = Math.round(feetX);
  const y = Math.round(feetY - spriteH - 10 + Math.sin(performance.now() / 220) * 2);
  ctx.fillStyle = BRAND.cyan;
  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BRAND.black;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillText("!", x - 3, y + 1);
}

function drawPeople(map) {
  for (const npc of map.npcs) {
    const point = tileCenter(npc);
    const x = point.x + (npc.ox || 0);
    const y = point.y + (npc.oy || 0);
    if (npc.visible && npc.sheet && npcPortraits[npc.id]) {
      const image = npcPortraits[npc.id];
      const dir = npc.dir || "down";
      drawWalkSheet(image, { sheet: npc.sheet }, x, y + 6, dir, npc.sheet.idle);
      if (!npc.silent && !state.dialogue) {
        const h = npc.sheet.cellH * npc.sheet.scale;
        drawTalkMark(x, y + 6, h);
      }
      continue;
    }
    if (
      map.id === "frawens" ||
      map.id === "tilos" ||
      map.id === "pasillo" ||
      map.id === "universal" ||
      map.id === "moreno" ||
      map.id === "gatos"
    ) {
      continue;
    }
    drawActor(NPC_SPRITE, point.x, point.y, "down");
  }
  const character = player.character;
  const photo = portraits[character.id];
  if (character.sheet) {
    drawWalkSheet(
      photo,
      character,
      player.x,
      player.y + 6,
      player.dir,
      walkFrame(character, player.moving, player.walkTime),
    );
    return;
  }
  const height = 96;
  const width = photo.naturalWidth ? Math.round(height * (photo.naturalWidth / photo.naturalHeight)) : 40;
  drawPhoto(photo, player.x, player.y + 6, width, height, player.dir === "left");
}

function drawSigns(map) {
  if (!map.signs) {
    return;
  }
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = "#f3e6c8";
  for (const sign of map.signs) {
    ctx.fillText(sign.text, sign.tx * TILE, sign.ty * TILE + 10);
  }
}

function drawLabels(map, cam) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = "#f3e6c8";
  if (map.id === "pasillo") {
    return;
  }
  for (const door of map.doors) {
    if (!door.label) {
      continue;
    }
    const x = door.tx === 0 ? 20 : 108;
    ctx.fillText(door.label, x - cam.x, door.ty * TILE + 12 - cam.y);
  }
}

function drawHud() {
  ctx.fillStyle = "#100c0a";
  ctx.fillRect(0, 0, VIEW_W, 18);
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = "#f3e6c8";
  ctx.fillText(state.map.name, 6, 12);
  ctx.fillText(`${coinCount()}/${COIN_TOTAL}`, 202, 12);
  if (nearMorenoExit()) {
    ctx.fillStyle = "rgba(16, 12, 10, 0.88)";
    ctx.fillRect(36, 22, 184, 28);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3e6c8";
    ctx.fillText("Salir por los", VIEW_W / 2, 34);
    ctx.fillText("túneles secretos", VIEW_W / 2, 46);
    ctx.textAlign = "left";
  } else if (!state.dialogue && (nearbyNpc() || atCounter())) {
    ctx.fillText("Hablar", 96, 28);
  }
}

function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function drawDialogue() {
  if (!state.dialogue) {
    return null;
  }
  const last = state.dialogue.index >= state.dialogue.lines.length - 1;
  const showQuiz = Boolean(state.dialogue.quiz && last);
  const optionCount = showQuiz ? state.dialogue.quiz.options.length : 0;
  const boxH = showQuiz ? 40 + optionCount * 24 + 10 : 66;
  const boxY = showQuiz ? Math.max(48, VIEW_H - boxH - 8) : 150;

  ctx.fillStyle = "#1a120e";
  ctx.fillRect(8, boxY, 240, boxH);
  ctx.strokeStyle = BRAND.cyan;
  ctx.strokeRect(8.5, boxY + 0.5, 239, boxH - 1);
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = "#f3e6c8";
  const lines = wrapText(state.dialogue.lines[state.dialogue.index], 220);
  lines.forEach((line, index) => {
    ctx.fillText(line, 16, boxY + 18 + index * 12);
  });

  if (showQuiz) {
    const options = state.dialogue.quiz.options;
    const startY = boxY + 36;
    /** @type {{ kind: string, index: number, x: number, y: number, w: number, h: number }[]} */
    const rects = [];
    options.forEach((option, index) => {
      const y = startY + index * 24;
      ctx.fillStyle = BRAND.orange;
      ctx.fillRect(16, y, 224, 20);
      ctx.fillStyle = BRAND.black;
      ctx.font = '7px "Press Start 2P", monospace';
      const label = wrapText(option, 210)[0];
      ctx.fillText(label, 22, y + 13);
      ctx.font = '8px "Press Start 2P", monospace';
      rects.push({ kind: "quiz", index, x: 16, y, w: 224, h: 20 });
    });
    state.dialogue.choiceRects = rects;
    return { kind: "quiz", rects };
  }

  state.dialogue.choiceRects = null;
  const showTicket = state.dialogue.action === "ticket" && last;
  if (showTicket) {
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(16, 190, 150, 18);
    ctx.fillStyle = "#1a120e";
    ctx.fillText("Sacar entradas", 22, 203);
    return { kind: "ticket", x: 16, y: 190, w: 150, h: 18 };
  }
  if (!last) {
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(150, 190, 90, 18);
    ctx.fillStyle = "#1a120e";
    ctx.fillText("Siguiente", 158, 203);
    return { kind: "next", x: 150, y: 190, w: 90, h: 18 };
  }
  return null;
}

function drawCoverImage(image) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (!iw || !ih) {
    return;
  }
  const scale = Math.max(VIEW_W / iw, VIEW_H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (VIEW_W - dw) / 2;
  const dy = (VIEW_H - dh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = false;
}

function drawTitle() {
  const now = performance.now();
  ctx.fillStyle = BRAND.black;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (TITLE_ART.complete && TITLE_ART.naturalWidth) {
    drawCoverImage(TITLE_ART);
  }

  // Soft pulse over the baked JUGAR so the CTA stays alive
  const pulse = 0.12 + Math.sin(now / 380) * 0.08;
  ctx.fillStyle = `rgba(69, 177, 209, ${pulse})`;
  ctx.fillRect(TITLE_PLAY.x, TITLE_PLAY.y, TITLE_PLAY.w, TITLE_PLAY.h);
}

function characterRect(index) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 4 + col * 84, y: 16 + row * 69, w: 80, h: 66 };
}

function drawSelect() {
  ctx.fillStyle = BRAND.black;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = BRAND.cyan;
  const title = "Elegí integrante";
  ctx.fillText(title, (VIEW_W - ctx.measureText(title).width) / 2, 14);
  CHARACTERS.forEach((character, index) => {
    const rect = characterRect(index);
    ctx.fillStyle = "#101418";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const photo = portraits[character.id];
    if (character.sheet && photo.complete && photo.naturalWidth) {
      const { cellW, cellH, idle, dirs } = character.sheet;
      const turnOrder = ["down", "right", "up", "left"];
      const dirName = turnOrder[Math.floor(performance.now() / 750) % turnOrder.length];
      const row = dirs[dirName] ?? 0;
      const dh = 36;
      const dw = cellW * (dh / cellH);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        photo,
        idle * cellW,
        row * cellH,
        cellW,
        cellH,
        rect.x + (rect.w - dw) / 2,
        rect.y + 2,
        dw,
        dh,
      );
    }
    ctx.strokeStyle = state.hover === index ? BRAND.orange : BRAND.cyanDeep;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    ctx.fillStyle = BRAND.cream;
    const nameWidth = ctx.measureText(character.name).width;
    ctx.fillText(character.name, rect.x + (rect.w - nameWidth) / 2, rect.y + 48);
    ctx.fillStyle = BRAND.cyan;
    const roleWidth = ctx.measureText(character.role).width;
    ctx.fillText(character.role, rect.x + (rect.w - roleWidth) / 2, rect.y + 60);
  });
}

function render() {
  ctx.setTransform(3, 0, 0, 3, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.screen === "title") {
    drawTitle();
    return null;
  }
  if (state.screen === "select") {
    drawSelect();
    return null;
  }

  const cam = camera();
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawFloorAndWalls(state.map);
  drawTilosProps(true);
  drawDoors(state.map);
  drawCoin(state.map);
  drawPeople(state.map);
  drawFrawensBalls();
  drawTilosAwning();
  drawTilosProps(false);
  drawSigns(state.map);
  ctx.restore();
  drawLabels(state.map, cam);
  drawHud();
  ticketRect = drawDialogue();
  return ticketRect;
}

function pointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
  };
}

function hit(rect, point) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function onCanvasPointer(event) {
  const point = pointerPos(event);
  if (state.screen === "title") {
    if (hit(TITLE_PLAY, point)) {
      startMusic();
      state.screen = "select";
    }
    return;
  }
  if (state.screen === "select") {
    CHARACTERS.forEach((character, index) => {
      if (hit(characterRect(index), point)) {
        player.character = character;
        state.map = MAPS.pasillo;
        placePlayer(MAPS.pasillo.spawn);
        state.screen = "play";
      }
    });
    return;
  }
  if (ticketRect?.kind === "quiz" && Array.isArray(ticketRect.rects)) {
    const choice = ticketRect.rects.find((rect) => hit(rect, point));
    if (choice) {
      answerQuiz(choice.index);
    }
    return;
  }
  if (ticketRect && hit(ticketRect, point)) {
    if (ticketRect.kind === "ticket") {
      openTicket();
    } else {
      talk();
    }
    return;
  }
  if (state.dialogue) {
    talk();
  }
}

function onCanvasMove(event) {
  if (state.screen !== "select") {
    state.hover = -1;
    return;
  }
  const point = pointerPos(event);
  state.hover = CHARACTERS.findIndex((_, index) => hit(characterRect(index), point));
}

function bindHold(button, key) {
  const press = (event) => {
    event.preventDefault();
    if (button.setPointerCapture && event.pointerId != null) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
    keys.add(key);
  };
  const release = (event) => {
    event.preventDefault();
    keys.delete(key);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
}

document.querySelectorAll("[data-dir]").forEach((button) => {
  bindHold(button, button.dataset.dir);
});

const talkButton = document.getElementById("talk");
talkButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (state.screen === "title") {
    startMusic();
  }
  talkQueued = true;
});
talkButton.addEventListener("contextmenu", (event) => event.preventDefault());
document.getElementById("touch").addEventListener("selectstart", (event) => {
  event.preventDefault();
});

const KEY_MAP = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
  A: "left",
  D: "right",
  W: "up",
  S: "down",
};

window.addEventListener("keydown", (event) => {
  const key = KEY_MAP[event.key];
  if (key) {
    event.preventDefault();
    keys.add(key);
    return;
  }
  if (event.key === "z" || event.key === "Z" || event.key === "Enter") {
    event.preventDefault();
    if (state.screen === "title") {
      startMusic();
    }
    talkQueued = true;
  }
});

window.addEventListener("keyup", (event) => {
  const key = KEY_MAP[event.key];
  if (key) {
    keys.delete(key);
  }
});

canvas.addEventListener("pointerdown", onCanvasPointer);
canvas.addEventListener("pointermove", onCanvasMove);

let ticketRect = null;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (talkQueued) {
    talkQueued = false;
    if (state.screen === "title") {
      state.screen = "select";
    } else {
      talk();
    }
  }
  move(dt);
  if (state.screen === "play") {
    updateWorldCoin(dt);
    takeCoin();
    checkTransitions();
    checkBoleteria();
    checkJose();
  }
  render();
  requestAnimationFrame(frame);
}

placePlayer(MAPS.pasillo.spawn);
requestAnimationFrame(frame);
