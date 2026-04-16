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
  addLayer: (projectId: string, layer: Layer) => void;
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

  addLayer: (projectId, layer) => set((state) => ({
    projects: state.projects.map((p) => 
      p.id === projectId ? { ...p, layers: [...p.layers, layer], activeLayerId: layer.id, isDirty: true } : p
    )
  })),

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
