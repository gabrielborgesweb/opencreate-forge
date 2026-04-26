/**
 * Purpose: Core state management for projects, layers, selection, and history (undo/redo), including serialization and project initialization logic.
 */
import { create } from "zustand";

/**
 * Represents a formatted segment of text with specific styling.
 */
export interface TextSpan {
  /** The text content of the span. */
  text: string;
  /** CSS color value. */
  color?: string;
  /** Font size in pixels. */
  fontSize?: number;
  /** Font family name. */
  fontFamily?: string;
  /** Font weight (e.g., 'bold', 400). */
  fontWeight?: string | number;
}

/**
 * Represents a layer in the project. Layers can be raster images, text, or groups.
 */
export interface Layer {
  /** Unique identifier for the layer. */
  id: string;
  /** Display name of the layer. */
  name: string;
  /** The type of layer content. */
  type: "raster" | "text" | "group";
  /** Whether the layer is currently visible. */
  visible: boolean;
  /** Whether the layer is locked for editing. */
  locked: boolean;
  /** Layer opacity from 0 to 100. */
  opacity: number;
  /** X coordinate in project space. */
  x: number;
  /** Y coordinate in project space. */
  y: number;
  /** Width of the layer in pixels. */
  width: number;
  /** Height of the layer in pixels. */
  height: number;
  /** Base64 encoded image data for raster layers. */
  data?: string; 
  /** Raw text content for text layers. */
  text?: string;
  /** Styled text spans for rich text support. */
  textSpans?: TextSpan[];
  /** Whether the text is point-based or area-based. */
  textType?: "point" | "area";
  /** Default font size for the layer. */
  fontSize?: number;
  /** Default font family for the layer. */
  fontFamily?: string;
  /** Default font weight for the layer. */
  fontWeight?: string | number;
  /** Default text color. */
  color?: string;
  /** Horizontal alignment of text. */
  textAlign?: "left" | "center" | "right" | "justify";
  /** Line height factor. */
  lineHeight?: number;
  /** Letter spacing in pixels. */
  tracking?: number;
  /** Whether the text overflows its bounds. */
  textOverflow?: boolean;
  /** Rendering quality for text. */
  textRendering?: "nearest" | "bilinear";
  /** Canvas composite operation for blending. */
  blendMode: GlobalCompositeOperation;
  /** Rotation in degrees. */
  rotation?: number;
  /** Internal undo stack for text editing. */
  textUndoStack?: { text: string; textSpans?: TextSpan[] }[];
  /** Internal redo stack for text editing. */
  textRedoStack?: { text: string; textSpans?: TextSpan[] }[];
}

/**
 * Represents the current selection state in the project.
 */
export interface Selection {
  /** Whether a selection is currently active. */
  hasSelection: boolean;
  /** The rectangular bounds of the selection in project space. */
  bounds: { x: number; y: number; width: number; height: number } | null;
  /** DataURL of the selection mask. */
  mask?: string;
  /** A temporary layer used for floating selections during transformation. */
  floatingLayer?: Layer | null;
}

/**
 * A snapshot of the project state for history management.
 */
export interface HistoryState {
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string | null;
  selection: Selection;
}

/**
 * An entry in the history stack.
 */
export interface HistoryEntry {
  /** Description of the action for the UI. */
  description: string;
  /** The project state at that point in time. */
  state: HistoryState;
}

/**
 * Represents a complete project document.
 */
export interface Project {
  /** Unique project identifier. */
  id: string;
  /** Project name. */
  name: string;
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** List of layers in the project. */
  layers: Layer[];
  /** ID of the currently selected layer. */
  activeLayerId: string | null;
  /** Current selection state. */
  selection: Selection;
  /** Current viewport zoom level. */
  zoom: number;
  /** Viewport pan X offset. */
  panX: number;
  /** Viewport pan Y offset. */
  panY: number;
  /** Whether the project has unsaved changes. */
  isDirty: boolean;
  /** File system path if the project has been saved. */
  filePath?: string;
  /** Version of the document format. */
  version?: string;
  /** Creation timestamp. */
  createdAt?: string;
  /** Last update timestamp. */
  updatedAt?: string;
  /** Stack of states for undo. */
  undoStack: HistoryEntry[];
  /** Stack of states for redo. */
  redoStack: HistoryEntry[];
}

