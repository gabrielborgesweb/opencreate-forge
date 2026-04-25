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
  const addLayer = useProjectStore((state) => state.addLayer);
  const duplicateLayer = useProjectStore((state) => state.duplicateLayer);
  const removeLayer = useProjectStore((state) => state.removeLayer);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const showToast = useUIStore((state) => state.showToast);
  const showRulers = useUIStore((state) => state.showRulers);
  const setShowRulers = useUIStore((state) => state.setShowRulers);

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

        case "add-layer":
          if (activeProjectId) {
            addLayer(activeProjectId, { type: "raster" });
          }
          break;

        case "duplicate-layer":
          window.dispatchEvent(new CustomEvent("forge:duplicate-layer"));
          break;

        case "remove-layer":
          if (activeProjectId && activeProject?.activeLayerId) {
            // Safety: Don't delete layer if typing in an input or textarea
            if (
              document.activeElement?.tagName === "INPUT" ||
              document.activeElement?.tagName === "TEXTAREA" ||
              (document.activeElement as HTMLElement)?.isContentEditable
            ) {
              return;
            }
            removeLayer(activeProjectId, activeProject.activeLayerId);
          }
          break;

        case "close-project":
          window.dispatchEvent(new CustomEvent("forge:close-project"));
          break;

        case "toggle-rulers":
          setShowRulers(!showRulers);
          break;

        case "deselect":
          window.dispatchEvent(new CustomEvent("forge:select-clear"));
          break;

        case "select-all":
          window.dispatchEvent(new CustomEvent("forge:select-all"));
          break;

        case "zoom-in": {
          window.dispatchEvent(new CustomEvent("forge:zoom-to", { detail: { step: 1 } }));
          break;
        }

        case "zoom-out": {
          window.dispatchEvent(new CustomEvent("forge:zoom-to", { detail: { step: -1 } }));
          break;
        }

        case "zoom-100":
          if (activeProject) {
            window.dispatchEvent(new CustomEvent("forge:zoom-to", { detail: { zoom: 1 } }));
          }
          break;

        case "zoom-fit":
          window.dispatchEvent(
            new CustomEvent("forge:zoom-to", { detail: { zoom: -1 /* Trigger fit */ } }),
          );
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
    addLayer,
    duplicateLayer,
    removeLayer,
    setActiveTab,
    showToast,
    showRulers,
    setShowRulers,
  ]);
};
