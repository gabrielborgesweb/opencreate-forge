import React from "react";
import { useToolStore, ToolId } from "@store/toolStore";
import {
  MousePointer2,
  Square,
  Brush,
  Pencil,
  Eraser,
  Type,
} from "lucide-react";

const tools = [
  { id: "move" as ToolId, icon: MousePointer2, label: "Move (V)" },
  { id: "select" as ToolId, icon: Square, label: "Select (M)" },
  { id: "brush" as ToolId, icon: Brush, label: "Brush (B)" },
  { id: "pencil" as ToolId, icon: Pencil, label: "Pencil (P)" },
  { id: "eraser" as ToolId, icon: Eraser, label: "Eraser (E)" },
  { id: "text" as ToolId, icon: Type, label: "Text (T)" },
];

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
      {tools.map((tool) => (
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
