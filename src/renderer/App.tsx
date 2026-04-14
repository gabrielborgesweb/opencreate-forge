import React from "react";
import { useUIStore } from "@store/uiStore";
import CanvasViewport from "./components/CanvasViewport";
import LayerList from "./components/Sidebar/LayerList";
import Toolbar from "./components/Toolbar";
import ToolOptions from "./components/ToolOptions";
import ProjectTabs from "./components/ProjectTabs";
import HomeScreen from "./components/HomeScreen";

function App() {
  const activeTab = useUIStore((state) => state.activeTab);

  return (
    <div
      className="app-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#1a1a1a",
        color: "#eee",
        overflow: "hidden",
      }}
    >
      {/* 1. Abas de Projeto */}
      <ProjectTabs />

      {/* 2. Cabeçalho Dinâmico (Opções da Ferramenta) */}
      {activeTab !== "home" && (
        <header
          style={{
            height: "45px",
            background: "#222",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ToolOptions />
        </header>
      )}

      {/* 3. Área Principal */}
      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {activeTab === "home" ? (
          <HomeScreen />
        ) : (
          <>
            <aside
              style={{
                // width: "60px",
                background: "#222",
                borderRight: "1px solid #333",
              }}
            >
              <Toolbar />
            </aside>

            <CanvasViewport />

            <aside
              style={{
                width: "250px",
                background: "#222",
                borderLeft: "1px solid #333",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "0.5rem 1rem",
                  borderBottom: "1px solid #333",
                  background: "#2a2a2a",
                }}
              >
                <h3 style={{ fontSize: "0.8rem", margin: 0, color: "#999" }}>
                  LAYERS
                </h3>
              </div>
              <LayerList />
            </aside>
          </>
        )}
      </main>

      {/* 4. Footer / Status Bar */}
      <footer
        style={{
          height: "25px",
          padding: "0 1rem",
          background: "#222",
          borderTop: "1px solid #333",
          fontSize: "0.75rem",
          display: "flex",
          alignItems: "center",
          color: "#666",
        }}
      >
        {activeTab === "home"
          ? "Welcome to OpenCreate Forge"
          : `Editing ${activeTab}.ocfd`}
      </footer>
    </div>
  );
}

export default App;
