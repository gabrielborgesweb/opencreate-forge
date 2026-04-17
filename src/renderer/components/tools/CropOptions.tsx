import React from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { useToolStore, CropMode } from "@/renderer/store/toolStore";
import ToolSettingInput from "@/renderer/components/ui/ToolSettingInput";

export const CropOptions: React.FC = () => {
  const crop = useToolStore((state) => state.toolSettings.crop);
  const updateSettings = useToolStore((state) => state.updateToolSettings);

  const handleApply = () => {
    window.dispatchEvent(new CustomEvent("forge:crop-apply"));
  };

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent("forge:crop-cancel"));
  };

  const handleReset = () => {
    window.dispatchEvent(new CustomEvent("forge:crop-reset"));
  };

  return (
    <div className="flex items-center gap-4 h-full text-[0.75rem]">
      <div className="flex items-center gap-2">
        <span className="text-[#999] font-bold">MODE:</span>
        <select
          value={crop.mode}
          onChange={(e) =>
            updateSettings("crop", { mode: e.target.value as CropMode })
          }
          className="bg-[#333] border border-white/10 text-[#eee] rounded px-1 outline-none h-6"
        >
          <option value="Free">Free</option>
          <option value="Original Ratio">Original Ratio</option>
          <option value="Fixed Ratio">Fixed Ratio</option>
        </select>
      </div>

      {crop.mode === "Fixed Ratio" && (
        <div className="flex items-center gap-2">
          <ToolSettingInput
            label="W"
            value={crop.ratioW}
            onChange={(v) => updateSettings("crop", { ratioW: v })}
            min={0.1}
            max={10000}
          />
          <span className="text-[#666]">:</span>
          <ToolSettingInput
            label="H"
            value={crop.ratioH}
            onChange={(v) => updateSettings("crop", { ratioH: v })}
            min={0.1}
            max={10000}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={crop.deleteCropped}
            onChange={(e) =>
              updateSettings("crop", { deleteCropped: e.target.checked })
            }
            className="w-3 h-3 rounded bg-[#333] border-white/10 accent-accent"
          />
          <span className="text-[#999] font-bold">DELETE PIXELS</span>
        </label>
      </div>

      <div className="w-[1px] h-4 bg-white/10" />

      <div className="flex items-center gap-1">
        <button
          onClick={handleReset}
          tabIndex={-1}
          className="p-1 hover:bg-[#444] rounded text-[#ccc] transition-colors"
          title="Reset Crop"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={handleCancel}
          tabIndex={-1}
          className="p-1 hover:bg-[#444] rounded text-red-400 transition-colors"
          title="Cancel (Esc)"
        >
          <X size={18} />
        </button>
        <button
          onClick={handleApply}
          tabIndex={-1}
          className="p-1 hover:bg-[#444] rounded text-green-400 transition-colors"
          title="Apply (Enter)"
        >
          <Check size={18} />
        </button>
      </div>
    </div>
  );
};
