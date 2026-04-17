import { create } from 'zustand';

export interface Layer {
  id: string;
  name: string;
  type: 'raster' | 'text' | 'group';
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: string; // dataURL (Base64)
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  blendMode: GlobalCompositeOperation;
}

export interface Selection {
  hasSelection: boolean;
  bounds: { x: number; y: number; width: number; height: number } | null;
  mask?: string; // dataURL of the mask
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
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  addLayer: (projectId: string, layer: Partial<Layer>) => void;
  removeLayer: (projectId: string, layerId: string) => void;
  duplicateLayer: (projectId: string, layerId: string) => void;
  moveLayer: (projectId: string, fromIndex: number, toIndex: number) => void;
  updateLayer: (projectId: string, layerId: string, updates: Partial<Layer>) => void;
  setActiveLayer: (projectId: string, layerId: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProjectId: null,

  addProject: (project) => set((state) => ({
    projects: [...state.projects, project],
    activeProjectId: project.id
  })),

  removeProject: (id) => set((state) => {
    const newProjects = state.projects.filter(p => p.id !== id);
    let newActiveId = state.activeProjectId;
    if (state.activeProjectId === id) {
      newActiveId = newProjects.length > 0 ? newProjects[newProjects.length - 1].id : null;
    }
    return { projects: newProjects, activeProjectId: newActiveId };
  }),

  setActiveProject: (id) => set({ activeProjectId: id }),

  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map((p) => p.id === id ? { ...p, ...updates, isDirty: updates.isDirty !== undefined ? updates.isDirty : true } : p)
  })),

  addLayer: (projectId, partialLayer) => set((state) => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return state;

    const id = partialLayer.id || Math.random().toString(36).substr(2, 9);
    const newLayer: Layer = {
      id,
      name: partialLayer.name || `Layer ${project.layers.length + 1}`,
      type: partialLayer.type || 'raster',
      visible: partialLayer.visible ?? true,
      locked: partialLayer.locked ?? false,
      opacity: partialLayer.opacity ?? 100,
      x: partialLayer.x ?? 0,
      y: partialLayer.y ?? 0,
      width: partialLayer.width ?? project.width,
      height: partialLayer.height ?? project.height,
      blendMode: partialLayer.blendMode || 'source-over',
      ...partialLayer
    };

    return {
      projects: state.projects.map((p) => 
        p.id === projectId ? { ...p, layers: [...p.layers, newLayer], activeLayerId: id, isDirty: true } : p
      )
    };
  }),

  removeLayer: (projectId, layerId) => set((state) => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || project.layers.length <= 1) return state; // Prevent deleting last layer for now

    const newLayers = project.layers.filter(l => l.id !== layerId);
    let newActiveLayerId = project.activeLayerId;
    if (project.activeLayerId === layerId) {
      const index = project.layers.findIndex(l => l.id === layerId);
      newActiveLayerId = newLayers[Math.max(0, index - 1)]?.id || null;
    }

    return {
      projects: state.projects.map((p) => 
        p.id === projectId ? { ...p, layers: newLayers, activeLayerId: newActiveLayerId, isDirty: true } : p
      )
    };
  }),

  duplicateLayer: (projectId, layerId) => set((state) => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return state;

    const layer = project.layers.find(l => l.id === layerId);
    if (!layer) return state;

    const newId = Math.random().toString(36).substr(2, 9);
    const newLayer = { ...layer, id: newId, name: `${layer.name} copy` };
    const index = project.layers.findIndex(l => l.id === layerId);
    
    const newLayers = [...project.layers];
    newLayers.splice(index + 1, 0, newLayer);

    return {
      projects: state.projects.map((p) => 
        p.id === projectId ? { ...p, layers: newLayers, activeLayerId: newId, isDirty: true } : p
      )
    };
  }),

  moveLayer: (projectId, fromIndex, toIndex) => set((state) => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return state;

    const newLayers = [...project.layers];
    const [movedLayer] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, movedLayer);

    return {
      projects: state.projects.map((p) => 
        p.id === projectId ? { ...p, layers: newLayers, isDirty: true } : p
      )
    };
  }),

  updateLayer: (projectId, layerId, updates) => set((state) => ({
    projects: state.projects.map((p) => 
      p.id === projectId ? {
        ...p,
        isDirty: true,
        layers: p.layers.map((l) => l.id === layerId ? { ...l, ...updates } : l)
      } : p
    )
  })),

  setActiveLayer: (projectId, layerId) => set((state) => ({
    projects: state.projects.map((p) => 
      p.id === projectId ? { ...p, activeLayerId: layerId } : p
    )
  })),
}));
