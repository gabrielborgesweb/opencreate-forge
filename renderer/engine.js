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
  },

  // --- Estado da Seleção ---
  selectionCanvas: null,
  selectionCtx: null,
  hasSelection: false,
  selectionBounds: null,
  newSelectionRect: null,
  isSelecting: false,
  isMovingSelection: false,
  selectionMoveStart: { x: 0, y: 0 },
  selectionMoveStartBounds: null,
  selectionEdges: null,
  lineDashOffset: 0,
  animationFrameId: null,
  lastFrameTime: 0,

  // --- Estado da Transformação ---
  isTransforming: false,
  transformState: null,

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
  isPointInSelection: null,
  updateSelectionWithRect: null,
  selectAll: null,
  addLayer: null,
  setActiveLayer: null,
  fitToScreen: null,
  getTransformHandles: null,
  getHandleAtPoint: null,
  localToWorld: null,
  startDrawing: null,
  processDrawing: null,
  stopDrawing: null,
};

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
    hasSelection,
    selectionEdges,
    selectionBounds,
    lineDashOffset,
    newSelectionRect,
  } = context;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!projectWidth || !projectHeight) return;

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

  // Camadas
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, originX, originY);

  for (let layer of layers) {
    if (!layer.visible) continue;
    if (layer === activeLayer && isDrawing) continue;

    if (isTransforming && layer === activeLayer && transformState) {
      ctx.save();
      const t = transformState.currentTransform;
      ctx.translate(t.x, t.y);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scaleX, t.scaleY);
      ctx.drawImage(layer.image, -t.width * t.anchor.x, -t.height * t.anchor.y);
      ctx.restore();
    } else {
      ctx.drawImage(layer.image, layer.x, layer.y);
    }
  }

  // Traço em andamento
  if (isDrawing && strokeCanvas) {
    ctx.drawImage(strokeCanvas, strokeOriginX, strokeOriginY);
  }

  // Borda do projeto
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2 / Math.max(scale, 1);
  ctx.strokeRect(0, 0, projectWidth, projectHeight);

  // Borda da camada ativa
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

  // Controles de transformação
  if (isTransforming && transformState) {
    Renderer.drawTransformControls(context);
    if (Utils.DebugGet("transformShowHandles")) {
      Renderer.drawDebugHitboxes(context);
    }
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

// 4. Ligar (Bind) todas as funções ao Contexto
// Isso permite que os módulos chamem funções uns dos outros (ex: History.js chama Selection.js)
context.draw = draw;
context.saveState = () => History.saveState(context);
context.restoreState = (state) => History.restoreState(context, state);
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
context.startDrawing = (e) => Drawing.startDrawing(context, e);
context.processDrawing = (e) => Drawing.processDrawing(context, e);
context.stopDrawing = (e) => Drawing.stopDrawing(context, e);

// 5. Inicialização
Input.attachInputListeners(context);
Project.resizeViewport(context); // Ajusta o canvas ao tamanho inicial
draw();

window.addEventListener("resize", (e) => {
  Project.resizeViewport(context);
  draw();
});

window.context = context; // Para depuração

// 6. Expor a API Pública (`window.Engine`)
window.Engine = {
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
  setProject: (w, h, layers, viewport, selData, selBounds) =>
    Project.setProject(context, w, h, layers, viewport, selData, selBounds),
  createEmptyLayer: (name) => Layers.createEmptyLayer(context, name),
  addFillLayer: (color, name) => Layers.addFillLayer(context, color, name),
  updateLayersPanel: () => Renderer.updateLayersPanel(context),

  // Estado
  getState: () => ({
    projectWidth: context.projectWidth,
    projectHeight: context.projectHeight,
    layers: context.layers,
    activeLayer: context.activeLayer,
    scale: context.scale,
    originX: context.originX,
    originY: context.originY,
    hasSelection: context.hasSelection,
    selectionDataURL: context.hasSelection
      ? context.selectionCanvas.toDataURL()
      : null,
    selectionBounds: context.hasSelection ? context.selectionBounds : null,
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

  // Ferramentas
  setActiveTool: (toolId) => {
    if (context.tools[toolId]) {
      context.activeToolId = toolId;
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
