// renderer/engine.js

// 1. Importar todos os módulos
import * as Utils from "./engineUtils.js";
import * as Renderer from "./engineRenderer.js";
import * as Selection from "./engineSelection.js";
import * as History from "./engineHistory.js";
import * as Project from "./engineProject.js";
import * as Layers from "./engineLayers.js";
import * as Clipboard from "./engineClipboard.js";
import * as Drawing from "./engineDrawing.js";
import * as Transform from "./engineTransform.js";
import * as Input from "./engineInput.js";
import * as Crop from "./engineCrop.js";

// --- INÍCIO DA CORREÇÃO ---
// Crie os canvases de seleção "off-screen" aqui,
// no escopo global do módulo.
const selectionCanvas = document.createElement("canvas");
const selectionCtx = selectionCanvas.getContext("2d", {
  willReadFrequently: true, // Otimização para getImageData
});
// --- FIM DA CORREÇÃO ---

// 2. Definir o Objeto de Contexto (Estado Central)
const context = {
  // --- Constantes ---
  ZOOM_SENSITIVITY: 0.05,
  ZOOM_SMOOTHING: 0.15,
  TRANSFOM_HANDLE_SIZE_PROJ: 8,
  STROKE_PADDING: 1000,
  MIN_BRUSH_MOVE_DISTANCE: 1,
  MAX_HISTORY: 50,
  frameInterval: 1000 / 15,

  // --- Elementos DOM ---
  canvas: document.getElementById("mainCanvas"),
  container: document.getElementById("mainCanvas").parentElement,
  ctx: document.getElementById("mainCanvas").getContext("2d"),
  brushPreview: document.getElementById("brushPreview"),
  layersList: document.getElementById("layersList"),

  // --- Estado da Viewport ---
  scale: 1,
  originX: 0,
  originY: 0,
  isPanning: false,
  startX: 0,
  startY: 0,
  currentScale: 1,
  targetScale: 1,

  // --- Estado do Projeto ---
  projectWidth: undefined,
  projectHeight: undefined,
  layers: [],
  activeLayer: null,
  checkerPattern: null,

  // --- Estado das Ferramentas ---
  activeToolId: "moveTool",
  lastUsedToolId: "moveTool",
  tools: {
    brushTool: { size: 50, color: "#000000", hardness: 1.0 },
    pencilTool: { size: 1, color: "#000000", shape: "square" },
    eraserTool: {
      size: 100,
      hardness: 1.0,
      mode: "brush",
      shape: "square",
    },
    moveTool: {},
    selectTool: { mode: "replace" },
    cropTool: {
      mode: "Free", // 'Free' or 'Fixed Ratio'
      ratioW: 1,
      ratioH: 1,
      deleteCropped: true, // Checkbox
    },
    typeTool: {
      color: "#000000",
      size: 40,
      align: "left",
      text: "Lorem Ipsum",
    },
  },

  // --- Estado da Seleção ---
  selectionCanvas: selectionCanvas, // <-- Atribui o canvas recém-criado
  selectionCtx: selectionCtx, // <-- Atribui o context recém-criado
  hasSelection: false,
  selectionBounds: null,
  newSelectionRect: null,
  isSelecting: false,
  isMovingSelection: false,
  selectionMoveStart: { x: 0, y: 0 },
  selectionMoveStartBounds: null,
  selectionEdges: null,
  selectionRestoreData: null, // <-- ADICIONAR ESTA LINHA
  lineDashOffset: 0,
  animationFrameId: null,
  lastFrameTime: 0,

  // --- Estado da Transformação ---
  isTransforming: false,
  transformState: null,

  // --- Estado de Corte ---
  isCropping: false,
  cropState: null,

  // --- Estado do Desenho ---
  isDrawing: false,
  strokeCanvas: null,
  strokeOriginX: 0,
  strokeOriginY: 0,
  lastX: null,
  lastY: null,
  currentStrokeBounds: null,
  draggingLayerState: { isDragging: false, offsetX: 0, offsetY: 0 },

  // --- Estado do Histórico ---
  undoStack: [],
  redoStack: [],

  // --- Funções "Core" (serão preenchidas abaixo) ---
  // Funções que precisam ser chamadas por outros módulos
  draw: null,
  saveState: null,
  restoreState: null,
  clearSelection: null,
  cacheSelectionEdges: null,
  startAnimation: null,
  stopAnimation: null,
  getOptimizedBoundingBox: null,
  createEmptyLayer: null,
  uid: null,
  hexToRgba: null,
  screenToProject: null,
  projectToScreen: null,
  notifyTransformUI: null,
  notifyCropUI: null,
  isPointInSelection: null,
  updateSelectionWithRect: null,
  selectAll: null,
  addLayer: null,
  setActiveLayer: null,
  fitToScreen: null,
  getTransformHandles: null,
  getCropHandles: null,
  getHandleAtPoint: null,
  getCropHandleAtPoint: null,
  localToWorld: null,
  cropLocalToWorld: null,
  startDrawing: null,
  processDrawing: null,
  stopDrawing: null,
  resizeViewport: null,
};
window.context = context; // Expor o contexto

