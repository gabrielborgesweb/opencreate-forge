import { Project } from "@/renderer/store/projectStore";

export interface ToolContext {
  project: Project;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  updateProject: (updates: Partial<Project>) => void;
  invalidateCache: (layerId: string) => void;
  setLayerCache: (layerId: string, canvas: HTMLCanvasElement) => void;
  getLayerCanvas: (layerId: string) => { canvas: HTMLCanvasElement; ready: boolean } | null;
  screenToProject: (x: number, y: number) => { x: number; y: number };
  getSelectionCanvas: () => { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  updateSelectionEdges: () => void;
  setLastSelectionMask: (mask: string | undefined) => void;
}

export abstract class BaseTool {
  abstract id: string;

  onMouseDown(_e: MouseEvent, _context: ToolContext): void {}
  onMouseMove(_e: MouseEvent, _context: ToolContext): void {}
  onMouseUp(_e: MouseEvent, _context: ToolContext): void {}

  onActivate(_context: ToolContext): void {}
  onDeactivate(_context: ToolContext): void {}

  getEditingLayerId(): string | null {
    return null;
  }

  // Opcional: Renderizar algo extra por cima (como o cursor do pincel)
  onRender(_ctx: CanvasRenderingContext2D, _context: ToolContext): void {}
}
