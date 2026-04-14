import { Layer, Project } from "@/renderer/store/projectStore";

export interface ViewportState {
  scale: number;
  originX: number;
  originY: number;
  targetScale: number;
}

export class ForgeEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: ViewportState = { scale: 1, originX: 0, originY: 0, targetScale: 1 };
  private project: Project | null = null;
  private checkerPattern: CanvasPattern | null = null;

  private ZOOM_SENSITIVITY = 0.05;
  private ZOOM_SMOOTHING = 0.15;
  private animationFrameId: number | null = null;

  // Panning state
  private isPanning = false;
  private startX = 0;
  private startY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    this.setupEventListeners();
    this.startRenderLoop();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    window.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const mx = e.offsetX;
      const my = e.offsetY;
      const wheelDelta = -e.deltaY;
      const normalizedDelta = Math.sign(wheelDelta) * Math.min(Math.abs(wheelDelta * this.ZOOM_SENSITIVITY), 0.5);

      const zoomFactor = Math.exp(normalizedDelta);
      this.viewport.targetScale = Math.min(Math.max(this.viewport.scale * zoomFactor, 0.05), 50);

      const scaleChange = (this.viewport.targetScale - this.viewport.scale) * this.ZOOM_SMOOTHING;
      const newScale = this.viewport.scale + scaleChange;

      this.viewport.originX = mx - (mx - this.viewport.originX) * (newScale / this.viewport.scale);
      this.viewport.originY = my - (my - this.viewport.originY) * (newScale / this.viewport.scale);
      this.viewport.scale = newScale;
      this.ctx.imageSmoothingEnabled = this.viewport.scale <= 1.0;
    } else {
      this.viewport.originX -= e.deltaX;
      this.viewport.originY -= e.deltaY;
    }
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.spaceKey)) { // Middle button or Space+Left
      this.isPanning = true;
      this.startX = e.clientX - this.viewport.originX;
      this.startY = e.clientY - this.viewport.originY;
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.isPanning) {
      this.viewport.originX = e.clientX - this.startX;
      this.viewport.originY = e.clientY - this.startY;
    }
  }

  private handleMouseUp() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
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
    // Remove window listeners
    window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    window.removeEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private getCheckerPattern(): CanvasPattern {
    if (!this.checkerPattern) {
      const size = 8;
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = size * 2;
      patternCanvas.height = size * 2;
      const pctx = patternCanvas.getContext('2d')!;

      pctx.fillStyle = '#333';
      pctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);

      pctx.fillStyle = '#444';
      pctx.fillRect(0, 0, size, size);
      pctx.fillRect(size, size, size, size);

      this.checkerPattern = this.ctx.createPattern(patternCanvas, 'repeat')!;
    }
    return this.checkerPattern;
  }

  public setProject(project: Project) {
    this.project = project;
  }

  public render() {
    if (!this.project) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Checkerboard Background
    this.ctx.save();
    this.ctx.setTransform(this.viewport.scale, 0, 0, this.viewport.scale, this.viewport.originX, this.viewport.originY);
    this.ctx.fillStyle = this.getCheckerPattern();
    this.ctx.fillRect(0, 0, this.project.width, this.project.height);
    this.ctx.restore();

    // 2. Draw Layers
    this.ctx.save();
    this.ctx.setTransform(this.viewport.scale, 0, 0, this.viewport.scale, this.viewport.originX, this.viewport.originY);
    
    for (const layer of this.project.layers) {
      if (!layer.visible) continue;
      this.renderLayer(layer);
    }
    
    this.ctx.restore();
  }

  private renderLayer(layer: Layer) {
    this.ctx.save();
    this.ctx.globalAlpha = layer.opacity / 100;
    this.ctx.globalCompositeOperation = layer.blendMode;

    if (layer.type === 'raster' && layer.data) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.width;
        tempCanvas.height = layer.height;
        tempCanvas.getContext('2d')!.putImageData(layer.data, 0, 0);
        this.ctx.drawImage(tempCanvas, layer.x, layer.y);
    } else if (layer.type === 'text') {
        this.ctx.fillStyle = layer.color || '#ffffff';
        this.ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
        this.ctx.fillText(layer.text || '', layer.x, layer.y + (layer.fontSize || 0));
    } else if (layer.type === 'raster' && !layer.data) {
        // Just fill with a color for debugging empty layers
        this.ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
        this.ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    }
    this.ctx.restore();
  }

  public screenToProject(sx: number, sy: number) {
    return {
      x: (sx - this.viewport.originX) / this.viewport.scale,
      y: (sy - this.viewport.originY) / this.viewport.scale
    };
  }
}