/**
 * Zustand store state for managing multiple projects and their lifecycle.
 */
interface ProjectState {
  /** List of currently open projects. */
  projects: Project[];
  /** ID of the project currently being edited. */
  activeProjectId: string | null;
  /** The application version. */
  appVersion: string;

  /** Initializes the store, fetching the app version from Electron. */
  initialize: () => Promise<void>;
  /** Adds a new project to the store. */
  addProject: (project: Project) => void;
  /** Removes a project from the store. */
  removeProject: (id: string) => void;
  /** Sets the active project. */
  setActiveProject: (id: string | null) => void;
  /** Updates project-level properties. */
  updateProject: (id: string, updates: Partial<Project>) => void;
  /** Adds a new layer to a specific project. */
  addLayer: (projectId: string, layer: Partial<Layer>, skipHistory?: boolean) => void;
  /** Removes a layer from a specific project. */
  removeLayer: (projectId: string, layerId: string, skipHistory?: boolean) => void;
  /** Adds a manual entry to the project's history stack. */
  addHistoryEntry: (projectId: string, entry: HistoryEntry) => void;
  /** Moves a layer from one index to another in the stack. */
  moveLayer: (projectId: string, fromIndex: number, toIndex: number) => void;
  /** Duplicates an existing layer. */
  duplicateLayer: (projectId: string, layerId: string) => void;
  /** Updates properties of a specific layer. */
  updateLayer: (
    projectId: string,
    layerId: string,
    updates: Partial<Layer>,
    skipDirty?: boolean,
  ) => void;
  /** Renames a layer. */
  renameLayer: (projectId: string, layerId: string, name: string) => void;
  /** Toggles layer visibility. */
  toggleLayerVisibility: (projectId: string, layerId: string) => void;
  /** Toggles layer lock status. */
  toggleLayerLock: (projectId: string, layerId: string) => void;
  /** Sets the active layer for a project. */
  setActiveLayer: (projectId: string, layerId: string | null) => void;
  /** Reverts the last text change in a text layer. */
  undoText: (projectId: string, layerId: string) => void;
  /** Re-applies the last reverted text change in a text layer. */
  redoText: (projectId: string, layerId: string) => void;
  /** Jumps to a specific point in the project's history stack. */
  jumpToHistory: (projectId: string, index: number) => void;
  /** Pushes the current project state to the undo stack. */
  pushHistory: (projectId: string, description: string) => void;
  /** Reverts to the previous project state. */
  undo: (projectId: string) => void;
  /** Advances to the next project state in the redo stack. */
  redo: (projectId: string) => void;
}

const MAX_HISTORY = 50;

export const createHistoryState = (project: Project): HistoryState => ({
  width: project.width,
  height: project.height,
  layers: JSON.parse(JSON.stringify(project.layers)),
  activeLayerId: project.activeLayerId,
  selection: JSON.parse(JSON.stringify(project.selection)),
});

/**
 * Prepares a project for serialization (saving to disk).
 * Includes history stacks but may limit them to avoid excessively large files.
 */
export const getSerializableProject = (project: Project): any => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isDirty, filePath, undoStack, redoStack, ...rest } = project;

  // We keep the history but limit it to avoid massive files due to Base64 data duplication.
  // 20 steps is usually a good compromise for persisted history.
  const persistedUndoStack = undoStack.slice(-20);

  return {
    ...rest,
    undoStack: persistedUndoStack,
    redoStack: [], // Redo stack is typically not persisted across sessions
    updatedAt: new Date().toISOString(),
  };
};

