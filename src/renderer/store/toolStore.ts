import { create } from 'zustand';

export type ToolId = 'move' | 'select' | 'brush' | 'pencil' | 'eraser' | 'text';

interface ToolState {
  activeToolId: ToolId;
  toolSettings: {
    brush: { size: number; color: string; hardness: number };
    pencil: { size: number; color: string };
    eraser: { size: number; hardness: number };
  };
  
  // Actions
  setActiveTool: (id: ToolId) => void;
  updateToolSettings: (id: ToolId, settings: any) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeToolId: 'move',
  toolSettings: {
    brush: { size: 50, color: '#000000', hardness: 1.0 },
    pencil: { size: 1, color: '#000000' },
    eraser: { size: 100, hardness: 1.0 },
  },

  setActiveTool: (id) => set({ activeToolId: id }),

  updateToolSettings: (id, settings) => set((state) => ({
    toolSettings: {
      ...state.toolSettings,
      [id]: { ...state.toolSettings[id as keyof typeof state.toolSettings], ...settings }
    }
  })),
}));
