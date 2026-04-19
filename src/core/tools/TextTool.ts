import { BaseTool, ToolContext, ToolId } from "./BaseTool";
import { Layer, useProjectStore } from "@/renderer/store/projectStore";
import { TextLayer } from "../layers/TextLayer";

export class TextTool extends BaseTool {
  id: ToolId = "text";

  private isDragging = false;
  private isMoving = false;
  private startPos = { x: 0, y: 0 };
  private currentPos = { x: 0, y: 0 };
  private layerStartPos = { x: 0, y: 0 };

  private editingLayerId: string | null = null;
  private caretIndex: number = 0;
  private selectionStart: number = 0;
  private isEditing = false;
  private isSelecting = false;
  private originalText: string = "";

  private onApply = () => this.commit(this.lastContext!);
  private onCancel = () => this.cancel(this.lastContext!);
  private lastContext: ToolContext | null = null;

  onActivate(context: ToolContext): void {
    this.lastContext = context;
    window.addEventListener("forge:text-apply", this.onApply);
    window.addEventListener("forge:text-cancel", this.onCancel);
  }

  onDeactivate(context: ToolContext): void {
    if (this.isEditing) {
      this.commit(context);
    }
    window.removeEventListener("forge:text-apply", this.onApply);
    window.removeEventListener("forge:text-cancel", this.onCancel);
  }

  getEditingLayerId(): string | null {
    return this.isEditing ? this.editingLayerId : null;
  }

  getEditingState() {
    return {
      caretIndex: this.caretIndex,
      selectionStart: this.selectionStart,
      isFocused: this.isEditing,
    };
  }

  onMouseDown(e: MouseEvent, context: ToolContext): void {
    this.lastContext = context;
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    this.startPos = { x, y };
    this.currentPos = { x, y };

    // 1. Hit-test existing text layers
    const hitLayer = this.findTextLayerAt(x, y, context);

    if (this.isEditing && this.editingLayerId) {
      const editingLayer = context.project.layers.find(l => l.id === this.editingLayerId);
      
      // If clicked outside the current editing layer, but inside another text layer
      if (hitLayer && hitLayer.id !== this.editingLayerId) {
        this.commit(context);
        this.startEditing(hitLayer, context);
        return;
      }

      // If clicked inside the current editing layer
      if (hitLayer && hitLayer.id === this.editingLayerId) {
        const index = TextLayer.getCaretIndexAt(context.ctx, hitLayer, x, y);
        this.caretIndex = index;
        if (!e.shiftKey) {
          this.selectionStart = index;
        }
        this.isSelecting = true;
        context.setInteracting(true);
        return;
      }

      // If clicked far from the current editing layer, start moving it
      if (!hitLayer) {
        this.isMoving = true;
        this.layerStartPos = { x: editingLayer?.x || 0, y: editingLayer?.y || 0 };
        context.setInteracting(true);
        return;
      }
    }

    if (hitLayer) {
      this.startEditing(hitLayer, context, x, y);
      return;
    }

    // 2. Prepare for new layer (click or drag)
    this.isDragging = true;
    context.setInteracting(true);
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    this.lastContext = context;
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    
    if (this.isSelecting && this.editingLayerId) {
      const editingLayer = context.project.layers.find(l => l.id === this.editingLayerId);
      if (editingLayer) {
        this.caretIndex = TextLayer.getCaretIndexAt(context.ctx, editingLayer, x, y);
      }
      return;
    }

    if (this.isMoving && this.editingLayerId) {
      const dx = x - this.startPos.x;
      const dy = y - this.startPos.y;
      useProjectStore.getState().updateLayer(context.project.id, this.editingLayerId, {
        x: this.layerStartPos.x + dx,
        y: this.layerStartPos.y + dy,
      });
      return;
    }

    if (this.isDragging) {
      this.currentPos = { x, y };
    } else {
      const hitLayer = this.findTextLayerAt(x, y, context);
      if (this.isEditing) {
        context.canvas.style.cursor = hitLayer ? "text" : "move";
      } else {
        context.canvas.style.cursor = hitLayer ? "text" : "default";
      }
    }
  }

  onMouseUp(e: MouseEvent, context: ToolContext): void {
    this.lastContext = context;
    if (this.isSelecting) {
      this.isSelecting = false;
      context.setInteracting(false);
      return;
    }

    if (this.isMoving) {
      this.isMoving = false;
      context.setInteracting(false);
      return;
    }

    if (!this.isDragging) return;
    this.isDragging = false;
    context.setInteracting(false);

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    const dist = Math.sqrt(Math.pow(x - this.startPos.x, 2) + Math.pow(y - this.startPos.y, 2));

    if (dist < 5) {
      this.createNewTextLayer(context, "point");
    } else {
      this.createNewTextLayer(context, "area");
    }
    
    const layer = context.project.layers.find(l => l.id === this.editingLayerId);
    if (layer && layer.textType === "point") {
      this.updateText("", context);
    }
  }

