// renderer/imageEngine.js
const ZOOM_SENSITIVITY = 0.01; // 0.01 = 1% por scroll (aumente ou diminua)
let currentScale = 1;
let targetScale = 1;
const ZOOM_SMOOTHING = 0.15; // Controls how smooth the zoom animation is

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

let activeToolId = "moveTool"; // Ferramenta ativa por padrão
const tools = {
  brushTool: {
    size: 50,
    color: "#000000",
    hardness: 1.0,
  },
  eraserTool: {
    size: 100,
    hardness: 1.0,
  },
  // Outras ferramentas podem ser adicionadas aqui
  moveTool: {},
  selectTool: {},
};

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

  // Desenha as camadas
  for (let layer of layers) {
    if (!layer.visible) continue;
    // Não desenha a camada ativa se estivermos no meio de um traço,
    // pois o strokeCanvas a substituirá visualmente.
    if (layer === activeLayer && isDrawing) {
      continue;
    }
    ctx.drawImage(layer.image, layer.x, layer.y);
  }

  // NOVO: Desenha o canvas do traço em andamento sobre tudo
  if (isDrawing && strokeCanvas) {
    // AQUI ESTÁ A MUDANÇA: desenha o canvas na sua posição de origem correta
    ctx.drawImage(strokeCanvas, strokeOriginX, strokeOriginY);
  }

  // Desenha a borda do projeto
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2 / Math.max(scale, 1);
  ctx.strokeRect(0, 0, projectWidth, projectHeight);

  // Desenha a borda de seleção da camada ativa
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

  ctx.restore();

  if (scale > 1.0) {
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.imageSmoothingEnabled = true;
  }

  // desenhar grid se zoom >= 500%
  function shouldShowGrid() {
    return scale >= 5; // 500%
  }

  // desenha grid 1px x 1px
  function drawGrid() {
    const gridSize = 1; // 1px grid

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, originX, originY);

    ctx.beginPath();
    ctx.strokeStyle = "rgba(128,128,128,0.2)";
    ctx.lineWidth = 1 / scale;

    // Vertical lines
    for (let x = 0; x <= projectWidth; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, projectHeight);
    }

    // Horizontal lines
    for (let y = 0; y <= projectHeight; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(projectWidth, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  if (shouldShowGrid()) {
    drawGrid();
  }

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
function createEmptyLayer(name = "Empty Layer") {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  const img = new Image();
  img.onload = () => {
    const newLayer = {
      id: uid(),
      name,
      image: img,
      x: 0, // Posicionar no canto para consistência com camadas apagadas
      y: 0,
      visible: true,
    };
    layers.push(newLayer);
    setActiveLayer(newLayer.id);
    updateLayersPanel();
    saveState();
    draw();
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
  const promises = state.layers.map(
    (l) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...l, image: img });
        img.src = l.image;
      })
  );

  Promise.all(promises).then((loadedLayers) => {
    layers = loadedLayers;
    activeLayer = state.activeLayer
      ? layers.find((l) => l.id === state.activeLayer)
      : null;
    updateLayersPanel();
    draw();
  });
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

    if (e.ctrlKey || e.metaKey) {
      // Focal point (screen coords)
      const mx = e.offsetX;
      const my = e.offsetY;

      // Normalize wheel delta
      const wheelDelta = -e.deltaY;
      const normalizedDelta =
        Math.sign(wheelDelta) *
        Math.min(Math.abs(wheelDelta * ZOOM_SENSITIVITY), 0.5);

      // Calculate target scale with momentum
      const zoomFactor = Math.exp(normalizedDelta);
      targetScale = Math.min(Math.max(scale * zoomFactor, 0.05), 50);

      // Smoothly animate to target scale
      const scaleChange = (targetScale - scale) * ZOOM_SMOOTHING;
      const newScale = scale + scaleChange;

      // Update origin to keep mouse point stable
      originX = mx - (mx - originX) * (newScale / scale);
      originY = my - (my - originY) * (newScale / scale);

      scale = newScale;

      // Disable image smoothing at high zoom levels
      ctx.imageSmoothingEnabled = scale <= 1.0;

      draw();

      // Request another frame if still animating
      if (Math.abs(targetScale - scale) > 0.001) {
        requestAnimationFrame(() => {
          const evt = new WheelEvent("wheel", {
            deltaY: 0,
            ctrlKey: true,
            metaKey: true,
          });
          canvas.dispatchEvent(evt);
        });
      }
    } else {
      // Pan behavior remains the same
      originX -= e.deltaX;
      originY -= e.deltaY;
      draw();
    }
  },
  { passive: false }
);

