// renderer/imageEngine.js
const ZOOM_SENSITIVITY = 0.05; // 0.1 = 10% por scroll (aumente ou diminua)

const canvas = document.getElementById("mainCanvas");
const container = canvas.parentElement;
const ctx = canvas.getContext("2d");

// --- Transform / view ---
let scale = 1;
let originX = 0; // screen translation for project origin: screenX = projectX*scale + originX
let originY = 0;
let isPanning = false;
let startX = 0,
  startY = 0;

// --- Project (separate from viewport) ---
let projectWidth = undefined; // undefined = no project yet
let projectHeight = undefined;

// --- Layers ---
let layers = []; // { id, name, image (HTMLImageElement), x, y, visible }
let activeLayer = null;

// helpers
function uid() {
  return Date.now() + "-" + Math.floor(Math.random() * 10000);
}

let checkerPattern = null;
function getCheckerPattern() {
  if (!checkerPattern) {
    const size = 10;
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = size * 2;
    patternCanvas.height = size * 2;
    const pctx = patternCanvas.getContext("2d");

    pctx.fillStyle = "#333";
    pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

    pctx.fillStyle = "#444";
    pctx.fillRect(0, 0, size, size);
    pctx.fillRect(size, size, size, size);

    checkerPattern = ctx.createPattern(patternCanvas, "repeat");
  }
  return checkerPattern;
}

// ajusta canvas para ocupar o viewport (em CSS pixels)
function resizeViewport() {
  const oldW = canvas.width || 0;
  const oldH = canvas.height || 0;

  canvas.width = container.clientWidth;
  canvas.height =
    container.clientHeight -
    document.getElementById("projectsTabs").clientHeight;
  canvas.style.width = container.clientWidth + "px";
  canvas.style.height =
    container.clientHeight -
    document.getElementById("projectsTabs").clientHeight +
    "px";

  // manter a mesma posição visual do centro do projeto ao redimensionar
  originX += (canvas.width - oldW) / 2;
  originY += (canvas.height - oldH) / 2;

  draw();
}
window.addEventListener("resize", resizeViewport);
resizeViewport(); // inicializa

// --------- DRAW: desenha o viewport, mostrando apenas a área do projeto desenhada nas coordenadas certas ---------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!projectWidth || !projectHeight) return;

  // --- desenhar checkerboard em coords de tela (não escala) ---
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

  // calcular área do projeto em coords de tela
  const projectXOnScreen = originX;
  const projectYOnScreen = originY;
  const projectWOnScreen = projectWidth * scale;
  const projectHOnScreen = projectHeight * scale;

  ctx.fillStyle = getCheckerPattern();
  ctx.fillRect(
    projectXOnScreen,
    projectYOnScreen,
    projectWOnScreen,
    projectHOnScreen
  );

  ctx.restore();

  // --- desenhar camadas e bordas em coords do projeto ---
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY);

  for (let layer of layers) {
    if (!layer.visible) continue;
    ctx.drawImage(layer.image, layer.x, layer.y);
  }

  // sombra (box shadow)
  // ctx.shadowColor = "rgba(0,0,0,1)"; // cor da sombra
  // ctx.shadowBlur = 4; // intensidade do blur
  // ctx.shadowSpread = 8; // espalhamento
  // ctx.shadowOffsetX = 0; // deslocamento horizontal
  // ctx.shadowOffsetY = 4; // deslocamento vertical

  // stroke
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2 / Math.max(scale, 1);
  ctx.strokeRect(0, 0, projectWidth, projectHeight);

  if (activeLayer) {
    ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
    ctx.lineWidth = 2 / Math.max(scale, 1);
    ctx.strokeRect(
      activeLayer.x,
      activeLayer.y,
      activeLayer.image.width,
      activeLayer.image.height
    );
  }

  for (let layer of layers) {
    if (!layer.visible) continue;
    // Draw either temp canvas during stroke or regular image
    if (layer === activeLayer && layer.tempCanvas) {
      ctx.drawImage(layer.tempCanvas, layer.x, layer.y);
    } else {
      ctx.drawImage(layer.image, layer.x, layer.y);
    }
  }

  // const currentTab = projectsTabs.querySelectorAll("button.active")[0];
  // // atualiza o layers do projects (para o caso de mudanças fora do draw)
  // if (typeof projects !== "undefined" && typeof currentTab !== "undefined") {
  //   const project = projects.find((p) => p.id === currentTab.id);
  //   console.log("Projects array:", projects);
  //   console.log("Active tab:", currentTab);
  //   console.log("Updating project layers:", project);
  //   console.log("Current layers:", layers);
  //   if (project) {
  //     project.layers = layers;
  //   }
  // }

  ctx.restore();

  // zoom overlay
  const zoomEl = document.getElementById("zoomScale");
  if (zoomEl) {
    zoomEl.textContent = Math.round(scale * 100) + "%";
  }
}