  onDoubleClick(e: MouseEvent, context: ToolContext): void {
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    const hitLayer = this.findTextLayerAt(x, y, context);

    if (hitLayer) {
      if (!this.isEditing || this.editingLayerId !== hitLayer.id) {
        this.startEditing(hitLayer, context, x, y);
      }
      
      const index = TextLayer.getCaretIndexAt(context.ctx, hitLayer, x, y);
      const text = hitLayer.text || "";
      
      // Find word boundaries
      let start = index;
      while (start > 0 && /\w/.test(text[start - 1])) {
        start--;
      }
      
      let end = index;
      while (end < text.length && /\w/.test(text[end])) {
        end++;
      }
      
      this.selectionStart = start;
      this.caretIndex = end;
    }
  }

  private findTextLayerAt(x: number, y: number, context: ToolContext): Layer | null {
    const layers = [...context.project.layers].reverse();
    for (const layer of layers) {
      if (layer.type === "text" && layer.visible && !layer.locked) {
        const padding = 10;
        if (x >= layer.x - padding && x <= layer.x + layer.width + padding && 
            y >= layer.y - padding && y <= layer.y + layer.height + padding) {
          return layer;
        }
      }
    }
    return null;
  }

  private startEditing(layer: Layer, context: ToolContext, hitX?: number, hitY?: number) {
    this.editingLayerId = layer.id;
    this.isEditing = true;
    this.originalText = layer.text || "";
    context.updateProject({ activeLayerId: layer.id });
    
    if (hitX !== undefined && hitY !== undefined) {
      this.caretIndex = TextLayer.getCaretIndexAt(context.ctx, layer, hitX, hitY);
    } else {
      this.caretIndex = layer.text?.length || 0;
    }
    this.selectionStart = this.caretIndex;
    
    context.updateToolSettings("text", { isEditing: true });
  }

  private createNewTextLayer(context: ToolContext, type: "point" | "area") {
    const settings = context.settings.text;
    const id = Math.random().toString(36).substring(2, 11);

    let x = this.startPos.x;
    let y = this.startPos.y;
    let width = 0; 
    let height = settings.fontSize * 1.2;

    if (type === "area") {
      x = Math.min(this.startPos.x, this.currentPos.x);
      y = Math.min(this.startPos.y, this.currentPos.y);
      width = Math.max(10, Math.abs(this.currentPos.x - this.startPos.x));
      height = Math.max(settings.fontSize, Math.abs(this.currentPos.y - this.startPos.y));
    } else {
      if (settings.textAlign === "center") x = this.startPos.x - width / 2;
      else if (settings.textAlign === "right") x = this.startPos.x - width;
      y = this.startPos.y - settings.fontSize;
    }

    const newLayer: Partial<Layer> = {
      id,
      name: "Text Layer",
      type: "text",
      x,
      y,
      width,
      height,
      text: "",
      textType: type,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      fontWeight: settings.fontWeight,
      color: settings.color,
      textAlign: settings.textAlign,
      lineHeight: settings.lineHeight,
      tracking: settings.tracking,
      opacity: 100,
      visible: true,
      blendMode: "source-over",
    };

    useProjectStore.getState().addLayer(context.project.id, newLayer);

    this.editingLayerId = id;
    this.isEditing = true;
    this.caretIndex = 0;
    this.selectionStart = 0;
    this.originalText = "";
    context.updateToolSettings("text", { isEditing: true });
  }

  onKeyDown(e: KeyboardEvent, context: ToolContext): boolean {
    this.lastContext = context;
    if (!this.isEditing || !this.editingLayerId) return false;

    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (!layer) return false;

    const text = layer.text || "";
    const hasSelection = this.caretIndex !== this.selectionStart;

    if (e.key === "Enter") {
      if (e.ctrlKey || e.metaKey) {
        this.commit(context);
        return true;
      }
      this.insertText("\n", context);
      return true;
    } else if (e.key === "Backspace") {
      if (hasSelection) {
        this.deleteSelection(context);
      } else if (this.caretIndex > 0) {
        const newText = text.substring(0, this.caretIndex - 1) + text.substring(this.caretIndex);
        this.caretIndex--;
        this.selectionStart = this.caretIndex;
        this.updateText(newText, context);
      }
      return true;
    } else if (e.key === "Delete") {
      if (hasSelection) {
        this.deleteSelection(context);
      } else if (this.caretIndex < text.length) {
        const newText = text.substring(0, this.caretIndex) + text.substring(this.caretIndex + 1);
        this.updateText(newText, context);
      }
      return true;
    } else if (e.key === "ArrowLeft") {
      if (e.ctrlKey || e.altKey) {
        // Jump word
        let i = this.caretIndex;
        // Skip current non-word chars
        while (i > 0 && !/\w/.test(text[i - 1])) i--;
        // Skip word chars
        while (i > 0 && /\w/.test(text[i - 1])) i--;
        this.caretIndex = i;
      } else {
        this.caretIndex = Math.max(0, this.caretIndex - 1);
      }

      if (!e.shiftKey) {
        this.selectionStart = this.caretIndex;
      }
      return true;
    } else if (e.key === "ArrowRight") {
      if (e.ctrlKey || e.altKey) {
        // Jump word
        let i = this.caretIndex;
        // Skip current word chars
        while (i < text.length && /\w/.test(text[i])) i++;
        // Skip non-word chars to next word start
        while (i < text.length && !/\w/.test(text[i])) i++;
        this.caretIndex = i;
      } else {
        this.caretIndex = Math.min(text.length, this.caretIndex + 1);
      }

      if (!e.shiftKey) {
        this.selectionStart = this.caretIndex;
      }
      return true;
    } else if (e.key === "Escape") {
      this.cancel(context);
      return true;
    } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
      this.selectionStart = 0;
      this.caretIndex = text.length;
      return true;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.insertText(e.key, context);
      return true;
    }

