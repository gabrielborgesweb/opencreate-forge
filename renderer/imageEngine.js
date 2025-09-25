const canvas = document.getElementById("mainCanvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;

let scale = 1;
let originX = 0;
let originY = 0;
let isPanning = false;
let startX, startY;
let currentImage = null;

// --------- DRAW ---------
function draw() {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY);
  ctx.clearRect(
    -originX / scale,
    -originY / scale,
    canvas.width / scale,
    canvas.height / scale
  );
  if (currentImage) ctx.drawImage(currentImage, 0, 0);
  ctx.restore();
}

// --------- LOAD IMAGE ---------
function loadImage(filePath) {
  const img = new Image();
  img.onload = () => {
    currentImage = img;
    scale = 1;
    originX = 0;
    originY = 0;
    draw();
  };
  img.src = filePath;
}

// --------- ZOOM & PAN (touchpad + mouse) ---------
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  // Trackpad pinch (ctrlKey=true) OU mouse + Ctrl/Cmd pressionado
  if (e.ctrlKey || e.metaKey) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);

    originX = mouseX - (mouseX - originX) * (newScale / scale);
    originY = mouseY - (mouseY - originY) * (newScale / scale);

    scale = newScale;
    draw();
  } else {
    // Dois dedos no trackpad → PAN
    originX -= e.deltaX;
    originY -= e.deltaY;
    draw();
  }
});

// --------- PAN (mouse botão do meio) ---------
canvas.addEventListener("mousedown", (e) => {
  // Botão do meio (e.button === 1)
  if (e.button === 1) {
    isPanning = true;
    startX = e.clientX - originX;
    startY = e.clientY - originY;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isPanning) return;
  originX = e.clientX - startX;
  originY = e.clientY - startY;
  draw();
});

canvas.addEventListener("mouseup", () => (isPanning = false));
canvas.addEventListener("mouseleave", () => (isPanning = false));
