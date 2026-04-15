import { Layer, Project } from "@/renderer/store/projectStore";

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

  private onViewportChange: (zoom: number, x: number, y: number) => void;

  constructor(canvas: HTMLCanvasElement, onViewportChange: (zoom: number, x: number, y: number) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    this.onViewportChange = onViewportChange;
    
    // Bind event handlers once to avoid memory leaks and fix removeEventListener
    this.handleWheel = this.handleWheel.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    this.setupEventListeners();
    this.startRenderLoop();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
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
      const normalizedDelta = Math.sign(wheelDelta) * Math.min(Math.abs(wheelDelta * this.ZOOM_SENSITIVITY), 0.5);

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
    
    // Update local state immediately to avoid race conditions during interaction
    this.project.zoom = newScale;
    this.project.panX = newOriginX;
    this.project.panY = newOriginY;
    
    this.onViewportChange(newScale, newOriginX, newOriginY);
  }

  private handleMouseDown(e: MouseEvent) {
    if (!this.project) return;
    // Adicionamos suporte a Alt ou Space para Pan (Space key detectado via flag global se necessário, 
    // mas por enquanto mantemos o middle click ou clique normal se o usuário preferir)
    if (e.button === 1 || (e.button === 0 && (e as any).spaceKey)) { 
      this.isPanning = true;
      this.startX = e.clientX - this.project.panX;
      this.startY = e.clientY - this.project.panY;
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.isPanning && this.project) {
      const newPanX = e.clientX - this.startX;
      const newPanY = e.clientY - this.startY;
      
      // Update local state immediately
      this.project.panX = newPanX;
      this.project.panY = newPanY;
      
      this.onViewportChange(this.project.zoom, newPanX, newPanY);
    }
  }

  private handleMouseUp() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'default';
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
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  private getCheckerPattern(): CanvasPattern {
    if (!this.checkerPattern) {
      const size = 8;
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = size * 2;
      patternCanvas.height = size * 2;
      const pctx = patternCanvas.getContext('2d')!;
      pctx.imageSmoothingEnabled = false;

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

  public fitToScreen() {
    if (!this.project || !this.canvas.parentElement) return;
    
    // Usar o tamanho do pai (viewport) para garantir precisão
    const cw = this.canvas.parentElement.clientWidth;
    const ch = this.canvas.parentElement.clientHeight;

    // Sincronizar o tamanho interno do canvas com o viewport
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }

    const padding = 40;
    const availableWidth = cw - padding * 2;
    const availableHeight = ch - padding * 2;
    
    const scaleX = availableWidth / this.project.width;
    const scaleY = availableHeight / this.project.height;
    const scale = Math.min(scaleX, scaleY); // Permitir zoom > 100% se o projeto for pequeno    
    const originX = (cw - this.project.width * scale) / 2;
    const originY = (ch - this.project.height * scale) / 2;
    
    // Atualiza estado local imediatamente
    this.project.zoom = scale;
    this.project.panX = originX;
    this.project.panY = originY;
    
    this.onViewportChange(scale, originX, originY);
  }

  public render() {
    if (!this.project) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Set global smoothing to false for pixelated look
    this.ctx.imageSmoothingEnabled = false;

    // 1. Draw Checkerboard Background
    this.ctx.save();
    this.ctx.setTransform(this.project.zoom, 0, 0, this.project.zoom, this.project.panX, this.project.panY);
    
    const pattern = this.getCheckerPattern();
    this.ctx.fillStyle = pattern;
    this.ctx.fillRect(0, 0, this.project.width, this.project.height);
    this.ctx.restore();

    // 2. Draw Layers
    this.ctx.save();
    this.ctx.setTransform(this.project.zoom, 0, 0, this.project.zoom, this.project.panX, this.project.panY);
    
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
        this.ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
        this.ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
    }
    this.ctx.restore();
  }
}
