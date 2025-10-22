// renderer/imageEngine.js

// NOVO: Objeto Debug
const Debug = {
  // Flags padrão
  transformShowHandles: false,
  // Obter a flag de Debug
  get: (key) => {
    if (!(key in Debug)) return undefined; // Verificar se a chave existe
    return Debug[key];
  },
  // Definir a flag de Debug
  set: (key, value) => {
    if (typeof value !== "boolean") return undefined; // Garantir que o valor seja booleano
    if (!(key in Debug)) return undefined; // Verificar se a chave existe
    Debug[key] = value;
    draw();
    return Debug[key];
  },
  // Alternar a flag de Debug
  toggle: (key) => {
    if (!(key in Debug)) return undefined; // Verificar se a chave existe
    Debug[key] = !Debug[key];
    draw();
    return Debug[key];
  },
};

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

// --- NOVO: Estado de Transformação ---
let isTransforming = false;
let transformState = null; // { originalLayer, currentTransform, activeHandle, dragStartCoords, dragStartTransform }
const TRANSFORM_HANDLE_SIZE_PROJ = 8; // Tamanho do controle em pixels do projeto (a 100% zoom)
let lastUsedToolId = "moveTool"; // Guarda a ferramenta anterior

// --- SELEÇÃO: ARQUITETURA REFEITA COM BOUNDS DINÂMICOS ---
let selectionCanvas = null;
let selectionCtx = null;
let hasSelection = false;
let selectionBounds = null; // { x, y, width, height } em coordenadas do projeto
let newSelectionRect = null;
let isSelecting = false;
let isMovingSelection = false;
let selectionMoveStart = { x: 0, y: 0 };
let selectionMoveStartBounds = null; // Guarda os bounds no início do movimento
let selectionEdges = null; // Cache para as bordas da seleção

let lineDashOffset = 0;
let animationFrameId = null;
let lastFrameTime = 0;
const frameInterval = 1000 / 15; // 15 fps

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
  pencilTool: {
    size: 1,
    color: "#000000",
    shape: "square", // 'square' or 'sphere'
  },
  eraserTool: {
    size: 100,
    hardness: 1.0,
    mode: "brush", // 'brush' or 'pencil'
    shape: "square", // 'square' or 'sphere'
  },
  // Outras ferramentas podem ser adicionadas aqui
  moveTool: {},
  selectTool: {
    mode: "replace", // replace, unite, subtract, intersect
  },
};

// helpers
function uid() {
  return Date.now() + "-" + Math.floor(Math.random() * 10000);
}

// --- Helper para atualizar a UI do app.js ---
function notifyTransformUI() {
  if (typeof window.updateTransformUI === "function") {
    window.updateTransformUI();
  }
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

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const elapsed = currentTime - lastFrameTime;

  if (elapsed > frameInterval) {
    lastFrameTime = currentTime - (elapsed % frameInterval);

    lineDashOffset = (lineDashOffset - 1) % 16;
    draw();
  }
}

function startAnimation() {
  if (!animationFrameId) {
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(animate);
  }
}

function stopAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// ajusta canvas para ocupar o viewport (em CSS pixels)
function resizeViewport() {
  const oldW = canvas.width || 0;
  const oldH = canvas.height || 0;

  canvas.width = container.clientWidth;
  canvas.height =
    container.clientHeight -
    document.getElementById("projectsTabs").clientHeight;

  // manter a mesma posição visual do centro do projeto ao redimensionar
  originX += (canvas.width - oldW) / 2;
  originY += (canvas.height - oldH) / 2;

  draw();
}
window.addEventListener("resize", resizeViewport);
resizeViewport(); // inicializa

// --- Função para calcular e armazenar em cache as bordas da seleção ---
function cacheSelectionEdges() {
  if (!hasSelection) {
    selectionEdges = null;
    return;
  }
  // Usa a sua função existente para encontrar as bordas.
  // Em uma aplicação real, otimizações mais avançadas poderiam ser usadas aqui.
  selectionEdges = findSelectionEdges();
}

// --------- DRAW: desenha o viewport, mostrando apenas a área do projeto desenhada nas coordenadas certas ---------
function draw() {
  // limpar tela
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
    if (layer === activeLayer && isDrawing) {
      continue;
    }

    // --- NOVO: Lógica de Desenho para Transformação ---
    if (isTransforming && layer === activeLayer && transformState) {
      ctx.save();
      const t = transformState.currentTransform;

      // 1. Vai para o ponto da âncora
      ctx.translate(t.x, t.y);
      // 2. Rotaciona
      ctx.rotate((t.rotation * Math.PI) / 180);
      // 3. Escala
      ctx.scale(t.scaleX, t.scaleY);
      // 4. Desenha a imagem, deslocada pela sua âncora
      // (ex: âncora central {0.5, 0.5} desenha em [-width/2, -height/2])
      ctx.drawImage(layer.image, -t.width * t.anchor.x, -t.height * t.anchor.y);
      ctx.restore();
    } else {
      // Desenho normal da camada
      ctx.drawImage(layer.image, layer.x, layer.y);
    }
    // --- FIM DA MODIFICAÇÃO ---
  }

  // Desenha o canvas do traço em andamento sobre tudo
  if (isDrawing && strokeCanvas) {
    // AQUI ESTÁ A MUDANÇA: desenha o canvas na sua posição de origem correta
    ctx.drawImage(strokeCanvas, strokeOriginX, strokeOriginY);
  }

  // Desenha a borda do projeto
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2 / Math.max(scale, 1);
  ctx.strokeRect(0, 0, projectWidth, projectHeight);

  // Desenha a borda de seleção da camada ativa
  if (activeLayer && activeLayer.visible && !isTransforming) {
    ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
    ctx.lineWidth = 2 / Math.max(scale, 1);
    ctx.strokeRect(
      activeLayer.x,
      activeLayer.y,
      activeLayer.image.width,
      activeLayer.image.height
    );
  }

  // --- NOVO: Desenha os controles de transformação ---
  if (isTransforming && transformState) {
    drawTransformControls();

    // NOVO: Desenha hitboxes de Debug
    if (Debug.get("transformShowHandles")) {
      drawDebugHitboxes();
    }
  }

  // MODIFICADO: Usa selectionBounds para o translate
  if (hasSelection && selectionEdges && selectionBounds) {
    ctx.save();
    ctx.translate(selectionBounds.x, selectionBounds.y); // USA BOUNDS

    const lineWidth = 1 / scale;
    const dashLength = 4 / scale;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([dashLength, dashLength]);
    const pixelFix = 0.5 / scale;

    // MODIFICADO: Remova o pixelFix das coordenadas x e y
    const drawSegments = (segments, offset) => {
      ctx.lineDashOffset = offset;
      ctx.beginPath();
      for (const seg of segments.horizontal) {
        const y = seg.y; // SEM pixelFix
        ctx.moveTo(seg.x, y);
        ctx.lineTo(seg.x + seg.length, y);
      }
      for (const seg of segments.vertical) {
        const x = seg.x; // SEM pixelFix
        ctx.moveTo(x, seg.y);
        ctx.lineTo(x, seg.y + seg.length);
      }
      ctx.stroke();
    };

    // Aplica a translação de meio pixel para linhas nítidas
    ctx.translate(0.5 / scale, 0.5 / scale);

    ctx.strokeStyle = "white";
    drawSegments(selectionEdges, lineDashOffset / scale);
    ctx.strokeStyle = "black";
    drawSegments(selectionEdges, (lineDashOffset + 4) / scale);
    ctx.restore();
  }

  // Draw temporary selection rectangle for visual feedback during creation
  if (newSelectionRect) {
    ctx.save();
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = "rgba(150, 150, 150, 0.8)";
    ctx.setLineDash([4 / scale, 2 / scale]);
    ctx.strokeRect(
      newSelectionRect.x,
      newSelectionRect.y,
      newSelectionRect.width,
      newSelectionRect.height
    );
    ctx.restore();
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

/**
 * Analisa a máscara de seleção e retorna os segmentos de linha que formam seu contorno.
 * @returns {{horizontal: Array, vertical: Array}} Um objeto com arrays de segmentos de linha.
 * Cada segmento é { x, y, length }.
 */
function findSelectionEdges() {
  if (!hasSelection || !selectionCtx || !selectionBounds) {
    return { horizontal: [], vertical: [] };
  }

  const w = selectionBounds.width;
  const h = selectionBounds.height;
  const imageData = selectionCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const horizontal = [];
  const vertical = [];

  const isSelected = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return data[(y * w + x) * 4 + 3] > 0;
  };

  // MODIFICADO: Os loops agora começam em -1 para detectar as bordas em x=0 e y=0.
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const current = isSelected(x, y);

      // Checa a transição para o pixel de baixo
      if (current !== isSelected(x, y + 1)) {
        horizontal.push({ x: x, y: y + 1, length: 1 });
      }
      // Checa a transição para o pixel da direita
      if (current !== isSelected(x + 1, y)) {
        vertical.push({ x: x + 1, y: y, length: 1 });
      }
    }
  }

  // A LÓGICA DE FUSÃO PERMANECE A MESMA E FUNCIONARÁ CORRETAMENTE
  const mergeSegments = (segments, orientation) => {
    if (segments.length === 0) return [];

    const isHorizontal = orientation === "horizontal";

    if (isHorizontal) {
      segments.sort((a, b) => a.y - b.y || a.x - b.x);
    } else {
      segments.sort((a, b) => a.x - b.x || a.y - b.y);
    }

    const merged = [segments[0]];
    for (let i = 1; i < segments.length; i++) {
      const last = merged[merged.length - 1];
      const current = segments[i];
      if (isHorizontal) {
        if (current.y === last.y && current.x === last.x + last.length) {
          last.length += current.length;
        } else {
          merged.push(current);
        }
      } else {
        if (current.x === last.x && current.y === last.y + last.length) {
          last.length += current.length;
        } else {
          merged.push(current);
        }
      }
    }
    return merged;
  };

  return {
    horizontal: mergeSegments(horizontal, "horizontal"),
    vertical: mergeSegments(vertical, "vertical"),
  };
}

