import { BaseTool, ToolContext } from "./BaseTool";
import { useToolStore } from "@/renderer/store/toolStore";

export class PencilTool extends BaseTool {
  id = "pencil";
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

  // Para otimização de bounding box
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  private isLoadingBaseImage = false;

  onMouseDown(e: MouseEvent, context: ToolContext): void {
    if (e.button !== 0) return;

    const activeLayerId = context.project.activeLayerId;
    if (!activeLayerId) return;

    const layer = context.project.layers.find((l) => l.id === activeLayerId);
    if (!layer || layer.locked || !layer.visible) return;

    this.isDrawing = true;
    this.layerId = activeLayerId;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    // Snap to pixel grid
    const snapX = Math.floor(x);
    const snapY = Math.floor(y);
    
    this.mouseX = snapX;
    this.mouseY = snapY;
    this.lastX = snapX;
    this.lastY = snapY;

    const settings = useToolStore.getState().toolSettings.pencil;
    this.initOffscreen(layer, context);

    const pad = settings.size;
    this.minX = snapX - pad;
    this.minY = snapY - pad;
    this.maxX = snapX + pad;
    this.maxY = snapY + pad;

    this.draw(snapX, snapY);
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    const snapX = Math.floor(x);
    const snapY = Math.floor(y);
    
    this.mouseX = snapX;
    this.mouseY = snapY;

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

    const settings = useToolStore.getState().toolSettings.pencil;
    const pad = settings.size;
    
    this.minX = Math.min(this.minX, snapX - pad);
    this.minY = Math.min(this.minY, snapY - pad);
    this.maxX = Math.max(this.maxX, snapX + pad);
    this.maxY = Math.max(this.maxY, snapY + pad);

    this.draw(snapX, snapY);
    this.lastX = snapX;
    this.lastY = snapY;
  }

  onMouseUp(e: MouseEvent, context: ToolContext): void {
    if (!this.isDrawing) return;

    if (this.isLoadingBaseImage) {
      setTimeout(() => this.onMouseUp(e, context), 10);
      return;
    }

    this.isDrawing = false;

    if (this.offscreenCanvas && this.layerId && this.offscreenCtx) {
      const layer = context.project.layers.find((l) => l.id === this.layerId)!;

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

  private initOffscreen(layer: any, context: ToolContext) {
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
    
    // Pencil needs crisp pixels
    this.offscreenCtx.imageSmoothingEnabled = false;

    const cachedResult = context.getLayerCanvas(layer.id);
    if (cachedResult) {
      this.offscreenCtx.clearRect(0, 0, width, height);
      this.offscreenCtx.drawImage(
        cachedResult.canvas,
        this.STROKE_PADDING,
        this.STROKE_PADDING,
      );
      if (cachedResult.ready) return;
    }

    if (layer.data) {
      this.isLoadingBaseImage = true;
      const img = new Image();
      img.onload = () => {
        if (this.offscreenCtx) {
          this.offscreenCtx.save();
          this.offscreenCtx.globalCompositeOperation = "destination-over";
          this.offscreenCtx.drawImage(
            img,
            this.STROKE_PADDING,
            this.STROKE_PADDING,
          );
          this.offscreenCtx.restore();
        }
        this.isLoadingBaseImage = false;
      };
      img.src = layer.data;
    }
  }

  private draw(x: number, y: number) {
    if (!this.offscreenCtx || !this.layerId) return;
    const settings = useToolStore.getState().toolSettings.pencil;
    
    const localX = x - this.strokeOriginX;
    const localY = y - this.strokeOriginY;
    const localLastX = this.lastX - this.strokeOriginX;
    const localLastY = this.lastY - this.strokeOriginY;

    this.offscreenCtx.fillStyle = settings.color;
    
    // Bresenham's line algorithm
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
      this.drawPixel(x0, y0, settings.size, settings.shape);
      
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
  }

  private drawPixel(x: number, y: number, size: number, shape: 'circle' | 'square') {
    if (!this.offscreenCtx) return;

    if (shape === "square") {
      this.offscreenCtx.fillRect(
        x - Math.floor(size / 2),
        y - Math.floor(size / 2),
        size,
        size
      );
    } else {
      // Circle shape (pixelated)
      if (size === 1) {
        this.offscreenCtx.fillRect(x, y, 1, 1);
        return;
      }

      if (size % 2 !== 0) {
        const r = (size - 1) / 2;
        for (let dy = -r; dy <= r; dy++) {
          const dx = Math.floor(Math.sqrt(r * r - dy * dy));
          this.offscreenCtx.fillRect(x - dx, y + dy, 2 * dx + 1, 1);
        }
      } else {
        const radius = size / 2;
        const topLeftX = x - radius;
        const topLeftY = y - radius;

        for (let py = 0; py < size; py++) {
          const dist_y = py + 0.5 - radius;
          const max_dist_x_sq = radius * radius - dist_y * dist_y;
          if (max_dist_x_sq < 0) continue;
          const max_dist_x = Math.sqrt(max_dist_x_sq);
          const x_min = Math.ceil(-max_dist_x + radius - 0.5);
          const x_max = Math.floor(max_dist_x + radius - 0.5);
          const draw_width = x_max - x_min + 1;
          if (draw_width > 0) {
            this.offscreenCtx.fillRect(topLeftX + x_min, topLeftY + py, draw_width, 1);
          }
        }
      }
    }
  }

  onDeactivate(context: ToolContext): void {
    context.canvas.style.cursor = "default";
    this.isMouseOver = false;
    this.isDrawing = false;
  }

  getEditingLayerId(): string | null {
    return this.isDrawing ? this.layerId : null;
  }

  onRender(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    const settings = useToolStore.getState().toolSettings.pencil;

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
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.offscreenCanvas,
        this.strokeOriginX,
        this.strokeOriginY,
      );
      ctx.restore();
    }

    // Pencil Preview
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

      const size = settings.size;
      const x = this.mouseX;
      const y = this.mouseY;
      const zoom = context.project.zoom;

      // 1. Outline Externa (Branca)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1 / zoom;

      if (settings.shape === "square") {
        ctx.strokeRect(
          x - Math.floor(size / 2),
          y - Math.floor(size / 2),
          size,
          size
        );
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Outline Interna (Preta para contraste)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 0.5 / zoom;
      const offset = 0.5 / zoom;

      if (settings.shape === "square") {
        ctx.strokeRect(
          x - Math.floor(size / 2) + offset,
          y - Math.floor(size / 2) + offset,
          size - offset * 2,
          size - offset * 2
        );
      } else {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0, size / 2 - offset), 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3. Ponto central (estilo Brush)
      ctx.beginPath();
      ctx.arc(x, y, 1 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fill();

      ctx.restore();
    }
  }
}