    return true; 
  }

  private deleteSelection(context: ToolContext) {
    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (!layer) return;
    const text = layer.text || "";
    const start = Math.min(this.caretIndex, this.selectionStart);
    const end = Math.max(this.caretIndex, this.selectionStart);
    const newText = text.substring(0, start) + text.substring(end);
    this.caretIndex = start;
    this.selectionStart = start;
    this.updateText(newText, context);
  }

  private insertText(char: string, context: ToolContext) {
    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (!layer) return;
    
    const start = Math.min(this.caretIndex, this.selectionStart);
    const end = Math.max(this.caretIndex, this.selectionStart);
    const text = layer.text || "";
    
    const newText = text.substring(0, start) + char + text.substring(end);
    this.caretIndex = start + char.length;
    this.selectionStart = this.caretIndex;
    this.updateText(newText, context);
  }

  private updateText(text: string, context: ToolContext) {
    if (!this.editingLayerId) return;
    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (!layer) return;

    const updates: Partial<Layer> = { text };

    if (layer.textType === "point") {
      let anchorX = layer.x;
      if (layer.textAlign === "center") anchorX = layer.x + layer.width / 2;
      else if (layer.textAlign === "right") anchorX = layer.x + layer.width;

      const ctx = context.ctx;
      ctx.save();
      ctx.font = `${layer.fontWeight || "normal"} ${layer.fontSize || 24}px ${layer.fontFamily || "Arial"}`;
      
      const lines = text.split("\n");
      const tracking = layer.tracking || 0;
      let maxWidth = 0;
      
      lines.forEach(line => {
        const width = TextLayer.measureTextWithTracking(ctx, line, tracking);
        maxWidth = Math.max(maxWidth, width);
      });
      
      const newWidth = Math.max(1, maxWidth);
      updates.width = newWidth;
      updates.height = lines.length * (layer.fontSize || 24) * (layer.lineHeight || 1.2);

      if (layer.textAlign === "center") updates.x = anchorX - newWidth / 2;
      else if (layer.textAlign === "right") updates.x = anchorX - newWidth;
      else updates.x = anchorX;

      ctx.restore();
    }

    useProjectStore.getState().updateLayer(context.project.id, this.editingLayerId, updates);
  }

  private commit(context: ToolContext) {
    if (!this.editingLayerId) return;
    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (layer && !layer.text && this.originalText === "") {
      useProjectStore.getState().removeLayer(context.project.id, this.editingLayerId);
    }
    this.isEditing = false;
    this.editingLayerId = null;
    context.setInteracting(false);
    context.updateToolSettings("text", { isEditing: false });
  }

  private cancel(context: ToolContext) {
    if (!this.editingLayerId) return;
    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (this.originalText === "" && (!layer || !layer.text)) {
      useProjectStore.getState().removeLayer(context.project.id, this.editingLayerId);
    } else {
      useProjectStore
        .getState()
        .updateLayer(context.project.id, this.editingLayerId, { text: this.originalText });
    }
    this.isEditing = false;
    this.editingLayerId = null;
    context.setInteracting(false);
    context.updateToolSettings("text", { isEditing: false });
  }

  onRender(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    if (this.isDragging) {
      ctx.save();
      ctx.strokeStyle = "#0078ff";
      ctx.lineWidth = 1 / context.project.zoom;
      ctx.setLineDash([4 / context.project.zoom, 2 / context.project.zoom]);

      const x = Math.min(this.startPos.x, this.currentPos.x);
      const y = Math.min(this.startPos.y, this.currentPos.y);
      const w = Math.max(1, Math.abs(this.currentPos.x - this.startPos.x));
      const h = Math.max(1, Math.abs(this.currentPos.y - this.startPos.y));

      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
    
    // Auto-commit if active layer changed externally
    if (this.isEditing && this.editingLayerId && context.project.activeLayerId !== this.editingLayerId) {
       this.commit(context);
    }
  }
}
