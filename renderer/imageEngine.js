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

// NOVO: Clipboard interno para copiar e colar
// let internalClipboard = null;

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

// --- NOVO: Animação para a seleção "marching ants" ---
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

// --- NOVO: Função para calcular e armazenar em cache as bordas da seleção ---
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

    // NOVO: Aplica a translação de meio pixel para linhas nítidas
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

// --- NOVO: ADD FILL LAYER ---
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

// REMOVA OS LISTENERS ANTIGOS (mousedown, mousemove, mouseup, mouseleave) DO CANVAS E SUBSTITUA POR ESTE BLOCO

// --- Novas funções de manipulação de eventos de desenho ---

function startDrawing(e) {
  // const isBrushActive = document.getElementById("brushTool").hasAttribute("active"); // <-- REMOVER
  // const isEraserActive = document.getElementById("eraserTool").hasAttribute("active"); // <-- REMOVER

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

  // NOVO: Desabilita anti-aliasing para o lápis
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

  // NOVO: Apenas desenha se o mouse se moveu o suficiente
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

  // NOVO: Adicione esta linha para expor o estado
  isSelecting: () => isSelecting,

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
