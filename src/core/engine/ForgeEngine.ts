import { Layer, Project, useProjectStore } from "@/renderer/store/projectStore";
import { BaseTool, ToolContext } from "../tools/BaseTool";
import { MoveTool } from "../tools/MoveTool";
import { BrushTool } from "../tools/BrushTool";
import { PencilTool } from "../tools/PencilTool";
import { EraserTool } from "../tools/EraserTool";
import { TransformTool } from "../tools/TransformTool";
import { SelectTool } from "../tools/SelectTool";
import { CropTool } from "../tools/CropTool";
import { TextTool } from "../tools/TextTool";
import { useToolStore } from "@/renderer/store/toolStore";
import { useUIStore } from "@/renderer/store/uiStore";
import { getOptimizedBoundingBox } from "../utils/imageUtils";
import { RasterLayer } from "../layers/RasterLayer";
import { TextLayer } from "../layers/TextLayer";
import { GroupLayer } from "../layers/GroupLayer";

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
  private viewportAnimationId: number | null = null;

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
  private isCtrlPressed = false;

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
      text: new TextTool(),
    };

    this.handleWheel = this.handleWheel.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.setupEventListeners();
    this.startRenderLoop();
  }

  private setupEventListeners() {
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    this.canvas.addEventListener("dblclick", this.handleDoubleClick);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("keydown", (e) => {
      this.isCtrlPressed = e.ctrlKey || e.metaKey;
      this.handleKeyDown(e);
    });
    window.addEventListener("keyup", (e) => {
      this.isCtrlPressed = e.ctrlKey || e.metaKey;
    });
    window.addEventListener("forge:clear-selection", () => {
      if (this.project) {
        this.clearSelection();
      }
    });
  }

  private async clearSelection() {
    if (!this.project) return;
    if (this.project.selection.floatingLayer) {
      await this.commitFloatingLayer();
    }
    useProjectStore.getState().updateProject(this.project.id, {
      selection: { hasSelection: false, bounds: null, mask: undefined, floatingLayer: null },
    });
    this.selectionCanvas.width = 1;
    this.selectionCanvas.height = 1;
    this.selectionCtx.clearRect(0, 0, 1, 1);
    this.updateSelectionEdges();
  }

  private handleKeyDown(e: KeyboardEvent) {
    const tool = this.getActiveTool();
    const context = this.getToolContext();
    if (tool && context) {
      const consumed = tool.onKeyDown(e, context);
      if (consumed) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && e.key.toLowerCase() === "c") {
      this.copyToClipboard();
    } else if (isCtrl && e.key.toLowerCase() === "v") {
      this.pasteFromClipboard();
    } else if (isCtrl && e.key.toLowerCase() === "x") {
      this.cutToClipboard();
    }
  }

  public async cutToClipboard() {
    if (!this.project || !this.project.activeLayerId) return;

    // 1. Copy first
    await this.copyToClipboard();

    // 2. Clear selection
    const activeLayer = this.project.layers.find((l) => l.id === this.project?.activeLayerId);
    if (!activeLayer || activeLayer.type !== "raster" || !activeLayer.data) return;

    const layerCanvas = this.layerCanvasCache.get(activeLayer.id);
    if (!layerCanvas) return;

    if (this.project.selection.hasSelection && this.project.selection.bounds) {
      const { bounds } = this.project.selection;
      const ctx = layerCanvas.getContext("2d")!;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";

      // Draw selection mask relative to layer
      ctx.drawImage(this.selectionCanvas, bounds.x - activeLayer.x, bounds.y - activeLayer.y);
      ctx.restore();

      // Update project store
      useProjectStore.getState().updateLayer(this.project.id, activeLayer.id, {
        data: layerCanvas.toDataURL(),
      });
      this.invalidateLayerCache(activeLayer.id);
    } else {
      // If no selection, maybe clear whole layer?
      // Most editors "Cut" whole layer if no selection, but let's just do nothing for safety or clear it.
      // Standard behavior: Cut entire layer.
      useProjectStore.getState().updateLayer(this.project.id, activeLayer.id, {
        data: undefined,
      });
      this.invalidateLayerCache(activeLayer.id);
    }
  }

  public async copyToClipboard() {
    if (!this.project || !this.project.activeLayerId) return;

    const activeLayer = this.project.layers.find((l) => l.id === this.project?.activeLayerId);
    if (!activeLayer || activeLayer.type !== "raster" || !activeLayer.data) return;

    // Check if layer is visible or locked
    if (!activeLayer.visible) {
      useUIStore.getState().showToast("Cannot copy from a hidden layer", "warning");
      return;
    }
    if (activeLayer.locked) {
      // For copy it might be okay, but user asked to prevent it for both
      useUIStore.getState().showToast("Cannot copy from a locked layer", "warning");
      return;
    }

    let sourceCanvas: HTMLCanvasElement;
    let finalX = activeLayer.x;
    let finalY = activeLayer.y;

    const layerCanvas = this.layerCanvasCache.get(activeLayer.id);
    if (!layerCanvas) return;

    if (!this.project.selection.hasSelection || !this.project.selection.bounds) {
      sourceCanvas = layerCanvas;
    } else {
      const { bounds } = this.project.selection;

      // 1. First, check if there are ANY pixels in this selection on the current layer
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;
      const tempCtx = tempCanvas.getContext("2d")!;

      const layerOffsetX = activeLayer.x - bounds.x;
      const layerOffsetY = activeLayer.y - bounds.y;

      tempCtx.drawImage(layerCanvas, layerOffsetX, layerOffsetY);
      tempCtx.globalCompositeOperation = "destination-in";
      tempCtx.drawImage(this.selectionCanvas, 0, 0);

      const optimizedBounds = getOptimizedBoundingBox(tempCanvas, {
        x: 0,
        y: 0,
        width: tempCanvas.width,
        height: tempCanvas.height,
      });

      // Selection is empty for this layer
      if (!optimizedBounds) {
        useUIStore.getState().showToast("The selection is empty on this layer", "warning");
        return;
      }

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = optimizedBounds.width;
      finalCanvas.height = optimizedBounds.height;
      const finalCtx = finalCanvas.getContext("2d")!;
      finalCtx.drawImage(
        tempCanvas,
        optimizedBounds.x,
        optimizedBounds.y,
        optimizedBounds.width,
        optimizedBounds.height,
        0,
        0,
        optimizedBounds.width,
        optimizedBounds.height,
      );
      sourceCanvas = finalCanvas;
      finalX = bounds.x + optimizedBounds.x;
      finalY = bounds.y + optimizedBounds.y;
    }

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        sourceCanvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;

      const metadata = {
        source: "forge-editor",
        projectId: this.project.id,
        x: finalX,
        y: finalY,
      };

      const metadataBlob = new Blob([JSON.stringify(metadata)], {
        type: "text/plain",
      });

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
          "text/plain": metadataBlob,
        }),
      ]);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }

  public async pasteFromClipboard() {
    if (!this.project) return;

    // Deselect if selection is empty (standard QoL behavior)
    if (this.project.selection.hasSelection) {
      // If we have a selection, let's just clear it to paste normally
      // Usually editors paste INSIDE if there's a selection, but here the request is:
      // "colar e a seleção estiver vazia, tirar a seleção e colar normalmente"
      // If the selection has NO pixels it's redundant to keep it.
      // Most users actually want to paste as new layer and ignore selection if it's just a rectangle.
      useProjectStore.getState().updateProject(this.project.id, {
        selection: { hasSelection: false, bounds: null, mask: undefined },
      });
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (!imageType) continue;

        let pasteX: number | null = null;
        let pasteY: number | null = null;

        if (item.types.includes("text/plain")) {
          const textBlob = await item.getType("text/plain");
          const text = await textBlob.text();
          try {
            const metadata = JSON.parse(text);
            if (metadata.source === "forge-editor") {
              pasteX = metadata.x;
              pasteY = metadata.y;
            }
          } catch (_) {
            // Not our metadata
          }
        }

        const imageBlob = await item.getType(imageType);
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            if (pasteX === null || pasteY === null) {
              // Center in viewport
              const viewportWidth = this.canvas.width;
              const viewportHeight = this.canvas.height;
              const projCenterX = (viewportWidth / 2 - this.project!.panX) / this.project!.zoom;
              const projCenterY = (viewportHeight / 2 - this.project!.panY) / this.project!.zoom;
              pasteX = Math.round(projCenterX - img.naturalWidth / 2);
              pasteY = Math.round(projCenterY - img.naturalHeight / 2);
            }

            useProjectStore.getState().addLayer(this.project!.id, {
              name: "Pasted Layer",
              type: "raster",
              data: dataUrl,
              width: img.naturalWidth,
              height: img.naturalHeight,
              x: pasteX,
              y: pasteY,
            });
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(imageBlob);
        break; // Only paste the first image found
      }
    } catch (err) {
      console.error("Failed to paste from clipboard:", err);
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

  private getActiveTool(): BaseTool | null {
    const activeToolId = useToolStore.getState().activeToolId;
    return this.tools[activeToolId] || null;
  }

  private getToolContext(): ToolContext | null {
    if (!this.project) return null;
    const toolStore = useToolStore.getState();

    const context = {
      activeToolId: toolStore.activeToolId,
      previousToolId: toolStore.previousToolId,
      get settings() {
        return useToolStore.getState().toolSettings;
      },
      canvas: this.canvas,
      ctx: this.ctx,
      updateProject: (updates: Partial<Project>) => {
        if (this.project) {
          useProjectStore.getState().updateProject(this.project.id, updates);
        }
      },
      invalidateCache: (layerId: string) => this.invalidateLayerCache(layerId),
      screenToProject: (x: number, y: number) => this.screenToProject(x, y),
      getSelectionCanvas: () => ({
        canvas: this.selectionCanvas,
        ctx: this.selectionCtx,
      }),
      updateSelectionEdges: () => this.updateSelectionEdges(),
      setLastSelectionMask: (mask: string | undefined) => {
        this.lastSelectionMask = mask;
      },
      floatSelection: (layerId: string) => this.floatSelection(layerId),
      commitFloatingLayer: () => this.commitFloatingLayer(),
      clearSelection: () => this.clearSelection(),
      setInteracting: (isInteracting: boolean) =>
        useToolStore.getState().setInteracting(isInteracting),
      setActiveTool: (id: any) => useToolStore.getState().setActiveTool(id),
      updateToolSettings: (id: any, settings: any) =>
        useToolStore.getState().updateToolSettings(id, settings),
      subscribe: (listener: any) => useToolStore.subscribe((state) => listener(state.toolSettings)),
      setLayerCache: (layerId: string, canvas: HTMLCanvasElement) => {
        this.layerCanvasCache.set(layerId, canvas);
        this.layerReadyCache.set(layerId, true);
      },
      getLayerCanvas: (layerId: string) => {
        const canvas = this.layerCanvasCache.get(layerId);
        if (!canvas) return null;
        return { canvas, ready: !!this.layerReadyCache.get(layerId) };
      },
      ensureLayerCanvas: (layer: Layer) => this.ensureLayerCanvas(layer),
      animateFitToScreen: (ow?: number, oh?: number) => this.animateFitToScreen(ow, oh),
    };

    Object.defineProperty(context, "project", {
      get: () => this.project,
      enumerable: true,
      configurable: true,
    });

    return context as any as ToolContext;
  }

  public async ensureLayerCanvas(layer: Layer): Promise<HTMLCanvasElement> {
    const cached = this.layerCanvasCache.get(layer.id);
    if (
      cached &&
      this.layerReadyCache.get(layer.id) &&
      cached.width === layer.width &&
      cached.height === layer.height
    ) {
      return cached;
    }

    // Create and populate if not ready or not matching
    const canvas = document.createElement("canvas");
    canvas.width = layer.width;
    canvas.height = layer.height;
    const ctx = canvas.getContext("2d")!;

    if (layer.data) {
      const img = await this.loadImage(layer.data);
      ctx.drawImage(img, 0, 0);
    }

    // We don't necessarily want to update the main cache here as it might
    // conflict with the render loop, but for tools it's fine.
    return canvas;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
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
    this.stopViewportAnimation();
    e.preventDefault();

    let newScale = this.project.zoom;
    let newOriginX = this.project.panX;
    let newOriginY = this.project.panY;

    if (e.ctrlKey || e.metaKey) {
      const mx = e.offsetX;
      const my = e.offsetY;
      const wheelDelta = -e.deltaY;
      const normalizedDelta =
        Math.sign(wheelDelta) * Math.min(Math.abs(wheelDelta * this.ZOOM_SENSITIVITY), 0.5);

      const zoomFactor = Math.exp(normalizedDelta);
      const targetScale = Math.min(Math.max(this.project.zoom * zoomFactor, 0.05), 50);

      const scaleChange = (targetScale - this.project.zoom) * this.ZOOM_SMOOTHING;
      newScale = this.project.zoom + scaleChange;

      newOriginX = mx - (mx - this.project.panX) * (newScale / this.project.zoom);
      newOriginY = my - (my - this.project.panY) * (newScale / this.project.zoom);
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
    this.stopViewportAnimation();

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

  private handleDoubleClick(e: MouseEvent) {
    if (!this.project) return;
    const tool = this.getActiveTool();
    const context = this.getToolContext();
    if (tool && context) {
      tool.onDoubleClick(e, context);
    }
  }

  private stopViewportAnimation() {
    if (this.viewportAnimationId) {
      cancelAnimationFrame(this.viewportAnimationId);
      this.viewportAnimationId = null;
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
    window.removeEventListener("keydown", this.handleKeyDown);
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

    const mergeSegments = (segments: any[], orientation: "horizontal" | "vertical") => {
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

    // If we have a floating layer, use its coordinates for the selection border
    const bounds = this.project.selection.floatingLayer || this.project.selection.bounds;
    const { x: bx, y: by } = bounds;
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

  public animateFitToScreen(overrideWidth?: number, overrideHeight?: number) {
    if (!this.project || !this.canvas.parentElement) return;
    const cw = this.canvas.parentElement.clientWidth;
    const ch = this.canvas.parentElement.clientHeight;

    const targetW = overrideWidth ?? this.project.width;
    const targetH = overrideHeight ?? this.project.height;

    const padding = 40;
    const scaleX = (cw - padding * 2) / targetW;
    const scaleY = (ch - padding * 2) / targetH;
    const scale = Math.min(scaleX, scaleY);
    const originX = (cw - targetW * scale) / 2;
    const originY = (ch - targetH * scale) / 2;

    this.animateToViewport(scale, originX, originY);
  }

  private animateToViewport(targetZoom: number, targetPanX: number, targetPanY: number) {
    if (!this.project) return;

    if (this.viewportAnimationId) {
      cancelAnimationFrame(this.viewportAnimationId);
    }

    const startZoom = this.project.zoom;
    const startPanX = this.project.panX;
    const startPanY = this.project.panY;
    const duration = 500; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      if (!this.project) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out cubic
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentZoom = startZoom + (targetZoom - startZoom) * ease;
      const currentPanX = startPanX + (targetPanX - startPanX) * ease;
      const currentPanY = startPanY + (targetPanY - startPanY) * ease;

      this.project.zoom = currentZoom;
      this.project.panX = currentPanX;
      this.project.panY = currentPanY;
      this.onViewportChange(currentZoom, currentPanX, currentPanY);

      if (progress < 1) {
        this.viewportAnimationId = requestAnimationFrame(animate);
      } else {
        this.viewportAnimationId = null;
      }
    };

    this.viewportAnimationId = requestAnimationFrame(animate);
  }

  private intersects(layer: Layer, projectWidth: number, projectHeight: number): boolean {
    return !(
      layer.x >= projectWidth ||
      layer.x + layer.width <= 0 ||
      layer.y >= projectHeight ||
      layer.y + layer.height <= 0
    );
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

    // 1. PASSO: Camadas que INTERSECTAM o projeto (Serão clipadas)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.project.width, this.project.height);
    this.ctx.clip();

    for (const layer of this.project.layers) {
      if (layer.visible) {
        if (this.intersects(layer, this.project.width, this.project.height)) {
          this.renderLayer(layer);
        }
      }
    }

    // Render floating layer if it exists
    if (
      this.project.selection.floatingLayer &&
      this.project.selection.floatingLayer.visible
    ) {
      this.renderLayer(this.project.selection.floatingLayer);
    }

    this.ctx.restore(); // Fim do clip do projeto

    // 2. PASSO: Camadas que NÃO INTERSECTAM o projeto (Desenhar sem clip)
    for (const layer of this.project.layers) {
      if (layer.visible) {
        if (!this.intersects(layer, this.project.width, this.project.height)) {
          this.renderLayer(layer);
        }
      }
    }

    if (this.project.zoom >= 10) {
      this.renderPixelGrid();
    }

    const context = this.getToolContext();
    if (tool && context) tool.onRender(this.ctx, context);

    const editingLayerId = tool?.getEditingLayerId();

    if (this.project.activeLayerId && activeToolId !== "transform" && activeToolId !== "crop") {
      const activeLayer = this.project.layers.find((l) => l.id === this.project?.activeLayerId);
      if (activeLayer && activeLayer.id !== editingLayerId) {
        this.ctx.save();

        if (!activeLayer.visible) {
          this.ctx.strokeStyle = "rgba(150, 150, 150, 0.7)"; // Gray for hidden
        } else if (activeLayer.locked) {
          this.ctx.strokeStyle = "rgba(255, 204, 0, 0.9)"; // Yellow for locked
        } else {
          this.ctx.strokeStyle = "rgba(0, 120, 255, 0.9)"; // Default blue
        }

        this.ctx.lineWidth = 1 / this.project.zoom;
        this.ctx.setLineDash([4 / this.project.zoom, 2 / this.project.zoom]);
        this.ctx.strokeRect(activeLayer.x, activeLayer.y, activeLayer.width, activeLayer.height);
        this.ctx.restore();
      }
    }
    this.ctx.restore();

    this.renderSelection();
  }

  private renderLayer(layer: Layer) {
    this.ctx.save();
    this.ctx.globalAlpha = layer.opacity / 100;
    this.ctx.globalCompositeOperation = layer.blendMode;

    const tool = this.getActiveTool();
    const isEditing = tool?.getEditingLayerId() === layer.id;
    const editingState = isEditing ? (tool as any).getEditingState?.() : undefined;

    if (editingState) {
      editingState.isCtrlPressed = this.isCtrlPressed;
    }

    switch (layer.type) {
      case "raster":
        RasterLayer.render(
          this.ctx,
          layer,
          this.layerCanvasCache,
          this.layerReadyCache,
          this.imageCache,
          () => this.render(),
        );
        break;
      case "text":
        TextLayer.render(
          this.ctx,
          layer,
          this.layerCanvasCache,
          this.layerReadyCache,
          editingState
        );
        break;
      case "group":
        GroupLayer.render(this.ctx, layer);
        break;
    }
    this.ctx.restore();
  }

  private renderPixelGrid() {
    if (!this.project) return;
    this.ctx.save();
    this.ctx.setTransform(
      this.project.zoom,
      0,
      0,
      this.project.zoom,
      this.project.panX,
      this.project.panY,
    );
    this.ctx.lineWidth = 0.5 / this.project.zoom;
    this.ctx.strokeStyle = "rgba(128, 128, 128, 0.4)";
    this.ctx.beginPath();
    for (let x = 0; x <= this.project.width; x++) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.project.height);
    }
    for (let y = 0; y <= this.project.height; y++) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.project.width, y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  public invalidateLayerCache(layerId: string) {
    this.layerCanvasCache.delete(layerId);
    this.layerReadyCache.delete(layerId);
  }

  private async floatSelection(layerId: string): Promise<boolean> {
    if (!this.project || !this.project.selection.hasSelection || !this.project.selection.bounds)
      return false;

    if (this.project.selection.floatingLayer) return true;

    const layer = this.project.layers.find((l) => l.id === layerId);
    if (!layer || layer.type !== "raster" || !layer.data) return false;

    const { bounds } = this.project.selection;
    const layerCanvas = await this.ensureLayerCanvas(layer);

    // 1. Extract content
    const floatCanvas = document.createElement("canvas");
    floatCanvas.width = bounds.width;
    floatCanvas.height = bounds.height;
    const fctx = floatCanvas.getContext("2d")!;

    fctx.drawImage(layerCanvas, layer.x - bounds.x, layer.y - bounds.y);
    fctx.globalCompositeOperation = "destination-in";
    fctx.drawImage(this.selectionCanvas, 0, 0);

    // 2. Remove from original layer
    const newLayerCanvas = document.createElement("canvas");
    newLayerCanvas.width = layer.width;
    newLayerCanvas.height = layer.height;
    const nlctx = newLayerCanvas.getContext("2d")!;
    nlctx.drawImage(layerCanvas, 0, 0);
    nlctx.globalCompositeOperation = "destination-out";
    nlctx.drawImage(this.selectionCanvas, bounds.x - layer.x, bounds.y - layer.y);

    const floatingLayer: Layer = {
      id: "floating-selection",
      name: "Floating Selection",
      type: "raster",
      visible: true,
      locked: false,
      opacity: 100,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      data: floatCanvas.toDataURL(), // We still need this for the store, but we'll use cache for rendering
      blendMode: "source-over",
    };

    // Cache the new canvases immediately
    this.layerCanvasCache.set(floatingLayer.id, floatCanvas);
    this.layerReadyCache.set(floatingLayer.id, true);
    this.layerCanvasCache.set(layer.id, newLayerCanvas);
    this.layerReadyCache.set(layer.id, true);

    // Update Store
    useProjectStore.getState().updateLayer(this.project.id, layer.id, {
      data: newLayerCanvas.toDataURL(),
    });

    useProjectStore.getState().updateProject(this.project.id, {
      selection: {
        ...this.project.selection,
        floatingLayer: floatingLayer,
      },
    });

    // Update local project reference immediately to avoid stale reads in the same frame
    this.project.selection.floatingLayer = floatingLayer;

    return true;
  }

  private async commitFloatingLayer() {
    if (!this.project || !this.project.selection.floatingLayer || !this.project.activeLayerId)
      return;

    const activeLayer = this.project.layers.find((l) => l.id === this.project?.activeLayerId);
    if (!activeLayer || activeLayer.type !== "raster") return;

    const floatingLayer = this.project.selection.floatingLayer;
    const activeCanvas = await this.ensureLayerCanvas(activeLayer);
    const floatCanvas = await this.ensureLayerCanvas(floatingLayer);

    const minX = Math.min(activeLayer.x, floatingLayer.x);
    const minY = Math.min(activeLayer.y, floatingLayer.y);
    const maxX = Math.max(activeLayer.x + activeLayer.width, floatingLayer.x + floatingLayer.width);
    const maxY = Math.max(
      activeLayer.y + activeLayer.height,
      floatingLayer.y + floatingLayer.height,
    );

    const newW = Math.ceil(maxX - minX);
    const newH = Math.ceil(maxY - minY);

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = newW;
    finalCanvas.height = newH;
    const fctx = finalCanvas.getContext("2d")!;

    fctx.drawImage(
      activeCanvas,
      Math.round(activeLayer.x - minX),
      Math.round(activeLayer.y - minY),
    );
    fctx.drawImage(
      floatCanvas,
      Math.round(floatingLayer.x - minX),
      Math.round(floatingLayer.y - minY),
    );

    this.layerCanvasCache.set(activeLayer.id, finalCanvas);
    this.layerReadyCache.set(activeLayer.id, true);

    useProjectStore.getState().updateLayer(this.project.id, activeLayer.id, {
      x: minX,
      y: minY,
      width: newW,
      height: newH,
      data: finalCanvas.toDataURL(),
    });

    useProjectStore.getState().updateProject(this.project.id, {
      selection: {
        ...this.project.selection,
        floatingLayer: null,
      },
    });

    this.project.selection.floatingLayer = null;
  }
}
