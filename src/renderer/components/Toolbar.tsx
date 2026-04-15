import React from "react";
import { useToolStore } from "@store/toolStore";
import { TOOLS } from "../constants/tools";

const Toolbar: React.FC = () => {
  const activeToolId = useToolStore((state) => state.activeToolId);
  const setActiveTool = useToolStore((state) => state.setActiveTool);

  return (
    <div
      className="toolbar"
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "0.5rem",
        gap: "0.5rem",
      }}
    >
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          title={tool.label}
          style={{
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: activeToolId === tool.id ? "#cc6d29" : "transparent",
            color: activeToolId === tool.id ? "white" : "#ccc",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <tool.icon size={16} />
        </button>
      ))}
    </div>
  );
};

export default Toolbar;
