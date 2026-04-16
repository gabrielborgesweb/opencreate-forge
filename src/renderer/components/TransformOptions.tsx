import React from "react";
import { useToolStore } from "@store/toolStore";
import ToolSettingInput from "./ui/ToolSettingInput";
import { Check, X } from "lucide-react";

const TransformOptions: React.FC = () => {
  const transform = useToolStore((state) => state.toolSettings.transform);

  const updateSettings = (updates: any) => {
    useToolStore.getState().updateToolSettings("transform", { ...updates, isDirty: true });
  };

  const handleApply = () => {
    // Dispatch custom event or call engine directly if accessible
    // In this architecture, it's better to use a global command or store action
    // but the actual application logic is inside TransformTool class.
    // We can use a trick: setting the tool to move will trigger deactivation/application
    // Or we can add an 'applying' state.
    // However, the cleanest way is to trigger it via a custom event that the tool listens to.
    window.dispatchEvent(new CustomEvent("forge:transform-apply"));
  };

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent("forge:transform-cancel"));
  };

  return (
    <div className="flex items-center gap-4 px-4 text-[0.75rem]">
      <div className="flex items-center gap-2">
        <span className="text-[#999] font-bold">POS:</span>
        <ToolSettingInput
          label="X"
          value={Math.round(transform.x)}
          onChange={(v) => updateSettings({ x: v })}
          unit="px"
          min={-10000}
          max={10000}
        />
        <ToolSettingInput
          label="Y"
          value={Math.round(transform.y)}
          onChange={(v) => updateSettings({ y: v })}
          unit="px"
          min={-10000}
          max={10000}
        />
      </div>

      <div className="w-[1px] h-4 bg-bg-tertiary" />

      <div className="flex items-center gap-2">
        <span className="text-[#999] font-bold">SIZE:</span>
        <ToolSettingInput
          label="W"
          value={Math.round(transform.width * transform.scaleX)}
          onChange={(v) => updateSettings({ scaleX: v / transform.width })}
          unit="px"
          min={-10000}
          max={10000}
        />
        <ToolSettingInput
          label="H"
          value={Math.round(transform.height * transform.scaleY)}
          onChange={(v) => updateSettings({ scaleY: v / transform.height })}
          unit="px"
          min={-10000}
          max={10000}
        />
      </div>

      <div className="w-[1px] h-4 bg-bg-tertiary" />

      <div className="flex items-center gap-2">
        <span className="text-[#999] font-bold">SCALE:</span>
        <ToolSettingInput
          label="X"
          value={transform.scaleX}
          onChange={(v) => updateSettings({ scaleX: v })}
          unit="%"
          displayMultiplier={100}
          min={-100}
          max={100}
          step={0.1}
        />
        <ToolSettingInput
          label="Y"
          value={transform.scaleY}
          onChange={(v) => updateSettings({ scaleY: v })}
          unit="%"
          displayMultiplier={100}
          min={-100}
          max={100}
          step={0.1}
        />
      </div>

      <div className="w-[1px] h-4 bg-bg-tertiary" />

      <div className="flex items-center gap-2">
        <span className="text-[#999] font-bold">ROT:</span>
        <ToolSettingInput
          label="∠"
          value={transform.rotation}
          onChange={(v) => updateSettings({ rotation: v })}
          unit="°"
          min={-360}
          max={360}
        />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          onClick={handleCancel}
          className="p-1 hover:bg-[#444] rounded text-red-400 transition-colors"
          title="Cancel (Esc)"
        >
          <X size={18} />
        </button>
        <button
          onClick={handleApply}
          className="p-1 hover:bg-[#444] rounded text-green-400 transition-colors"
          title="Apply (Enter)"
        >
          <Check size={18} />
        </button>
      </div>
    </div>
  );
};

export default TransformOptions;