// --------- UTIL: converte coordenadas de evento -> coords do projeto ---------
function screenToProject(screenX, screenY) {
  // screenX/screenY: coordenadas em pixels relativos ao canvas (mouse offsetX/offsetY)
  const px = (screenX - originX) / scale;
  const py = (screenY - originY) / scale;
  return { x: px, y: py };
}

// --------- CREATE NEW PROJECT ---------
function createNewProject(w, h) {
  projectWidth = Math.max(1, Math.floor(w));
  projectHeight = Math.max(1, Math.floor(h));

  // limpar camadas
  layers = [];
  activeLayer = null;
  updateLayersPanel();
  fitToScreen();

  // centralizar projeto na viewport
  // scale = 1;
  // originX = Math.round((canvas.width - projectWidth * scale) / 2);
  // originY = Math.round((canvas.height - projectHeight * scale) / 2);

  draw();
  saveState();
  console.log(`Novo projeto: ${projectWidth}x${projectHeight}`);
}

// --------- ADD LAYER (from image) ---------
function addLayer(img, name = "Layer") {
  // posicionar no centro do projeto por padrão
  const lx = Math.round((projectWidth - img.width) / 2);
  const ly = Math.round((projectHeight - img.height) / 2);
  const newLayer = {
    id: uid(),
    name,
    image: img,
    x: lx,
    y: ly,
    visible: true,
  };
  layers.push(newLayer);
  setActiveLayer(newLayer.id);
  updateLayersPanel();
  saveState();
  draw();
}

// --------- CREATE EMPTY LAYER ---------
function createEmptyLayer(w, h, name = "Empty Layer") {
  const canvas = document.createElement("canvas");
  canvas.width = projectWidth; // Use project dimensions instead of passed w,h
  canvas.height = projectHeight;

  // Initialize with transparent background
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  img.onload = () => {
    addLayer(img, name);
  };
  img.src = canvas.toDataURL();
}

// --------- LOAD IMAGE (filePath from main) -> cria uma camada ---------
function loadImage(filePath) {
  const img = new Image();
  img.onload = () => {
    addLayer(img, filePath.split("/").pop());
  };
  img.onerror = () => console.error("Erro ao carregar imagem:", filePath);
  img.src = filePath;
}

// --------- Set active layer by id ---------
function setActiveLayer(id) {
  const layer = layers.find((l) => l.id === id);
  activeLayer = layer || null;
  updateLayersPanel();
  draw();
}

// Undo/redo stacks
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

function saveState() {
  const state = {
    layers: layers.map((l) => ({ ...l, image: l.image.src })),
    activeLayer: activeLayer ? activeLayer.id : null,
  };
  console.log("Saving state for undo:", state);

  undoStack.push(state);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0; // Clear redo stack when new action is performed
}

