import React from "react";
import { useUIStore } from "@store/uiStore";
import { useProjectStore } from "@store/projectStore";
import CanvasViewport from "./components/CanvasViewport";
import LayerList from "./components/Sidebar/LayerList";
import Toolbar from "./components/Toolbar";
import ToolOptions from "./components/ToolOptions";
import ProjectTabs from "./components/ProjectTabs";
import HomeScreen from "./components/HomeScreen";
import NewProjectModal from "./components/NewProjectModal";
import { useToolStore } from "@store/toolStore";
import Toast from "./components/ui/Toast";

function App() {
  const activeTab = useUIStore((state) => state.activeTab);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = React.useState(false);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const setActiveTool = useToolStore((state) => state.setActiveTool);
  const activeToolId = useToolStore((state) => state.activeToolId);
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);
  const transformSettings = useToolStore((state) => state.toolSettings.transform);
  const showToast = useUIStore((state) => state.showToast);
  const isInteracting = useToolStore((state) => state.isInteracting);

  const originalModeRef = React.useRef<any>(null);
  const pendingRestoreRef = React.useRef<boolean>(false);

  const activeProject = useProjectStore((state) =>
    state.projects.find((p) => p.id === activeProjectId),
  );

  // Restore mode when interaction ends
  React.useEffect(() => {
    if (!isInteracting && pendingRestoreRef.current && originalModeRef.current) {
      updateToolSettings("select", { mode: originalModeRef.current });
      originalModeRef.current = null;
      pendingRestoreRef.current = false;
    }
  }, [isInteracting, updateToolSettings]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle SelectTool modifiers for visual feedback
      if (activeToolId === "select") {
        if ((e.shiftKey || e.altKey) && !originalModeRef.current) {
          originalModeRef.current = toolSettings.select.mode;
        }

        if (!isInteracting) {
          if (e.shiftKey && e.altKey) {
            updateToolSettings("select", { mode: "intersect" });
          } else if (e.shiftKey) {
            updateToolSettings("select", { mode: "unite" });
          } else if (e.altKey) {
            updateToolSettings("select", { mode: "subtract" });
          }
        }
      }

      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsNewProjectModalOpen(true);
        return;
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "w") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("forge:close-project"));
        return;
      }

      // 1. Atalhos Globais (Independente de foco em input se for Cmd/Ctrl)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("forge:clear-selection"));
        return;
      }

      // Ignore if typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        if (e.key === "Enter") {
          if (activeToolId === "transform")
            window.dispatchEvent(new CustomEvent("forge:transform-apply"));
          if (activeToolId === "crop") window.dispatchEvent(new CustomEvent("forge:crop-apply"));
        } else if (e.key === "Escape") {
          if (activeToolId === "transform")
            window.dispatchEvent(new CustomEvent("forge:transform-cancel"));
          if (activeToolId === "crop") window.dispatchEvent(new CustomEvent("forge:crop-cancel"));
        }
        return;
      }

      const checkDirty = (nextToolId: string) => {
        if (
          activeToolId === "transform" &&
          transformSettings.isDirty &&
          nextToolId !== "transform"
        ) {
          // showToast(
          //   "Apply or cancel transform before switching tools",
          //   "warning",
          // );
          return false;
        }
        return true;
      };

      if (isCmdOrCtrl && e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (checkDirty("transform")) setActiveTool("transform");
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        // Prevent default browser cut if needed, although we handle it in ForgeEngine
        // e.preventDefault();
      } else if (e.key === "Enter") {
        if (activeToolId === "transform")
          window.dispatchEvent(new CustomEvent("forge:transform-apply"));
        if (activeToolId === "crop") window.dispatchEvent(new CustomEvent("forge:crop-apply"));
      } else if (e.key === "Escape") {
        if (activeToolId === "transform")
          window.dispatchEvent(new CustomEvent("forge:transform-cancel"));
        if (activeToolId === "crop") window.dispatchEvent(new CustomEvent("forge:crop-cancel"));
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // Tool shortcuts - only if no modifiers
        if (e.key.toLowerCase() === "v") {
          if (checkDirty("move")) setActiveTool("move");
        } else if (e.key.toLowerCase() === "b") {
          if (checkDirty("brush")) setActiveTool("brush");
        } else if (e.key.toLowerCase() === "e") {
          if (checkDirty("eraser")) setActiveTool("eraser");
        } else if (e.key.toLowerCase() === "p") {
          if (checkDirty("pencil")) setActiveTool("pencil");
        } else if (e.key.toLowerCase() === "m") {
          if (checkDirty("select")) setActiveTool("select");
        } else if (e.key.toLowerCase() === "c") {
          if (checkDirty("crop")) setActiveTool("crop");
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (activeToolId === "select" && originalModeRef.current) {
        if (!e.shiftKey && !e.altKey) {
          if (isInteracting) {
            pendingRestoreRef.current = true;
          } else {
            updateToolSettings("select", { mode: originalModeRef.current });
            originalModeRef.current = null;
            pendingRestoreRef.current = false;
          }
        } else if (!isInteracting) {
          if (e.shiftKey && !e.altKey) {
            updateToolSettings("select", { mode: "unite" });
          } else if (!e.shiftKey && e.altKey) {
            updateToolSettings("select", { mode: "subtract" });
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    setActiveTool,
    activeToolId,
    transformSettings.isDirty,
    showToast,
    toolSettings.select.mode,
    updateToolSettings,
    activeProjectId,
    isInteracting,
  ]);

  React.useEffect(() => {
    const handleNewProject = () => setIsNewProjectModalOpen(true);
    window.addEventListener("forge:new-project", handleNewProject);
    return () => window.removeEventListener("forge:new-project", handleNewProject);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text overflow-hidden relative">
      <Toast />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
      />

      {/* 1. Abas de Projeto */}
      <ProjectTabs />

      {/* 2. Cabeçalho Dinâmico (Opções da Ferramenta) */}
      {activeTab !== "home" && (
        <header className="bg-[#222] border-b border-bg-tertiary flex items-center">
          <ToolOptions />
        </header>
      )}

      {/* 3. Área Principal */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === "home" ? (
          <HomeScreen />
        ) : (
          <>
            <aside className="bg-[#222] border-r border-bg-tertiary">
              <Toolbar />
            </aside>

            <CanvasViewport />

            <aside className="w-[250px] bg-[#222] border-l border-bg-tertiary flex flex-col">
              {/* <div className="px-4 py-2 border-b border-bg-tertiary">
                <h3 className="text-[0.8rem] m-0 text-[#999] font-bold uppercase">
                  LAYERS
                </h3>
              </div> */}
              <LayerList />
            </aside>
          </>
        )}
      </main>

      {/* 4. Footer / Status Bar */}
      <footer className="h-[25px] px-4 bg-[#222] border-t border-bg-tertiary text-[0.75rem] flex items-center justify-between text-[#888]">
        <div>
          {activeTab === "home"
            ? "Welcome to OpenCreate Forge"
            : `Editing ${activeProject?.name || "Unknown"}.ocfd`}
        </div>
        {activeProject && (
          <div className="flex gap-4">
            <span>
              {activeProject.width} x {activeProject.height} px
            </span>
            <span className="text-accent font-bold">
              Zoom: {Math.round(activeProject.zoom * 100)}%
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}

export default App;
