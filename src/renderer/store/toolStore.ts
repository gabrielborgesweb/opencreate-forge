import { create } from 'zustand';

export type ToolId = 'move' | 'select' | 'brush' | 'pencil' | 'eraser' | 'text' | 'transform';

export type SelectMode = 'replace' | 'unite' | 'subtract' | 'intersect';
export type SelectShape = 'rectangle' | 'ellipse' | 'lasso' | 'wand';

interface ToolState {
  activeToolId: ToolId;
  toolSettings: {
    select: { mode: SelectMode; shape: SelectShape };
    brush: { size: number; color: string; hardness: number };
    pencil: { size: number; color: string; shape: 'circle' | 'square' };
    eraser: { size: number; hardness: number; mode: 'brush' | 'pencil'; shape: 'circle' | 'square' };
    transform: {
      x: number;
      y: number;
      width: number;
      height: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
      anchor: { x: number; y: number };
      isDirty: boolean;
    };
  };
  
  // Actions
  setActiveTool: (id: ToolId) => void;
  updateToolSettings: (id: ToolId, settings: any) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeToolId: 'move',
  toolSettings: {
    select: { mode: 'replace', shape: 'rectangle' },
    brush: { size: 50, color: '#000000', hardness: 1.0 },
    pencil: { size: 1, color: '#000000', shape: 'square' },
    eraser: { size: 100, hardness: 1.0, mode: 'brush', shape: 'circle' },
    transform: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchor: { x: 0.5, y: 0.5 },
      isDirty: false,
    },
  },

  setActiveTool: (id) => set({ activeToolId: id }),

  updateToolSettings: (id, settings) => set((state) => ({
    toolSettings: {
      ...state.toolSettings,
      [id]: { ...state.toolSettings[id as keyof typeof state.toolSettings], ...settings }
    }
  })),
}));
