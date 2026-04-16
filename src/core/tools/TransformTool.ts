import { BaseTool, ToolContext } from "./BaseTool";
import { useToolStore } from "@/renderer/store/toolStore";
import { Layer } from "@/renderer/store/projectStore";

interface TransformState {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  anchor: { x: number; y: number };
  isDirty: boolean;
}

interface Handle {
  name: string;
  x: number;
  y: number;
  cursor: string;
}

export class TransformTool extends BaseTool {
  id = "transform";
  private originalLayer: Layer | null = null;
  private currentTransform: TransformState | null = null;
  private activeHandle: Handle | null = null;
  private dragStartCoords = { x: 0, y: 0 };
  private dragStartTransform: TransformState | null = null;
  private scaleAnchor = { x: 0, y: 0 };
  private TRANSFORM_HANDLE_SIZE = 8;
  private context: ToolContext | null = null;
  private unsubscribeStore: (() => void) | null = null;

  onActivate(context: ToolContext): void {
    this.context = context;
    const activeLayerId = context.project.activeLayerId;
    const layer = context.project.layers.find((l) => l.id === activeLayerId);

    if (layer) {
      this.originalLayer = JSON.parse(JSON.stringify(layer));
      this.currentTransform = {
        x: layer.x + layer.width / 2,
        y: layer.y + layer.height / 2,
        width: layer.width,
        height: layer.height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
        isDirty: false,
      };
      this.syncStore();
    }

    window.addEventListener("forge:transform-apply", this.handleApplyEvent);
    window.addEventListener("forge:transform-cancel", this.handleCancelEvent);

    this.unsubscribeStore = useToolStore.subscribe((state) => {
      if (useToolStore.getState().activeToolId === "transform") {
        const newSettings = state.toolSettings.transform;
        if (this.currentTransform) {
          if (
            this.currentTransform.x !== newSettings.x ||
            this.currentTransform.y !== newSettings.y ||
            this.currentTransform.scaleX !== newSettings.scaleX ||
            this.currentTransform.scaleY !== newSettings.scaleY ||
            this.currentTransform.rotation !== newSettings.rotation
          ) {
            this.currentTransform = { ...newSettings };
          }
        }
      }
    });
  }

  private handleApplyEvent = () => {
    if (this.context) this.apply(this.context);
  };

  private handleCancelEvent = () => {
    this.cancel();
  };

  onDeactivate(_context: ToolContext): void {
    this.originalLayer = null;
    this.currentTransform = null;
    this.activeHandle = null;
    this.context = null;
    window.removeEventListener("forge:transform-apply", this.handleApplyEvent);
    window.removeEventListener("forge:transform-cancel", this.handleCancelEvent);
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    
    // Reset dirty state on deactivate
    useToolStore.getState().updateToolSettings("transform", { isDirty: false });
  }

  private syncStore() {
    if (this.currentTransform) {
      useToolStore.getState().updateToolSettings("transform", {
        ...this.currentTransform,
      });
    }
  }

