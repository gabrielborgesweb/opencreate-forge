import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, Project } from "@/renderer/store/projectStore";

describe("projectStore", () => {
  beforeEach(() => {
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
  });
});
