import { create } from "zustand";

export interface TextSpan {
  text: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
}

export interface Layer {
  id: string;
  name: string;
  type: "raster" | "text" | "group";
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: string; // dataURL (Base64)
  // Text properties
  text?: string;
  textSpans?: TextSpan[];
  textType?: "point" | "area";
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  color?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number; // leading
  tracking?: number; // letter spacing
  textOverflow?: boolean;
  textRendering?: "nearest" | "bilinear";
  blendMode: GlobalCompositeOperation;
  // History for text
  textUndoStack?: { text: string; textSpans?: TextSpan[] }[];
  textRedoStack?: { text: string; textSpans?: TextSpan[] }[];
}

export interface Selection {
  hasSelection: boolean;
  bounds: { x: number; y: number; width: number; height: number } | null;
  mask?: string; // dataURL of the mask
  floatingLayer?: Layer | null;
}

export interface HistoryState {
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string | null;
  selection: Selection;
}

export interface HistoryEntry {
  description: string;
  state: HistoryState;
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string | null;
  selection: Selection;
  // Viewport isolada por projeto
  zoom: number;
  panX: number;
  panY: number;
  isDirty: boolean; // Para saber se houve mudanças não salvas
  // History
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;

  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  addLayer: (projectId: string, layer: Partial<Layer>, skipHistory?: boolean) => void;
  removeLayer: (projectId: string, layerId: string, skipHistory?: boolean) => void;
  addHistoryEntry: (projectId: string, entry: HistoryEntry) => void;
  moveLayer: (projectId: string, fromIndex: number, toIndex: number) => void;
  duplicateLayer: (projectId: string, layerId: string) => void;
  updateLayer: (projectId: string, layerId: string, updates: Partial<Layer>) => void;
  renameLayer: (projectId: string, layerId: string, name: string) => void;
  toggleLayerVisibility: (projectId: string, layerId: string) => void;
  toggleLayerLock: (projectId: string, layerId: string) => void;
  setActiveLayer: (projectId: string, layerId: string | null) => void;
  undoText: (projectId: string, layerId: string) => void;
  redoText: (projectId: string, layerId: string) => void;
  jumpToHistory: (projectId: string, index: number) => void;
  // History actions
  pushHistory: (projectId: string, description: string) => void;
  undo: (projectId: string) => void;
  redo: (projectId: string) => void;
}

const MAX_HISTORY = 50;

const createHistoryState = (project: Project): HistoryState => ({
  width: project.width,
  height: project.height,
  layers: JSON.parse(JSON.stringify(project.layers)),
  activeLayerId: project.activeLayerId,
  selection: JSON.parse(JSON.stringify(project.selection)),
});

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProjectId: null,

  addProject: (project) =>
    set((state) => {
      const initialState = createHistoryState(project);
      const description = project.undoStack[0]?.description || "Initial State";
      return {
        projects: [
          ...state.projects,
          {
            ...project,
            undoStack: [{ description, state: initialState }],
            redoStack: [],
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

  updateLayer: (projectId, layerId, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              isDirty: true,
              layers: p.layers.map((l) => (l.id === layerId ? { ...l, ...updates } : l)),
            }
          : p,
      ),
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