function undo() {
  if (undoStack.length <= 1) return;
  const prevState = undoStack.pop();
  redoStack.push(prevState);
  const newState = undoStack[undoStack.length - 1];
  restoreState(newState);
  draw();
}

function redo() {
  if (redoStack.length === 0) return;
  const nextState = redoStack.pop();
  undoStack.push(nextState);
  restoreState(nextState);
  draw();
}

function restoreState(state) {
  layers = state.layers.map((l) => ({
    ...l,
    image: (() => {
      const img = new Image();
      img.src = l.image;
      return img;
    })(),
  }));
  activeLayer = state.activeLayer
    ? layers.find((l) => l.id === state.activeLayer)
    : null;
  updateLayersPanel();
  draw();
}

// Enhance layer panel
function updateLayersPanel() {
  const list = document.getElementById("layersList");
  if (!list) return;
  list.innerHTML = "";

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const div = document.createElement("div");
    div.className = "layer-item";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.padding = "6px";
    div.style.background = layer === activeLayer ? "#555" : "transparent";

    // Visibility toggle
    const visibilityBtn = document.createElement("button");
    visibilityBtn.innerHTML = layer.visible ? "👁" : "👁‍🗨";
    visibilityBtn.style.marginRight = "8px";
    visibilityBtn.onclick = (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      saveState();
      updateLayersPanel();
      draw();
    };

    // Layer name
    const name = document.createElement("span");
    name.textContent = layer.name;
    name.style.flex = "1";

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      layers = layers.filter((l) => l.id !== layer.id);
      if (activeLayer === layer) {
        activeLayer = layers[layers.length - 1] || null;
      }
      saveState();
      updateLayersPanel();
      draw();
    };

    div.append(visibilityBtn, name, deleteBtn);
    div.onclick = () => setActiveLayer(layer.id);
    list.appendChild(div);
  }
}

// --------- EXPORT (render all layers to an offscreen canvas sized to project) ---------
function exportImage() {
  if (!projectWidth || !projectHeight) {
    // fallback: export viewport (not recommended)
    return canvas.toDataURL("image/png");
  }
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = projectWidth;
  exportCanvas.height = projectHeight;
  const ectx = exportCanvas.getContext("2d");

  // limpar (transparente)
  ectx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

  // desenhar cada layer (em ordem)
  for (let layer of layers) {
    if (!layer.visible) continue;
    ectx.drawImage(layer.image, layer.x, layer.y);
  }

  return exportCanvas.toDataURL("image/png");
}

// --------- ZOOM & PAN (wheel + middle mouse pan + trackpad heuristics) ---------

// wheel: ctrl/meta (pinch or cmd/ctrl + scroll) => zoom; otherwise delta => pan (trackpad two-finger)
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    // if ctrl/meta pressed => zoom
    if (e.ctrlKey || e.metaKey) {
      // focal point (screen)
      const mx = e.offsetX;
      const my = e.offsetY;
      const zoomFactor =
        e.deltaY < 0 ? 1 + ZOOM_SENSITIVITY : 1 - ZOOM_SENSITIVITY;
      const newScale = Math.min(Math.max(scale * zoomFactor, 0.05), 50);

      // keep mouse point stable
      originX = mx - (mx - originX) * (newScale / scale);
      originY = my - (my - originY) * (newScale / scale);

      scale = newScale;
      draw();
    } else {
      // pan (trackpad two-finger) — deltaX, deltaY in screen pixels
      originX -= e.deltaX;
      originY -= e.deltaY;
      draw();
    }
  },
  { passive: false }
);

