import React, { useEffect, useRef } from "react";
import { useToolStore } from "@/renderer/store/toolStore";
import { useProjectStore } from "@/renderer/store/projectStore";
import ToolSettingInput from "@/renderer/components/ui/ToolSettingInput";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, X, Check } from "lucide-react";
import { TextLayer } from "@/core/layers/TextLayer";

export const TextOptions: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const activeProject = useProjectStore((state) =>
    state.projects.find((p) => p.id === activeProjectId),
  );

  const textSettings = toolSettings.text;
  const textAlign = textSettings.textAlign;

  // Live updates
  useEffect(() => {
    if (activeProject && activeProject.activeLayerId) {
      const layer = activeProject.layers.find((l) => l.id === activeProject.activeLayerId);
      if (layer && layer.type === "text" && textSettings.isEditing) {
        const baseUpdates: any = {
          fontSize: textSettings.fontSize,
          fontFamily: textSettings.fontFamily,
          color: textSettings.color,
          textAlign: textSettings.textAlign,
          tracking: textSettings.tracking,
          lineHeight: textSettings.lineHeight,
          textRendering: textSettings.textRendering,
        };

        // For point text, we must recalculate width/height to avoid clipping
        let dimensionUpdates = {};
        if (layer.textType === "point") {
          const ctx = canvasRef.current.getContext("2d")!;
          const metrics = TextLayer.calculateMetrics(ctx, { ...layer, ...baseUpdates });
          dimensionUpdates = {
            width: metrics.width,
            height: metrics.height,
            x: metrics.x,
          };
        }

        const updates = { ...baseUpdates, ...dimensionUpdates };
        
        // Only update if there's a real change to avoid infinite loops or unnecessary renders
        const hasChange = Object.keys(updates).some(key => (updates as any)[key] !== (layer as any)[key]);
        
        if (hasChange) {
           useProjectStore.getState().updateLayer(activeProject.id, layer.id, updates);
        }
      }
    }
  }, [textSettings, activeProject]);

  const handleApply = () => {
    window.dispatchEvent(new CustomEvent("forge:text-apply"));
  };

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent("forge:text-cancel"));
  };

  const setAlign = (align: "left" | "center" | "right" | "justify") => {
    updateToolSettings("text", { textAlign: align });
  };

  return (
    <div className="flex items-center gap-6 w-full px-4 overflow-x-auto no-scrollbar">
      <div className="flex flex-col gap-0.5">
        <label className="text-[0.65rem] text-[#999] font-medium uppercase tracking-tight">
          Font Family
        </label>
        <select
          value={textSettings.fontFamily}
          onChange={(e) => updateToolSettings("text", { fontFamily: e.target.value })}
          className="bg-zinc-800 border-none text-[0.75rem] text-white px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Georgia">Georgia</option>
          <option value="system-ui">System UI</option>
        </select>
      </div>

      <ToolSettingInput
        label="Size"
        unit="pt"
        min={1}
        max={1000}
        value={textSettings.fontSize}
        onChange={(val) => updateToolSettings("text", { fontSize: val })}
      />

      <div className="flex items-center gap-1.5 px-3 border-x border-zinc-800 h-8">
        <button
          onClick={() => setAlign("left")}
          className={`p-1.5 rounded transition-colors ${textAlign === "left" ? "bg-accent text-white" : "text-zinc-400 hover:bg-zinc-800"}`}
          title="Align Left"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => setAlign("center")}
          className={`p-1.5 rounded transition-colors ${textAlign === "center" ? "bg-accent text-white" : "text-zinc-400 hover:bg-zinc-800"}`}
          title="Align Center"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => setAlign("right")}
          className={`p-1.5 rounded transition-colors ${textAlign === "right" ? "bg-accent text-white" : "text-zinc-400 hover:bg-zinc-800"}`}
          title="Align Right"
        >
          <AlignRight size={16} />
        </button>
        <button
          onClick={() => setAlign("justify")}
          className={`p-1.5 rounded transition-colors ${textAlign === "justify" ? "bg-accent text-white" : "text-zinc-400 hover:bg-zinc-800"}`}
          title="Justify"
        >
          <AlignJustify size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <label className="text-[0.65rem] text-[#999] font-medium uppercase tracking-tight">
            Color
          </label>
          <input
            type="color"
            value={textSettings.color}
            onChange={(e) => updateToolSettings("text", { color: e.target.value })}
            className="border-none bg-none w-5 h-5 cursor-pointer rounded overflow-hidden"
          />
        </div>
      </div>

      <ToolSettingInput
        label="Tracking"
        unit="px"
        min={-50}
        max={200}
        value={textSettings.tracking}
        onChange={(val) => updateToolSettings("text", { tracking: val })}
      />

      <ToolSettingInput
        label="Leading"
        unit="x"
        min={0.1}
        max={10}
        step={0.1}
        value={textSettings.lineHeight}
        onChange={(val) => updateToolSettings("text", { lineHeight: val })}
      />

      <div className="flex flex-col gap-0.5">
        <label className="text-[0.65rem] text-[#999] font-medium uppercase tracking-tight">
          Rendering
        </label>
        <select
          value={textSettings.textRendering}
          onChange={(e) => updateToolSettings("text", { textRendering: e.target.value })}
          className="bg-zinc-800 border-none text-[0.75rem] text-white px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="bilinear">Smooth (Bilinear)</option>
          <option value="nearest">Pixelated (Nearest)</option>
        </select>
      </div>

      {textSettings.isEditing && (
        <div className="flex items-center gap-2 ml-auto border-l border-zinc-800 pl-4 h-8 animate-in fade-in slide-in-from-right-2 duration-200">
          <button
            onClick={handleCancel}
            className="p-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors"
            title="Cancel (Esc)"
          >
            <X size={18} />
          </button>
          <button
            onClick={handleApply}
            className="p-1.5 rounded text-green-400 hover:bg-green-400/10 transition-colors"
            title="Apply (Ctrl+Enter)"
          >
            <Check size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
