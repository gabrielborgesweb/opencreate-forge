import React from "react";
import { useToolStore } from "@store/toolStore";
import { TOOLS } from "../constants/tools";

const Toolbar: React.FC = () => {
  const activeToolId = useToolStore((state) => state.activeToolId);
  const setActiveTool = useToolStore((state) => state.setActiveTool);

  return (
    <div className="flex flex-col p-2 gap-2 bg-bg-secondary border-r border-bg-tertiary">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          title={tool.label}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            activeToolId === tool.id
              ? "bg-accent text-white"
              : "bg-transparent text-[#ccc] hover:bg-white/5"
          } border-none cursor-pointer`}
        >
          <tool.icon size={16} />
        </button>
      ))}
    </div>
  );
};

export default Toolbar;
