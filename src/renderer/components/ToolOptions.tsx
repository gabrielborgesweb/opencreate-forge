import React from "react";
import { useToolStore, ToolId } from "@store/toolStore";
import {
  MousePointer2,
  Square,
  Brush,
  Pencil,
  Eraser,
  Type,
  Settings2,
} from "lucide-react";

const ToolOptions: React.FC = () => {
  const activeToolId = useToolStore((state) => state.activeToolId);
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);

  const getToolIcon = (id: ToolId) => {
    switch (id) {
      case "move":
        return <MousePointer2 size={16} color="#cc6d29" />;
      case "select":
        return <Square size={16} color="#cc6d29" />;
      case "brush":
        return <Brush size={16} color="#cc6d29" />;
      case "pencil":
        return <Pencil size={16} color="#cc6d29" />;
      case "eraser":
        return <Eraser size={16} color="#cc6d29" />;
      case "text":
        return <Type size={16} color="#cc6d29" />;
      default:
        return <Settings2 size={16} color="#cc6d29" />;
    }
  };

  const renderOptions = () => {
    switch (activeToolId) {
      case "brush":
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <label style={{ fontSize: "0.75rem", color: "#999" }}>Size</label>
              <input
                type="range"
                min="1"
                max="500"
                value={toolSettings.brush.size}
                onChange={(e) =>
                  updateToolSettings("brush", {
                    size: parseInt(e.target.value),
                  })
                }
              />
              <span style={{ fontSize: "0.75rem", width: "30px" }}>
                {toolSettings.brush.size}px
              </span>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <label style={{ fontSize: "0.75rem", color: "#999" }}>
                Color
              </label>
              <input
                type="color"
                value={toolSettings.brush.color}
                onChange={(e) =>
                  updateToolSettings("brush", { color: e.target.value })
                }
                style={{
                  border: "none",
                  background: "none",
                  width: "24px",
                  height: "24px",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>
        );
      default:
        return (
          <span style={{ fontSize: "0.75rem", color: "#666" }}>
            No options for this tool
          </span>
        );
    }
  };

  return (
    <div
      className="tool-options"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        padding: "0 .5rem",
        paddingRight: "calc(.5rem - 1px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderRight: "1px solid #444",
          paddingRight: "1rem",
        }}
      >
        {getToolIcon(activeToolId)}
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: "bold",
            textTransform: "uppercase",
          }}
        >
          {activeToolId}
        </span>
      </div>
      {renderOptions()}
    </div>
  );
};

export default ToolOptions;