// REMOVA OS LISTENERS ANTIGOS (mousedown, mousemove, mouseup, mouseleave) DO CANVAS E SUBSTITUA POR ESTE BLOCO

// --- Novas funções de manipulação de eventos de desenho ---

function startDrawing(e) {
  // const isBrushActive = document.getElementById("brushTool").hasAttribute("active"); // <-- REMOVER
  // const isEraserActive = document.getElementById("eraserTool").hasAttribute("active"); // <-- REMOVER

  const isDrawableTool =
    activeToolId === "brushTool" || activeToolId === "eraserTool";

  if (e.button !== 0 || !activeLayer || !isDrawableTool) {
    return;
  }

  isDrawing = true;

  // Calcula a origem e o tamanho do canvas de pintura expandido
  strokeOriginX = activeLayer.x - STROKE_PADDING;
  strokeOriginY = activeLayer.y - STROKE_PADDING;
  const strokeWidth = activeLayer.image.width + STROKE_PADDING * 2;
  const strokeHeight = activeLayer.image.height + STROKE_PADDING * 2;

  // Cria o canvas temporário
  strokeCanvas = document.createElement("canvas");
  strokeCanvas.width = strokeWidth;
  strokeCanvas.height = strokeHeight;
  const strokeCtx = strokeCanvas.getContext("2d");

  // Copia a imagem da camada ativa para o centro do nosso canvas expandido
  strokeCtx.drawImage(activeLayer.image, STROKE_PADDING, STROKE_PADDING);

  // Pega a posição inicial do mouse em coordenadas do projeto
  const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
  lastX = px;
  lastY = py;

  const toolOptions = tools[activeToolId];
  const hardness =
    typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;
  const effectiveSize = toolOptions.size * (1 + (1 - hardness) * 0.5);
  const pad = effectiveSize / 2;
  currentStrokeBounds = {
    minX: px - pad,
    minY: py - pad,
    maxX: px + pad,
    maxY: py + pad,
  };

  // Inicia o traço
  drawBrushStroke(px, py);

  // Anexa os listeners à JANELA para capturar o movimento/clique em qualquer lugar
  window.addEventListener("mousemove", processDrawing);
  window.addEventListener("mouseup", stopDrawing, { once: true }); // { once: true } remove o listener após ser chamado
}

function processDrawing(e) {
  if (!isDrawing) return;

  // Precisamos converter as coordenadas do cliente (window) para coordenadas do canvas
  const canvasRect = canvas.getBoundingClientRect();
  const canvasX = e.clientX - canvasRect.left;
  const canvasY = e.clientY - canvasRect.top;

  const { x: px, y: py } = screenToProject(canvasX, canvasY);

  // NOVO: Apenas desenha se o mouse se moveu o suficiente
  const dist = Math.hypot(px - lastX, py - lastY);
  if (dist < MIN_BRUSH_MOVE_DISTANCE) {
    return;
  }

  // Expande os limites do traço para incluir o novo ponto
  // const pad = brushSize / 2;
  const toolOptions = tools[activeToolId];
  const hardness =
    typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;
  const effectiveSize = toolOptions.size * (1 + (1 - hardness) * 0.5);
  const pad = effectiveSize / 2;

  currentStrokeBounds.minX = Math.min(
    currentStrokeBounds.minX,
    px - pad,
    lastX - pad
  );
  currentStrokeBounds.minY = Math.min(
    currentStrokeBounds.minY,
    py - pad,
    lastY - pad
  );
  currentStrokeBounds.maxX = Math.max(
    currentStrokeBounds.maxX,
    px + pad,
    lastX + pad
  );
  currentStrokeBounds.maxY = Math.max(
    currentStrokeBounds.maxY,
    py + pad,
    lastY + pad
  );

  drawBrushStroke(px, py);
}

