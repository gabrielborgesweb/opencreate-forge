import React from "react";
import { useToolStore } from "@store/toolStore";
import { useUIStore } from "@store/uiStore";
import { TOOLS } from "../constants/tools";

const Toolbar: React.FC = () => {
  const activeToolId = useToolStore((state) => state.activeToolId);
  const setActiveTool = useToolStore((state) => state.setActiveTool);
  const transformSettings = useToolStore(
    (state) => state.toolSettings.transform,
  );
  const cropSettings = useToolStore(
    (state) => state.toolSettings.crop,
  );
  const showToast = useUIStore((state) => state.showToast);

  const handleToolClick = (id: string) => {
    const isTransformDirty = activeToolId === "transform" && transformSettings.isDirty;
    const isCropDirty = activeToolId === "crop" && cropSettings.isDirty;

    if (
      (isTransformDirty || isCropDirty) &&
      id !== activeToolId
    ) {
      showToast(
        "<b>Apply (Enter)</b> or <b>Cancel (Esc)</b> before switching tools",
        "warning",
        5000,
      );
      return;
    }
    setActiveTool(id as any);
  };

  return (
    <div className="flex flex-col p-2 pr-[calc(0.5rem-1px)] gap-2">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => handleToolClick(tool.id)}
          title={tool.label}
          tabIndex={-1}
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
