// renderer/imageEngine.js

const canvas = document.getElementById("mainCanvas");
const ctx = canvas.getContext("2d");

canvas.width = canvas.parentElement.clientWidth;
canvas.height = canvas.parentElement.clientHeight;

// Transformações globais
let scale = 1;
let originX = 0;
let originY = 0;
let isPanning = false;
let startX, startY;

// Gestão de camadas
let layers = [];
let activeLayer = null;

// --------- DRAW TODAS AS CAMADAS ---------
function draw() {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY);
  ctx.clearRect(
    -originX / scale,
    -originY / scale,
    canvas.width / scale,
    canvas.height / scale
  );

  for (let layer of layers) {
    if (!layer.visible) continue;
    ctx.drawImage(layer.image, layer.x, layer.y);

    if (layer === activeLayer) {
      ctx.strokeStyle = "rgba(0, 120, 255, 0.8)";
      ctx.lineWidth = 2 / scale;
      ctx.strokeRect(layer.x, layer.y, layer.image.width, layer.image.height);
    }
  }

  ctx.restore();
}

// --------- ADICIONAR CAMADA ---------
function addLayer(img, name = "Layer") {
  const newLayer = {
    id: Date.now(),
    name,
    image: img,
    x: 0,
    y: 0,
    visible: true,
  };
  layers.push(newLayer);
  setActiveLayer(newLayer);
  updateLayersPanel();
  draw();
}

// --------- LOAD IMAGE EM UMA CAMADA ---------
function loadImage(filePath) {
  const img = new Image();
  img.onload = () => {
    addLayer(img, filePath.split("/").pop());
  };
  img.onerror = () => console.error("Erro ao carregar imagem:", filePath);
  img.src = filePath;
}

// --------- DEFINIR CAMADA ATIVA ---------
function setActiveLayer(layer) {
  activeLayer = layer;
  updateLayersPanel();
  draw();
}

// --------- ATUALIZAR PAINEL DE CAMADAS ---------
function updateLayersPanel() {
  const list = document.getElementById("layersList");
  if (!list) return;
  list.innerHTML = "";
  layers.forEach((layer) => {
    const div = document.createElement("div");
    div.className = "layer-item";
    div.textContent = layer.name;
    if (layer === activeLayer) div.style.background = "#555";
    div.onclick = () => setActiveLayer(layer);
    list.appendChild(div);
  });
}

// --------- MOVER CAMADA COM MOVE TOOL ---------
let isDraggingLayer = false;
let dragOffsetX, dragOffsetY;

canvas.addEventListener("mousedown", (e) => {
  const moveToolActive = document
    .getElementById("moveTool")
    .hasAttribute("active");

  if (moveToolActive && activeLayer) {
    const mx = (e.offsetX - originX) / scale;
    const my = (e.offsetY - originY) / scale;

    if (
      mx >= activeLayer.x &&
      mx <= activeLayer.x + activeLayer.image.width &&
      my >= activeLayer.y &&
      my <= activeLayer.y + activeLayer.image.height
    ) {
      isDraggingLayer = true;
      dragOffsetX = mx - activeLayer.x;
      dragOffsetY = my - activeLayer.y;
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDraggingLayer || !activeLayer) return;
  const mx = (e.offsetX - originX) / scale;
  const my = (e.offsetY - originY) / scale;

  activeLayer.x = mx - dragOffsetX;
  activeLayer.y = my - dragOffsetY;
  draw();
});

canvas.addEventListener("mouseup", () => (isDraggingLayer = false));
canvas.addEventListener("mouseleave", () => (isDraggingLayer = false));
