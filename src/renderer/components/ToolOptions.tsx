import React from "react";
import { useToolStore } from "@store/toolStore";
import { TOOLS } from "../constants/tools";
import { Brush, Circle, Pencil, Settings2, Square } from "lucide-react";
import ToolSettingInput from "./ui/ToolSettingInput";
import TransformOptions from "./TransformOptions";

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
          <div className="flex items-center gap-6">
            <ToolSettingInput
              label="Size"
              unit="px"
              min={1}
              max={500}
              value={toolSettings.brush.size}
              onChange={(val) => updateToolSettings("brush", { size: val })}
            />
            <ToolSettingInput
              label="Hardness"
              unit="%"
              min={0}
              max={1}
              displayMultiplier={100}
              value={toolSettings.brush.hardness}
              onChange={(val) => updateToolSettings("brush", { hardness: val })}
            />
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999] font-medium">
                Color
              </label>
              <input
                type="color"
                value={toolSettings.brush.color}
                onChange={(e) =>
                  updateToolSettings("brush", { color: e.target.value })
                }
                className="border-none bg-none w-5 h-5 cursor-pointer rounded overflow-hidden"
              />
            </div>
          </div>
        );
      case "pencil":
        return (
          <div className="flex items-center gap-6">
            <ToolSettingInput
              label="Size"
              unit="px"
              min={1}
              max={100}
              value={toolSettings.pencil.size}
              onChange={(val) => updateToolSettings("pencil", { size: val })}
            />
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999] font-medium">
                Color
              </label>
              <input
                type="color"
                value={toolSettings.pencil.color}
                onChange={(e) =>
                  updateToolSettings("pencil", { color: e.target.value })
                }
                className="border-none bg-none w-5 h-5 cursor-pointer rounded overflow-hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999] font-medium">
                Shape
              </label>
              <div className="flex items-center bg-black/20 rounded p-0.5">
                <button
                  onClick={() =>
                    updateToolSettings("pencil", { shape: "square" })
                  }
                  className={`p-1 text-[10px] uppercase font-bold rounded ${
                    toolSettings.pencil.shape === "square"
                      ? "bg-accent text-white shadow-sm"
                      : "text-[#999] hover:text-white"
                  } transition-all`}
                  title="Square"
                >
                  <Square size={16} />
                </button>
                <button
                  onClick={() =>
                    updateToolSettings("pencil", { shape: "circle" })
                  }
                  className={`p-1 text-[10px] uppercase font-bold rounded ${
                    toolSettings.pencil.shape === "circle"
                      ? "bg-accent text-white shadow-sm"
                      : "text-[#999] hover:text-white"
                  } transition-all`}
                  title="Circle"
                >
                  <Circle size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      case "eraser":
        return (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-[0.75rem] text-[#999] font-medium">
                Mode
              </label>
              <div className="flex items-center bg-black/20 rounded p-0.5">
                <button
                  onClick={() =>
                    updateToolSettings("eraser", { mode: "brush" })
                  }
                  className={`p-1 text-[10px] uppercase font-bold rounded ${
                    toolSettings.eraser.mode === "brush"
                      ? "bg-accent text-white shadow-sm"
                      : "text-[#999] hover:text-white"
                  } transition-all`}
                  title="Brush"
                >
                  <Brush size={16} />
                </button>
                <button
                  onClick={() =>
                    updateToolSettings("eraser", { mode: "pencil" })
                  }
                  className={`p-1 text-[10px] uppercase font-bold rounded ${
                    toolSettings.eraser.mode === "pencil"
                      ? "bg-accent text-white shadow-sm"
                      : "text-[#999] hover:text-white"
                  } transition-all`}
                  title="Pencil"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>
            <ToolSettingInput
              label="Size"
              unit="px"
              min={1}
              max={500}
              value={toolSettings.eraser.size}
              onChange={(val) => updateToolSettings("eraser", { size: val })}
            />
            {toolSettings.eraser.mode === "brush" && (
              <ToolSettingInput
                label="Hardness"
                unit="%"
                min={0}
                max={1}
                displayMultiplier={100}
                value={toolSettings.eraser.hardness}
                onChange={(val) =>
                  updateToolSettings("eraser", { hardness: val })
                }
              />
            )}
            {toolSettings.eraser.mode === "pencil" && (
              <div className="flex items-center gap-2">
                <label className="text-[0.75rem] text-[#999] font-medium">
                  Shape
                </label>
                <div className="flex items-center bg-black/20 rounded p-0.5">
                  <button
                    onClick={() =>
                      updateToolSettings("eraser", { shape: "square" })
                    }
                    className={`p-1 text-[10px] uppercase font-bold rounded ${
                      toolSettings.eraser.shape === "square"
                        ? "bg-accent text-white shadow-sm"
                        : "text-[#999] hover:text-white"
                    } transition-all`}
                    title="Square"
                  >
                    <Square size={16} />
                  </button>
                  <button
                    onClick={() =>
                      updateToolSettings("eraser", { shape: "circle" })
                    }
                    className={`p-1 text-[10px] uppercase font-bold rounded ${
                      toolSettings.eraser.shape === "circle"
                        ? "bg-accent text-white shadow-sm"
                        : "text-[#999] hover:text-white"
                    } transition-all`}
                    title="Circle"
                  >
                    <Circle size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      case "transform":
        return <TransformOptions />;
      default:
        return (
          <span className="text-[0.75rem] text-[#666]">
            No options for this tool
          </span>
        );
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-1 pr-[calc(0.5rem-1px)]">
      <div className="flex items-center gap-4 border-r border-border pr-4 h-full py-1">
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
