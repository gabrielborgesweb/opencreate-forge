import { BaseTool, ToolContext } from "./BaseTool";

export class MoveTool extends BaseTool {
  id = 'move';
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLayerX = 0;
  private initialLayerY = 0;
  private layerId: string | null = null;

  onMouseDown(e: MouseEvent, context: ToolContext): void {
    if (e.button !== 0) return;

    const activeLayerId = context.project.activeLayerId;
    if (!activeLayerId) return;

    const layer = context.project.layers.find(l => l.id === activeLayerId);
    if (!layer || layer.locked) return;

    this.isDragging = true;
    this.layerId = activeLayerId;
    
    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    this.startX = x;
    this.startY = y;
    this.initialLayerX = layer.x;
    this.initialLayerY = layer.y;
  }

  onMouseMove(e: MouseEvent, context: ToolContext): void {
    if (!this.isDragging || !this.layerId) return;

    const { x, y } = context.screenToProject(e.offsetX, e.offsetY);
    const dx = x - this.startX;
    const dy = y - this.startY;

    const layers = context.project.layers.map(l => {
      if (l.id === this.layerId) {
        return { ...l, x: this.initialLayerX + dx, y: this.initialLayerY + dy };
      }
      return l;
    });

    context.updateProject({ layers });
  }

  onMouseUp(e: MouseEvent, context: ToolContext): void {
    if (this.isDragging) {
      this.isDragging = false;
      context.updateProject({ isDirty: true });
    }
    this.layerId = null;
  }
}