function stopDrawing(e) {
  if (!isDrawing) return;

  isDrawing = false;
  window.removeEventListener("mousemove", processDrawing);

  // --- LÓGICA DE OTIMIZAÇÃO ---
  // 1. Define os limites da camada original dentro do strokeCanvas
  const originalLayerBounds = {
    x: STROKE_PADDING,
    y: STROKE_PADDING,
    width: activeLayer.image.width,
    height: activeLayer.image.height,
  };

  // 2. Converte os limites do traço (que estão em coords do projeto) para coords do strokeCanvas
  const strokeRelativeBounds = {
    x: currentStrokeBounds.minX - strokeOriginX,
    y: currentStrokeBounds.minY - strokeOriginY,
    width: currentStrokeBounds.maxX - currentStrokeBounds.minX,
    height: currentStrokeBounds.maxY - currentStrokeBounds.minY,
  };

  // 3. Calcula a união da camada original e do novo traço para criar a área de busca
  const searchBounds = {
    x: Math.min(originalLayerBounds.x, strokeRelativeBounds.x),
    y: Math.min(originalLayerBounds.y, strokeRelativeBounds.y),
    width: 0,
    height: 0,
  };
  const right = Math.max(
    originalLayerBounds.x + originalLayerBounds.width,
    strokeRelativeBounds.x + strokeRelativeBounds.width
  );
  const bottom = Math.max(
    originalLayerBounds.y + originalLayerBounds.height,
    strokeRelativeBounds.y + strokeRelativeBounds.height
  );
  searchBounds.width = right - searchBounds.x;
  searchBounds.height = bottom - searchBounds.y;
  // --- FIM DA LÓGICA DE OTIMIZAÇÃO ---

  // 4. Encontra os limites finais usando a função otimizada e a área de busca
  const bounds = getOptimizedBoundingBox(strokeCanvas, searchBounds);

  // Limpa o rastreador de limites
  currentStrokeBounds = null;

  if (bounds) {
    const newLayerCanvas = document.createElement("canvas");
    newLayerCanvas.width = bounds.width;
    newLayerCanvas.height = bounds.height;
    const newCtx = newLayerCanvas.getContext("2d");
    newCtx.drawImage(
      strokeCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );

    const img = new Image();
    img.onload = () => {
      activeLayer.image = img;
      activeLayer.x = strokeOriginX + bounds.x;
      activeLayer.y = strokeOriginY + bounds.y;

      strokeCanvas = null;
      saveState();
      draw();
      updateLayersPanel();
    };
    img.src = newLayerCanvas.toDataURL();
  } else {
    // CORREÇÃO: Lida com o caso em que a camada fica totalmente vazia
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = 1;
    emptyCanvas.height = 1;

    const img = new Image();
    img.onload = () => {
      activeLayer.image = img;
      // Reseta a posição para o canto superior esquerdo para consistência
      activeLayer.x = 0;
      activeLayer.y = 0;

      strokeCanvas = null;
      saveState();
      draw();
      updateLayersPanel();
    };
    img.src = emptyCanvas.toDataURL();
  }
}

// --- Listeners de Eventos Principais ---

// state for layer dragging
const draggingLayerState = {
  isDragging: false,
  offsetX: 0,
  offsetY: 0,
};

