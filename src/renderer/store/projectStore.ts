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
  data?: ImageData; // For raster
  text?: string;    // For text
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  blendMode: GlobalCompositeOperation;
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  
  // Actions
  addProject: (project: Project) => void;
  setActiveProject: (id: string) => void;
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

  setActiveProject: (id) => set({ activeProjectId: id }),

  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map((p) => p.id === id ? { ...p, ...updates } : p)
  })),

  addLayer: (projectId, layer) => set((state) => ({
    projects: state.projects.map((p) => 
      p.id === projectId ? { ...p, layers: [...p.layers, layer], activeLayerId: layer.id } : p
    )
  })),

  updateLayer: (projectId, layerId, updates) => set((state) => ({
    projects: state.projects.map((p) => 
      p.id === projectId ? {
        ...p,
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