// 3. Definir a Função de Renderização Principal (`draw`)
function draw() {
  const {
    canvas,
    ctx,
    projectWidth,
    projectHeight,
    originX,
    originY,
    scale,
    layers,
    activeLayer,
    isDrawing,
    strokeCanvas,
    strokeOriginX,
    strokeOriginY,
    isTransforming,
    transformState,
    isCropping, // <-- ADICIONAR
    cropState, // <-- ADICIONAR
    hasSelection,
    selectionEdges,
    selectionBounds,
    lineDashOffset,
    newSelectionRect,
  } = context;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!projectWidth || !projectHeight) return;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY);

  // Checkerboard
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const projectXOnScreen = originX;
  const projectYOnScreen = originY;
  const projectWOnScreen = projectWidth * scale;
  const projectHOnScreen = projectHeight * scale;
  ctx.fillStyle = Renderer.getCheckerPattern(context);
  ctx.fillRect(
    projectXOnScreen,
    projectYOnScreen,
    projectWOnScreen,
    projectHOnScreen
  );
  ctx.restore();

  // Helper function para desenhar o cursor e a seleção de texto
  function drawTextCursor(ctx, layer) {
    const textEditor = document.getElementById("textEditor");
    if (!textEditor) return;

    const selStart = textEditor.selectionStart;
    const selEnd = textEditor.selectionEnd;
    const text = layer.text || "";
    const lines = text.split("\n");
    
    const fontSize = layer.fontSize || 40;
    const fontFamily = layer.fontFamily || "Arial";
    const lineHeight = fontSize * 1.2;
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    
    // Função auxiliar para obter coordenadas de um índice
    function getCharCoordinates(index) {
      let currentIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLength = line.length + 1; // +1 for \n
        
        if (index < currentIdx + lineLength) {
          const charInLine = index - currentIdx;
          const subStr = line.substring(0, charInLine);
          const w = ctx.measureText(subStr).width;
          const lineW = ctx.measureText(line).width;
          
          let lineStartX = layer.x;
          if (layer.align === "center") {
             lineStartX = layer.x + (layer.width / 2) - (lineW / 2);
          } else if (layer.align === "right") {
             lineStartX = layer.x + layer.width - lineW;
          }
          
          return {
            x: lineStartX + w,
            y: layer.y + i * lineHeight,
            height: fontSize // ou lineHeight
          };
        }
        currentIdx += lineLength;
      }
      // Fallback para o final
      const lastLineIdx = lines.length - 1;
      const lastLine = lines[lastLineIdx] || "";
      const lineW = ctx.measureText(lastLine).width;
      let lineStartX = layer.x;
      if (layer.align === "center") {
         lineStartX = layer.x + (layer.width / 2) - (lineW / 2);
      } else if (layer.align === "right") {
         lineStartX = layer.x + layer.width - lineW;
      }
      return {
        x: lineStartX + lineW,
        y: layer.y + lastLineIdx * lineHeight,
        height: fontSize
      };
    }

    // Desenhar Seleção (Azul)
    if (selStart !== selEnd) {
      const start = Math.min(selStart, selEnd);
      const end = Math.max(selStart, selEnd);
      
      ctx.fillStyle = "rgba(0, 120, 215, 0.3)"; // Azul semitransparente
      
      // Maneira simplificada: iterar char por char no range (pode ser otimizado)
      for (let i = start; i < end; i++) {
        // Pega coord do char i
        // Precisamos saber a largura do char i
        let currentIdx = 0;
        for (let l = 0; l < lines.length; l++) {
           const line = lines[l];
           const lineLen = line.length + 1;
           if (i >= currentIdx && i < currentIdx + line.length) { // Ignora o \n
              const charInLine = i - currentIdx;
              const charStr = line[charInLine];
              const subStrBefore = line.substring(0, charInLine);
              const xBefore = ctx.measureText(subStrBefore).width;
              const charW = ctx.measureText(charStr).width;
              
              const lineW = ctx.measureText(line).width;
              let lineStartX = layer.x;
              if (layer.align === "center") lineStartX = layer.x + (layer.width / 2) - (lineW / 2);
              else if (layer.align === "right") lineStartX = layer.x + layer.width - lineW;

              ctx.fillRect(lineStartX + xBefore, layer.y + l * lineHeight, charW, lineHeight);
           }
           currentIdx += lineLen;
        }
      }
    }

    // Desenhar Cursor (Piscando)
    if (selStart === selEnd) {
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        const pos = getCharCoordinates(selEnd);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x, pos.y + lineHeight);
        ctx.strokeStyle = layer.color; // Usa cor do texto
        ctx.lineWidth = 2; // Cursor um pouco mais grosso
        ctx.stroke();
      }
      // Força redraw para animação
      // requestAnimationFrame(() => context.draw()); // Cuidado com loop infinito
      if (!context.cursorBlinkInterval) {
         context.cursorBlinkInterval = setInterval(() => context.draw(), 500);
      }
    } else {
      if (context.cursorBlinkInterval) {
        clearInterval(context.cursorBlinkInterval);
        context.cursorBlinkInterval = null;
      }
    }
  }

  // Helper function para desenhar uma camada (para evitar repetição)
  // Helper function modificada para suportar MULTILINHA
  function drawLayer(ctx, layer, activeLayer, isTransforming, transformState) {
    // Configura opacidade e blend mode (se houver essas props no objeto layer)
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
    ctx.globalCompositeOperation = layer.blendMode || "source-over";

    // 1. Caso esteja transformando (Rotacionando/Escalando)
    if (isTransforming && layer === activeLayer && transformState) {
      const t = transformState.currentTransform;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scaleX, t.scaleY);

      if (layer.type === "text") {
        const fontSize = layer.fontSize || 40;
        const fontFamily = layer.fontFamily || "Arial";
        const lineHeight = fontSize * 1.2;

        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = layer.color;
        ctx.textBaseline = "top";
        ctx.textAlign = layer.align || "left";

        const lines = (layer.text || "").split("\n");
        // O ponto de ancoragem define onde o texto começa em relação à caixa de transformação
        const startX = -t.width * t.anchor.x;
        const startY = -t.height * t.anchor.y;

        let x = startX;
        if (ctx.textAlign === "center") x += t.width / 2;
        if (ctx.textAlign === "right") x += t.width;

        lines.forEach((line, index) => {
          ctx.fillText(line, x, startY + index * lineHeight);
        });
      } else {
        // Raster Image
        if (layer.image) {
          ctx.drawImage(
            layer.image,
            -t.width * t.anchor.x,
            -t.height * t.anchor.y
          );
        }
      }
      ctx.restore();
    }
    // 2. Desenho Normal (Estático)
    else {
      if (layer.type === "text") {
        const fontSize = layer.fontSize || 40;
        const fontFamily = layer.fontFamily || "Arial";
        const lineHeight = fontSize * 1.2;

        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = layer.color;
        ctx.textBaseline = "top";
        ctx.textAlign = layer.align || "left";

        const lines = (layer.text || "").split("\n");

        let x = layer.x;
        if (ctx.textAlign === "center") x += layer.width / 2;
        if (ctx.textAlign === "right") x += layer.width;

        lines.forEach((line, index) => {
          ctx.fillText(line, x, layer.y + index * lineHeight);
        });

        // --- NOVO: Desenha o cursor se estiver editando esta camada ---
        if (context.isTextEditing && context.editingLayerId === layer.id) {
           drawTextCursor(ctx, layer);
        }
        // -------------------------------------------------------------

      } else {
        // Raster Image
        if (layer.image) {
          ctx.drawImage(layer.image, layer.x, layer.y);
        }
      }
    }

    // Restaura opacidade para o próximo layer
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // Camadas

  // for (let layer of layers) {
  //   if (!layer.visible) continue;
  //   if (layer === activeLayer && isDrawing) continue;

  //   if (isTransforming && layer === activeLayer && transformState) {
  //     ctx.save();
  //     const t = transformState.currentTransform;
  //     ctx.translate(t.x, t.y);
  //     ctx.rotate((t.rotation * Math.PI) / 180);
  //     ctx.scale(t.scaleX, t.scaleY);
  //     ctx.drawImage(layer.image, -t.width * t.anchor.x, -t.height * t.anchor.y);
  //     ctx.restore();
  //   } else {
  //     ctx.drawImage(layer.image, layer.x, layer.y);
  //   }
  // }

  // Salva o estado ANTES de aplicar o clip
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, projectWidth, projectHeight);
  ctx.clip();

  const projectBounds = {
    x: 0,
    y: 0,
    width: projectWidth,
    height: projectHeight,
  };

  // Loop 1: Desenha camadas que INTERSECTAM (e serão clipadas)
  for (let layer of layers) {
    if (!layer.visible) continue;
    if (layer === activeLayer && isDrawing) continue;

    const w = layer.width || (layer.image ? layer.image.width : 0);
    const h = layer.height || (layer.image ? layer.image.height : 0);

    const layerBounds = {
      x: layer.x,
      y: layer.y,
      width: w,
      height: h,
    };
    const intersects = !(
      layerBounds.x > projectBounds.width ||
      layerBounds.x + layerBounds.width < projectBounds.x ||
      layerBounds.y > projectBounds.height ||
      layerBounds.y + layerBounds.height < projectBounds.y
    );

    if (intersects) {
      drawLayer(ctx, layer, activeLayer, isTransforming, transformState);
    }
  }

  // Restaura o estado (remove o clip)
  ctx.restore();

  // Loop 2: Desenha camadas que NÃO INTERSECTAM (para referência)
  for (let layer of layers) {
    if (!layer.visible) continue;
    if (layer === activeLayer && isDrawing) continue;

    const w = layer.width || (layer.image ? layer.image.width : 0);
    const h = layer.height || (layer.image ? layer.image.height : 0);

    const layerBounds = {
      x: layer.x,
      y: layer.y,
      width: w,
      height: h,
    };
    const intersects = !(
      layerBounds.x > projectBounds.width ||
      layerBounds.x + layerBounds.width < projectBounds.x ||
      layerBounds.y > projectBounds.height ||
      layerBounds.y + layerBounds.height < projectBounds.y
    );

    if (!intersects) {
      drawLayer(ctx, layer, activeLayer, isTransforming, transformState);
    }
  }

  // Traço em andamento (deve ser clipado)
  if (isDrawing && strokeCanvas) {
    ctx.save(); // Clip o traço
    ctx.beginPath();
    ctx.rect(0, 0, projectWidth, projectHeight);
    ctx.clip();
    ctx.drawImage(strokeCanvas, strokeOriginX, strokeOriginY);
    ctx.restore(); // Fim do clip do traço
  }

  // // Traço em andamento
  // if (isDrawing && strokeCanvas) {
  //   ctx.drawImage(strokeCanvas, strokeOriginX, strokeOriginY);
  // }

  // Borda do projeto
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1 / scale;
  ctx.strokeRect(0, 0, projectWidth, projectHeight);

  // Borda da camada ativa
  if (activeLayer && activeLayer.visible && !isTransforming) {
    ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
    ctx.lineWidth = 1 / scale;

    const w =
      activeLayer.width || (activeLayer.image ? activeLayer.image.width : 0);
    const h =
      activeLayer.height || (activeLayer.image ? activeLayer.image.height : 0);

    ctx.strokeRect(activeLayer.x, activeLayer.y, w, h);
  }

  if (isCropping && cropState) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();

    // Path 1: O projeto inteiro (coords do mundo)
    ctx.moveTo(0, 0);
    ctx.lineTo(projectWidth, 0);
    ctx.lineTo(projectWidth, projectHeight);
    ctx.lineTo(0, projectHeight);
    ctx.closePath();

    // Path 2: O buraco (caixa de corte)
    const t = cropState.currentCrop;
    const left = -t.width * t.anchor.x * t.scaleX;
    const top = -t.height * t.anchor.y * t.scaleY;
    const width = t.width * t.scaleX;
    const height = t.height * t.scaleY;

    // Pega os 4 cantos locais e converte para o mundo
    const localCorners = [
      { x: left, y: top }, // top-left
      { x: left + width, y: top }, // top-right
      { x: left + width, y: top + height }, // bottom-right
      { x: left, y: top + height }, // bottom-left
    ];
    // context.cropLocalToWorld está disponível via bind
    const worldCorners = localCorners.map((c) =>
      context.cropLocalToWorld(c.x, c.y)
    );

    ctx.moveTo(worldCorners[0].x, worldCorners[0].y);
    ctx.lineTo(worldCorners[1].x, worldCorners[1].y);
    ctx.lineTo(worldCorners[2].x, worldCorners[2].y);
    ctx.lineTo(worldCorners[3].x, worldCorners[3].y);
    ctx.closePath();

    // Preenche a área entre os dois paths
    ctx.fill("evenodd");
    ctx.restore();
  }

  // Controles de transformação
  if (isTransforming && transformState) {
    Renderer.drawTransformControls(context);
    if (Utils.DebugGet("transformShowHandles")) {
      Renderer.drawDebugHitboxes(context);
    }
  }

  // Controles de corte
  if (isCropping && cropState) {
    Renderer.drawCropControls(context);
  }

  // Seleção (marching ants)
  if (hasSelection && selectionEdges && selectionBounds) {
    ctx.save();
    ctx.translate(selectionBounds.x, selectionBounds.y);
    const lineWidth = 1 / scale;
    const dashLength = 4 / scale;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([dashLength, dashLength]);

    const drawSegments = (segments, offset) => {
      ctx.lineDashOffset = offset;
      ctx.beginPath();
      for (const seg of segments.horizontal) {
        ctx.moveTo(seg.x, seg.y);
        ctx.lineTo(seg.x + seg.length, seg.y);
      }
      for (const seg of segments.vertical) {
        ctx.moveTo(seg.x, seg.y);
        ctx.lineTo(seg.x, seg.y + seg.length);
      }
      ctx.stroke();
    };

    ctx.translate(0.5 / scale, 0.5 / scale); // Nítidez
    ctx.strokeStyle = "white";
    drawSegments(selectionEdges, lineDashOffset / scale);
    ctx.strokeStyle = "black";
    drawSegments(selectionEdges, (lineDashOffset + 4) / scale);
    ctx.restore();
  }

  // Retângulo de seleção temporário
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
  ctx.imageSmoothingEnabled = scale <= 1.0;

  // Grid
  if (scale >= 5) {
    Renderer.drawGrid(context);
  }

  // Zoom overlay
  const zoomEl = document.getElementById("zoomScale");
  if (zoomEl) {
    zoomEl.textContent = Math.round(scale * 100) + "%";
  }
}

