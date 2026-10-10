const player = document.getElementById("player");
const keys = new Set();
const speed = 300;
const size = 36;

let x = 0;
let y = 0;
let lastTime = 0;

function draw() {
  player.style.left = x + "px";
  player.style.top = y + "px";
}

function start() {
  x = (window.innerWidth - size) / 2;
  y = (window.innerHeight - size) / 2;
  draw();
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
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
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

  x += dx * speed * dt;
  y += dy * speed * dt;

  if (x > window.innerWidth) x = -size;
  if (x < -size) x = window.innerWidth;
  if (y > window.innerHeight) y = -size;
  if (y < -size) y = window.innerHeight;

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", start);
start();
requestAnimationFrame(loop);
