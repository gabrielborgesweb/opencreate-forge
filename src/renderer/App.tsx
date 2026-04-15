import React from "react";
import { useUIStore } from "@store/uiStore";
import { useProjectStore } from "@store/projectStore";
import CanvasViewport from "./components/CanvasViewport";
import LayerList from "./components/Sidebar/LayerList";
import Toolbar from "./components/Toolbar";
import ToolOptions from "./components/ToolOptions";
import ProjectTabs from "./components/ProjectTabs";
import HomeScreen from "./components/HomeScreen";

function App() {
  const activeTab = useUIStore((state) => state.activeTab);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const activeProject = useProjectStore((state) =>
    state.projects.find((p) => p.id === activeProjectId),
  );

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-[#eee] overflow-hidden">
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
              <div className="px-4 py-2 border-b border-bg-tertiary bg-bg-secondary">
                <h3 className="text-[0.8rem] m-0 text-[#999] font-bold uppercase">
                  LAYERS
                </h3>
              </div>
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