/** Restaura a seleção a partir de dados salvos (bounds e dataURL) */
function restoreSelection(context, restoreData) {
  if (!restoreData || !restoreData.bounds || !restoreData.dataURL) {
    context.clearSelection(); // Limpa por via das dúvidas
    return;
  }

  const img = new Image();
  img.onload = () => {
    context.selectionBounds = { ...restoreData.bounds };
    context.selectionCanvas.width = restoreData.bounds.width;
    context.selectionCanvas.height = restoreData.bounds.height;
    context.selectionCtx.drawImage(img, 0, 0);
    context.hasSelection = true;
    context.cacheSelectionEdges();
    context.startAnimation();
    context.draw();
  };
  img.src = restoreData.dataURL;
}

// 4. Ligar (Bind) todas as funções ao Contexto
// Isso permite que os módulos chamem funções uns dos outros (ex: History.js chama Selection.js)
context.draw = draw;
// --- INÍCIO DA MODIFICAÇÃO ---
// Modifique o context.saveState para notificar a UI
context.saveState = () => {
  History.saveState(context); // Chama a função original
  // Notifica a UI (app.js) que o projeto está "sujo"
  if (window.markActiveProjectUnsaved) {
    window.markActiveProjectUnsaved();
  }
};
// --- FIM DA MODIFICAÇÃO ---
context.restoreState = (state) => History.restoreState(context, state);
context.restoreSelection = (data) => restoreSelection(context, data); // <-- ADICIONAR ESTA LINHA
context.clearSelection = () => Selection.clearSelection(context);
context.cacheSelectionEdges = () => Selection.cacheSelectionEdges(context);
context.startAnimation = () => Renderer.startAnimation(context);
context.stopAnimation = () => Renderer.stopAnimation(context);
context.getOptimizedBoundingBox = (canvas, bounds) =>
  Utils.getOptimizedBoundingBox(canvas, bounds);
