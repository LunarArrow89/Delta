const game = document.getElementById("game");
const player = document.getElementById("player");

const keys = new Set();
const speed = 240;
const playerSize = 36;

let x = 0;
let y = 0;
let lastTime = 0;

function resize() {
  x = Math.max(0, Math.min(x, window.innerWidth - playerSize));
  y = Math.max(0, Math.min(y, window.innerHeight - playerSize));
  draw();
}

function draw() {
  player.style.transform = `translate(${x}px, ${y}px)`;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) keys.clear();
});

function loop(time) {
  if (!lastTime) lastTime = time;
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  let dx = 0;
  let dy = 0;

  if (keys.has("a") || keys.has("arrowleft")) dx--;
  if (keys.has("d") || keys.has("arrowright")) dx++;
  if (keys.has("w") || keys.has("arrowup")) dy--;
  if (keys.has("s") || keys.has("arrowdown")) dy++;

  if (dx && dy) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  x += dx * speed * dt;
  y += dy * speed * dt;

  if (x > window.innerWidth) x = -playerSize;
  if (x < -playerSize) x = window.innerWidth;
  if (y > window.innerHeight) y = -playerSize;
  if (y < -playerSize) y = window.innerHeight;

  draw();
  requestAnimationFrame(loop);
}

function start() {
  x = (window.innerWidth - playerSize) / 2;
  y = (window.innerHeight - playerSize) / 2;
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);
start();
