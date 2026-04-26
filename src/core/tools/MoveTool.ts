/**
 * Purpose: Tool for moving layers and selections, including auto-selection logic and support for floating selections.
 */
import { BaseTool, ToolContext, ToolId } from "./BaseTool";
import { createHistoryState, HistoryState } from "@/renderer/store/projectStore";

export class MoveTool extends BaseTool {
  id: ToolId = "move";

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLayerX = 0;
  private initialLayerY = 0;
  private layerId: string | null = null;
  private isFloating = false;
  private historySnapshot: HistoryState | null = null;

  async onMouseDown(e: MouseEvent, context: ToolContext): Promise<void> {
    if (e.button !== 0) return;

    const { project } = context;
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);

    // 1. Auto Select Logic (Enabled by setting OR by holding Alt key)
    if (context.settings.move.autoSelect || e.altKey) {
      // Find top-most layer at this point (reverse search)
      const foundLayer = [...project.layers]
        .reverse()
        .find(
          (l) =>
            l.visible &&
            !l.locked &&
            x >= l.x &&
            x <= l.x + l.width &&
            y >= l.y &&
            y <= l.y + l.height,
        );

      if (foundLayer && foundLayer.id !== project.activeLayerId) {
        context.updateProject({ activeLayerId: foundLayer.id });
        // Update local reference for the rest of the method
        project.activeLayerId = foundLayer.id;
      }
    }

    const activeLayerId = project.activeLayerId;
    if (!activeLayerId) return;

    const layer = project.layers.find((l) => l.id === activeLayerId);
    if (!layer || layer.locked) return;

    // Capture snapshot BEFORE any changes
    this.historySnapshot = createHistoryState(project);

    // If we have a selection and no floating layer yet, we float it now
    if (project.selection.hasSelection && !project.selection.floatingLayer) {
      const success = await context.floatSelection(activeLayerId);
      if (success) {
        this.isFloating = true;
      }
    } else if (project.selection.floatingLayer) {
      this.isFloating = true;
    } else {
      this.isFloating = false;
    }

    this.isDragging = true;
    this.layerId = this.isFloating ? "floating-selection" : activeLayerId;

    const targetLayer = this.isFloating ? context.project.selection.floatingLayer! : layer;

    this.startX = x;
    this.startY = y;
    this.initialLayerX = targetLayer.x;
    this.initialLayerY = targetLayer.y;
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    if (!this.isDragging || !this.layerId) return;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    // Use Math.round to force movement to project pixels (no subpixels)
    const dx = Math.round(x - this.startX);
    const dy = Math.round(y - this.startY);

    if (this.isFloating) {
      const floatingLayer = context.project.selection.floatingLayer;
      if (floatingLayer) {
        const newFloating = {
          ...floatingLayer,
          x: this.initialLayerX + dx,
          y: this.initialLayerY + dy,
        };
        context.updateProject({
          selection: {
            ...context.project.selection,
            floatingLayer: newFloating,
            bounds: {
              ...context.project.selection.bounds!,
              x: this.initialLayerX + dx,
              y: this.initialLayerY + dy,
            },
          },
        });
        context.updateSelectionEdges();
      }
    } else {
      const layers = context.project.layers.map((l) => {
        if (l.id === this.layerId) {
          return {
            ...l,
            x: this.initialLayerX + dx,
            y: this.initialLayerY + dy,
          };
        }
        return l;
      });

      context.updateProject({ layers });
    }
  }

  onMouseUp(e: MouseEvent, context: ToolContext): void {
    if (this.isDragging) {
      this.isDragging = false;

      const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
      const dx = Math.round(x - this.startX);
      const dy = Math.round(y - this.startY);

      if (this.historySnapshot && (dx !== 0 || dy !== 0)) {
        context.addHistoryEntry({
          description: "Move Tool",
          state: this.historySnapshot,
        });
      }

      context.updateProject({ isDirty: true });
    }
    this.layerId = null;
    this.historySnapshot = null;
  }

  onKeyDown(e: KeyboardEvent, context: ToolContext): boolean {
    const isArrow = e.key.startsWith("Arrow");
    if (!isArrow) return false;

    const { project } = context;
    const activeLayerId = project.activeLayerId;
    if (!activeLayerId) return false;

    const layer = project.layers.find((l) => l.id === activeLayerId);
    if (!layer || layer.locked) return false;

    e.preventDefault();

    const multiplier = e.shiftKey ? 8 : 1;
    let dx = 0;
    let dy = 0;

    if (e.key === "ArrowLeft") dx = -1 * multiplier;
    if (e.key === "ArrowRight") dx = 1 * multiplier;
    if (e.key === "ArrowUp") dy = -1 * multiplier;
    if (e.key === "ArrowDown") dy = 1 * multiplier;

    const history = createHistoryState(project);

    const layers = project.layers.map((l) => {
      if (l.id === activeLayerId) {
        return { ...l, x: l.x + dx, y: l.y + dy };
      }
      return l;
    });

    context.addHistoryEntry({
      description: "Move",
      state: history,
    });

    context.updateProject({ layers, isDirty: true });
    return true;
  }
}