// --------- UTIL: converte coordenadas de evento -> coords do projeto ---------
function screenToProject(screenX, screenY) {
  // screenX/screenY: coordenadas em pixels relativos ao canvas (mouse offsetX/offsetY)
  const px = (screenX - originX) / scale;
  const py = (screenY - originY) / scale;
  return { x: px, y: py };
}

function projectToScreen(projectX, projectY) {
  const sx = projectX * scale + originX;
  const sy = projectY * scale + originY;
  return { x: sx, y: sy };
}

// --------- CREATE NEW PROJECT ---------
function createNewProject(w, h) {
  projectWidth = Math.max(1, Math.floor(w));
  projectHeight = Math.max(1, Math.floor(h));

  if (!selectionCanvas) {
    selectionCanvas = document.createElement("canvas");
    // MODIFICADO: Adiciona o atributo de otimização aqui
    selectionCtx = selectionCanvas.getContext("2d", {
      willReadFrequently: true,
    });
  }
  selectionCanvas.width = projectWidth;
  selectionCanvas.height = projectHeight;
  // --- FIM DA MODIFICAÇÃO ---

  // limpar camadas
  layers = [];
  activeLayer = null;
  // resizeViewport(); // ajusta viewport
  clearSelection();
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

// --- ADD FILL LAYER ---
function addFillLayer(color, name = "Fill Layer") {
  if (!projectWidth || !projectHeight) return;

  const fillCanvas = document.createElement("canvas");
  fillCanvas.width = projectWidth;
  fillCanvas.height = projectHeight;
  const fillCtx = fillCanvas.getContext("2d");

  fillCtx.fillStyle = color;
  fillCtx.fillRect(0, 0, projectWidth, projectHeight);

  const img = new Image();
  img.onload = () => {
    // Para camadas de preenchimento, queremos que elas se alinhem com o projeto
    const newLayer = {
      id: uid(),
      name,
      image: img,
      x: 0,
      y: 0,
      visible: true,
    };
    layers.unshift(newLayer); // Adiciona no início (fundo)
    setActiveLayer(newLayer.id);
    updateLayersPanel();
    saveState();
    draw();
  };
  img.src = fillCanvas.toDataURL();
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

// --- MODIFICADO: Funções de Seleção com Máscara ---
function clearSelection() {
  if (hasSelection) {
    hasSelection = false;
    selectionBounds = null; // Limpa os bounds
    cacheSelectionEdges();
    stopAnimation();
    draw();
    saveState();
  }
}

function selectAll() {
  if (!projectWidth) return;
  // Define os bounds para corresponder ao projeto
  selectionBounds = { x: 0, y: 0, width: projectWidth, height: projectHeight };
  // Ajusta o canvas da seleção
  selectionCanvas.width = projectWidth;
  selectionCanvas.height = projectHeight;
  selectionCtx.fillStyle = "white";
  selectionCtx.fillRect(0, 0, projectWidth, projectHeight);

  hasSelection = true;
  cacheSelectionEdges();
  startAnimation();
  draw();
  saveState();
}

// ATUALIZAR isPointInSelection para considerar o offset
function isPointInSelection(px, py) {
  if (!hasSelection || !selectionBounds) return false;
  // Converte para coordenadas locais do canvas da seleção
  const localX = Math.floor(px - selectionBounds.x);
  const localY = Math.floor(py - selectionBounds.y);

  // Checa se o ponto está dentro dos limites do canvas da máscara
  if (
    localX < 0 ||
    localX >= selectionBounds.width ||
    localY < 0 ||
    localY >= selectionBounds.height
  ) {
    return false;
  }
  const pixelData = selectionCtx.getImageData(localX, localY, 1, 1).data;
  return pixelData[3] > 0; // Checa o canal alfa
}

// --- MODIFICADO: Função central para atualizar a máscara ---
function updateSelectionWithRect(rect, mode) {
  if (!rect || rect.width < 1 || rect.height < 1) return;

  if (mode === "replace") {
    clearSelection(); // Limpa a seleção e reseta os bounds
  }

  if (!hasSelection) {
    // Criando a primeira seleção
    selectionBounds = { ...rect };
    selectionCanvas.width = rect.width;
    selectionCanvas.height = rect.height;
    selectionCtx.fillStyle = "white";
    selectionCtx.fillRect(0, 0, rect.width, rect.height);
  } else {
    // Unindo com uma seleção existente
    const oldBounds = selectionBounds;
    const newBounds = {
      x: Math.min(oldBounds.x, rect.x),
      y: Math.min(oldBounds.y, rect.y),
      right: Math.max(oldBounds.x + oldBounds.width, rect.x + rect.width),
      bottom: Math.max(oldBounds.y + oldBounds.height, rect.y + rect.height),
    };
    newBounds.width = newBounds.right - newBounds.x;
    newBounds.height = newBounds.bottom - newBounds.y;

    // Se o canvas precisa crescer para acomodar o novo retângulo
    if (
      newBounds.width > oldBounds.width ||
      newBounds.height > oldBounds.height
    ) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = newBounds.width;
      tempCanvas.height = newBounds.height;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

      const offsetX = oldBounds.x - newBounds.x;
      const offsetY = oldBounds.y - newBounds.y;
      tempCtx.drawImage(selectionCanvas, offsetX, offsetY);

      selectionCanvas.width = newBounds.width;
      selectionCanvas.height = newBounds.height;
      selectionCtx.drawImage(tempCanvas, 0, 0);
      selectionBounds = {
        x: newBounds.x,
        y: newBounds.y,
        width: newBounds.width,
        height: newBounds.height,
      };
    }

    const localRect = {
      x: rect.x - selectionBounds.x,
      y: rect.y - selectionBounds.y,
      width: rect.width,
      height: rect.height,
    };

    switch (mode) {
      case "unite":
      case "replace": // 'replace' já foi tratado, mas aqui ele desenha
        selectionCtx.globalCompositeOperation = "source-over";
        break;
      case "subtract":
        selectionCtx.globalCompositeOperation = "destination-out";
        break;
      case "intersect":
        selectionCtx.globalCompositeOperation = "destination-in";
        break;
    }

    selectionCtx.fillStyle = "white";
    selectionCtx.fillRect(
      localRect.x,
      localRect.y,
      localRect.width,
      localRect.height
    );
    selectionCtx.globalCompositeOperation = "source-over"; // Reset
  }

  // Verifica se a seleção ainda existe
  const selectionData = selectionCtx.getImageData(
    0,
    0,
    selectionCanvas.width,
    selectionCanvas.height
  ).data;
  let stillHasSelection = false;
  for (let i = 3; i < selectionData.length; i += 4) {
    if (selectionData[i] > 0) {
      stillHasSelection = true;
      break;
    }
  }
  hasSelection = stillHasSelection;

  if (hasSelection) {
    cacheSelectionEdges();
    startAnimation();
  } else {
    clearSelection(); // Limpa completamente se a seleção ficou vazia
  }
  draw();
  saveState();
}

/**
 * [ASSÍNCRONO] Copia a área selecionada da camada ativa para o clipboard do sistema.
 * Se não houver seleção, copia a camada ativa inteira.
 */
async function copySelection() {
  if (!activeLayer) return;

  let sourceCanvas;
  let originalBounds = {}; // Armazenará a posição original

  if (!hasSelection) {
    // Caso 1: Sem seleção, usa a imagem da camada inteira
    sourceCanvas = activeLayer.image;
    originalBounds = { x: activeLayer.x, y: activeLayer.y };
  } else {
    // Caso 2: Com seleção, recorta a área (lógica que você já tinha)
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = selectionBounds.width;
    tempCanvas.height = selectionBounds.height;
    const tempCtx = tempCanvas.getContext("2d");

    const layerOffsetX = activeLayer.x - selectionBounds.x;
    const layerOffsetY = activeLayer.y - selectionBounds.y;
    tempCtx.drawImage(activeLayer.image, layerOffsetX, layerOffsetY);
    tempCtx.globalCompositeOperation = "destination-in";
    tempCtx.drawImage(selectionCanvas, 0, 0);

    const bounds = getOptimizedBoundingBox(tempCanvas, {
      x: 0,
      y: 0,
      width: tempCanvas.width,
      height: tempCanvas.height,
    });
    if (!bounds) return; // Nada para copiar

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = bounds.width;
    finalCanvas.height = bounds.height;
    const finalCtx = finalCanvas.getContext("2d");
    finalCtx.drawImage(
      tempCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    sourceCanvas = finalCanvas;

    originalBounds = {
      x: selectionBounds.x + bounds.x,
      y: selectionBounds.y + bounds.y,
    };
  }

  // Converte o canvas final para um Blob e escreve no clipboard
  try {
    const blob = await new Promise((resolve) =>
      sourceCanvas.toBlob(resolve, "image/png")
    );

    const activeTab = projectsTabs.querySelector("button.active:not(#homeTab)");
    // O ID do projeto é armazenado como o ID do botão
    const currentProjectID =
      projects.find((p) => p.id == activeTab.id).id || "";
    const metadata = {
      source: `opencreate-forge-editor__${currentProjectID}`, // Carimbo para reconhecer colagens internas por projeto
      x: originalBounds.x,
      y: originalBounds.y,
    };
    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: "text/plain",
    });

    // Escreve ambos os blobs (imagem e metadados) no clipboard
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
        "text/plain": metadataBlob, // Adiciona o carimbo
      }),
    ]);
    console.log("Image copied to system clipboard.");
  } catch (err) {
    console.error("Failed to copy image to clipboard:", err);
    alert(
      "Could not copy image to clipboard. Check permissions or console for errors."
    );
  }
}

