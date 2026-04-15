import React from "react";
import { useToolStore } from "@store/toolStore";
import { TOOLS } from "../constants/tools";
import { Settings2 } from "lucide-react";

const ToolOptions: React.FC = () => {
  const activeToolId = useToolStore((state) => state.activeToolId);
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);

  const activeTool = TOOLS.find((tool) => tool.id === activeToolId);
  const ToolIcon = activeTool?.icon || Settings2;

  const renderOptions = () => {
    switch (activeToolId) {
      case "brush":
        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999]">Size</label>
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
                className="accent-accent"
              />
              <span className="text-[0.75rem] w-[40px]">
                {toolSettings.brush.size}px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999]">Hardness</label>
              <input
                type="range"
                min="0"
                max="100"
                value={toolSettings.brush.hardness * 100}
                onChange={(e) =>
                  updateToolSettings("brush", {
                    hardness: parseInt(e.target.value) / 100,
                  })
                }
                className="accent-accent"
              />
              <span className="text-[0.75rem] w-[35px]">
                {Math.round(toolSettings.brush.hardness * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999]">Color</label>
              <input
                type="color"
                value={toolSettings.brush.color}
                onChange={(e) =>
                  updateToolSettings("brush", { color: e.target.value })
                }
                className="border-none bg-none w-6 h-6 cursor-pointer"
              />
            </div>
          </div>
        );
      case "eraser":
        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999]">Size</label>
              <input
                type="range"
                min="1"
                max="500"
                value={toolSettings.eraser.size}
                onChange={(e) =>
                  updateToolSettings("eraser", {
                    size: parseInt(e.target.value),
                  })
                }
                className="accent-accent"
              />
              <span className="text-[0.75rem] w-[40px]">
                {toolSettings.eraser.size}px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999]">Hardness</label>
              <input
                type="range"
                min="0"
                max="100"
                value={toolSettings.eraser.hardness * 100}
                onChange={(e) =>
                  updateToolSettings("eraser", {
                    hardness: parseInt(e.target.value) / 100,
                  })
                }
                className="accent-accent"
              />
              <span className="text-[0.75rem] w-[35px]">
                {Math.round(toolSettings.eraser.hardness * 100)}%
              </span>
            </div>
          </div>
        );
      default:
        return (
          <span className="text-[0.75rem] text-[#666]">
            No options for this tool
          </span>
        );
    }
  };

  return (
    <div className="flex items-center gap-6 px-4 py-1 pr-[calc(0.5rem-1px)]">
      <div className="flex items-center gap-2 border-r border-border pr-4 h-full py-1">
        <ToolIcon size={16} className="text-accent" />
        <span className="text-[0.85rem] font-bold uppercase">
          {activeTool?.name || activeToolId}
        </span>
      </div>
      {renderOptions()}
    </div>
  );
};

export default ToolOptions;