canvas.addEventListener("mousedown", (e) => {
  // Pan com o botão do meio
  if (e.button === 1) {
    isPanning = true;
    startX = e.clientX - originX;
    startY = e.clientY - originY;
    e.preventDefault();
    return;
  }

  // Iniciar desenho (Brush Tool)
  startDrawing(e);

  // Lógica de arrastar camada (Move Tool)
  if (
    document.getElementById("moveTool").hasAttribute("active") &&
    activeLayer &&
    e.button === 0
  ) {
    const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
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
  // Pan com o botão do meio
  if (isPanning) {
    originX = e.clientX - startX;
    originY = e.clientY - startY;
    draw();
    return;
  }

  // Arrastar camada
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

  if (draggingLayerState.isDragging) {
    saveState();
    draggingLayerState.isDragging = false;
  }
});

// O listener de mouseleave agora só precisa se preocupar com o pan e o arraste
canvas.addEventListener("mouseleave", () => {
  isPanning = false;
  draggingLayerState.isDragging = false;
  // A lógica de desenho foi removida daqui, pois agora é global
});

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

  const promises = projLayers.map(
    (l) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...l, image: img });
        img.src = l.image.src || l.image; // Handle both image elements and data URLs
      })
  );

  Promise.all(promises).then((loadedLayers) => {
    layers = loadedLayers;
    activeLayer = layers.length > 0 ? layers[0] : null;
    updateLayersPanel();

    if (viewportState.scale) {
      scale = viewportState.scale;
      originX = viewportState.originX;
      originY = viewportState.originY;
    } else {
      fitToScreen();
    }
    draw();
  });
}

// --------- BRUSH TOOL ---------
const STROKE_PADDING = 1000;
const MIN_BRUSH_MOVE_DISTANCE = 1; // Distância mínima (em pixels do projeto) para registrar um novo ponto de pintura
let isDrawing = false;
// let brushColor = "#000000"; // <-- REMOVER
// let brushSize = 5; // <-- REMOVER
let strokeCanvas = null;
let strokeOriginX = 0;
let strokeOriginY = 0;
let lastX = null;
let lastY = null;
let currentStrokeBounds = null;

/**
 * Encontra a caixa delimitadora (bounding box) de pixels não transparentes
 * DENTRO de uma área de busca específica para otimização.
 * @param {HTMLCanvasElement} canvas - O canvas para processar.
 * @param {{x: number, y: number, width: number, height: number}} searchBounds - A área para escanear.
 * @returns {{x: number, y: number, width: number, height: number}|null}
 */