/**
 * [ASSÍNCRONO] Lê o clipboard do sistema. Se encontrar uma imagem,
 * cola como uma nova camada no centro da visão atual.
 */
async function pasteFromClipboard() {
  try {
    const clipboardItems = await navigator.clipboard.read();

    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue; // Pula se não houver imagem

      let isInternalPaste = false;
      let pastePosition = null;

      // 1. Tenta ler nossos metadados primeiro
      if (item.types.includes("text/plain")) {
        const metadataBlob = await item.getType("text/plain");
        const metadataText = await metadataBlob.text();

        console.log("Clipboard metadata:", metadataText);

        try {
          const metadata = JSON.parse(metadataText);
          const activeTab = projectsTabs.querySelector(
            "button.active:not(#homeTab)"
          );
          // O ID do projeto é armazenado como o ID do botão
          const currentProjectID =
            projects.find((p) => p.id == activeTab.id).id || "";
          if (
            metadata.source === `opencreate-forge-editor__${currentProjectID}`
          ) {
            isInternalPaste = true;
            pastePosition = { x: metadata.x, y: metadata.y };
          }
        } catch (e) {
          /* Não é nosso JSON, ignora */
        }
      }

      // 2. Se não for interno, calcula a posição centralizada
      if (!isInternalPaste) {
        const center = screenToProject(canvas.width / 2, canvas.height / 2);
        pastePosition = center; // A posição será ajustada pelo tamanho da imagem depois
      }

      // 3. Processa a imagem
      const blob = await item.getType(imageType);
      createLayerFromBlob(blob, pastePosition, !isInternalPaste);

      saveState();

      return; // Processamos o primeiro item de imagem e paramos
    }

    console.log("No image found in clipboard.", clipboardItems);
  } catch (err) {
    console.error("Failed to read from clipboard:", err);
    alert(
      "Could not paste from clipboard. Check permissions or console for errors."
    );
  }
}

/**
 * Deleta o conteúdo dentro da seleção da camada ativa.
 */
function deleteSelectionContent() {
  if (!activeLayer || !hasSelection || !selectionBounds) return;

  // 1. Cria um novo canvas com o conteúdo da camada atual
  const newLayerCanvas = document.createElement("canvas");
  newLayerCanvas.width = activeLayer.image.width;
  newLayerCanvas.height = activeLayer.image.height;
  const newCtx = newLayerCanvas.getContext("2d");
  newCtx.drawImage(activeLayer.image, 0, 0);

  // 2. Usa 'destination-out' para "apagar" a área da seleção
  newCtx.globalCompositeOperation = "destination-out";

  // 3. Calcula a posição da máscara de seleção relativa à camada
  const drawX = selectionBounds.x - activeLayer.x;
  const drawY = selectionBounds.y - activeLayer.y;
  newCtx.drawImage(selectionCanvas, drawX, drawY);

  // 4. Encontra o novo bounding box para otimizar o tamanho da camada
  const bounds = getOptimizedBoundingBox(newLayerCanvas, {
    x: 0,
    y: 0,
    width: newLayerCanvas.width,
    height: newLayerCanvas.height,
  });

  if (bounds) {
    // Se ainda há conteúdo na camada
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = bounds.width;
    finalCanvas.height = bounds.height;
    const finalCtx = finalCanvas.getContext("2d");
    finalCtx.drawImage(
      newLayerCanvas,
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
      // Atualiza a posição da camada com base no novo bounding box
      activeLayer.x += bounds.x;
      activeLayer.y += bounds.y;

      saveState(); // Salva o estado para o 'undo'
      draw();
      updateLayersPanel();
    };
    img.src = finalCanvas.toDataURL();
  } else {
    // Se a camada ficou completamente vazia
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = 1;
    emptyCanvas.height = 1;
    const img = new Image();
    img.onload = () => {
      activeLayer.image = img;
      activeLayer.x = 0;
      activeLayer.y = 0;
      saveState();
      draw();
      updateLayersPanel();
    };
    img.src = emptyCanvas.toDataURL();
  }
}

/**
 * [ASSÍNCRONO] Recorta a área selecionada (Copia e depois Deleta).
 */
async function cutSelection() {
  if (!activeLayer || !hasSelection) return;

  // 1. Copia a seleção para a área de transferência
  await copySelection();

  // 2. Deleta o conteúdo da seleção na camada
  deleteSelectionContent();
}

/**
 * Helper para criar uma camada a partir de um Blob de imagem, convertendo-o para um data URL permanente.
 * @param {Blob} blob - O blob da imagem.
 * @param {{x: number, y: number}} position - A posição desejada (canto superior esquerdo ou centro).
 * @param {boolean} isCenterPosition - Se a posição fornecida é para o centro da imagem.
 */
function createLayerFromBlob(blob, position, isCenterPosition = false) {
  const imageUrl = URL.createObjectURL(blob); // 1. Cria a URL temporária para carregar a imagem
  const img = new Image();
  const imgName = blob.name || "Imported Image";

  img.onload = () => {
    // 2. Após carregar a imagem do blob, nós a convertemos
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(img, 0, 0);

    // 3. Libera a memória do blob, pois já o temos no canvas
    URL.revokeObjectURL(imageUrl);

    // 4. Converte o canvas para um data URL permanente
    const dataURL = tempCanvas.toDataURL();

    // 5. Cria a imagem final que será armazenada no estado
    const finalImage = new Image();
    finalImage.onload = () => {
      let layerX, layerY;
      if (isCenterPosition) {
        layerX = position.x - finalImage.width / 2;
        layerY = position.y - finalImage.height / 2;
      } else {
        layerX = position.x;
        layerY = position.y;
      }

      const newLayer = {
        id: uid(),
        name: imgName,
        image: finalImage, // A imagem agora tem um src="data:..."
        x: layerX,
        y: layerY,
        visible: true,
      };

      layers.push(newLayer);
      setActiveLayer(newLayer.id);
      clearSelection();

      updateLayersPanel();
      saveState();
      draw();
      console.log("Image from blob converted and added as a new layer.");
    };

    // 6. Define o src da imagem final para o data URL
    finalImage.src = dataURL;
  };

  img.src = imageUrl;
}

// Undo/redo stacks
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

