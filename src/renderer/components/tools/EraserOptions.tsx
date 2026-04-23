import React from "react";
import { Brush, Pencil, Square, Circle } from "lucide-react";
import { useToolStore } from "@/renderer/store/toolStore";
import ToolSettingInput from "@/renderer/components/ui/ToolSettingInput";

export const EraserOptions: React.FC = () => {
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label className="text-[0.75rem] text-[#999] font-medium">Mode</label>
        <div className="flex items-center bg-black/20 rounded p-0.5">
          <button
            onClick={() => updateToolSettings("eraser", { mode: "brush" })}
            tabIndex={-1}
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
            onClick={() => updateToolSettings("eraser", { mode: "pencil" })}
            tabIndex={-1}
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
          onChange={(val) => updateToolSettings("eraser", { hardness: val })}
        />
      )}
      {toolSettings.eraser.mode === "pencil" && (
        <div className="flex items-center gap-2">
          <label className="text-[0.75rem] text-[#999] font-medium">Shape</label>
          <div className="flex items-center bg-black/20 rounded p-0.5">
            <button
              onClick={() => updateToolSettings("eraser", { shape: "square" })}
              tabIndex={-1}
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
              onClick={() => updateToolSettings("eraser", { shape: "circle" })}
              tabIndex={-1}
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
};
