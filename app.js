
const screen = document.getElementById("game-screen");
const player = document.getElementById("player");

const speed = 150; // Pixels per second
let x = 0;
let previousTime = 0;

function animate(time) {
  if (previousTime === 0) {
    previousTime = time;
  }

  const deltaTime = Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;

  const screenWidth = screen.clientWidth;
  const squareWidth = player.offsetWidth;

  x += speed * deltaTime;

  // Loop back to the left when the square leaves the screen.
  if (x >= screenWidth) {
    x = -squareWidth;
  }

  player.style.left = `${x}px`;

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// Keep the square inside the correct coordinate range after resizing.
window.addEventListener("resize", () => {
  x = Math.min(x, screen.clientWidth);
});