function saveState() {
  const state = {
    layers: layers.map((l) => ({ ...l, image: l.image.src })),
    activeLayer: activeLayer ? activeLayer.id : null,
    hasSelection: hasSelection,
    selectionDataURL: hasSelection ? selectionCanvas.toDataURL() : null,
    selectionBounds: hasSelection ? { ...selectionBounds } : null, // Salva bounds
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

    selectionBounds = state.selectionBounds
      ? { ...state.selectionBounds }
      : null; // Restaura bounds

    if (state.hasSelection && state.selectionDataURL && selectionBounds) {
      const img = new Image();
      img.onload = () => {
        selectionCanvas.width = selectionBounds.width;
        selectionCanvas.height = selectionBounds.height;
        selectionCtx.drawImage(img, 0, 0);
        hasSelection = true;
        cacheSelectionEdges();
        startAnimation();
        draw();
      };
      img.src = state.selectionDataURL;
    } else {
      clearSelection();
    }

    // O draw() final é chamado dentro do bloco de seleção ou por clearSelection()
    draw(); // Este draw pode ser removido para evitar redesenho duplo
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

      // Hide brush preview during zoom for performance
      brushPreview.style.display = "none";

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

/**
 * Desenha a caixa delimitadora, âncora e controles de transformação no canvas.
 * Chamada por draw().
 *
 * CORREÇÃO:
 * - Tarefa 2: Altera o visual da âncora de uma cruz para um losango preenchido.
 */
function drawTransformControls() {
  const t = transformState.currentTransform;

  ctx.save();
  // 1. Vai para o ponto da âncora (já em coords do projeto)
  ctx.translate(t.x, t.y);
  // 2. Rotaciona
  ctx.rotate((t.rotation * Math.PI) / 180);

  // Calcula os limites da caixa (relativos à âncora rotacionada)
  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  // Desenha a caixa delimitadora
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;
  ctx.setLineDash([]);
  ctx.strokeRect(left, top, width, height);

  // Prepara para desenhar os controles
  const handleSize = TRANSFORM_HANDLE_SIZE_PROJ / scale;
  ctx.fillStyle = "white";
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;

  // --- INÍCIO DA CORREÇÃO (Tarefa 2: Mudar âncora para losango) ---
  // Substitui a cruz azul por um losango azul
  // ctx.fillStyle = "rgba(0, 0, 0, 0)";
  ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
  ctx.lineWidth = 1 / scale;
  ctx.beginPath();
  ctx.moveTo(0, -(handleSize * 1.25) / 1.5); // Ponto de cima (um pouco menor)
  ctx.lineTo((handleSize * 1.25) / 1.5, 0); // Ponto da direita
  ctx.lineTo(0, (handleSize * 1.25) / 1.5); // Ponto de baixo
  ctx.lineTo(-(handleSize * 1.25) / 1.5, 0); // Ponto da esquerda
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Desenha os controles de escala (lista agora é filtrada por getTransformHandles)
  getTransformHandles(true).forEach((handle) => {
    if (handle.name === "rotate") return;
    // Coordenadas já estão em espaço local rotacionado
    ctx.fillRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
  });

  // Desenha o controle de rotação
  // (também é filtrado se estiver muito perto, mas a lógica de 'top' o mantém)
  const rotHandle = getTransformHandles(true).find((h) => h.name === "rotate");
  if (rotHandle) {
    ctx.beginPath();
    ctx.moveTo(rotHandle.x, rotHandle.y + handleSize / 2);
    ctx.lineTo(rotHandle.x, rotHandle.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rotHandle.x, rotHandle.y, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // --- FIM DA CORREÇÃO ---

  ctx.restore();
}

/**
 * NOVO: Desenha as hitboxes de Debug para a transformação.
 */
function drawDebugHitboxes() {
  if (!isTransforming || !transformState) return;

  const handleSize = TRANSFORM_HANDLE_SIZE_PROJ / scale;
  const debugHitboxSize = handleSize * 1.5; // Tamanho da área de clique

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY); // Coords do Projeto
  ctx.fillStyle = "rgba(255, 0, 0, 0.3)"; // Vermelho 30%

  const handles = getTransformHandles(false); // Coords do MUNDO (projeto)
  handles.forEach((h) => {
    ctx.fillRect(
      h.x - debugHitboxSize / 2,
      h.y - debugHitboxSize / 2,
      debugHitboxSize,
      debugHitboxSize
    );
  });
  ctx.restore(); // Restaura para coords de tela

  // Agora desenha a caixa de "move"
  ctx.save();
  const t = transformState.currentTransform;
  ctx.setTransform(scale, 0, 0, scale, originX, originY); // Coords do Projeto
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);

  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  ctx.fillStyle = "rgba(255, 0, 0, 0.1)"; // Vermelho 10%
  ctx.fillRect(left, top, width, height);

  ctx.restore();
}

/**
 * Converte coordenadas do projeto (mundo) para o espaço local (rotacionado/escalado) da camada.
 * CORREÇÃO: Esta função agora retorna coordenadas LOCAIS ESCALADAS,
 * pois é assim que os limites são definidos em getHandleAtPoint.
 * @returns {{x: number, y: number}} Coordenadas locais ESCALADAS.
 */
function worldToLocal(px, py) {
  if (!transformState) return { x: 0, y: 0 };
  const t = transformState.currentTransform;

  // 1. Remove a translação da âncora
  let x = px - t.x;
  let y = py - t.y;

  // 2. Remove a rotação (rotaciona no sentido oposto)
  const rot = (-t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let x_rot = x * cos - y * sin;
  let y_rot = x * sin + y * cos;

  // 3. REMOVIDO: A escala não é removida, pois getHandleAtPoint compara com valores escalados.
  // let x_scaled = x_rot / t.scaleX;
  // let y_scaled = y_rot / t.scaleY;

  return { x: x_rot, y: y_rot }; // Retorna as coords rotacionadas (que são locais e escaladas)
}

/**
 * Converte coordenadas locais (rotacionadas/escaladas) para o espaço do projeto (mundo).
 * CORREÇÃO: Esta função agora assume que lx e ly já estão ESCALADOS,
 * pois é assim que os handles são calculados em getTransformHandles.
 * @returns {{x: number, y: number}} Coordenadas do projeto.
 */
function localToWorld(lx, ly) {
  // lx e ly são coords locais JÁ ESCALADAS
  if (!transformState) return { x: 0, y: 0 };
  const t = transformState.currentTransform;

  // 1. REMOVIDO: A escala não é aplicada, pois lx/ly já estão escalados
  // let x = lx * t.scaleX;
  // let y = ly * t.scaleY;
  let x = lx; // Usa os valores escalados diretamente
  let y = ly;

  // 2. Aplica rotação
  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let x_rot = x * cos - y * sin;
  let y_rot = x * sin + y * cos;

  // 3. Aplica translação da âncora
  let x_trans = x_rot + t.x;
  let y_trans = y_rot + t.y;

  return { x: x_trans, y: y_trans };
}

/**
 * Retorna uma lista de todos os controles de transformação e suas posições.
 * @param {boolean} local - Se true, retorna coordenadas locais (relativas à âncora rotacionada).
 * Se false, retorna coordenadas do projeto (mundo).
 *
 * CORREÇÃO:
 * - Tarefa 1: Oculta handles de aresta se o objeto estiver muito pequeno na tela.
 * - Tarefa 3: Remove o handle "anchor" da lista para desativar sua interatividade.
 */
function getTransformHandles(local = false) {
  if (!transformState) return [];
  const t = transformState.currentTransform;

  // --- NOVO: Lógica de Ocultação de Handles ---
  // Se o tamanho na tela for menor que 4x o tamanho do handle, oculta as arestas.
  const HIDE_THRESHOLD = TRANSFORM_HANDLE_SIZE_PROJ * 4;
  // 'scale' é a variável global de zoom da viewport
  const width_screen = Math.abs(t.width * t.scaleX * scale);
  const height_screen = Math.abs(t.height * t.scaleY * scale);

  const hideVerticalEdges = height_screen < HIDE_THRESHOLD;
  const hideHorizontalEdges = width_screen < HIDE_THRESHOLD;
  // --- FIM DA LÓGICA NOVA ---

  // Coordenadas locais (antes da rotação/translação)
  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;
  const midX = left + width / 2;
  const midY = top + height / 2;

  const handleSize = TRANSFORM_HANDLE_SIZE_PROJ / scale;

  const allHandles = [
    { name: "top-left", x: left, y: top, cursor: "nwse-resize" },
    { name: "top-middle", x: midX, y: top, cursor: "ns-resize" },
    { name: "top-right", x: left + width, y: top, cursor: "nesw-resize" },
    { name: "center-left", x: left, y: midY, cursor: "ew-resize" },
    { name: "center-right", x: left + width, y: midY, cursor: "ew-resize" },
    { name: "bottom-left", x: left, y: top + height, cursor: "nesw-resize" },
    { name: "bottom-middle", x: midX, y: top + height, cursor: "ns-resize" },
    {
      name: "bottom-right",
      x: left + width,
      y: top + height,
      cursor: "nwse-resize",
    },
    { name: "rotate", x: midX, y: top - 20 / scale, cursor: "crosshair" },
    // O handle da âncora foi movido para o filtro abaixo
  ];

  // NOVO: Filtrar os handles com base nas condições
  const handles = allHandles.filter((h) => {
    // Tarefa 3: Remover interatividade da âncora
    if (h.name === "anchor") {
      return false;
    }
    // Tarefa 1: Ocultar handles de aresta
    if (h.name === "top-middle" || h.name === "bottom-middle") {
      return !hideHorizontalEdges;
    }
    if (h.name === "center-left" || h.name === "center-right") {
      return !hideVerticalEdges;
    }
    return true; // Manter cantos e rotação
  });

  if (local) return handles;

  // Converte para coordenadas do mundo
  return handles.map((h) => {
    const worldPos = localToWorld(h.x, h.y);
    return { ...h, ...worldPos };
  });
}

/**
 * Encontra qual controle de transformação está em um determinado ponto (coords do projeto).
 */
function getHandleAtPoint(px, py) {
  const handles = getTransformHandles(false); // Pega coords do mundo
  const handleSize = TRANSFORM_HANDLE_SIZE_PROJ / scale;
  const checkRadius = (handleSize / 2) * 1.5; // Área de clique 50% maior
  const rotation = transformState.currentTransform.rotation;

  // Muda o cursor com base na rotação atual
  function getRotatedCursor(handleName, originalCursor, rotation) {
    const directions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"]; // Sentidos em ordem horária

    // Apenas rotaciona cursores de resize
    if (!originalCursor.endsWith("-resize")) {
      return originalCursor;
    }

    // Determina a direção base do cursor a partir do nome do handle
    let baseDir = "";
    if (handleName.includes("top")) baseDir += "n";
    else if (handleName.includes("bottom")) baseDir += "s";

    if (handleName.includes("left")) baseDir += "w";
    else if (handleName.includes("right")) baseDir += "e";

    // Garante a ordem correta para diagonais (n/s antes de e/w)
    if (baseDir === "wn") baseDir = "nw";
    if (baseDir === "en") baseDir = "ne";
    if (baseDir === "ws") baseDir = "sw";
    if (baseDir === "es") baseDir = "se";

    const index = directions.indexOf(baseDir);
    if (index === -1) {
      return originalCursor; // Fallback
    }

    // Calcula o novo índice com base na rotação
    const steps = Math.round(rotation / 45); // Cada 45 graus é um passo
    const newIndex = (index + steps + directions.length) % directions.length;
    return directions[newIndex] + "-resize";
  }

  // Atualiza os cursores dos handles com base na rotação
  handles.forEach((h) => {
    h.cursor = getRotatedCursor(h.name, h.cursor, rotation);
  });

  // Itera de trás para frente (controles ficam por cima da caixa)
  for (let i = handles.length - 1; i >= 0; i--) {
    const h = handles[i];
    const dist = Math.hypot(px - h.x, py - h.y);
    if (dist <= checkRadius) {
      return h;
    }
  }

  // Se nenhum controle, verifica se está dentro da caixa (para mover)
  const localPos = worldToLocal(px, py);
  const t = transformState.currentTransform;
  const left = -t.width * t.anchor.x * t.scaleX;
  const top = -t.height * t.anchor.y * t.scaleY;
  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  if (
    localPos.x >= left &&
    localPos.x <= left + width &&
    localPos.y >= top &&
    localPos.y <= top + height
  ) {
    return { name: "move", cursor: "move" };
  }

  return null;
}

/**
 * Entra no modo de transformação para a camada ativa.
 */
function enterTransformMode() {
  if (isTransforming || !activeLayer) return;

  console.log("Entrando no modo de transformação:", activeLayer.id);
  isTransforming = true;
  isSelecting = false; // Garante que não estamos selecionando
  lastUsedToolId = activeToolId; // Salva a ferramenta atual
  activeToolId = "transformTool"; // "Ferramenta" virtual
  document.body.classList.add("transforming");

  // Limpa a seleção, pois não é compatível com a transformação
  clearSelection();

  // Esconde o Brush Preview durante a transformação
  brushPreview.style.display = "none";

  // Armazena o estado original
  transformState = {
    originalLayer: {
      ...activeLayer,
      image: activeLayer.image,
    },
    currentTransform: {
      // Âncora começa no centro da camada
      x: activeLayer.x + activeLayer.image.width / 2,
      y: activeLayer.y + activeLayer.image.height / 2,
      width: activeLayer.image.width,
      height: activeLayer.image.height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorString: "center-middle", // Para a UI
      anchor: { x: 0.5, y: 0.5 }, // 0-1 normalizado
    },
    activeHandle: null,
    dragStartCoords: { x: 0, y: 0 },
    dragStartTransform: null,
  };

  draw();
  // A UI será atualizada pelo app.js
}

/**
 * Cancela a transformação e restaura o estado original.
 * @param {boolean} isApplying - Se true, não restaura o estado (usado por applyTransform).
 */
function cancelTransform(isApplying = false) {
  if (!isTransforming) return;

  if (!isApplying) {
    // Restaura a camada
    const original = transformState.originalLayer;
    activeLayer.image = original.image;
    activeLayer.x = original.x;
    activeLayer.y = original.y;
    console.log("Transformação cancelada.");
  }

  isTransforming = false;
  transformState = null;
  activeToolId = lastUsedToolId; // Restaura a ferramenta anterior
  document.body.classList.remove("transforming");

  draw();
  updateLayersPanel();
  // A UI será atualizada pelo app.js
}

/**
 * [ASSÍNCRONO] Aplica a transformação, criando uma nova imagem de camada.
 */
async function applyTransform() {
  if (!isTransforming) return;

  const t = transformState.currentTransform;
  const originalImg = transformState.originalLayer.image;

  // 1. Calcula a nova caixa delimitadora no espaço do projeto
  const corners = [
    { x: -t.width * t.anchor.x, y: -t.height * t.anchor.y }, // top-left
    { x: t.width * (1 - t.anchor.x), y: -t.height * t.anchor.y }, // top-right
    { x: t.width * (1 - t.anchor.x), y: t.height * (1 - t.anchor.y) }, // bottom-right
    { x: -t.width * t.anchor.x, y: t.height * (1 - t.anchor.y) }, // bottom-left
  ];

  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const transformedCorners = corners.map((c) => {
    // Aplica escala
    const scaledX = c.x * t.scaleX;
    const scaledY = c.y * t.scaleY;
    // Aplica rotação e translação da âncora
    return {
      x: scaledX * cos - scaledY * sin + t.x,
      y: scaledX * sin + scaledY * cos + t.y,
    };
  });

  const minX = Math.min(...transformedCorners.map((c) => c.x));
  const minY = Math.min(...transformedCorners.map((c) => c.y));
  const maxX = Math.max(...transformedCorners.map((c) => c.x));
  const maxY = Math.max(...transformedCorners.map((c) => c.y));

  const newWidth = Math.ceil(maxX - minX);
  const newHeight = Math.ceil(maxY - minY);
  const newX = Math.floor(minX);
  const newY = Math.floor(minY);

  if (newWidth < 1 || newHeight < 1) {
    // A camada desapareceu, trata como vazia
    createEmptyLayer(activeLayer.name); // (Isso pode precisar de refinamento)
    layers = layers.filter((l) => l.id !== transformState.originalLayer.id);
  } else {
    // 2. Cria um novo canvas e desenha a imagem transformada nele
    const newLayerCanvas = document.createElement("canvas");
    newLayerCanvas.width = newWidth;
    newLayerCanvas.height = newHeight;
    const newCtx = newLayerCanvas.getContext("2d");

    // 3. Desenha a imagem
    // Move o canvas para que (newX, newY) do projeto seja (0, 0)
    newCtx.translate(-newX, -newY);
    // Aplica a mesma transformação de renderização
    newCtx.translate(t.x, t.y);
    newCtx.rotate(rot);
    newCtx.scale(t.scaleX, t.scaleY);
    newCtx.drawImage(
      originalImg,
      -t.width * t.anchor.x,
      -t.height * t.anchor.y
    );

    // 4. Cria a nova imagem e atualiza a camada
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = newLayerCanvas.toDataURL();
    });

    activeLayer.image = img;
    activeLayer.x = newX;
    activeLayer.y = newY;
  }

  console.log("Transformação aplicada.");

  // 5. Sai do modo de transformação e salva no histórico
  cancelTransform(true); // Sai sem reverter
  saveState(); // Salva o novo estado
  draw();
  updateLayersPanel();
  document.body.classList.remove("transforming");
}

/**
 * Atualiza o estado da transformação com base em um novo valor numérico da UI.
 */
function setTransformNumeric(option, value) {
  if (!isTransforming || isNaN(value)) return;
  transformState.currentTransform[option] = value;
  draw();
  // A UI já foi atualizada pelo input, não precisa notificar de volta
}

/**
 * Define um novo ponto de âncora e recalcula a posição X, Y
 * para que a camada não se mova visualmente.
 */
function setTransformAnchor(anchorString) {
  if (!isTransforming) return;

  const t = transformState.currentTransform;
  const oldAnchor = t.anchor;
  const newAnchor = { ...oldAnchor };

  if (anchorString.includes("top")) newAnchor.y = 0;
  if (anchorString.includes("center-")) newAnchor.y = 0.5;
  if (anchorString.includes("bottom")) newAnchor.y = 1;

  if (anchorString.includes("left")) newAnchor.x = 0;
  if (anchorString.endsWith("-middle")) newAnchor.x = 0.5;
  if (anchorString === "center") newAnchor.x = 0.5;
  if (anchorString.includes("right")) newAnchor.x = 1;

  const width = t.width * t.scaleX;
  const height = t.height * t.scaleY;

  // Calcula o deslocamento da âncora no espaço local (escalado, não rotacionado)
  const dx_local = (newAnchor.x - oldAnchor.x) * width;
  const dy_local = (newAnchor.y - oldAnchor.y) * height;

  // Rotaciona o deslocamento para o espaço do mundo
  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const dx_world = dx_local * cos - dy_local * sin;
  const dy_world = dx_local * sin + dy_local * cos;

  // Atualiza a posição X, Y para compensar o deslocamento da âncora
  t.x = t.x + dx_world;
  t.y = t.y + dy_world;

  t.anchor = newAnchor;
  t.anchorString = anchorString;

  draw();
  notifyTransformUI(); // Notifica a UI sobre a mudança em X, Y
}

/**
 * Mastro de eventos para mousedown durante a transformação.
 * CORREÇÃO: Lógica para encontrar 'oppositeHandleName' foi reescrita
 * para evitar o bug de substituição encadeada.
 * * CORREÇÃO 2: Adicionado Pixel Snapping.
 * - Armazena as coordenadas iniciais com snap se não for rotação.
 */
function handleTransformMouseDown(e) {
  const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
  const handle = getHandleAtPoint(px, py);

  if (!handle) return;

  transformState.activeHandle = handle;

  // --- INÍCIO DA CORREÇÃO (Pixel Snapping) ---
  // Armazena as coordenadas iniciais, com snap se não for rotação
  if (handle.name !== "rotate") {
    transformState.dragStartCoords = { x: Math.round(px), y: Math.round(py) };
  } else {
    transformState.dragStartCoords = { x: px, y: py };
  }
  // --- FIM DA CORREÇÃO ---

  transformState.dragStartTransform = JSON.parse(
    JSON.stringify(transformState.currentTransform)
  );

  // Prepara dados extras para escalonamento
  if (
    handle.name !== "move" &&
    handle.name !== "rotate" &&
    handle.name !== "anchor"
  ) {
    // --- INÍCIO DA CORREÇÃO ---
    // A lógica de replace encadeado estava errada.
    // ex: "top-left".replace("top", "bottom").replace("bottom", "top") -> "top-left"
    let oppositeHandleName = handle.name;
    if (oppositeHandleName.includes("top")) {
      oppositeHandleName = oppositeHandleName.replace("top", "bottom");
    } else if (oppositeHandleName.includes("bottom")) {
      oppositeHandleName = oppositeHandleName.replace("bottom", "top");
    }

    if (oppositeHandleName.includes("left")) {
      oppositeHandleName = oppositeHandleName.replace("left", "right");
    } else if (oppositeHandleName.includes("right")) {
      oppositeHandleName = oppositeHandleName.replace("right", "left");
    }
    // --- FIM DA CORREÇÃO ---

    // A âncora de escalonamento é o controle oposto
    const oppositeHandle = getTransformHandles(true).find(
      (h) => h.name === oppositeHandleName
    );
    if (oppositeHandle) {
      transformState.scaleAnchor = localToWorld(
        oppositeHandle.x,
        oppositeHandle.y
      );
    } else {
      // Fallback (não deve acontecer)
      transformState.scaleAnchor = transformState.currentTransform;
    }
  }
}

/**
 * Mastro de eventos para mousemove durante a transformação.
 * CORREÇÃO: Removido Math.abs() da lógica de 'keepAspect' (Shift).
 *
 * CORREÇÃO 2: Adicionado Pixel Snapping (Move/Scale) e Rotation Snapping (Shift+Rotate).
 * - Pixel Snapping: Usa coordenadas arredondadas para move/scale.
 * - Rotation Snapping: Trava a rotação em incrementos de 15 graus com Shift.
 */
function handleTransformMouseMove(e) {
  // --- INÍCIO DA CORREÇÃO (Pixel Snapping) ---
  // Pega as coordenadas "raw" (float)
  const { x: raw_px, y: raw_py } = screenToProject(e.offsetX, e.offsetY);
  // --- FIM DA CORREÇÃO ---

  const t = transformState.currentTransform;
  const startT = transformState.dragStartTransform;
  const handle = transformState.activeHandle;

  if (!handle) {
    // Atualiza o cursor ao pairar (usa coordenadas raw para detecção suave)
    const hoverHandle = getHandleAtPoint(raw_px, raw_py);
    // console.log("Hover handle:", hoverHandle);
    document.body.style.cursor = hoverHandle?.cursor || "default";
    return;
  }

  // --- INÍCIO DA CORREÇÃO (Pixel Snapping) ---
  // Decide se deve usar coordenadas com snap
  let px, py;
  if (handle.name === "rotate") {
    px = raw_px; // Sem snap para rotação
    py = raw_py;
  } else {
    px = Math.round(raw_px); // Com snap para move e scale
    py = Math.round(raw_py);
  }
  // --- FIM DA CORREÇÃO ---

  // O dx/dy agora é (snapped_pos - snapped_start_pos) para move/scale
  const dx = px - transformState.dragStartCoords.x;
  const dy = py - transformState.dragStartCoords.y;

  switch (handle.name) {
    case "move":
    case "anchor":
      // --- INÍCIO DA CORREÇÃO (Pixel Snapping Pós-Escala) ---

      // 1. Posição-alvo do anchor (baseado no mouse snap)
      const targetX = startT.x + dx;
      const targetY = startT.y + dy;

      // 2. Calcula o offset do "canto 0,0" da camada
      //    em relação à âncora, no espaço do MUNDO.
      const rot = (t.rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      // 3. Coords locais do canto (já escaladas)
      //    (t.width é a largura original da imagem)
      const local_left = -t.width * t.anchor.x * t.scaleX;
      const local_top = -t.height * t.anchor.y * t.scaleY;

      // 4. Rotaciona esse offset para o espaço do mundo
      const world_offset_x = local_left * cos - local_top * sin;
      const world_offset_y = local_left * sin + local_top * cos;

      // 5. Posição-alvo do canto (visual)
      const target_visual_left = targetX + world_offset_x;
      const target_visual_top = targetY + world_offset_y;

      // 6. Arredonda o canto visual para o pixel mais próximo
      const snapped_visual_left = Math.round(target_visual_left);
      const snapped_visual_top = Math.round(target_visual_top);

      // 7. Calcula a *correção* (o 'erro' do snap)
      const correction_x = snapped_visual_left - target_visual_left;
      const correction_y = snapped_visual_top - target_visual_top;

      // 8. Aplica a correção à posição-alvo do *anchor*
      //    A âncora (t.x, t.y) pode agora ficar em um "meio-pixel" (ex: 9.5),
      //    o que é CORRETO para centralizar um objeto de dimensão ímpar (ex: 15px).
      t.x = targetX + correction_x;
      t.y = targetY + correction_y;

      // --- FIM DA CORREÇÃO ---
      break;

    case "rotate": {
      // Girar o objeto
      const startAngle = Math.atan2(
        transformState.dragStartCoords.y - startT.y,
        transformState.dragStartCoords.x - startT.x
      );
      const currentAngle = Math.atan2(py - startT.y, px - startT.x); // Usa px/py (sem snap)
      const deltaAngle = currentAngle - startAngle;

      // --- INÍCIO DA CORREÇÃO (Rotation 15deg Snapping) ---
      let newRotation = startT.rotation + (deltaAngle * 180) / Math.PI;

      if (e.shiftKey) {
        const snapAngle = 15; // Trava em 15 graus
        newRotation = Math.round(newRotation / snapAngle) * snapAngle;
      }

      t.rotation = newRotation % 360;
      // --- FIM DA CORREÇÃO ---
      break;
    }

    // --- LÓGICA DE ESCALA ---
    // Todos os 8 controles de escalonamento
    default: {
      if (!transformState.scaleAnchor) break; // Segurança
      const scaleAnchor = transformState.scaleAnchor; // O ponto oposto (fixo)
      const keepAspect = e.shiftKey;

      // 1. Eixos do objeto no espaço do mundo (baseado na rotação inicial)
      const rot = (startT.rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const world_axis_x = { x: cos, y: sin };
      const world_axis_y = { x: -sin, y: cos };

      // 2. Vetor do anchor ao handle original (no mousedown)
      //    (Usa dragStartCoords, que já está com snap)
      const vec_start = {
        x: transformState.dragStartCoords.x - scaleAnchor.x,
        y: transformState.dragStartCoords.y - scaleAnchor.y,
      };
      // Vetor do anchor ao mouse atual
      //    (Usa px/py, que também está com snap)
      const vec_current = {
        x: px - scaleAnchor.x,
        y: py - scaleAnchor.y,
      };

      // 3. Projeta os vetores nos eixos rotacionados do objeto
      // Projeção do vetor original
      const start_proj_x =
        vec_start.x * world_axis_x.x + vec_start.y * world_axis_x.y;
      const start_proj_y =
        vec_start.x * world_axis_y.x + vec_start.y * world_axis_y.y;
      // Projeção do vetor atual
      const current_proj_x =
        vec_current.x * world_axis_x.x + vec_current.y * world_axis_x.y;
      const current_proj_y =
        vec_current.x * world_axis_y.x + vec_current.y * world_axis_y.y;

      // 4. Calcula os fatores de escala (proporção do vetor atual vs. original)
      // Evita divisão por zero se o handle estiver alinhado com o anchor
      let scaleFactorX = start_proj_x === 0 ? 1 : current_proj_x / start_proj_x;
      let scaleFactorY = start_proj_y === 0 ? 1 : current_proj_y / start_proj_y;

      // 5. Aplica constrangimentos do handle e 'Shift'
      let applyScaleX =
        handle.name.includes("left") || handle.name.includes("right");
      let applyScaleY =
        handle.name.includes("top") || handle.name.includes("bottom");
      const isCorner = applyScaleX && applyScaleY;

      if (keepAspect) {
        if (isCorner) {
          // Para travar a proporção em um canto, usamos a projeção no vetor do próprio handle
          const start_mag = Math.hypot(start_proj_x, start_proj_y);
          if (start_mag > 0) {
            const proj_axis = {
              x: start_proj_x / start_mag,
              y: start_proj_y / start_mag,
            };
            const current_proj =
              current_proj_x * proj_axis.x + current_proj_y * proj_axis.y;
            const globalScaleFactor = current_proj / start_mag;
            scaleFactorX = globalScaleFactor;
            scaleFactorY = globalScaleFactor;
          }
        } else if (applyScaleX) {
          // Trava proporção em handle horizontal
          // *** ESTA É A CORREÇÃO ***
          scaleFactorY = scaleFactorX; // Removido Math.abs()
          applyScaleY = true;
        } else if (applyScaleY) {
          // Trava proporção em handle vertical
          // *** ESTA É A CORREÇÃO ***
          scaleFactorX = scaleFactorY; // Removido Math.abs()
          applyScaleX = true;
        }
      }

      // 6. Define as escalas finais
      if (applyScaleX) t.scaleX = startT.scaleX * scaleFactorX;
      if (applyScaleY) t.scaleY = startT.scaleY * scaleFactorY;

      // 7. Recalcula a posição da âncora central para que o 'scaleAnchor' permaneça fixo
      const vec_anchor_to_center = {
        x: startT.x - scaleAnchor.x,
        y: startT.y - scaleAnchor.y,
      };

      // Projeta o vetor do centro nos eixos
      const center_proj_x =
        vec_anchor_to_center.x * world_axis_x.x +
        vec_anchor_to_center.y * world_axis_x.y;
      const center_proj_y =
        vec_anchor_to_center.x * world_axis_y.x +
        vec_anchor_to_center.y * world_axis_y.y;

      // Escala os vetores do centro APENAS pelos fatores que foram aplicados
      const new_center_proj_x =
        center_proj_x * (applyScaleX ? scaleFactorX : 1);
      const new_center_proj_y =
        center_proj_y * (applyScaleY ? scaleFactorY : 1);

      // Reconstrói o vetor do centro em coordenadas do mundo
      // (new_proj_x * eixo_x_mundo) + (new_proj_y * eixo_y_mundo)
      const new_world_vec = {
        x:
          new_center_proj_x * world_axis_x.x +
          new_center_proj_y * world_axis_y.x,
        y:
          new_center_proj_x * world_axis_x.y +
          new_center_proj_y * world_axis_y.y,
      };

      // A nova posição da âncora é o ponto fixo (scaleAnchor) + o novo vetor escalado
      t.x = scaleAnchor.x + new_world_vec.x;
      t.y = scaleAnchor.y + new_world_vec.y;

      break;
    }
    // --- FIM DA CORREÇÃO ---
  }

  draw();
  notifyTransformUI(); // Atualiza os inputs X, Y, W, H, A
}

/**
 * Mastro de eventos para mouseup durante a transformação.
 */
function handleTransformMouseUp(e) {
  if (!transformState.activeHandle) return;
  transformState.activeHandle = null;
  transformState.dragStartTransform = null;
  // Não salva no histórico aqui, apenas ao clicar em "Apply"
}

// --- Novas funções de manipulação de eventos de desenho ---

function startDrawing(e) {
  if (isTransforming) return; // Bloqueia se estiver transformando
  // const isBrushActive = document.getElementById("brushTool").hasAttribute("active"); <-- REMOVER
  // const isEraserActive = document.getElementById("eraserTool").hasAttribute("active"); <-- REMOVER

  const isDrawableTool =
    activeToolId === "brushTool" ||
    activeToolId === "eraserTool" ||
    activeToolId === "pencilTool";

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

  // Desabilita anti-aliasing para o lápis
  const toolOptions = tools[activeToolId];
  const isPencilMode =
    activeToolId === "pencilTool" ||
    (activeToolId === "eraserTool" && toolOptions.mode === "pencil");
  if (isPencilMode) {
    strokeCtx.imageSmoothingEnabled = false;
  }

  // Copia a imagem da camada ativa para o centro do nosso canvas expandido
  strokeCtx.drawImage(activeLayer.image, STROKE_PADDING, STROKE_PADDING);

  // Pega a posição inicial do mouse em coordenadas do projeto
  const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
  lastX = px;
  lastY = py;

  let effectiveSize;
  if (isPencilMode) {
    effectiveSize = toolOptions.size;
  } else {
    const hardness =
      typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;
    effectiveSize = toolOptions.size * (1 + (1 - hardness) * 0.5);
  }
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

  // Apenas desenha se o mouse se moveu o suficiente
  const dist = Math.hypot(px - lastX, py - lastY);
  if (dist < MIN_BRUSH_MOVE_DISTANCE) {
    return;
  }

  // Expande os limites do traço para incluir o novo ponto
  // const pad = brushSize / 2;
  const toolOptions = tools[activeToolId];
  const isPencilMode =
    activeToolId === "pencilTool" ||
    (activeToolId === "eraserTool" && toolOptions.mode === "pencil");

  let effectiveSize;
  if (isPencilMode) {
    effectiveSize = toolOptions.size;
  } else {
    const hardness =
      typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;
    effectiveSize = toolOptions.size * (1 + (1 - hardness) * 0.5);
  }
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
  // NOVO: Prioridade para transformação
  if (isTransforming) {
    handleTransformMouseDown(e);
    return;
  }

  // Pan com o botão do meio
  if (e.button === 1) {
    isPanning = true;
    startX = e.clientX - originX;
    startY = e.clientY - originY;
    e.preventDefault();
    // brushPreview.style.display = "block"; // Reexibe o preview do pincel após o pan
    return;
  }

  // Lógica da ferramenta de seleção
  if (activeToolId === "selectTool" && e.button === 0) {
    const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
    const toolOptions = tools.selectTool; // Pega as opções da ferramenta

    // CORREÇÃO: Permite mover a seleção apenas nos modos 'replace' e 'unite'
    const canMoveSelection =
      toolOptions.mode === "replace" || toolOptions.mode === "unite";

    if (hasSelection && canMoveSelection && isPointInSelection(px, py)) {
      isMovingSelection = true;
      selectionMoveStart = { x: px, y: py };
      selectionMoveStartBounds = { ...selectionBounds }; // Salva os bounds iniciais
      return;
    }
    // Fim da modificação

    isSelecting = true;
    selectionStartX = Math.floor(px);
    selectionStartY = Math.floor(py);

    if (toolOptions.mode === "replace" && !isMovingSelection) {
      // Limpa a seleção visualmente ao começar a arrastar,
      // mas a limpeza final ocorre no mouseup.
      clearSelection();
    }
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
  // NOVO: Prioridade para transformação
  if (isTransforming) {
    handleTransformMouseMove(e);
    draw(); // Garante redesenho durante o movimento
    return;
  }

  // Pan com o botão do meio
  if (isPanning) {
    originX = e.clientX - startX;
    originY = e.clientY - startY;
    draw();
    // brushPreview.style.display = "block";
    return;
  }

  if (isMovingSelection) {
    const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);
    const dx = Math.round(px - selectionMoveStart.x);
    const dy = Math.round(py - selectionMoveStart.y);

    // Atualiza os bounds com base no deslocamento
    selectionBounds.x = selectionMoveStartBounds.x + dx;
    selectionBounds.y = selectionMoveStartBounds.y + dy;

    draw(); // Apenas redesenha, os dados do canvas não mudam
    return;
  }

  // Desenhar retângulo de seleção
  if (isSelecting) {
    const { x: px, y: py } = screenToProject(e.offsetX, e.offsetY);

    // CORREÇÃO: Use Math.round() para uma seleção mais responsiva
    const currentX = Math.round(px);
    const currentY = Math.round(py);

    const x = Math.min(selectionStartX, currentX);
    const y = Math.min(selectionStartY, currentY);
    const width = Math.abs(currentX - selectionStartX);
    const height = Math.abs(currentY - selectionStartY);
    newSelectionRect = { x, y, width, height }; // Update temp rect
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
  // NOVO: Prioridade para transformação
  if (isTransforming) {
    handleTransformMouseUp(e);
    return;
  }

  if (e.button === 1) {
    isPanning = false;
  }

  if (isMovingSelection) {
    isMovingSelection = false;
    selectionMoveStartBounds = null; // Limpa
    saveState(); // Salva o estado com os novos bounds
    return;
  }

  if (isSelecting) {
    isSelecting = false;
    const finalRect = newSelectionRect;
    newSelectionRect = null; // Limpa o retângulo temporário

    if (!finalRect || finalRect.width < 1 || finalRect.height < 1) {
      if (tools.selectTool.mode === "replace") {
        clearSelection();
      }
      draw(); // Redesenha para remover o retângulo temporário
      return;
    }

    // --- LÓGICA DE SELEÇÃO MODIFICADA ---
    updateSelectionWithRect(finalRect, tools.selectTool.mode);
    // --- FIM DA MODIFICAÇÃO ---
  }

  if (draggingLayerState.isDragging) {
    saveState();
    draggingLayerState.isDragging = false;
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

canvas.addEventListener("dblclick", (e) => {
  if (activeToolId === "selectTool") {
    selectAll();
  }
});

function fitToScreen() {
  if (!projectWidth || !projectHeight) return;

  const viewW = canvas.width;
  const viewH = canvas.height;

  // fator de escala mínimo para caber em width/height
  const scaleX = viewW / projectWidth;
  const scaleY = viewH / projectHeight;
  scale = Math.min(scaleX, scaleY) * 0.7; // 70% para dar uma margem

  // centralizar
  originX = (viewW - projectWidth * scale) / 2;
  originY = (viewH - projectHeight * scale) / 2;

  draw();
}
// fitToScreen();

// ensure canvas is transparent so checkerboard of container shows through
// canvas.style.background = "transparent";
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
  clearSelection();
  updateLayersPanel();
  draw();
}

// --------- AO TROCAR PARA A ABA DO PROJETO ---------

// Mudar a assinatura para aceitar o estado da seleção
function setProject(
  w,
  h,
  projLayers,
  viewportState = {},
  selectionDataURL = null,
  selBounds = null
) {
  projectWidth = w;
  projectHeight = h;

  // Garante que o canvas de seleção tenha o tamanho certo para o projeto
  if (selectionCanvas) {
    selectionCanvas.width = w;
    selectionCanvas.height = h;
  }

  const promises = projLayers.map(
    (l) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...l, image: img });
        img.src = l.image.src || l.image;
      })
  );

  Promise.all(promises).then((loadedLayers) => {
    layers = loadedLayers;
    // MODIFICADO: Seleciona a última camada da lista como ativa (mais comum em editores)
    activeLayer = layers.length > 0 ? layers[layers.length - 1] : null;
    updateLayersPanel();

    selectionBounds = selBounds ? { ...selBounds } : null; // Restaura bounds do projeto
    if (selectionDataURL && selectionBounds) {
      const img = new Image();
      img.onload = () => {
        selectionCanvas.width = selectionBounds.width;
        selectionCanvas.height = selectionBounds.height;
        selectionCtx.drawImage(img, 0, 0);
        hasSelection = true;
        cacheSelectionEdges();
        startAnimation();
        draw();
      };
      img.src = selectionDataURL;
    } else {
      clearSelection();
    }

    if (viewportState.scale) {
      scale = viewportState.scale;
      originX = viewportState.originX;
      originY = viewportState.originY;
    } else {
      fitToScreen();
    }

    // O draw() será chamado pela lógica de restauração da seleção ou por clearSelection
    draw();
    resizeViewport();
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
  // o acúmulo excessivo de alfa quando
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

  const isPencilMode =
    activeToolId === "pencilTool" ||
    (activeToolId === "eraserTool" && toolOptions.mode === "pencil");

  if (activeToolId === "eraserTool") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
  }

  const localLastX = lastX - strokeOriginX;
  const localLastY = lastY - strokeOriginY;
  const localX = x - strokeOriginX;
  const localY = y - strokeOriginY;

  if (isPencilMode) {
    ctx.fillStyle = toolOptions.color || "#000000";
    if (activeToolId === "eraserTool") {
      ctx.fillStyle = "#000000"; // any opaque color works for destination-out
    }
    const size = toolOptions.size;
    const shape = toolOptions.shape;

    // Bresenham's line algorithm to draw a continuous line of "pixels"
    let x0 = Math.floor(localLastX);
    let y0 = Math.floor(localLastY);
    const x1 = Math.floor(localX);
    const y1 = Math.floor(localY);

    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      if (shape === "square") {
        ctx.fillRect(
          x0 - Math.floor(size / 2),
          y0 - Math.floor(size / 2),
          size,
          size
        );
      } else {
        // sphere
        if (size % 2 !== 0) {
          // Odd size, use integer math for classic pixel circle
          const r = (size - 1) / 2;
          for (let dy = -r; dy <= r; dy++) {
            const dx = Math.floor(Math.sqrt(r * r - dy * dy));
            ctx.fillRect(x0 - dx, y0 + dy, 2 * dx + 1, 1);
          }
        } else {
          // Even size, use distance check which works well for these
          const radius = size / 2;
          // Center the bounding box on the pixel grid
          const topLeftX = x0 - radius;
          const topLeftY = y0 - radius;

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const dist_x = x + 0.5 - radius;
              const dist_y = y + 0.5 - radius;
              if (dist_x * dist_x + dist_y * dist_y <= radius * radius) {
                ctx.fillRect(topLeftX + x, topLeftY + y, 1, 1);
              }
            }
          }
        }
      }

      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  } else {
    // Soft brush: draw dabs along the path
    const hardness =
      typeof toolOptions.hardness === "number" ? toolOptions.hardness : 1.0;

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
  }

  lastX = x;
  lastY = y;

  draw();
}

// expose API to global (app.js will call these)
window.ImageEngine = {
  Debug, // NOVO: Expor o objeto Debug

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
    hasSelection: hasSelection,
    selectionDataURL: hasSelection ? selectionCanvas.toDataURL() : null,
    selectionBounds: hasSelection ? selectionBounds : null, // Expõe bounds
  }),
  undo,
  redo,
  createEmptyLayer,
  addFillLayer,
  selectAll,
  clearSelection,
  isPointInSelection,

  copySelection,
  pasteFromClipboard,
  cutSelection,
  deleteSelectionContent,
  createLayerFromBlob,

  isSelecting: () => isSelecting,

  // --- NOVO: Funções de Transformação Expostas ---
  isTransforming: () => isTransforming,
  enterTransformMode,
  applyTransform,
  cancelTransform,
  getTransformState: () =>
    isTransforming ? transformState.currentTransform : null,
  setTransformNumeric,
  setTransformAnchor,

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
  screenToProject,
  projectToScreen,
};