// middle-button drag = pan view
canvas.addEventListener("mousedown", (e) => {
  // botão do meio = 1
  if (e.button === 1) {
    isPanning = true;
    startX = e.clientX - originX;
    startY = e.clientY - originY;
    e.preventDefault();
    return;
  }

  const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);

  // Handle brush tool
  if (
    document.getElementById("brushTool").hasAttribute("active") &&
    activeLayer &&
    e.button === 0
  ) {
    isDrawing = true;
    drawBrushStroke(px, py);
    return;
  }

  // Handle move tool
  if (
    document.getElementById("moveTool").hasAttribute("active") &&
    activeLayer &&
    e.button === 0
  ) {
    if (
      px >= activeLayer.x &&
      px <= activeLayer.x + activeLayer.image.width &&
      py >= activeLayer.y &&
      py <= activeLayer.y + activeLayer.image.height
    ) {
      draggingLayerState.isDragging = true;
      draggingLayerState.offsetX = px - activeLayer.x;
      draggingLayerState.offsetY = py - activeLayer.y;
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  // pan com middle button
  if (isPanning) {
    originX = e.clientX - startX;
    originY = e.clientY - startY;
    draw();
    return;
  } else if (isDrawing && activeLayer) {
    const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
    drawBrushStroke(px, py);
  }
  // arrastar camada
  if (draggingLayerState.isDragging && activeLayer) {
    const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
    activeLayer.x = px - draggingLayerState.offsetX;
    activeLayer.y = py - draggingLayerState.offsetY;
    draw();
    return;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 1) {
    isPanning = false;
  }
  if (isDrawing && activeLayer) {
    isDrawing = false;

    if (strokeCanvas) {
      const img = new Image();
      img.onload = () => {
        activeLayer.image = img;
        activeLayer.tempCanvas = null;
        strokeCanvas = null;
        strokeStartBounds = null;
        saveState();
        draw();
      };
      img.src = strokeCanvas.toDataURL();
    }

    // saveState(); // Save for undo/redo after stroke
  }
  // Save state if we were dragging a layer
  if (draggingLayerState.isDragging) {
    saveState(); // Save for undo/redo after moving layer
    draggingLayerState.isDragging = false;
  }
});

canvas.addEventListener("mouseleave", () => {
  isPanning = false;
  draggingLayerState.isDragging = false;

  if (isDrawing) {
    isDrawing = false;
    strokeCanvas = null;
    strokeStartBounds = null;
    activeLayer.tempCanvas = null;
    draw();
  }
});

// state for layer dragging
const draggingLayerState = {
  isDragging: false,
  offsetX: 0,
  offsetY: 0,
};

function fitToScreen() {
  if (!projectWidth || !projectHeight) return;

  const viewW = canvas.width;
  const viewH = canvas.height;

  // fator de escala mínimo para caber em width/height
  const scaleX = viewW / projectWidth;
  const scaleY = viewH / projectHeight;
  scale = Math.min(scaleX, scaleY) * 0.9; // 90% para dar uma margem

  // centralizar
  originX = (viewW - projectWidth * scale) / 2;
  originY = (viewH - projectHeight * scale) / 2;

  draw();
}
// fitToScreen();

// ensure canvas is transparent so checkerboard of container shows through
canvas.style.background = "transparent";
draw();

// -------- RESETAR VIEWPORT PARA HOMEPAGE-TAB ---------

function resetViewport() {
  projectWidth = undefined;
  projectHeight = undefined;
  layers = [];
  activeLayer = null;
  scale = 1;
  originX = canvas.width / 2;
  originY = canvas.height / 2;
  updateLayersPanel();
  draw();
}

// --------- AO TROCAR PARA A ABA DO PROJETO ---------

// Mudar a assinatura para aceitar o estado do viewport salvo
function setProject(w, h, projLayers, viewportState = {}) {
  projectWidth = w;
  projectHeight = h;
  layers = projLayers.map((l) => ({
    ...l,
    image: (() => {
      const img = new Image();
      img.src = l.image.src; // assume que l.image é um HTMLImageElement ou similar
      return img;
    })(),
  }));
  activeLayer = layers.length > 0 ? layers[0] : null;
  updateLayersPanel();

  // --- NOVO: Aplicar estado do viewport ou re-ajustar ---
  if (viewportState.scale) {
    scale = viewportState.scale;
    originX = viewportState.originX;
    originY = viewportState.originY;
  } else {
    // Se não há estado salvo, ajusta a tela como era antes (e.g., primeira vez)
    fitToScreen();
  }
  // ----------------------------------------------------

  draw();
}

// --------- BRUSH TOOL ---------
let isDrawing = false;
let brushColor = "#000000";
let brushSize = 5;
let strokeCanvas = null;
let strokeStartBounds = null;

function drawBrushStroke(x, y) {
  if (
    !activeLayer ||
    !document.getElementById("brushTool").hasAttribute("active")
  ) {
    return;
  }

  const localX = x - activeLayer.x;
  const localY = y - activeLayer.y;

  if (isDrawing) {
    // Start new stroke - initialize bounds tracking
    strokeStartBounds = {
      minX: activeLayer.x,
      minY: activeLayer.y,
      maxX: activeLayer.x + activeLayer.image.width,
      maxY: activeLayer.y + activeLayer.image.height,
    };
  }

  // Track expanded bounds including current stroke
  const strokeRadius = brushSize / 2;
  strokeStartBounds.minX = Math.min(strokeStartBounds.minX, x - strokeRadius);
  strokeStartBounds.minY = Math.min(strokeStartBounds.minY, y - strokeRadius);
  strokeStartBounds.maxX = Math.max(strokeStartBounds.maxX, x + strokeRadius);
  strokeStartBounds.maxY = Math.max(strokeStartBounds.maxY, y + strokeRadius);

  // Calculate new dimensions and offset
  const newWidth = Math.ceil(strokeStartBounds.maxX - strokeStartBounds.minX);
  const newHeight = Math.ceil(strokeStartBounds.maxY - strokeStartBounds.minY);
  const offsetX = activeLayer.x - strokeStartBounds.minX;
  const offsetY = activeLayer.y - strokeStartBounds.minY;

  // Create or resize stroke canvas
  if (!strokeCanvas) {
    strokeCanvas = document.createElement("canvas");
    const ctx = strokeCanvas.getContext("2d");

    // Set new dimensions
    strokeCanvas.width = newWidth;
    strokeCanvas.height = newHeight;

    // Copy existing layer content to new position
    ctx.drawImage(activeLayer.image, offsetX, offsetY);
  }

  // Ensure stroke canvas is large enough
  if (strokeCanvas.width < newWidth || strokeCanvas.height < newHeight) {
    const oldCanvas = strokeCanvas;
    strokeCanvas = document.createElement("canvas");
    strokeCanvas.width = newWidth;
    strokeCanvas.height = newHeight;

    // Copy existing content
    const ctx = strokeCanvas.getContext("2d");
    ctx.drawImage(oldCanvas, 0, 0);
  }

  // Draw new stroke
  const ctx = strokeCanvas.getContext("2d");
  ctx.fillStyle = brushColor;
  ctx.beginPath();
  ctx.arc(
    x - strokeStartBounds.minX,
    y - strokeStartBounds.minY,
    strokeRadius,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Update layer position and temporary canvas
  activeLayer.x = strokeStartBounds.minX;
  activeLayer.y = strokeStartBounds.minY;
  activeLayer.tempCanvas = strokeCanvas;

  draw();
}

// expose API to global (app.js will call these)
window.ImageEngine = {
  loadImage,
  addLayer,
  createNewProject,
  setActiveLayer,
  exportImage,
  draw,
  resetViewport,
  setProject,
  getState: () => ({
    projectWidth,
    projectHeight,
    layers,
    activeLayer,
    scale,
    originX,
    originY,
  }),
  undo,
  redo,
  createEmptyLayer,
  setBrushColor: (color) => {
    brushColor = color;
  },
  setBrushSize: (size) => {
    brushSize = Math.max(1, size);
  },
};
