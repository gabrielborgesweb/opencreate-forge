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
  private strokeOriginX = 0;
  private strokeOriginY = 0;
  private readonly STROKE_PADDING = 2048;

  private mouseX = 0;
  private mouseY = 0;
  private isMouseOver = false;

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
    // Padding extra para garantir que o blur não seja cortado
    const canvasSize = Math.ceil(size * 1.5);

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

    const opaque = this.hexToRgba(color, 1);
    const transparent = this.hexToRgba(color, 0);

    // O centro é sempre opaco
    gradient.addColorStop(0, opaque);
    // O núcleo opaco se estende até o valor de hardness
    gradient.addColorStop(Math.max(0, Math.min(0.99, hardness)), opaque);
    // Queda linear para transparente a partir do hardness
    gradient.addColorStop(1, transparent);

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
    this.mouseX = x;
    this.mouseY = y;
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
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    this.mouseX = x;
    this.mouseY = y;

    // Verifica se o mouse está sobre o canvas para mostrar/ocultar o preview
    const rect = context.canvas.getBoundingClientRect();
    this.isMouseOver =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (this.isMouseOver) {
      context.canvas.style.cursor = "none";
    } else {
      context.canvas.style.cursor = "default";
    }

    if (!this.isDrawing) return;

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

      // Otimização: Em vez de varrer o canvas todo (que agora tem STROKE_PADDING),
      // varremos apenas a união da área original da camada com a área do novo traço.
      const strokeLocalMinX = Math.floor(this.minX - this.strokeOriginX);
      const strokeLocalMinY = Math.floor(this.minY - this.strokeOriginY);
      const strokeLocalMaxX = Math.ceil(this.maxX - this.strokeOriginX);
      const strokeLocalMaxY = Math.ceil(this.maxY - this.strokeOriginY);

      const searchBounds = {
        x: Math.max(0, Math.min(this.STROKE_PADDING, strokeLocalMinX)),
        y: Math.max(0, Math.min(this.STROKE_PADDING, strokeLocalMinY)),
        width: 0,
        height: 0,
      };

      const searchMaxX = Math.min(
        this.offscreenCanvas.width,
        Math.max(this.STROKE_PADDING + layer.width, strokeLocalMaxX),
      );
      const searchMaxY = Math.min(
        this.offscreenCanvas.height,
        Math.max(this.STROKE_PADDING + layer.height, strokeLocalMaxY),
      );

      searchBounds.width = searchMaxX - searchBounds.x;
      searchBounds.height = searchMaxY - searchBounds.y;

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
              x: this.strokeOriginX + bounds.x,
              y: this.strokeOriginY + bounds.y,
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
    this.strokeOriginX = layer.x - this.STROKE_PADDING;
    this.strokeOriginY = layer.y - this.STROKE_PADDING;
    const width = layer.width + this.STROKE_PADDING * 2;
    const height = layer.height + this.STROKE_PADDING * 2;

    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
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
          this.offscreenCtx.drawImage(
            img,
            this.STROKE_PADDING,
            this.STROKE_PADDING,
          );
          this.offscreenCtx.restore();
        }
      };
      img.src = layer.data;
    }
  }

  private draw(x: number, y: number, _context: ToolContext) {
    if (!this.offscreenCtx || !this.layerId || !this.brushCanvas) return;
    const settings = useToolStore.getState().toolSettings.brush;
    const localX = x - this.strokeOriginX;
    const localY = y - this.strokeOriginY;
    const localLastX = this.lastX - this.strokeOriginX;
    const localLastY = this.lastY - this.strokeOriginY;

    this.offscreenCtx.save();

    const dist = Math.hypot(localX - localLastX, localY - localLastY);
    const angle = Math.atan2(localY - localLastY, localX - localLastX);

    // Espaçamento de 10% do tamanho para um traço fluido
    const spacing = Math.max(1, settings.size * 0.1);

    for (let i = 0; i <= dist; i += spacing) {
      const px = localLastX + Math.cos(angle) * i;
      const py = localLastY + Math.sin(angle) * i;
      this.offscreenCtx.drawImage(
        this.brushCanvas,
        px - this.brushCanvas.width / 2,
        py - this.brushCanvas.height / 2,
      );
    }

    this.offscreenCtx.restore();
  }

  onDeactivate(context: ToolContext): void {
    context.canvas.style.cursor = "default";
    this.isMouseOver = false;
    this.isDrawing = false;
  }

  onRender(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    const settings = useToolStore.getState().toolSettings.brush;

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
      ctx.drawImage(
        this.offscreenCanvas,
        this.strokeOriginX,
        this.strokeOriginY,
      );
      ctx.restore();
    }

    // Brush Preview - Só desenha se o mouse estiver sobre o canvas
    if (this.isMouseOver) {
      ctx.save();
      ctx.setTransform(
        context.project.zoom,
        0,
        0,
        context.project.zoom,
        context.project.panX,
        context.project.panY,
      );

      const effectiveSize = settings.size * (1 + (1 - settings.hardness) * 0.5);
      const radius = effectiveSize / 2;

      // Outline externa (branca)
      ctx.beginPath();
      ctx.arc(this.mouseX, this.mouseY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1 / context.project.zoom;
      ctx.stroke();

      // Outline interna (preta para contraste)
      ctx.beginPath();
      ctx.arc(
        this.mouseX,
        this.mouseY,
        radius - 0.5 / context.project.zoom,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 0.5 / context.project.zoom;
      ctx.stroke();

      // Ponto central
      ctx.beginPath();
      ctx.arc(
        this.mouseX,
        this.mouseY,
        1 / context.project.zoom,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fill();

      ctx.restore();
    }
  }
}
