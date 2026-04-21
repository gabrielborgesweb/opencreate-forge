import { Project, Layer } from "@/renderer/store/projectStore";
import { ToolSettings, ToolId } from "@/renderer/store/toolStore";

export type { ToolId };

export interface ToolContext {
  project: Project;
  settings: ToolSettings;
  activeToolId: ToolId;
  previousToolId: ToolId;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  updateProject: (updates: Partial<Project>) => void;
  pushHistory: (description: string) => void;
  invalidateCache: (layerId: string) => void;
  setLayerCache: (layerId: string, canvas: HTMLCanvasElement) => void;
  getLayerCanvas: (layerId: string) => { canvas: HTMLCanvasElement; ready: boolean } | null;
  ensureLayerCanvas: (layer: Layer) => Promise<HTMLCanvasElement>;
  screenToProject: (x: number, y: number) => { x: number; y: number };
  getSelectionCanvas: () => {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  };
  updateSelectionEdges: () => void;
  setLastSelectionMask: (mask: string | undefined) => void;
  floatSelection: (layerId: string) => Promise<boolean>;
  commitFloatingLayer: () => Promise<void>;
  clearSelection: () => Promise<void>;
  setInteracting: (isInteracting: boolean) => void;
  setActiveTool: (id: ToolId) => void;
  updateToolSettings: <K extends keyof ToolSettings>(
    id: K,
    settings: Partial<ToolSettings[K]>,
  ) => void;
  subscribe: (listener: (settings: ToolSettings) => void) => () => void;
  animateFitToScreen: (overrideWidth?: number, overrideHeight?: number) => void;
}

export abstract class BaseTool {
  abstract id: ToolId;

  onMouseDown(_e: MouseEvent, _context: ToolContext): void {}
  onDoubleClick(_e: MouseEvent, _context: ToolContext): void {}
  onMouseMove(_e: MouseEvent, _context: ToolContext): void {}
  onMouseUp(_e: MouseEvent, _context: ToolContext): void {}

  onActivate(_context: ToolContext): void {}
  onDeactivate(_context: ToolContext): void {}

  onKeyDown(_e: KeyboardEvent, _context: ToolContext): boolean {
    return false; // Retorna true se o evento foi consumido
  }

  getEditingLayerId(): string | null {
    return null;
  }

  // Opcional: Renderizar algo extra por cima (como o cursor do pincel)
  onRender(_ctx: CanvasRenderingContext2D, _context: ToolContext): void {}
}
