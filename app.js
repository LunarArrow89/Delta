const player = document.getElementById("player");
const game = document.getElementById("game");
const keys = new Set();
const speed = 300;
const size = 36;

let x = 0;
let y = 0;
let lastTime = 0;

function draw() {
  // Use transforms so Chrome can move the square without relaying out the page.
  player.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function start() {
  const bounds = game.getBoundingClientRect();
  x = Math.max(0, (bounds.width - size) / 2);
  y = Math.max(0, (bounds.height - size) / 2);
  draw();
}

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

window.addEventListener("blur", () => keys.clear());

document.addEventListener("visibilitychange", () => {
  keys.clear();
  lastTime = 0;
});

function loop(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
  lastTime = time;

  let dx = 0;
  let dy = 0;

  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;

  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  const bounds = game.getBoundingClientRect();
  x = Math.max(0, Math.min(x + dx * speed * dt, bounds.width - size));
  y = Math.max(0, Math.min(y + dy * speed * dt, bounds.height - size));

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", start);
start();
requestAnimationFrame(loop);
