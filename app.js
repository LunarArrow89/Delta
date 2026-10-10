const game = document.getElementById("game");
const player = document.getElementById("player");

const keys = new Set();
const speed = 240;

let x = 0;
let y = 0;
let previousTime = 0;

const movementKeys = new Set([
  "w", "a", "s", "d",
  "arrowup", "arrowdown", "arrowleft", "arrowright"
]);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (movementKeys.has(key)) {
    event.preventDefault();
    keys.add(key);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
});

function drawPlayer() {
  player.style.left = x + "px";
  player.style.top = y + "px";
}

function resizeGame() {
  x = Math.max(0, Math.min(x, game.clientWidth - player.offsetWidth));
  y = Math.max(0, Math.min(y, game.clientHeight - player.offsetHeight));
  drawPlayer();
}

function update(time) {
  if (previousTime === 0) previousTime = time;

  const deltaTime = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;

  let dx = 0;
  let dy = 0;

  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  x += dx * speed * deltaTime;
  y += dy * speed * deltaTime;

  const width = game.clientWidth;
  const height = game.clientHeight;
  const size = player.offsetWidth;

  // Walk completely off one edge to appear on the opposite edge.
  if (x + size < 0) x = width;
  else if (x > width) x = -size;

  if (y + size < 0) y = height;
  else if (y > height) y = -size;

  drawPlayer();
  requestAnimationFrame(update);
}

function startGame() {
  x = (game.clientWidth - player.offsetWidth) / 2;
  y = (game.clientHeight - player.offsetHeight) / 2;
  drawPlayer();
  requestAnimationFrame(update);
}

window.addEventListener("resize", resizeGame);
startGame();
