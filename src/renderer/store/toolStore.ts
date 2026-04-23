import { create } from "zustand";

export type ToolId =
  | "move"
  | "select"
  | "brush"
  | "pencil"
  | "eraser"
  | "text"
  | "transform"
  | "crop";

export type SelectMode = "replace" | "unite" | "subtract" | "intersect";
export type SelectShape = "rectangle" | "ellipse" | "lasso" | "wand";
export type CropMode = "Free" | "Original Ratio" | "Fixed Ratio";

export interface ToolSettings {
  select: { mode: SelectMode; shape: SelectShape };
  brush: { size: number; color: string; hardness: number };
  pencil: { size: number; color: string; shape: "circle" | "square" };
  eraser: { size: number; hardness: number; mode: "brush" | "pencil"; shape: "circle" | "square" };
  text: {
    fontFamily: string;
    fontSize: number;
    fontWeight: string | number;
    color: string;
    textAlign: "left" | "center" | "right" | "justify";
    lineHeight: number;
    tracking: number;
    textOverflow: boolean;
    textRendering: "nearest" | "bilinear";
    isEditing: boolean;
  };
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
}

interface ToolState {
  activeToolId: ToolId;
  previousToolId: ToolId;
  isInteracting: boolean;
  toolSettings: ToolSettings;
  foregroundColor: string;
  backgroundColor: string;

  // Actions
  setActiveTool: (id: ToolId) => void;
  setInteracting: (isInteracting: boolean) => void;
  updateToolSettings: (id: ToolId, settings: any) => void;
  setForegroundColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  swapColors: () => void;
  resetColors: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeToolId: "move",
  previousToolId: "move",
  isInteracting: false,
  foregroundColor: "#000000",
  backgroundColor: "#ffffff",
  toolSettings: {
    select: { mode: "replace", shape: "rectangle" },
    brush: { size: 50, color: "#000000", hardness: 1.0 },
    pencil: { size: 1, color: "#000000", shape: "square" },
    eraser: { size: 100, hardness: 1.0, mode: "brush", shape: "circle" },
    text: {
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "normal",
      color: "#000000",
      textAlign: "left",
      lineHeight: 1.2,
      tracking: 0,
      textOverflow: true,
      textRendering: "bilinear",
      isEditing: false,
    },
    crop: {
      mode: "Free",
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

  setActiveTool: (id) =>
    set((state) => {
      if (id === state.activeToolId) return state;

      // Don't save 'transform' or 'crop' as the previous tool
      const newPreviousToolId =
        state.activeToolId === "transform" || state.activeToolId === "crop"
          ? state.previousToolId
          : state.activeToolId;

      return {
        activeToolId: id,
        previousToolId: newPreviousToolId,
      };
    }),

  setInteracting: (isInteracting) =>
    set((state) => (state.isInteracting === isInteracting ? state : { isInteracting })),

  updateToolSettings: (id, settings) =>
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        [id]: { ...state.toolSettings[id as keyof typeof state.toolSettings], ...settings },
      },
    })),

  setForegroundColor: (color) => set({ foregroundColor: color }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  swapColors: () =>
    set((state) => ({
      foregroundColor: state.backgroundColor,
      backgroundColor: state.foregroundColor,
    })),
  resetColors: () =>
    set({
      foregroundColor: "#000000",
      backgroundColor: "#ffffff",
    }),
}));
