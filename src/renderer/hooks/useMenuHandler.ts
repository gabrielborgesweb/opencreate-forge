import { useEffect } from "react";
import { useProjectStore } from "@store/projectStore";
import { useUIStore } from "@store/uiStore";

export const useMenuHandler = () => {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projects = useProjectStore((state) => state.projects);
  const addProject = useProjectStore((state) => state.addProject);
  const updateProject = useProjectStore((state) => state.updateProject);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const showToast = useUIStore((state) => state.showToast);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (!(window as any).electronAPI) return;

    const handleAction = async (action: string) => {
      switch (action) {
        case "new-project":
          window.dispatchEvent(new CustomEvent("forge:new-project"));
          break;

        case "open-project":
          try {
            const result = await (window as any).electronAPI.openProject();
            if (result && result.success) {
              const projectData = JSON.parse(result.content);
              // Ensure it has the new fields and is not dirty
              projectData.filePath = result.filePath;
              projectData.isDirty = false;
              addProject(projectData);
              setActiveTab(projectData.id);
              showToast("Project opened successfully", "info");
            }
          } catch (err: any) {
            showToast(`Failed to open project: ${err.message}`, "error");
          }
          break;

        case "save-project":
          if (!activeProject) return;
          if (activeProject.filePath) {
            try {
              const appVersion = await (window as any).electronAPI.getAppVersion();
              const projectWithVersion = { ...activeProject, version: appVersion };
              const jsonString = JSON.stringify(projectWithVersion);

              const result = await (window as any).electronAPI.saveProject({
                jsonString,
                filePath: activeProject.filePath,
              });
              if (result.success) {
                updateProject(activeProject.id, { isDirty: false, version: appVersion });
                showToast("Project saved", "info");
              }
            } catch (err: any) {
              showToast(`Failed to save project: ${err.message}`, "error");
            }
          } else {
            handleAction("save-project-as");
          }
          break;

        case "save-project-as":
          if (!activeProject) return;
          try {
            const appVersion = await (window as any).electronAPI.getAppVersion();
            const projectWithVersion = { ...activeProject, version: appVersion };
            const jsonString = JSON.stringify(projectWithVersion);

            const result = await (window as any).electronAPI.saveProjectAs({
              jsonString,
              defaultName: `${activeProject.name}.ocfd`,
            });
            if (result.success) {
              updateProject(activeProject.id, {
                isDirty: false,
                filePath: result.filePath,
                name: result.name,
                version: appVersion,
              });
              showToast("Project saved", "info");
            }
          } catch (err: any) {
            showToast(`Failed to save project: ${err.message}`, "error");
          }
          break;

        case "export-png":
          if (!activeProject) return;
          window.dispatchEvent(new CustomEvent("forge:export-png"));
          break;

        case "undo":
          if (activeProjectId) undo(activeProjectId);
          break;

        case "redo":
          if (activeProjectId) redo(activeProjectId);
          break;
      }
    };

    const cleanup = (window as any).electronAPI.onMenuAction(handleAction);
    return () => {
      if (cleanup) cleanup();
    };
  }, [
    activeProjectId,
    activeProject,
    addProject,
    updateProject,
    undo,
    redo,
    setActiveTab,
    showToast,
  ]);
};
