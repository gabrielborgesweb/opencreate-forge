import React from "react";
import { useToolStore } from "@/renderer/store/toolStore";
import ToolSettingInput from "@/renderer/components/ui/ToolSettingInput";

export const BrushOptions: React.FC = () => {
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);

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
        <label className="text-[0.75rem] text-[#999] font-medium">Color</label>
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
};
