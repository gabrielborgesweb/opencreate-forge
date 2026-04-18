import React from "react";
import { Square, Circle } from "lucide-react";
import { useToolStore } from "@/renderer/store/toolStore";
import ToolSettingInput from "@/renderer/components/ui/ToolSettingInput";

export const PencilOptions: React.FC = () => {
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);

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
        <label className="text-[0.75rem] text-[#999] font-medium">Color</label>
        <input
          type="color"
          value={toolSettings.pencil.color}
          onChange={(e) => updateToolSettings("pencil", { color: e.target.value })}
          className="border-none bg-none w-5 h-5 cursor-pointer rounded overflow-hidden"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[0.75rem] text-[#999] font-medium">Shape</label>
        <div className="flex items-center bg-black/20 rounded p-0.5">
          <button
            onClick={() => updateToolSettings("pencil", { shape: "square" })}
            tabIndex={-1}
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
            onClick={() => updateToolSettings("pencil", { shape: "circle" })}
            tabIndex={-1}
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
};
