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
  private hiddenInput: HTMLTextAreaElement | null = null;
  private isComposing = false;

  private onApply = () => this.commit(this.lastContext!);
  private onCancel = () => this.cancel(this.lastContext!);
  private lastContext: ToolContext | null = null;

  onActivate(context: ToolContext): void {
    this.lastContext = context;
    window.addEventListener("forge:text-apply", this.onApply);
    window.addEventListener("forge:text-cancel", this.onCancel);
    this.createHiddenInput(context);
  }

  onDeactivate(context: ToolContext): void {
    if (this.isEditing) {
      this.commit(context);
    }
    window.removeEventListener("forge:text-apply", this.onApply);
    window.removeEventListener("forge:text-cancel", this.onCancel);
    this.removeHiddenInput();
  }

  private createHiddenInput(context: ToolContext) {
    if (this.hiddenInput) return;
    this.hiddenInput = document.createElement("textarea");
    this.hiddenInput.style.position = "fixed";
    this.hiddenInput.style.left = "0px";
    this.hiddenInput.style.top = "0px";
    this.hiddenInput.style.width = "1px";
    this.hiddenInput.style.height = "1px";
    this.hiddenInput.style.opacity = "0";
    this.hiddenInput.style.zIndex = "-1";
    this.hiddenInput.id = "forge-text-input";
    document.body.appendChild(this.hiddenInput);

    this.hiddenInput.addEventListener("input", (_e: any) => {
      if (!this.isEditing || this.isComposing) return;
      const val = this.hiddenInput!.value;
      if (val) {
        this.insertText(val, context);
        this.hiddenInput!.value = "";
      }
    });

    this.hiddenInput.addEventListener("compositionstart", () => {
      this.isComposing = true;
    });

    this.hiddenInput.addEventListener("compositionend", (e: any) => {
      this.isComposing = false;
      if (e.data) {
        this.insertText(e.data, context);
        this.hiddenInput!.value = "";
      }
    });

    this.hiddenInput.addEventListener("blur", () => {
      setTimeout(() => {
        if (this.isEditing && this.hiddenInput && document.activeElement !== this.hiddenInput) {
          this.hiddenInput.focus();
        }
      }, 50);
    });

    // We do NOT add a keydown listener here because ForgeEngine already
    // has a window-level listener that calls tool.onKeyDown(e).
  }

  private removeHiddenInput() {
    if (this.hiddenInput) {
      document.body.removeChild(this.hiddenInput);
      this.hiddenInput = null;
    }
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
      const editingLayer = context.project.layers.find((l) => l.id === this.editingLayerId);

      // Focus hidden input to ensure we catch keyboard
      setTimeout(() => this.hiddenInput?.focus(), 50);

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
      const editingLayer = context.project.layers.find((l) => l.id === this.editingLayerId);
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

    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
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
        if (
          x >= layer.x - padding &&
          x <= layer.x + layer.width + padding &&
          y >= layer.y - padding &&
          y <= layer.y + layer.height + padding
        ) {
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
    setTimeout(() => this.hiddenInput?.focus(), 50);
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
      textRendering: settings.textRendering || "bilinear",
    };

    useProjectStore.getState().addLayer(context.project.id, newLayer);

    this.editingLayerId = id;
    this.isEditing = true;
    this.caretIndex = 0;
    this.selectionStart = 0;
    this.originalText = "";
    context.updateToolSettings("text", { isEditing: true });
    setTimeout(() => this.hiddenInput?.focus(), 50);
  }

  onKeyDown(e: KeyboardEvent, context: ToolContext): boolean {
    this.lastContext = context;
    if (!this.isEditing || !this.editingLayerId) return false;

    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (!layer) return false;

    const text = layer.text || "";
    const hasSelection = this.caretIndex !== this.selectionStart;

    // Helper to consume event
    const consume = () => {
      e.preventDefault();
      e.stopPropagation();
      return true;
    };

    if (e.key === "Enter") {
      if (e.ctrlKey || e.metaKey) {
        this.commit(context);
        return consume();
      }
      this.insertText("\n", context);
      return consume();
    } else if (e.key === "Backspace") {
      if (hasSelection) {
        this.deleteSelection(context);
      } else if (this.caretIndex > 0) {
        const newText = text.substring(0, this.caretIndex - 1) + text.substring(this.caretIndex);
        this.caretIndex--;
        this.selectionStart = this.caretIndex;
        this.updateText(newText, context);
      }
      return consume();
    } else if (e.key === "Delete") {
      if (hasSelection) {
        this.deleteSelection(context);
      } else if (this.caretIndex < text.length) {
        const newText = text.substring(0, this.caretIndex) + text.substring(this.caretIndex + 1);
        this.updateText(newText, context);
      }
      return consume();
    } else if (e.key === "ArrowLeft") {
      if (e.ctrlKey || e.altKey) {
        // Jump word
        let i = this.caretIndex;
        while (i > 0 && !/\w/.test(text[i - 1])) i--;
        while (i > 0 && /\w/.test(text[i - 1])) i--;
        this.caretIndex = i;
      } else {
        this.caretIndex = Math.max(0, this.caretIndex - 1);
      }

      if (!e.shiftKey) {
        this.selectionStart = this.caretIndex;
      }
      return consume();
    } else if (e.key === "ArrowRight") {
      if (e.ctrlKey || e.altKey) {
        // Jump word
        let i = this.caretIndex;
        while (i < text.length && /\w/.test(text[i])) i++;
        while (i < text.length && !/\w/.test(text[i])) i++;
        this.caretIndex = i;
      } else {
        this.caretIndex = Math.min(text.length, this.caretIndex + 1);
      }

      if (!e.shiftKey) {
        this.selectionStart = this.caretIndex;
      }
      return consume();
    } else if (e.key === "Escape") {
      this.cancel(context);
      return consume();
    } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
      this.selectionStart = 0;
      this.caretIndex = text.length;
      return consume();
    } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
      this.copySelectedText(layer);
      return consume();
    } else if (e.key === "x" && (e.ctrlKey || e.metaKey)) {
      this.copySelectedText(layer);
      this.deleteSelection(context);
      return consume();
    } else if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      this.pasteTextFromClipboard(context);
      return consume();
    }

    // Allow OS shortcuts (like Emoji Panel Cmd+Ctrl+Space) to pass through
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return false;
    }

    // Return false for any printable characters or dead keys so they can reach the hidden input natively
    if (e.key.length === 1 || e.key === "Dead") {
      return false;
    }

    return false;
  }

  private async copySelectedText(layer: Layer) {
    if (this.caretIndex === this.selectionStart) return;
    const start = Math.min(this.caretIndex, this.selectionStart);
    const end = Math.max(this.caretIndex, this.selectionStart);
    const text = (layer.text || "").substring(start, end);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  }

  private async pasteTextFromClipboard(context: ToolContext) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.insertText(text, context);
      }
    } catch (err) {
      console.error("Failed to paste text:", err);
    }
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

    const baseUpdates: Partial<Layer> = { text };
    let dimensionUpdates = {};

    if (layer.textType === "point") {
      const metrics = TextLayer.calculateMetrics(context.ctx, { ...layer, ...baseUpdates });
      dimensionUpdates = {
        width: metrics.width,
        height: metrics.height,
        x: metrics.x,
      };
    }

    const updates = { ...baseUpdates, ...dimensionUpdates };
    useProjectStore.getState().updateLayer(context.project.id, this.editingLayerId, updates);
    context.invalidateCache(this.editingLayerId);
  }

  private commit(context: ToolContext) {
    if (!this.editingLayerId) return;
    const layer = context.project.layers.find((l) => l.id === this.editingLayerId);
    if (layer && !layer.text && this.originalText === "") {
      useProjectStore.getState().removeLayer(context.project.id, this.editingLayerId);
    }
    this.isEditing = false;
    this.editingLayerId = null;
    if (this.hiddenInput) {
      this.hiddenInput.value = "";
      this.hiddenInput.blur();
    }
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
    if (this.hiddenInput) {
      this.hiddenInput.value = "";
      this.hiddenInput.blur();
    }
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
    if (
      this.isEditing &&
      this.editingLayerId &&
      context.project.activeLayerId !== this.editingLayerId
    ) {
      this.commit(context);
    }
  }
}
