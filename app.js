const player = document.getElementById("player");
const step = 12;
let x = 0;
let y = 0;

function move(key) {
  switch (key.toLowerCase()) {
    case "arrowup":
    case "w":
      y -= step;
      break;
    case "arrowdown":
    case "s":
      y += step;
      break;
    case "arrowleft":
    case "a":
      x -= step;
      break;
    case "arrowright":
    case "d":
      x += step;
      break;
    default:
      return;
  }

  const size = 36;
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (x > width) x = -size;
  if (x < -size) x = width;
  if (y > height) y = -size;
  if (y < -size) y = height;

  player.style.left = x + "px";
  player.style.top = y + "px";
}

function start() {
  x = Math.round((window.innerWidth - 36) / 2);
  y = Math.round((window.innerHeight - 36) / 2);
  player.style.left = x + "px";
  player.style.top = y + "px";
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
  move(event.key);
});

window.addEventListener("resize", start);
start();