function getOptimizedBoundingBox(canvas, searchBounds) {
  const ctx = canvas.getContext("2d");

  // Garante que a área de busca não saia dos limites do canvas
  const searchX = Math.max(0, Math.floor(searchBounds.x));
  const searchY = Math.max(0, Math.floor(searchBounds.y));
  const searchWidth = Math.min(
    canvas.width - searchX,
    Math.ceil(searchBounds.width)
  );
  const searchHeight = Math.min(
    canvas.height - searchY,
    Math.ceil(searchBounds.height)
  );

  if (searchWidth <= 0 || searchHeight <= 0) {
    return null; // Área de busca inválida
  }

  const data = ctx.getImageData(
    searchX,
    searchY,
    searchWidth,
    searchHeight
  ).data;
  let minX = canvas.width,
    minY = canvas.height,
    maxX = -1,
    maxY = -1;
  let foundPixel = false;

  for (let y = 0; y < searchHeight; y++) {
    for (let x = 0; x < searchWidth; x++) {
      const alpha = data[(y * searchWidth + x) * 4 + 3];
      if (alpha > 0) {
        // As coordenadas encontradas são relativas à `searchBounds`,
        // então precisamos convertê-las de volta para as coordenadas do canvas
        const globalX = searchX + x;
        const globalY = searchY + y;

        minX = Math.min(minX, globalX);
        minY = Math.min(minY, globalY);
        maxX = Math.max(maxX, globalX);
        maxY = Math.max(maxY, globalY);
        foundPixel = true;
      }
    }
  }

  if (!foundPixel) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function hexToRgba(hex, alpha = 1) {
  if (!hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawDab(ctx, x, y, radius, hardness, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const innerStop = Math.max(0, Math.min(1, hardness));

  let opaque, mid, transparent;

  if (ctx.globalCompositeOperation === "destination-out") {
    opaque = "rgba(0,0,0,1)";
    mid = "rgba(0,0,0,0.25)"; // y=(1-0.5)^2=0.25
    transparent = "rgba(0,0,0,0)";
  } else {
    opaque = hexToRgba(color, 1);
    mid = hexToRgba(color, 0.25); // y=(1-0.5)^2=0.25
    transparent = hexToRgba(color, 0);
  }

  gradient.addColorStop(0, opaque);
  gradient.addColorStop(innerStop, opaque);

  // Ao adicionar uma parada intermediária, mudamos a queda linear para uma
  // aproximação de 2 segmentos de uma curva. Esta curva (y=(1-x)^2) derruba
  // o alfa muito mais rápido, o que evita o acúmulo excessivo de alfa quando
  // os dabs se sobrepõem, resultando em um traço muito mais suave.
  if (innerStop < 1.0) {
    const midStop = innerStop + (1.0 - innerStop) * 0.5;
    gradient.addColorStop(midStop, mid);
  }

  gradient.addColorStop(1, transparent);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// MODIFICADO: Função de desenho do pincel/borracha
function drawBrushStroke(x, y) {
  if (!isDrawing || !strokeCanvas) return;

  const ctx = strokeCanvas.getContext("2d");
  const toolOptions = tools[activeToolId]; // Pega as opções da ferramenta ativa
  const hardness =
    typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;

  if (activeToolId === "eraserTool") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
  }

  const localLastX = lastX - strokeOriginX;
  const localLastY = lastY - strokeOriginY;
  const localX = x - strokeOriginX;
  const localY = y - strokeOriginY;

  // Optimization for 100% hardness: use native line drawing which is faster
  if (hardness >= 1.0) {
    ctx.strokeStyle = toolOptions.color || "#000000";
    if (activeToolId === "eraserTool") {
      ctx.strokeStyle = "#000000"; // any opaque color works for destination-out
    }
    ctx.lineWidth = toolOptions.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(localLastX, localLastY);
    ctx.lineTo(localX, localY);
    ctx.stroke();
  } else {
    // Soft brush: draw dabs along the path
    const size = toolOptions.size;
    const color = toolOptions.color || "#000000";
    const dist = Math.hypot(localX - localLastX, localY - localLastY);
    const angle = Math.atan2(localY - localLastY, localX - localLastX);
    const effectiveSize = size * (1 + (1 - hardness) * 0.5);
    const radius = effectiveSize / 2;

    // Spacing should be a fraction of the brush size to ensure a continuous line
    const spacing = Math.max(1, (size / 2) * 0.25);

    for (let i = 0; i < dist; i += spacing) {
      const px = localLastX + Math.cos(angle) * i;
      const py = localLastY + Math.sin(angle) * i;
      drawDab(ctx, px, py, radius, hardness, color);
    }

    // Draw final dab at the current mouse position to ensure it's responsive
    drawDab(ctx, localX, localY, radius, hardness, color);
  }

  lastX = x;
  lastY = y;

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

  // --- NOVA API DE FERRAMENTAS ---
  setActiveTool: (toolId) => {
    if (tools[toolId]) {
      activeToolId = toolId;
    }
  },
  setToolOption: (toolId, option, value) => {
    if (tools[toolId]) {
      tools[toolId][option] = value;
    }
  },
  getToolState: (toolId) => {
    return tools[toolId] || {};
  },
  getActiveToolId: () => activeToolId,
};
