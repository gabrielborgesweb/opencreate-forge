import { BaseTool, ToolContext, ToolId } from "./BaseTool";

export class MoveTool extends BaseTool {
  id: ToolId = "move";

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLayerX = 0;
  private initialLayerY = 0;
  private layerId: string | null = null;
  private isFloating = false;

  async onMouseDown(e: MouseEvent, context: ToolContext): Promise<void> {
    if (e.button !== 0) return;

    const { project } = context;
    const activeLayerId = project.activeLayerId;
    if (!activeLayerId) return;

    const layer = project.layers.find((l) => l.id === activeLayerId);
    if (!layer || layer.locked) return;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);

    context.pushHistory("Move");

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

    // IMPORTANT: use context.project (which was updated by floatSelection)
    const targetLayer = this.isFloating ? context.project.selection.floatingLayer! : layer;

    this.startX = x;
    this.startY = y;
    this.initialLayerX = targetLayer.x;
    this.initialLayerY = targetLayer.y;
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    if (!this.isDragging || !this.layerId) return;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    const dx = x - this.startX;
    const dy = y - this.startY;

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
      context.updateProject({ isDirty: true });
    }
    this.layerId = null;
  }
}
