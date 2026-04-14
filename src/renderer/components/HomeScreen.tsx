import React from "react";
import { useProjectStore, Project } from "@store/projectStore";
import { useUIStore } from "@store/uiStore";
import { Plus, FolderOpen } from 'lucide-react';

const HomeScreen: React.FC = () => {
  const addProject = useProjectStore((state) => state.addProject);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const createNewProject = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const newProject: Project = {
      id,
      name: "Untitled",
      width: 1080,
      height: 1080,
      layers: [
        {
          id: "bg-" + id,
          name: "Background",
          type: "raster",
          visible: true,
          locked: false,
          opacity: 100,
          x: 0,
          y: 0,
          width: 1080,
          height: 1080,
          blendMode: "source-over",
        },
      ],
      activeLayerId: "bg-" + id,
      zoom: 1,
      panX: 0,
      panY: 0,
    };
    addProject(newProject);
    setActiveTab(id);
  };

  return (
    <div
      className="home-screen"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        color: "#eee",
        gap: "2rem",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            fontSize: "2rem",
            marginBottom: "0.5rem",
            color: "var(--accent-color)",
          }}
        >
          OpenCreate Forge
        </h2>
        <p style={{ color: "#888" }}>
          Modern Image Editor powered by React & Electron
        </p>
      </div>

      <div style={{ display: "flex", gap: "1.5rem" }}>
        <button
          onClick={createNewProject}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            padding: "2rem",
            background: "#252525",
            border: "1px solid #333",
            borderRadius: "8px",
            cursor: "pointer",
            width: "160px",
            transition: "transform 0.2s, border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-color)";
            e.currentTarget.style.transform = "translateY(-5px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#333";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <Plus size={32} color="var(--accent-color)" />
          <span style={{ fontSize: "0.9rem", fontWeight: "500" }}>
            New Project
          </span>
        </button>

        <button
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            padding: "2rem",
            background: "#252525",
            border: "1px solid #333",
            borderRadius: "8px",
            cursor: "pointer",
            width: "160px",
            transition: "transform 0.2s, border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-color)";
            e.currentTarget.style.transform = "translateY(-5px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#333";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <FolderOpen size={32} color="var(--accent-color)" />
          <span style={{ fontSize: "0.9rem", fontWeight: "500" }}>
            Open Project
          </span>
        </button>
      </div>
    </div>
  );
};

export default HomeScreen;
