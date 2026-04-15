import { Layer, Project, useProjectStore } from "@/renderer/store/projectStore";
import { BaseTool, ToolContext } from "../tools/BaseTool";
import { MoveTool } from "../tools/MoveTool";
import { BrushTool } from "../tools/BrushTool";
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
  private imageCache: Map<string, HTMLImageElement> = new Map();

  private tools: Record<string, BaseTool> = {
    move: new MoveTool(),
    brush: new BrushTool(),
  };

  private onViewportChange: (zoom: number, x: number, y: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onViewportChange: (zoom: number, x: number, y: number) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onViewportChange = onViewportChange;

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
      canvas: this.canvas,
      ctx: this.ctx,
      updateProject: (updates) => {
        if (this.project) {
          useProjectStore.getState().updateProject(this.project.id, updates);
        }
      },
      invalidateCache: (layerId: string) => this.invalidateLayerCache(layerId),
      screenToProject: (x, y) => this.screenToProject(x, y),
      setLayerCache: (layerId: string, canvas: HTMLCanvasElement) =>
        this.layerCanvasCache.set(layerId, canvas),
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
    this.project = project;
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
    for (const layer of this.project.layers) {
      if (layer.visible) this.renderLayer(layer);
    }

    const tool = this.getActiveTool();
    const context = this.getToolContext();
    if (tool && context) tool.onRender(this.ctx, context);

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
              }
              this.render();
            };
          } else if (img.complete) {
            const lCtx = lCanvas.getContext("2d")!;
            lCtx.drawImage(img, 0, 0);
          }
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
  }
}
