import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, Project } from "./projectStore";

describe("projectStore", () => {
  beforeEach(() => {
    // Limpar o store antes de cada teste se necessário
    const { projects } = useProjectStore.getState();
    projects.forEach(p => useProjectStore.getState().removeProject(p.id));
  });

  it("should add a new project", () => {
    const store = useProjectStore.getState();
    const newProject: Project = {
      id: "p1",
      name: "Test Project",
      width: 800,
      height: 600,
      layers: [],
      activeLayerId: null,
      selection: { hasSelection: false, bounds: null },
      zoom: 1,
      panX: 0,
      panY: 0,
      isDirty: false,
      undoStack: [],
      redoStack: []
    };

    store.addProject(newProject);
    
    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().activeProjectId).toBe("p1");
  });

  it("should add a layer to a project", () => {
    const store = useProjectStore.getState();
    const project: Project = {
      id: "p1",
      name: "Test",
      width: 100,
      height: 100,
      layers: [],
      activeLayerId: null,
      selection: { hasSelection: false, bounds: null },
      zoom: 1,
      panX: 0,
      panY: 0,
      isDirty: false,
      undoStack: [],
      redoStack: []
    };
    
    store.addProject(project);
    store.addLayer("p1", { name: "Layer 1", type: "raster" });

    const updatedProject = useProjectStore.getState().projects[0];
    expect(updatedProject.layers).toHaveLength(1);
    expect(updatedProject.layers[0].name).toBe("Layer 1");
    expect(updatedProject.activeLayerId).toBe(updatedProject.layers[0].id);
  });
});