  private worldToLocal(px: number, py: number): { x: number; y: number } {
    if (!this.currentTransform) return { x: 0, y: 0 };
    const t = this.currentTransform;

    const x = px - t.x;
    const y = py - t.y;

    const rot = (-t.rotation * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const x_rot = x * cos - y * sin;
    const y_rot = x * sin + y * cos;

    return { x: x_rot, y: y_rot };
  }

  private localToWorld(lx: number, ly: number): { x: number; y: number } {
    if (!this.currentTransform) return { x: 0, y: 0 };
    const t = this.currentTransform;

    const rot = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const x_rot = lx * cos - ly * sin;
    const y_rot = lx * sin + ly * cos;

    return { x: x_rot + t.x, y: y_rot + t.y };
  }

  private getTransformHandles(context: ToolContext, local = false): Handle[] {
    if (!this.currentTransform) return [];
    const t = this.currentTransform;
    const scale = context.project.zoom;

    const left = -t.width * t.anchor.x * t.scaleX;
    const top = -t.height * t.anchor.y * t.scaleY;
    const width = t.width * t.scaleX;
    const height = t.height * t.scaleY;
    const midX = left + width / 2;
    const midY = top + height / 2;

    const handles: Handle[] = [
      { name: "top-left", x: left, y: top, cursor: "nwse-resize" },
      { name: "top-middle", x: midX, y: top, cursor: "ns-resize" },
      { name: "top-right", x: left + width, y: top, cursor: "nesw-resize" },
      { name: "center-left", x: left, y: midY, cursor: "ew-resize" },
      { name: "center-right", x: left + width, y: midY, cursor: "ew-resize" },
      { name: "bottom-left", x: left, y: top + height, cursor: "nesw-resize" },
      { name: "bottom-middle", x: midX, y: top + height, cursor: "ns-resize" },
      { name: "bottom-right", x: left + width, y: top + height, cursor: "nwse-resize" },
      { name: "rotate", x: midX, y: top - 20 / scale, cursor: "crosshair" },
    ];

    if (local) return handles;

    return handles.map((h) => {
      const worldPos = this.localToWorld(h.x, h.y);
      return { ...h, ...worldPos };
    });
  }

  private getRotatedCursor(handleName: string, rotation: number): string {
    const directions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
    
    if (handleName === "rotate") return "crosshair";
    if (handleName === "move") return "move";

    let baseDir = "";
    if (handleName.includes("top")) baseDir += "n";
    else if (handleName.includes("bottom")) baseDir += "s";
    
    if (handleName.includes("left")) baseDir += "w";
    else if (handleName.includes("right")) baseDir += "e";

    // Adjust baseDir for negative scales
    const t = this.currentTransform!;
    if (t.scaleX < 0) {
      if (baseDir.includes("w")) baseDir = baseDir.replace("w", "e");
      else if (baseDir.includes("e")) baseDir = baseDir.replace("e", "w");
    }
    if (t.scaleY < 0) {
      if (baseDir.includes("n")) baseDir = baseDir.replace("n", "s");
      else if (baseDir.includes("s")) baseDir = baseDir.replace("s", "n");
    }

    // Normalize baseDir (must be in 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw' format)
    if (baseDir === "wn") baseDir = "nw";
    if (baseDir === "en") baseDir = "ne";
    if (baseDir === "ws") baseDir = "sw";
    if (baseDir === "es") baseDir = "se";

    const index = directions.indexOf(baseDir);
    if (index === -1) return "default";

    // Add rotation to the base direction
    // 360 degrees / 8 directions = 45 degrees per step
    const steps = Math.round(rotation / 45);
    const newIndex = (index + steps + directions.length) % directions.length;
    
    return `${directions[newIndex]}-resize`;
  }

  private getHandleAtPoint(px: number, py: number, context: ToolContext): Handle | { name: string; cursor: string } | null {
    if (!this.currentTransform) return null;
    const handles = this.getTransformHandles(context, false);
    const scale = context.project.zoom;
    const checkRadius = (this.TRANSFORM_HANDLE_SIZE / scale / 2) * 2; // Increased hit area a bit
    const rotation = this.currentTransform.rotation;

    // Check handles first (in reverse to get top-most handles if they overlap)
    for (let i = handles.length - 1; i >= 0; i--) {
      const h = handles[i];
      const dist = Math.hypot(px - h.x, py - h.y);
      if (dist <= checkRadius) {
        return {
          ...h,
          cursor: this.getRotatedCursor(h.name, rotation)
        };
      }
    }

    // Move hit test
    const localPos = this.worldToLocal(px, py);
    const t = this.currentTransform;
    
    // Bounds check in local space (rotated but unscaled)
    // We must compare against the absolute bounds even if scale is negative
    const x1 = -t.width * t.anchor.x * t.scaleX;
    const x2 = t.width * (1 - t.anchor.x) * t.scaleX;
    const y1 = -t.height * t.anchor.y * t.scaleY;
    const y2 = t.height * (1 - t.anchor.y) * t.scaleY;

    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    // Add a small padding for easier selection
    const padding = 2 / scale;
    if (
      localPos.x >= left - padding &&
      localPos.x <= right + padding &&
      localPos.y >= top - padding &&
      localPos.y <= bottom + padding
    ) {
      return { name: "move", cursor: "move" };
    }

    return null;
  }

  onMouseDown(e: MouseEvent, context: ToolContext): void {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const handle = this.getHandleAtPoint(px, py, context);

    if (!handle) return;

    this.activeHandle = handle as Handle;
    this.dragStartCoords = { x: px, y: py };
    this.dragStartTransform = JSON.parse(JSON.stringify(this.currentTransform));

    if (handle.name !== "move" && handle.name !== "rotate") {
      let oppositeHandleName = handle.name;
      // Find opposite handle for scaling
      if (oppositeHandleName.includes("top")) oppositeHandleName = oppositeHandleName.replace("top", "bottom");
      else if (oppositeHandleName.includes("bottom")) oppositeHandleName = oppositeHandleName.replace("bottom", "top");
      if (oppositeHandleName.includes("left")) oppositeHandleName = oppositeHandleName.replace("left", "right");
      else if (oppositeHandleName.includes("right")) oppositeHandleName = oppositeHandleName.replace("right", "left");

      const oppositeHandle = this.getTransformHandles(context, true).find((h) => h.name === oppositeHandleName);
      if (oppositeHandle) {
        this.scaleAnchor = this.localToWorld(oppositeHandle.x, oppositeHandle.y);
      } else {
        this.scaleAnchor = { x: this.currentTransform!.x, y: this.currentTransform!.y };
      }
    }
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    const { x: raw_px, y: raw_py } = context.screenToProject(e.offsetX, e.offsetY);

    if (!this.activeHandle) {
      const hoverHandle = this.getHandleAtPoint(raw_px, raw_py, context);
      context.canvas.style.cursor = hoverHandle?.cursor || "default";
      return;
    }

    // Keep cursor correct during drag
    context.canvas.style.cursor = this.getRotatedCursor(this.activeHandle.name, this.currentTransform!.rotation);

    const t = this.currentTransform!;
    const startT = this.dragStartTransform!;
    const px = this.activeHandle.name === "rotate" ? raw_px : Math.round(raw_px);
    const py = this.activeHandle.name === "rotate" ? raw_py : Math.round(raw_py);

    const dx = px - this.dragStartCoords.x;
    const dy = py - this.dragStartCoords.y;

    let changed = false;

    switch (this.activeHandle.name) {
      case "move": {
        t.x = startT.x + dx;
        t.y = startT.y + dy;
        changed = dx !== 0 || dy !== 0;
        break;
      }
      case "rotate": {
        const startAngle = Math.atan2(this.dragStartCoords.y - startT.y, this.dragStartCoords.x - startT.x);
        const currentAngle = Math.atan2(py - startT.y, px - startT.x);
        let newRotation = startT.rotation + ((currentAngle - startAngle) * 180) / Math.PI;
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }
        const oldRot = t.rotation;
        t.rotation = newRotation % 360;
        changed = t.rotation !== oldRot;
        break;
      }
      default: {
        const scaleFromCenter = e.altKey;
        const scaleAnchor = scaleFromCenter ? { x: startT.x, y: startT.y } : this.scaleAnchor;
        const keepAspect = e.shiftKey;

        const rot = (startT.rotation * Math.PI) / 180;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const world_axis_x = { x: cos, y: sin };
        const world_axis_y = { x: -sin, y: cos };

        const vec_start = { x: this.dragStartCoords.x - scaleAnchor.x, y: this.dragStartCoords.y - scaleAnchor.y };
        const vec_current = { x: px - scaleAnchor.x, y: py - scaleAnchor.y };

        const start_proj_x = vec_start.x * world_axis_x.x + vec_start.y * world_axis_x.y;
        const start_proj_y = vec_start.x * world_axis_y.x + vec_start.y * world_axis_y.y;
        const current_proj_x = vec_current.x * world_axis_x.x + vec_current.y * world_axis_x.y;
        const current_proj_y = vec_current.x * world_axis_y.x + vec_current.y * world_axis_y.y;

        let scaleFactorX = start_proj_x === 0 ? 1 : current_proj_x / start_proj_x;
        let scaleFactorY = start_proj_y === 0 ? 1 : current_proj_y / start_proj_y;

        const applyScaleX = this.activeHandle.name.includes("left") || this.activeHandle.name.includes("right");
        const applyScaleY = this.activeHandle.name.includes("top") || this.activeHandle.name.includes("bottom");

        if (keepAspect) {
          if (applyScaleX && applyScaleY) {
            const globalScale = Math.abs(scaleFactorX) > Math.abs(scaleFactorY) ? scaleFactorX : scaleFactorY;
            scaleFactorX = globalScale;
            scaleFactorY = globalScale;
          } else if (applyScaleX) scaleFactorY = scaleFactorX;
          else if (applyScaleY) scaleFactorX = scaleFactorY;
        }

        const oldScaleX = t.scaleX;
        const oldScaleY = t.scaleY;

        if (applyScaleX || (keepAspect && applyScaleY)) t.scaleX = startT.scaleX * scaleFactorX;
        if (applyScaleY || (keepAspect && applyScaleX)) t.scaleY = startT.scaleY * scaleFactorY;

        const vec_anchor_to_center = { x: startT.x - scaleAnchor.x, y: startT.y - scaleAnchor.y };
        const center_proj_x = vec_anchor_to_center.x * world_axis_x.x + vec_anchor_to_center.y * world_axis_x.y;
        const center_proj_y = vec_anchor_to_center.x * world_axis_y.x + vec_anchor_to_center.y * world_axis_y.y;
        
        const new_center_proj_x = center_proj_x * ( (applyScaleX || (keepAspect && applyScaleY)) ? scaleFactorX : 1);
        const new_center_proj_y = center_proj_y * ( (applyScaleY || (keepAspect && applyScaleX)) ? scaleFactorY : 1);

        t.x = scaleAnchor.x + (new_center_proj_x * world_axis_x.x + new_center_proj_y * world_axis_y.x);
        t.y = scaleAnchor.y + (new_center_proj_x * world_axis_x.y + new_center_proj_y * world_axis_y.y);
        
        changed = t.scaleX !== oldScaleX || t.scaleY !== oldScaleY;
        break;
      }
    }
    
    if (changed) {
      t.isDirty = true;
    }
    this.syncStore();
  }