context.createEmptyLayer = (name) => Layers.createEmptyLayer(context, name);
// context.updateLayersPanel = () => Renderer.updateLayersPanel(context);
context.uid = Utils.uid;
context.hexToRgba = Utils.hexToRgba;
context.screenToProject = (x, y) => Utils.screenToProject(context, x, y);
context.projectToScreen = (x, y) => Utils.projectToScreen(context, x, y);
context.notifyTransformUI = Utils.notifyTransformUI;
context.notifyCropUI = Utils.notifyCropUI; // <-- ADICIONAR
context.isPointInSelection = (x, y) =>
  Selection.isPointInSelection(context, x, y);
context.updateSelectionWithRect = (rect, mode) =>
  Selection.updateSelectionWithRect(context, rect, mode);
context.selectAll = () => Selection.selectAll(context);
context.addLayer = (img, name) => Layers.addLayer(context, img, name);
context.setActiveLayer = (id) => Layers.setActiveLayer(context, id);
context.fitToScreen = () => Project.fitToScreen(context);
context.getTransformHandles = (local) =>
  Transform.getTransformHandles(context, local);
context.getHandleAtPoint = (x, y) => Transform.getHandleAtPoint(context, x, y);
context.localToWorld = (x, y) => Transform.localToWorld(context, x, y);
context.getCropHandles = (local) => Crop.getCropHandles(context, local);
context.getCropHandleAtPoint = (x, y) => Crop.getHandleAtPoint(context, x, y);
context.cropLocalToWorld = (x, y) => Crop.localToWorld(context, x, y);
context.startDrawing = (e) => Drawing.startDrawing(context, e);
context.processDrawing = (e) => Drawing.processDrawing(context, e);
context.stopDrawing = (e) => Drawing.stopDrawing(context, e);
context.resizeViewport = () => Project.resizeViewport(context);
context.handleCropMouseDown = (ctx, e) => Crop.handleCropMouseDown(ctx, e);
context.handleCropMouseMove = (ctx, e) => Crop.handleCropMouseMove(ctx, e);
context.handleCropMouseUp = (ctx, e) => Crop.handleCropMouseUp(ctx, e);