export const useProjectStore = create<ProjectState>((set, _get) => ({
  projects: [],
  activeProjectId: null,
  appVersion: "0.0.0",

  initialize: async () => {
    if ((window as any).electronAPI) {
      const version = await (window as any).electronAPI.getAppVersion();
      set({ appVersion: version });
    }
  },

  addProject: (project) =>
    set((state) => {
      const existingProject = state.projects.find(
        (p) => p.id === project.id || (p.filePath && p.filePath === project.filePath),
      );

      if (existingProject) {
        return { activeProjectId: existingProject.id };
      }

      const initialState = createHistoryState(project);
      const description = project.undoStack?.[0]?.description || "Initial State";
      const now = new Date().toISOString();
      return {
        projects: [
          ...state.projects,
          {
            ...project,
            version: project.version || state.appVersion,
            createdAt: project.createdAt || now,
            updatedAt: project.updatedAt || now,
            undoStack: project.undoStack?.length
              ? project.undoStack
              : [{ description, state: initialState }],
            redoStack: project.redoStack || [],
          },
        ],
        activeProjectId: project.id,
      };
    }),

  removeProject: (id) =>
    set((state) => {
      const newProjects = state.projects.filter((p) => p.id !== id);
      let newActiveId = state.activeProjectId;
      if (state.activeProjectId === id) {
        newActiveId = newProjects.length > 0 ? newProjects[newProjects.length - 1].id : null;
      }
      return { projects: newProjects, activeProjectId: newActiveId };
    }),

  setActiveProject: (id) => set({ activeProjectId: id }),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              ...updates,
              isDirty: updates.isDirty !== undefined ? updates.isDirty : p.isDirty,
            }
          : p,
      ),
    })),

  addLayer: (projectId, partialLayer, skipHistory = false) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      let newUndoStack = project.undoStack;

      if (!skipHistory) {
        const historyState = createHistoryState(project);

        let newDescrition = "Add Layer";
        switch (partialLayer.type) {
          case "text":
            newDescrition = "Text Tool";
            break;
        }

        newUndoStack = [...project.undoStack, { description: newDescrition, state: historyState }];
        if (newUndoStack.length > MAX_HISTORY) newUndoStack.shift();
      }

      const id = partialLayer.id || Math.random().toString(36).substr(2, 9);
      const newLayer: Layer = {
        id,
        name: partialLayer.name || `Layer ${project.layers.length + 1}`,
        type: partialLayer.type || "raster",
        visible: partialLayer.visible ?? true,
        locked: partialLayer.locked ?? false,
        opacity: partialLayer.opacity ?? 100,
        x: partialLayer.x ?? 0,
        y: partialLayer.y ?? 0,
        width: partialLayer.width ?? project.width,
        height: partialLayer.height ?? project.height,
        blendMode: partialLayer.blendMode || "source-over",
        ...partialLayer,
      };

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                layers: [...p.layers, newLayer],
                activeLayerId: id,
                isDirty: true,
                undoStack: newUndoStack,
                redoStack: !skipHistory ? [] : p.redoStack,
              }
            : p,
        ),
      };
    }),

  removeLayer: (projectId, layerId, skipHistory = false) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project || project.layers.length <= 1) return state;

      let newUndoStack = project.undoStack;

      if (!skipHistory) {
        const historyState = createHistoryState(project);
        newUndoStack = [...project.undoStack, { description: "Remove Layer", state: historyState }];
        if (newUndoStack.length > MAX_HISTORY) newUndoStack.shift();
      }

      const newLayers = project.layers.filter((l) => l.id !== layerId);
      let newActiveLayerId = project.activeLayerId;
      if (project.activeLayerId === layerId) {
        const index = project.layers.findIndex((l) => l.id === layerId);
        newActiveLayerId = newLayers[Math.max(0, index - 1)]?.id || null;
      }

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                layers: newLayers,
                activeLayerId: newActiveLayerId,
                isDirty: true,
                undoStack: newUndoStack,
                redoStack: !skipHistory ? [] : p.redoStack,
              }
            : p,
        ),
      };
    }),

  addHistoryEntry: (projectId, entry) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      const newUndoStack = [...project.undoStack, entry];
      if (newUndoStack.length > MAX_HISTORY) {
        newUndoStack.shift();
      }

      return {
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, undoStack: newUndoStack, redoStack: [] } : p,
        ),
      };
    }),

  duplicateLayer: (projectId: string, layerId: string) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer) return state;

      // Push to history
      const historyState = createHistoryState(project);
      const newUndoStack = [
        ...project.undoStack,
        { description: "Duplicate Layer", state: historyState },
      ];
      if (newUndoStack.length > MAX_HISTORY) newUndoStack.shift();

      const newId = Math.random().toString(36).substr(2, 9);
      const newLayer = {
        ...JSON.parse(JSON.stringify(layer)),
        id: newId,
        name: `${layer.name} copy`,
      };
      const index = project.layers.findIndex((l) => l.id === layerId);

      const newLayers = [...project.layers];
      newLayers.splice(index + 1, 0, newLayer);

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                layers: newLayers,
                activeLayerId: newId,
                isDirty: true,
                undoStack: newUndoStack,
                redoStack: [],
              }
            : p,
        ),
      };
    }),

  moveLayer: (projectId, fromIndex, toIndex) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      // Push to history
      const historyState = createHistoryState(project);
      const newUndoStack = [
        ...project.undoStack,
        { description: "Move Layer", state: historyState },
      ];
      if (newUndoStack.length > MAX_HISTORY) newUndoStack.shift();

      const newLayers = [...project.layers];
      const [movedLayer] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, movedLayer);

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? { ...p, layers: newLayers, isDirty: true, undoStack: newUndoStack, redoStack: [] }
            : p,
        ),
      };
    }),

  updateLayer: (projectId, layerId, updates, skipDirty = false) =>
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;

        const layer = p.layers.find((l) => l.id === layerId);
        if (!layer) return p;

        // Check if there's an actual change to avoid unnecessary dirtying
        const hasActualChange = Object.entries(updates).some(([key, value]) => {
          return (layer as any)[key] !== value;
        });

        if (!hasActualChange) return p;

        return {
          ...p,
          isDirty: skipDirty ? p.isDirty : true,
          layers: p.layers.map((l) => (l.id === layerId ? { ...l, ...updates } : l)),
        };
      }),
    })),

  renameLayer: (projectId, layerId, name) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      const historyState = createHistoryState(project);
      const newUndoStack = [
        ...project.undoStack,
        { description: "Rename Layer", state: historyState },
      ];
      if (newUndoStack.length > MAX_HISTORY) newUndoStack.shift();

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                layers: p.layers.map((l) => (l.id === layerId ? { ...l, name } : l)),
                undoStack: newUndoStack,
                redoStack: [],
                isDirty: true,
              }
            : p,
        ),
      };
    }),

  toggleLayerVisibility: (projectId, layerId) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      const historyState = createHistoryState(project);
      const newUndoStack = [
        ...project.undoStack,
        { description: "Visibility Change", state: historyState },
      ];
      if (newUndoStack.length > MAX_HISTORY) newUndoStack.shift();

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                layers: p.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
                undoStack: newUndoStack,
                redoStack: [],
                isDirty: true,
              }
            : p,
        ),
      };
    }),

  toggleLayerLock: (projectId, layerId) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      const historyState = createHistoryState(project);
      const newUndoStack = [
        ...project.undoStack,
        { description: "Lock Change", state: historyState },
      ];
      if (newUndoStack.length > MAX_HISTORY) newUndoStack.shift();

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                layers: p.layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l)),
                undoStack: newUndoStack,
                redoStack: [],
                isDirty: true,
              }
            : p,
        ),
      };
    }),

  undoText: (projectId, layerId) =>
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const layer = p.layers.find((l) => l.id === layerId);
        if (!layer || !layer.textUndoStack || layer.textUndoStack.length === 0) return p;

        const undoStack = [...(layer.textUndoStack || [])];
        const lastEntry = undoStack.pop()!;
        const redoStack = [
          ...(layer.textRedoStack || []),
          { text: layer.text || "", textSpans: layer.textSpans },
        ];

        return {
          ...p,
          layers: p.layers.map((l) =>
            l.id === layerId
              ? { ...l, ...lastEntry, textUndoStack: undoStack, textRedoStack: redoStack }
              : l,
          ),
          isDirty: true,
        };
      }),
    })),

  redoText: (projectId, layerId) =>
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const layer = p.layers.find((l) => l.id === layerId);
        if (!layer || !layer.textRedoStack || layer.textRedoStack.length === 0) return p;

        const redoStack = [...(layer.textRedoStack || [])];
        const nextEntry = redoStack.pop()!;
        const undoStack = [
          ...(layer.textUndoStack || []),
          { text: layer.text || "", textSpans: layer.textSpans },
        ];

        return {
          ...p,
          layers: p.layers.map((l) =>
            l.id === layerId
              ? { ...l, ...nextEntry, textUndoStack: undoStack, textRedoStack: redoStack }
              : l,
          ),
          isDirty: true,
        };
      }),
    })),

  setActiveLayer: (projectId, layerId) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, activeLayerId: layerId } : p,
      ),
    })),

  pushHistory: (projectId, description) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      const historyState = createHistoryState(project);

      const newEntry: HistoryEntry = {
        description,
        state: historyState,
      };

      const newUndoStack = [...project.undoStack, newEntry];
      if (newUndoStack.length > MAX_HISTORY) {
        newUndoStack.shift();
      }

      return {
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, undoStack: newUndoStack, redoStack: [] } : p,
        ),
      };
    }),

  undo: (projectId) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      // Impede undo se tiver apenas o estado inicial
      if (!project || project.undoStack.length <= 1) return state;

      const newUndoStack = [...project.undoStack];
      const lastEntry = newUndoStack.pop()!;

      // Save current state to redo stack
      const currentHistoryState = createHistoryState(project);

      const redoEntry: HistoryEntry = {
        description: lastEntry.description,
        state: currentHistoryState,
      };

      const newRedoStack = [...project.redoStack, redoEntry];

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                ...lastEntry.state,
                undoStack: newUndoStack,
                redoStack: newRedoStack,
                isDirty: true,
              }
            : p,
        ),
      };
    }),

  redo: (projectId) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project || project.redoStack.length === 0) return state;

      const newRedoStack = [...project.redoStack];
      const nextEntry = newRedoStack.pop()!;

      // Save current state to undo stack
      const currentHistoryState = createHistoryState(project);

      const undoEntry: HistoryEntry = {
        description: nextEntry.description,
        state: currentHistoryState,
      };

      const newUndoStack = [...project.undoStack, undoEntry];

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                ...nextEntry.state,
                undoStack: newUndoStack,
                redoStack: newRedoStack,
                isDirty: true,
              }
            : p,
        ),
      };
    }),

  jumpToHistory: (projectId, index) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;

      const historyLength = project.undoStack.length + project.redoStack.length;
      if (index < 0 || index >= historyLength) return state;

      // Usamos arrays mutáveis internamente para o loop
      const currentUndoStack = [...project.undoStack];
      const currentRedoStack = [...project.redoStack];

      // Capturamos o estado vivo atual UMA vez antes do loop
      let currentHistoryState = createHistoryState(project);

      // O índice atual do usuário é sempre baseado no tamanho do undoStack
      const currentIndex = currentUndoStack.length - 1;

      if (index === currentIndex) return state;

      if (index < currentIndex) {
        // Voltando no tempo (Simula chamadas de Undo)
        const steps = currentIndex - index;
        for (let i = 0; i < steps; i++) {
          const lastEntry = currentUndoStack.pop()!;
          currentRedoStack.push({
            description: lastEntry.description,
            state: currentHistoryState,
          });
          currentHistoryState = lastEntry.state;
        }
      } else {
        // Avançando no tempo (Simula chamadas de Redo)
        const steps = index - currentIndex;
        for (let i = 0; i < steps; i++) {
          const nextEntry = currentRedoStack.pop()!;
          currentUndoStack.push({
            description: nextEntry.description,
            state: currentHistoryState,
          });
          currentHistoryState = nextEntry.state;
        }
      }

      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                ...currentHistoryState,
                undoStack: currentUndoStack,
                redoStack: currentRedoStack,
                isDirty: true,
              }
            : p,
        ),
      };
    }),
}));