  onMouseUp(): void {
    this.activeHandle = null;
    this.dragStartTransform = null;
  }

  onRender(ctx: CanvasRenderingContext2D, context: ToolContext): void {
    if (!this.currentTransform || !this.originalLayer) return;
    const t = this.currentTransform;
    const scale = context.project.zoom;

    // Desenhar preview da camada transformada
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale(t.scaleX, t.scaleY);
    
    const layerCanvas = context.getLayerCanvas(this.originalLayer.id);
    if (layerCanvas?.ready) {
      ctx.globalAlpha = this.originalLayer.opacity / 100;
      ctx.drawImage(layerCanvas.canvas, -t.width * t.anchor.x, -t.height * t.anchor.y);
    }
    ctx.restore();

    // Desenhar handles e bordas
    const handles = this.getTransformHandles(context, false);
    ctx.save();
    ctx.strokeStyle = "#0078ff";
    ctx.lineWidth = 1 / scale;
    
    // Desenhar linhas conectando os cantos
    ctx.beginPath();
    const corners = handles.filter(h => ["top-left", "top-right", "bottom-right", "bottom-left"].includes(h.name));
    if (corners.length === 4) {
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.stroke();
    }

    // Desenhar linha de rotação
    const rotateHandle = handles.find(h => h.name === "rotate");
    const topMiddle = handles.find(h => h.name === "top-middle");
    if (rotateHandle && topMiddle) {
      ctx.beginPath();
      ctx.moveTo(topMiddle.x, topMiddle.y);
      ctx.lineTo(rotateHandle.x, rotateHandle.y);
      ctx.stroke();
    }

    // Desenhar os handles
    const handleSize = this.TRANSFORM_HANDLE_SIZE / scale;
    handles.forEach(h => {
      ctx.fillStyle = "white";
      ctx.strokeStyle = "#0078ff";
      ctx.lineWidth = 1 / scale;
      if (h.name === "rotate") {
        ctx.beginPath();
        ctx.arc(h.x, h.y, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      }
    });
    ctx.restore();
  }

  async apply(context: ToolContext) {
    if (!this.currentTransform || !this.originalLayer) return;
    const t = this.currentTransform;
    const layer = context.project.layers.find(l => l.id === this.originalLayer?.id);
    if (!layer) return;

    const rot = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    const corners = [
      { x: -t.width * t.anchor.x * t.scaleX, y: -t.height * t.anchor.y * t.scaleY },
      { x: t.width * (1 - t.anchor.x) * t.scaleX, y: -t.height * t.anchor.y * t.scaleY },
      { x: t.width * (1 - t.anchor.x) * t.scaleX, y: t.height * (1 - t.anchor.y) * t.scaleY },
      { x: -t.width * t.anchor.x * t.scaleX, y: t.height * (1 - t.anchor.y) * t.scaleY },
    ];

    const transformedCorners = corners.map(c => ({
      x: t.x + (c.x * cos - c.y * sin),
      y: t.y + (c.x * sin + c.y * cos),
    }));

    const minX = Math.min(...transformedCorners.map(c => c.x));
    const minY = Math.min(...transformedCorners.map(c => c.y));
    const maxX = Math.max(...transformedCorners.map(c => c.x));
    const maxY = Math.max(...transformedCorners.map(c => c.y));

    const newWidth = Math.ceil(maxX - minX);
    const newHeight = Math.ceil(maxY - minY);
    const newX = Math.round(minX);
    const newY = Math.round(minY);

    const layerCanvas = context.getLayerCanvas(layer.id);
    if (layerCanvas?.ready) {
      const offCanvas = document.createElement("canvas");
      offCanvas.width = newWidth;
      offCanvas.height = newHeight;
      const octx = offCanvas.getContext("2d")!;

      octx.translate(-newX, -newY);
      octx.translate(t.x, t.y);
      octx.rotate(rot);
      octx.scale(t.scaleX, t.scaleY);
      octx.drawImage(layerCanvas.canvas, -t.width * t.anchor.x, -t.height * t.anchor.y);

      context.updateProject({
        layers: context.project.layers.map(l => l.id === layer.id ? {
          ...l,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          data: offCanvas.toDataURL(),
        } : l)
      });
      context.invalidateCache(layer.id);
    }

    useToolStore.getState().setActiveTool("move");
  }

  cancel() {
    useToolStore.getState().setActiveTool("move");
  }

  getEditingLayerId(): string | null {
    return this.originalLayer?.id || null;
  }
}
