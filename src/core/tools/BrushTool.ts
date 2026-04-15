import { BaseTool, ToolContext } from "./BaseTool";
import { useToolStore } from "@/renderer/store/toolStore";

export class BrushTool extends BaseTool {
  id = "brush";
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private layerId: string | null = null;

  private brushCanvas: HTMLCanvasElement | null = null;

  // Para otimização de bounding box
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  private hexToRgba(hex: string, alpha: number) {
    if (!hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private initBrush(size: number, hardness: number, color: string) {
    const radius = size / 2;
    const canvasSize = Math.ceil(size + 4);

    this.brushCanvas = document.createElement("canvas");
    this.brushCanvas.width = canvasSize;
    this.brushCanvas.height = canvasSize;
    const ctx = this.brushCanvas.getContext("2d")!;

    const center = canvasSize / 2;
    const gradient = ctx.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      radius,
    );

    gradient.addColorStop(0, this.hexToRgba(color, 1));
    gradient.addColorStop(hardness, this.hexToRgba(color, 1));
    gradient.addColorStop(1, this.hexToRgba(color, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  onMouseDown(e: MouseEvent, context: ToolContext): void {
    if (e.button !== 0) return;

    const activeLayerId = context.project.activeLayerId;
    if (!activeLayerId) return;

    const layer = context.project.layers.find((l) => l.id === activeLayerId);
    if (!layer || layer.locked || !layer.visible) return;

    this.isDrawing = true;
    this.layerId = activeLayerId;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    this.lastX = x;
    this.lastY = y;

    const settings = useToolStore.getState().toolSettings.brush;
    this.initBrush(settings.size, settings.hardness, settings.color);
    this.initOffscreen(layer);

    const pad = settings.size;
    this.minX = x - pad;
    this.minY = y - pad;
    this.maxX = x + pad;
    this.maxY = y + pad;

    this.draw(x, y, context);
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    if (!this.isDrawing) return;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);

    const settings = useToolStore.getState().toolSettings.brush;
    const pad = settings.size;
    this.minX = Math.min(this.minX, x - pad);
    this.minY = Math.min(this.minY, y - pad);
    this.maxX = Math.max(this.maxX, x + pad);
    this.maxY = Math.max(this.maxY, y + pad);

    this.draw(x, y, context);
    this.lastX = x;
    this.lastY = y;
  }

  onMouseUp(e: MouseEvent, context: ToolContext): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.offscreenCanvas && this.layerId && this.offscreenCtx) {
      const layer = context.project.layers.find((l) => l.id === this.layerId)!;

      // CORREÇÃO: Buscar a Bounding Box varrendo o canvas INTEIRO e não apenas a área do traço.
      // Isso impede que dados fora do traço atual (como o próprio fundo da camada) sejam descartados.
      const searchBounds = {
        x: 0,
        y: 0,
        width: this.offscreenCanvas.width,
        height: this.offscreenCanvas.height,
      };

      const bounds = this.getOptimizedBoundingBox(
        this.offscreenCtx,
        searchBounds,
      );

      if (bounds) {
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = bounds.width;
        croppedCanvas.height = bounds.height;
        const croppedCtx = croppedCanvas.getContext("2d")!;

        croppedCtx.drawImage(
          this.offscreenCanvas,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          0,
          0,
          bounds.width,
          bounds.height,
        );

        const dataUrl = croppedCanvas.toDataURL("image/png");

        context.setLayerCache(this.layerId, croppedCanvas);

        const layers = context.project.layers.map((l) => {
          if (l.id === this.layerId) {
            return {
              ...l,
              data: dataUrl,
              x: layer.x + bounds.x,
              y: layer.y + bounds.y,
              width: bounds.width,
              height: bounds.height,
            };
          }
          return l;
        });

        context.updateProject({ layers, isDirty: true });
      }
    }

    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.brushCanvas = null;
  }

  private getOptimizedBoundingBox(
    ctx: CanvasRenderingContext2D,
    search: { x: number; y: number; width: number; height: number },
  ) {
    if (search.width <= 0 || search.height <= 0) return null;
    const imageData = ctx.getImageData(
      search.x,
      search.y,
      search.width,
      search.height,
    );
    const data = imageData.data;
    let minX = search.width,
      minY = search.height,
      maxX = -1,
      maxY = -1;
    let found = false;

    for (let y = 0; y < search.height; y++) {
      for (let x = 0; x < search.width; x++) {
        const alpha = data[(y * search.width + x) * 4 + 3];
        if (alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          found = true;
        }
      }
    }
    if (!found) return null;
    return {
      x: search.x + minX,
      y: search.y + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  private initOffscreen(layer: any) {
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = layer.width;
    this.offscreenCanvas.height = layer.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;

    if (layer.data) {
      const img = new Image();
      img.onload = () => {
        if (this.offscreenCtx) {
          this.offscreenCtx.save();
          // CORREÇÃO: A imagem base deve carregar sempre "por baixo" dos traços frescos que o usuário já fez
          this.offscreenCtx.globalCompositeOperation = "destination-over";
          this.offscreenCtx.drawImage(img, 0, 0);
          this.offscreenCtx.restore();
        }
      };
      img.src = layer.data;
    }
  }

  private draw(x: number, y: number, context: ToolContext) {
    if (!this.offscreenCtx || !this.layerId || !this.brushCanvas) return;
    const settings = useToolStore.getState().toolSettings.brush;
    const layer = context.project.layers.find((l) => l.id === this.layerId)!;
    const localX = x - layer.x;
    const localY = y - layer.y;
    const localLastX = this.lastX - layer.x;
    const localLastY = this.lastY - layer.y;

    this.offscreenCtx.save();
    if (settings.hardness >= 1) {
      this.offscreenCtx.strokeStyle = settings.color;
      this.offscreenCtx.lineWidth = settings.size;
      this.offscreenCtx.lineCap = "round";
      this.offscreenCtx.lineJoin = "round";
      this.offscreenCtx.beginPath();
      this.offscreenCtx.moveTo(localLastX, localLastY);
      this.offscreenCtx.lineTo(localX, localY);
      this.offscreenCtx.stroke();
    } else {
      const dist = Math.hypot(localX - localLastX, localY - localLastY);
      const angle = Math.atan2(localY - localLastY, localX - localLastX);
      const spacing = Math.max(1, (settings.size / 2) * 0.1);

      for (let i = 0; i <= dist; i += spacing) {
        const px = localLastX + Math.cos(angle) * i;
        const py = localLastY + Math.sin(angle) * i;
        this.offscreenCtx.drawImage(
          this.brushCanvas,
          px - this.brushCanvas.width / 2,
          py - this.brushCanvas.height / 2,
        );
      }
    }
    this.offscreenCtx.restore();
  }

  onRender(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    if (this.isDrawing && this.offscreenCanvas && this.layerId) {
      const layer = context.project.layers.find((l) => l.id === this.layerId)!;
      ctx.save();
      ctx.setTransform(
        context.project.zoom,
        0,
        0,
        context.project.zoom,
        context.project.panX,
        context.project.panY,
      );
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(this.offscreenCanvas, layer.x, layer.y);
      ctx.restore();
    }
  }
}