// 5. Inicialização
Input.attachInputListeners(context);
Project.resizeViewport(context); // Ajusta o canvas ao tamanho inicial
draw();

window.addEventListener("resize", (e) => {
  Project.resizeViewport(context);
  draw();
});

// 6. Expor a API Pública (`window.Engine`)
window.Engine = {
  // --- ADICIONE ESTA LINHA ABAIXO ---
  getContext: () => context,

  Debug: {
    // Funções de depuração
    get: (key) => Utils.DebugGet(key),
    set: (key, value) => Utils.DebugSet(context, key, value),
    toggle: (key) => Utils.DebugToggle(context, key),

    // Variáveis de depuração
    transformShowHandles: false,
  },

  // Camadas e Projeto
  loadImage: (filePath) => Layers.loadImage(context, filePath),
  addLayer: (img, name) => Layers.addLayer(context, img, name),
  createNewProject: (w, h) => Project.createNewProject(context, w, h),
  setActiveLayer: (id) => Layers.setActiveLayer(context, id),
  exportImage: () => Project.exportImage(context),
  draw: draw,
  resetViewport: () => Project.resetViewport(context),
  setProject: (
    w,
    h,
    layers,
    viewport,
    selData,
    selBounds,
    activeLayerId,
    // ***** INÍCIO DA CORREÇÃO *****
    historyStack // 1. Aceita o novo argumento
    // ***** FIM DA CORREÇÃO *****
  ) => {
    // ***** INÍCIO DA CORREÇÃO *****

    // 1. REATIVE a chamada para Project.setProject.
    //    O app.js agora envia <img>, que é o que Project.setProject espera.
    // 2. Passe o activeLayerId para que ele possa ser definido
    //    após o carregamento assíncrono das imagens.
    Project.setProject(
      context,
      w,
      h,
      layers,
      viewport,
      selData,
      selBounds,
      activeLayerId,
      // ***** INÍCIO DA CORREÇÃO *****
      historyStack // 2. Passa para a função real
      // ***** FIM DA CORREÇÃO *****
    );

    // 3. REMOVA toda a lógica manual que definia o contexto.
    //    Project.setProject é agora o único responsável por isso.
    /*
    context.layers = layers; 
    context.projectWidth = w;
    context.projectHeight = h;
    ... (toda a lógica que adicionamos antes deve ser removida daqui) ...
    Renderer.updateLayersPanel(context);
    context.draw();
    */
    // ***** FIM DA CORREÇÃO *****
  },
  createEmptyLayer: (name) => Layers.createEmptyLayer(context, name),
  addFillLayer: (color, name) => Layers.addFillLayer(context, color, name),
  updateLayersPanel: () => Renderer.updateLayersPanel(context),

  // Estado
  getState: () => ({
    projectWidth: context.projectWidth,
    projectHeight: context.projectHeight,
    layers: context.layers,
    activeLayerId: context.activeLayer ? context.activeLayer.id : null,
    scale: context.scale,
    originX: context.originX,
    originY: context.originY,
    hasSelection: context.hasSelection,
    selectionDataURL: context.hasSelection
      ? context.selectionCanvas.toDataURL()
      : null,
    selectionBounds: context.hasSelection ? context.selectionBounds : null,
    // ***** INÍCIO DA CORREÇÃO *****
    undoStack: context.undoStack, // Adiciona o stack ao estado
    // ***** FIM DA CORREÇÃO *****
  }),

  // Histórico
  undo: () => History.undo(context),
  redo: () => History.redo(context),

  // Seleção
  selectAll: () => Selection.selectAll(context),
  clearSelection: () => Selection.clearSelection(context),
  isPointInSelection: (px, py) => Selection.isPointInSelection(context, px, py),
  isSelecting: () => context.isSelecting,

  // Área de Transferência
  copySelection: () => Clipboard.copySelection(context),
  pasteFromClipboard: () => Clipboard.pasteFromClipboard(context),
  cutSelection: () => Clipboard.cutSelection(context),
  deleteSelectionContent: () => Clipboard.deleteSelectionContent(context),
  createLayerFromBlob: (blob, pos, isCenter) =>
    Clipboard.createLayerFromBlob(context, blob, pos, isCenter),

  // Transformação
  isTransforming: () => context.isTransforming,
  enterTransformMode: () => Transform.enterTransformMode(context),
  applyTransform: () => Transform.applyTransform(context),
  cancelTransform: () => Transform.cancelTransform(context, false),
  getTransformState: () =>
    context.isTransforming ? context.transformState.currentTransform : null,
  setTransformNumeric: (opt, val) =>
    Transform.setTransformNumeric(context, opt, val),
  setTransformAnchor: (anchor) => Transform.setTransformAnchor(context, anchor),

  // Corte
  isCropping: () => context.isCropping,
  enterCropMode: (rect) => Crop.enterCropMode(context, rect),
  applyCrop: () => Crop.applyCrop(context),
  cancelCrop: () => Crop.cancelCrop(context),
  getCropState: () =>
    context.isCropping ? context.cropState.currentCrop : null,
  setCropNumeric: (opt, val) => Crop.setCropNumeric(context, opt, val),
  setCropAnchor: (anchor) => Crop.setCropAnchor(context, anchor),
  applyCropRatio: (basedOn) => Crop.applyCropRatio(context, basedOn), // <-- ADICIONE ESTA LINHA

  // Ferramentas
  setActiveTool: (toolId) => {
    if (context.tools[toolId]) {
      // --- INÍCIO DA CORREÇÃO (UX de Corte) ---

      if (toolId === "cropTool") {
        // Se já está cortando, não faz nada
        if (context.isCropping) {
          return;
        }

        // NOVO: Se há uma seleção, entra no modo de corte usando-a
        if (context.hasSelection && context.selectionBounds) {
          // Passa os bounds da seleção para enterCropMode.
          // enterCropMode irá definir context.isCropping = true
          // e context.activeToolId = 'cropTool'
          // A função enterCropMode (em engineCrop.js) já limpa
          // a seleção, o que é o comportamento esperado.
          Crop.enterCropMode(context, context.selectionBounds);
        } else {
          // Se não há seleção, apenas define a ferramenta como ativa (modo ocioso)
          context.activeToolId = toolId;
        }
      } else {
        // Para qualquer outra ferramenta, apenas define como ativa
        context.activeToolId = toolId;
      }
      // --- FIM DA CORREÇÃO ---
    }
  },

  setToolOption: (toolId, option, value) => {
    if (context.tools[toolId]) {
      context.tools[toolId][option] = value;
    }
  },
  getToolState: (toolId) => context.tools[toolId] || {},
  getActiveToolId: () => context.activeToolId,

  // Utilitários
  screenToProject: (x, y) => Utils.screenToProject(context, x, y),
  projectToScreen: (x, y) => Utils.projectToScreen(context, x, y),
};
