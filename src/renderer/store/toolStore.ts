import { create } from 'zustand';

export type ToolId = 'move' | 'select' | 'brush' | 'pencil' | 'eraser' | 'text' | 'transform' | 'crop';

export type SelectMode = 'replace' | 'unite' | 'subtract' | 'intersect';
export type SelectShape = 'rectangle' | 'ellipse' | 'lasso' | 'wand';
export type CropMode = 'Free' | 'Original Ratio' | 'Fixed Ratio';

interface ToolState {
  activeToolId: ToolId;
  isInteracting: boolean;
  toolSettings: {
    select: { mode: SelectMode; shape: SelectShape };
    brush: { size: number; color: string; hardness: number };
    pencil: { size: number; color: string; shape: 'circle' | 'square' };
    eraser: { size: number; hardness: number; mode: 'brush' | 'pencil'; shape: 'circle' | 'square' };
    crop: {
      mode: CropMode;
      ratioW: number;
      ratioH: number;
      deleteCropped: boolean;
      isDirty: boolean;
    };
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
  setInteracting: (isInteracting: boolean) => void;
  updateToolSettings: (id: ToolId, settings: any) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeToolId: 'move',
  isInteracting: false,
  toolSettings: {
    select: { mode: 'replace', shape: 'rectangle' },
    brush: { size: 50, color: '#000000', hardness: 1.0 },
    pencil: { size: 1, color: '#000000', shape: 'square' },
    eraser: { size: 100, hardness: 1.0, mode: 'brush', shape: 'circle' },
    crop: {
      mode: 'Free',
      ratioW: 1,
      ratioH: 1,
      deleteCropped: true,
      isDirty: false,
    },
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

  setInteracting: (isInteracting) => set({ isInteracting }),

  updateToolSettings: (id, settings) => set((state) => ({
    toolSettings: {
      ...state.toolSettings,
      [id]: { ...state.toolSettings[id as keyof typeof state.toolSettings], ...settings }
    }
  })),
}));
