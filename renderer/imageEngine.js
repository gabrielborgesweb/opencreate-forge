// renderer/imageEngine.js

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
