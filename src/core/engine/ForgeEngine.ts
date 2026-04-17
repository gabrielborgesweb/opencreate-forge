import { Layer, Project, useProjectStore } from "@/renderer/store/projectStore";
import { BaseTool, ToolContext } from "../tools/BaseTool";
import { MoveTool } from "../tools/MoveTool";
import { BrushTool } from "../tools/BrushTool";
import { PencilTool } from "../tools/PencilTool";
import { EraserTool } from "../tools/EraserTool";
import { TransformTool } from "../tools/TransformTool";
import { SelectTool } from "../tools/SelectTool";
import { CropTool } from "../tools/CropTool";
import { useToolStore } from "@/renderer/store/toolStore";

export interface ViewportState {
  scale: number;
  originX: number;
  originY: number;
}

export class ForgeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: Project | null = null;
  private checkerPattern: CanvasPattern | null = null;

  private ZOOM_SENSITIVITY = 0.05;
  private ZOOM_SMOOTHING = 0.15;
  private animationFrameId: number | null = null;

  private isPanning = false;
  private startX = 0;
  private startY = 0;

  private layerCanvasCache: Map<string, HTMLCanvasElement> = new Map();
  private layerReadyCache: Map<string, boolean> = new Map();
  private imageCache: Map<string, HTMLImageElement> = new Map();

  private selectionCanvas: HTMLCanvasElement;
  private selectionCtx: CanvasRenderingContext2D;
  private selectionEdges: { horizontal: any[]; vertical: any[] } | null = null;
  private marchingAntsOffset = 0;
  private lastSelectionMask: string | undefined = undefined;

  private tools: Record<string, BaseTool>;

  private currentToolId: string | null = null;
  private onViewportChange: (zoom: number, x: number, y: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onViewportChange: (zoom: number, x: number, y: number) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onViewportChange = onViewportChange;

    this.selectionCanvas = document.createElement("canvas");
    this.selectionCtx = this.selectionCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;

    this.tools = {
      move: new MoveTool(),
      select: new SelectTool(),
      brush: new BrushTool(),
      pencil: new PencilTool(),
      eraser: new EraserTool(),
      transform: new TransformTool(),
      crop: new CropTool(),
    };

    this.handleWheel = this.handleWheel.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    this.setupEventListeners();
    this.startRenderLoop();
  }

  private setupEventListeners() {
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  }

  private getActiveTool(): BaseTool | null {
    const activeToolId = useToolStore.getState().activeToolId;
    return this.tools[activeToolId] || null;
  }

  private getToolContext(): ToolContext | null {
    if (!this.project) return null;
    return {
      project: this.project,
      settings: useToolStore.getState().toolSettings,
      canvas: this.canvas,
      ctx: this.ctx,
      updateProject: (updates) => {
        if (this.project) {
          useProjectStore.getState().updateProject(this.project.id, updates);
        }
      },
      invalidateCache: (layerId: string) => this.invalidateLayerCache(layerId),
      screenToProject: (x, y) => this.screenToProject(x, y),
      getSelectionCanvas: () => ({
        canvas: this.selectionCanvas,
        ctx: this.selectionCtx,
      }),
      updateSelectionEdges: () => this.updateSelectionEdges(),
      setLastSelectionMask: (mask) => {
        this.lastSelectionMask = mask;
      },
      setInteracting: (isInteracting) =>
        useToolStore.getState().setInteracting(isInteracting),
      setActiveTool: (id) => useToolStore.getState().setActiveTool(id),
      updateToolSettings: (id, settings) =>
        useToolStore.getState().updateToolSettings(id, settings),
      subscribe: (listener) =>
        useToolStore.subscribe((state) => listener(state.toolSettings)),
      setLayerCache: (layerId: string, canvas: HTMLCanvasElement) => {
        this.layerCanvasCache.set(layerId, canvas);
        this.layerReadyCache.set(layerId, true);
      },
      getLayerCanvas: (layerId: string) => {
        const canvas = this.layerCanvasCache.get(layerId);
        if (!canvas) return null;
        return { canvas, ready: !!this.layerReadyCache.get(layerId) };
      },
    };
  }

  public screenToProject(x: number, y: number) {
    if (!this.project) return { x, y };
    return {
      x: (x - this.project.panX) / this.project.zoom,
      y: (y - this.project.panY) / this.project.zoom,
    };
  }

  private handleWheel(e: WheelEvent) {
    if (!this.project) return;
    e.preventDefault();

    let newScale = this.project.zoom;
    let newOriginX = this.project.panX;
    let newOriginY = this.project.panY;

    if (e.ctrlKey || e.metaKey) {
      const mx = e.offsetX;
      const my = e.offsetY;
      const wheelDelta = -e.deltaY;
      const normalizedDelta =
        Math.sign(wheelDelta) *
        Math.min(Math.abs(wheelDelta * this.ZOOM_SENSITIVITY), 0.5);

      const zoomFactor = Math.exp(normalizedDelta);
      const targetScale = Math.min(
        Math.max(this.project.zoom * zoomFactor, 0.05),
        50,
      );

      const scaleChange =
        (targetScale - this.project.zoom) * this.ZOOM_SMOOTHING;
      newScale = this.project.zoom + scaleChange;

      newOriginX =
        mx - (mx - this.project.panX) * (newScale / this.project.zoom);
      newOriginY =
        my - (my - this.project.panY) * (newScale / this.project.zoom);
    } else {
      newOriginX = this.project.panX - e.deltaX;
      newOriginY = this.project.panY - e.deltaY;
    }

    this.project.zoom = newScale;
    this.project.panX = newOriginX;
    this.project.panY = newOriginY;

    this.onViewportChange(newScale, newOriginX, newOriginY);
  }

  private handleMouseDown(e: MouseEvent) {
    if (!this.project) return;

    if (e.button === 1) {
      this.isPanning = true;
      this.startX = e.clientX - this.project.panX;
      this.startY = e.clientY - this.project.panY;
      this.canvas.style.cursor = "grabbing";
      e.preventDefault();
      return;
    }

    const tool = this.getActiveTool();
    const context = this.getToolContext();
    if (tool && context) {
      tool.onMouseDown(e, context);
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.project) return;

    if (this.isPanning) {
      const newPanX = e.clientX - this.startX;
      const newPanY = e.clientY - this.startY;

      this.project.panX = newPanX;
      this.project.panY = newPanY;

      this.onViewportChange(this.project.zoom, newPanX, newPanY);
      return;
    }

    const tool = this.getActiveTool();
    const context = this.getToolContext();
    if (tool && context) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseEvent =
        e.target === this.canvas
          ? e
          : ({
              ...e,
              offsetX: e.clientX - rect.left,
              offsetY: e.clientY - rect.top,
            } as MouseEvent);

      tool.onMouseMove(mouseEvent, context);
    }
  }

  private handleMouseUp(e: MouseEvent) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
      return;
    }

    const tool = this.getActiveTool();
    const context = this.getToolContext();
    if (tool && context) {
      tool.onMouseUp(e, context);
    }
  }

  private startRenderLoop() {
    const loop = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stopRenderLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }

  private getCheckerPattern(): CanvasPattern {
    if (!this.checkerPattern) {
      const size = 8;
      const patternCanvas = document.createElement("canvas");
      patternCanvas.width = size * 2;
      patternCanvas.height = size * 2;
      const pctx = patternCanvas.getContext("2d")!;
      pctx.imageSmoothingEnabled = false;
      pctx.fillStyle = "#333";
      pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
      pctx.fillStyle = "#444";
      pctx.fillRect(0, 0, size, size);
      pctx.fillRect(size, size, size, size);
      this.checkerPattern = this.ctx.createPattern(patternCanvas, "repeat")!;
    }
    return this.checkerPattern;
  }

  public setProject(project: Project) {
    const prevProjectId = this.project?.id;
    const maskChanged = project.selection.mask !== this.lastSelectionMask;
    this.project = project;

    if (prevProjectId !== project.id) {
      // Clear caches for new project
      this.layerCanvasCache.clear();
      this.layerReadyCache.clear();
      this.imageCache.clear();
    }

    if (maskChanged || prevProjectId !== project.id) {
      this.lastSelectionMask = project.selection.mask;
      // Reset selection canvas
      if (project.selection.bounds && project.selection.mask) {
        this.selectionCanvas.width = project.selection.bounds.width;
        this.selectionCanvas.height = project.selection.bounds.height;
        const img = new Image();
        img.onload = () => {
          this.selectionCtx.clearRect(
            0,
            0,
            this.selectionCanvas.width,
            this.selectionCanvas.height,
          );
          this.selectionCtx.drawImage(img, 0, 0);
          this.updateSelectionEdges();
        };
        img.src = project.selection.mask;
      } else {
        this.selectionCanvas.width = 1;
        this.selectionCanvas.height = 1;
        this.selectionCtx.clearRect(0, 0, 1, 1);
        this.selectionEdges = null;
      }
    } else if (project.selection.hasSelection && !this.selectionEdges) {
      // Caso a máscara não tenha mudado (já sincronizada pelo Tool), mas as bordas ainda não existam
      this.updateSelectionEdges();
    }
  }

  private updateSelectionEdges() {
    if (!this.project || !this.project.selection.hasSelection) {
      this.selectionEdges = null;
      return;
    }

    const w = this.selectionCanvas.width;
    const h = this.selectionCanvas.height;
    if (w <= 0 || h <= 0) {
      this.selectionEdges = null;
      return;
    }

    const imageData = this.selectionCtx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const horizontal: any[] = [];
    const vertical: any[] = [];

    const isSelected = (x: number, y: number) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      return data[(y * w + x) * 4 + 3] > 0;
    };

    for (let y = -1; y < h; y++) {
      for (let x = -1; x < w; x++) {
        const current = isSelected(x, y);
        if (current !== isSelected(x, y + 1)) {
          horizontal.push({ x: x, y: y + 1, length: 1 });
        }
        if (current !== isSelected(x + 1, y)) {
          vertical.push({ x: x + 1, y: y, length: 1 });
        }
      }
    }

    const mergeSegments = (
      segments: any[],
      orientation: "horizontal" | "vertical",
    ) => {
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

    this.selectionEdges = {
      horizontal: mergeSegments(horizontal, "horizontal"),
      vertical: mergeSegments(vertical, "vertical"),
    };
  }

  private renderSelection() {
    if (
      !this.project ||
      !this.project.selection.hasSelection ||
      !this.selectionEdges ||
      !this.project.selection.bounds
    ) {
      return;
    }

    this.ctx.save();
    this.ctx.setTransform(
      this.project.zoom,
      0,
      0,
      this.project.zoom,
      this.project.panX,
      this.project.panY,
    );

    const { x: bx, y: by } = this.project.selection.bounds;
    const zoom = this.project.zoom;

    this.marchingAntsOffset = (Date.now() / 100) % 8;

    this.ctx.lineWidth = 1 / zoom;

    // Render horizontal edges
    for (const seg of this.selectionEdges.horizontal) {
      this.ctx.beginPath();
      this.ctx.setLineDash([4 / zoom, 4 / zoom]);
      this.ctx.lineDashOffset = -this.marchingAntsOffset / zoom;

      // Desenha linha branca
      this.ctx.strokeStyle = "white";
      this.ctx.moveTo(bx + seg.x, by + seg.y);
      this.ctx.lineTo(bx + seg.x + seg.length, by + seg.y);
      this.ctx.stroke();

      // Desenha linha preta intercalada (contraste)
      this.ctx.beginPath();
      this.ctx.strokeStyle = "black";
      this.ctx.lineDashOffset = -(this.marchingAntsOffset + 4) / zoom;
      this.ctx.moveTo(bx + seg.x, by + seg.y);
      this.ctx.lineTo(bx + seg.x + seg.length, by + seg.y);
      this.ctx.stroke();
    }

    // Render vertical edges
    for (const seg of this.selectionEdges.vertical) {
      this.ctx.beginPath();
      this.ctx.setLineDash([4 / zoom, 4 / zoom]);
      this.ctx.lineDashOffset = -this.marchingAntsOffset / zoom;

      this.ctx.strokeStyle = "white";
      this.ctx.moveTo(bx + seg.x, by + seg.y);
      this.ctx.lineTo(bx + seg.x, by + seg.y + seg.length);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.strokeStyle = "black";
      this.ctx.lineDashOffset = -(this.marchingAntsOffset + 4) / zoom;
      this.ctx.moveTo(bx + seg.x, by + seg.y);
      this.ctx.lineTo(bx + seg.x, by + seg.y + seg.length);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  public fitToScreen() {
    if (!this.project || !this.canvas.parentElement) return;
    const cw = this.canvas.parentElement.clientWidth;
    const ch = this.canvas.parentElement.clientHeight;
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    const padding = 40;
    const scaleX = (cw - padding * 2) / this.project.width;
    const scaleY = (ch - padding * 2) / this.project.height;
    const scale = Math.min(scaleX, scaleY);
    const originX = (cw - this.project.width * scale) / 2;
    const originY = (ch - this.project.height * scale) / 2;
    this.project.zoom = scale;
    this.project.panX = originX;
    this.project.panY = originY;
    this.onViewportChange(scale, originX, originY);
  }

  public render() {
    if (!this.project) return;

    // Detectar mudança de ferramenta
    const activeToolId = useToolStore.getState().activeToolId;
    if (activeToolId !== this.currentToolId) {
      const context = this.getToolContext();
      if (context) {
        if (this.currentToolId && this.tools[this.currentToolId]) {
          this.tools[this.currentToolId].onDeactivate(context);
        }
        this.currentToolId = activeToolId;
        if (this.currentToolId && this.tools[this.currentToolId]) {
          this.tools[this.currentToolId].onActivate(context);
        }
        // Reset cursor default ao trocar
        this.canvas.style.cursor = "default";
      }
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.save();
    this.ctx.setTransform(
      this.project.zoom,
      0,
      0,
      this.project.zoom,
      this.project.panX,
      this.project.panY,
    );
    this.ctx.fillStyle = this.getCheckerPattern();
    this.ctx.fillRect(0, 0, this.project.width, this.project.height);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.setTransform(
      this.project.zoom,
      0,
      0,
      this.project.zoom,
      this.project.panX,
      this.project.panY,
    );

    const tool = this.getActiveTool();
    const editingLayerId = tool?.getEditingLayerId();

    for (const layer of this.project.layers) {
      if (layer.visible && layer.id !== editingLayerId) {
        this.renderLayer(layer);
      }
    }

    const context = this.getToolContext();
    if (tool && context) tool.onRender(this.ctx, context);

    this.renderSelection();

    if (this.project.activeLayerId) {
      const activeLayer = this.project.layers.find(
        (l) => l.id === this.project?.activeLayerId,
      );
      if (activeLayer && activeLayer.visible) {
        this.ctx.save();
        this.ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
        this.ctx.lineWidth = 1 / this.project.zoom;
        this.ctx.setLineDash([4 / this.project.zoom, 2 / this.project.zoom]);
        this.ctx.strokeRect(
          activeLayer.x,
          activeLayer.y,
          activeLayer.width,
          activeLayer.height,
        );
        this.ctx.restore();
      }
    }
    this.ctx.restore();
  }

  private renderLayer(layer: Layer) {
    this.ctx.save();
    this.ctx.globalAlpha = layer.opacity / 100;
    this.ctx.globalCompositeOperation = layer.blendMode;

    if (layer.type === "raster") {
      let lCanvas = this.layerCanvasCache.get(layer.id);
      if (
        !lCanvas ||
        lCanvas.width !== layer.width ||
        lCanvas.height !== layer.height
      ) {
        lCanvas = document.createElement("canvas");
        lCanvas.width = layer.width;
        lCanvas.height = layer.height;
        this.layerCanvasCache.set(layer.id, lCanvas);

        if (layer.data) {
          let img = this.imageCache.get(layer.data);
          if (!img) {
            img = new Image();
            img.src = layer.data;
            this.imageCache.set(layer.data, img);
            img.onload = () => {
              // CORREÇÃO: Garante que a imagem seja desenhada no cache assim que carregar
              const cachedCanvas = this.layerCanvasCache.get(layer.id);
              if (cachedCanvas && img) {
                const ctx = cachedCanvas.getContext("2d")!;
                ctx.clearRect(0, 0, cachedCanvas.width, cachedCanvas.height);
                ctx.drawImage(img, 0, 0);
                this.layerReadyCache.set(layer.id, true);
              }
              this.render();
            };
          } else if (img.complete) {
            const lCtx = lCanvas.getContext("2d")!;
            lCtx.drawImage(img, 0, 0);
            this.layerReadyCache.set(layer.id, true);
          }
        } else {
          // Camada sem data (vazia) está "pronta"
          this.layerReadyCache.set(layer.id, true);
        }
      }
      this.ctx.drawImage(lCanvas, layer.x, layer.y);
    } else if (layer.type === "text") {
      this.ctx.fillStyle = layer.color || "#ffffff";
      this.ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
      this.ctx.fillText(
        layer.text || "",
        layer.x,
        layer.y + (layer.fontSize || 0),
      );
    }
    this.ctx.restore();
  }

  public invalidateLayerCache(layerId: string) {
    this.layerCanvasCache.delete(layerId);
    this.layerReadyCache.delete(layerId);
  }
}
