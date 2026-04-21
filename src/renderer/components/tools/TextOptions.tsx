import React, { useEffect, useRef } from "react";
import { useToolStore } from "@/renderer/store/toolStore";
import { useProjectStore } from "@/renderer/store/projectStore";
import ToolSettingInput from "@/renderer/components/ui/ToolSettingInput";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  X,
  Check,
  Baseline,
  ArrowDownUp,
  Highlighter,
  Palette,
  CaseSensitive,
  TypeOutline,
} from "lucide-react";
import { TextLayer } from "@/core/layers/TextLayer";

const WEIGHT_LABELS: Record<string, string> = {
  "100": "Thin",
  "200": "Extra Light",
  "300": "Light",
  "400": "Regular",
  "500": "Medium",
  "600": "Semi Bold",
  "700": "Bold",
  "800": "Extra Bold",
  "900": "Black",
  normal: "Regular",
  bold: "Bold",
};

const TextOverflowIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m15 20c0 1.1-0.9 2-2 2h-8c-1.1 0-2-0.9-2-2v-16c0-1.1 0.9-2 2-2h8c1.1 0 2 0.9 2 2" />
    <path d="m21 7h-14m8 5h-8m10 5h-10" />
  </svg>
);

export const TextOptions: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const [availableWeights, setAvailableWeights] = React.useState<string[]>(["normal", "bold"]);
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const activeProject = useProjectStore((state) =>
    state.projects.find((p) => p.id === activeProjectId),
  );

  const textSettings = toolSettings.text;
  const textAlign = textSettings.textAlign;
  const activeToolId = useToolStore((state) => state.activeToolId);

  // 0. Detect available weights for the current font
  useEffect(() => {
    const family = textSettings.fontFamily;
    const testWeights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
    const detected: string[] = [];

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const text = "Hg";
    const fontSize = "40px";

    const getPixelSum = (weight: string) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${weight} ${fontSize} "${family}"`;
      ctx.fillText(text, 10, 30);
      const data = ctx.getImageData(0, 0, 150, 50).data;
      let sum = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) sum += 1; // Count filled pixels
      }
      return sum;
    };

    canvas.width = 200;
    canvas.height = 60;
    ctx.textBaseline = "top";
    ctx.fillStyle = "black";

    const normalSum = getPixelSum("400");
    const boldSum = getPixelSum("700");

    testWeights.forEach((w) => {
      const currentSum = getPixelSum(w);
      if (w === "400") {
        detected.push(w);
        return;
      }
      if (w === "700") {
        detected.push(w);
        return;
      }

      // If it differs from both normal and bold, it's likely a unique weight
      const diffFromNormal = Math.abs(currentSum - normalSum);
      const diffFromBold = Math.abs(currentSum - boldSum);

      if (diffFromNormal > 2 || diffFromBold > 2) {
        detected.push(w);
      }
    });

    if (detected.length <= 2) {
      setTimeout(() => setAvailableWeights(["normal", "bold"]), 0);
    } else {
      const sorted = detected.sort((a, b) => parseInt(a) - parseInt(b));
      setTimeout(() => setAvailableWeights(sorted), 0);
    }
  }, [textSettings.fontFamily]);

  // Fallback if current weight is missing in new font
  useEffect(() => {
    if (
      availableWeights.length > 0 &&
      !availableWeights.includes(String(textSettings.fontWeight))
    ) {
      updateToolSettings("text", { fontWeight: "400" });
    }
  }, [availableWeights, textSettings.fontWeight, updateToolSettings]);

  // 1. Sync ToolOptions UI with selected layer properties
  useEffect(() => {
    if (activeProject && activeProject.activeLayerId) {
      const layer = activeProject.layers.find((l) => l.id === activeProject.activeLayerId);
      if (layer && layer.type === "text" && !textSettings.isEditing) {
        // Only update if values are actually different to avoid cycles
        const currentLayerProps = {
          fontSize: layer.fontSize || 24,
          fontFamily: layer.fontFamily || "Arial",
          fontWeight: layer.fontWeight || "normal",
          color: layer.color || "#000000",
          textAlign: layer.textAlign || "left",
          tracking: layer.tracking || 0,
          lineHeight: layer.lineHeight || 1.2,
          textRendering: layer.textRendering || "bilinear",
          textOverflow: layer.textOverflow !== false,
        };

        const needsUpdate = Object.entries(currentLayerProps).some(
          ([key, value]) => (textSettings as any)[key] !== value,
        );

        if (needsUpdate) {
          updateToolSettings("text", currentLayerProps);
        }
      }
    }
    // We only want to sync when the active layer ID changes or when we stop editing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.activeLayerId, textSettings.isEditing]);

  // 2. Live updates from ToolOptions to the layer
  useEffect(() => {
    if (activeProject && activeProject.activeLayerId) {
      const layer = activeProject.layers.find((l) => l.id === activeProject.activeLayerId);
      // Update if editing OR if the layer is selected while the text tool is active
      if (layer && layer.type === "text" && (textSettings.isEditing || activeToolId === "text")) {
        const baseUpdates: any = {
          fontSize: textSettings.fontSize,
          fontFamily: textSettings.fontFamily,
          fontWeight: textSettings.fontWeight,
          color: textSettings.color,
          textAlign: textSettings.textAlign,
          tracking: textSettings.tracking,
          lineHeight: textSettings.lineHeight,
          textOverflow: textSettings.textOverflow,
          textRendering: textSettings.textRendering,
        };

        // For point text, we must recalculate width/height to avoid clipping
        let dimensionUpdates: any = {};

        // Baseline Pivot scaling: oldY + oldFontSize = newY + newFontSize
        // So newY = oldY + oldFontSize - newFontSize
        if (layer.fontSize !== textSettings.fontSize) {
          dimensionUpdates.y = Math.round(layer.y + (layer.fontSize || 24) - textSettings.fontSize);
        }

        if (layer.textType === "point") {
          const ctx = canvasRef.current.getContext("2d")!;
          const metrics = TextLayer.calculateMetrics(ctx, {
            ...layer,
            ...baseUpdates,
            ...dimensionUpdates,
          });
          dimensionUpdates = {
            ...dimensionUpdates,
            width: Math.round(metrics.width),
            height: Math.round(metrics.height),
            x: Math.round(metrics.x ?? layer.x),
          };
        }

        const updates = { ...baseUpdates, ...dimensionUpdates };

        // Only update if there's a real change to avoid infinite loops or unnecessary renders
        const hasChange = Object.keys(updates).some(
          (key) => (updates as any)[key] !== (layer as any)[key],
        );

        if (hasChange) {
          useProjectStore.getState().updateLayer(activeProject.id, layer.id, updates);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSettings, activeProject?.activeLayerId, activeToolId]);

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
    <div className="flex items-center gap-4 w-full">
      {/* Font Family & Weight */}
      <div className="flex items-center gap-2">
        <TypeOutline size={16} className="text-zinc-500" />
        <select
          value={textSettings.fontFamily}
          onChange={(e) => updateToolSettings("text", { fontFamily: e.target.value })}
          className="bg-zinc-800 border-none text-[0.75rem] text-white px-2 py-1 rounded outline-none focus:ring-1 focus:ring-accent min-w-[100px]"
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Georgia">Georgia</option>
          <option value="system-ui">System UI</option>
        </select>

        <select
          value={textSettings.fontWeight}
          onChange={(e) => updateToolSettings("text", { fontWeight: e.target.value })}
          className="bg-zinc-800 border-none text-[0.75rem] text-white px-2 py-1 rounded outline-none focus:ring-1 focus:ring-accent w-24"
        >
          {availableWeights.map((w) => (
            <option key={w} value={w}>
              {WEIGHT_LABELS[w] || w}
            </option>
          ))}
        </select>
      </div>

      <ToolSettingInput
        label={<CaseSensitive size={14} />}
        unit="pt"
        min={1}
        max={1000}
        value={textSettings.fontSize}
        onChange={(val) => updateToolSettings("text", { fontSize: val })}
      />

      {/* Alignment */}
      <div className="flex items-center bg-black/20 rounded p-0.5">
        <button
          onClick={() => setAlign("left")}
          className={`p-1 rounded transition-colors ${textAlign === "left" ? "bg-accent text-white" : "text-zinc-400 hover:text-white"}`}
          title="Align Left"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => setAlign("center")}
          className={`p-1 rounded transition-colors ${textAlign === "center" ? "bg-accent text-white" : "text-zinc-400 hover:text-white"}`}
          title="Align Center"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => setAlign("right")}
          className={`p-1 rounded transition-colors ${textAlign === "right" ? "bg-accent text-white" : "text-zinc-400 hover:text-white"}`}
          title="Align Right"
        >
          <AlignRight size={16} />
        </button>
        <button
          onClick={() => setAlign("justify")}
          className={`p-1 rounded transition-colors ${textAlign === "justify" ? "bg-accent text-white" : "text-zinc-400 hover:text-white"}`}
          title="Justify"
        >
          <AlignJustify size={16} />
        </button>
      </div>

      {/* Color */}
      <div className="flex items-center gap-2">
        <Palette size={16} className="text-zinc-500" />
        <input
          type="color"
          value={textSettings.color}
          onChange={(e) => updateToolSettings("text", { color: e.target.value })}
          className="border-none bg-none w-5 h-5 cursor-pointer rounded overflow-hidden"
        />
      </div>

      {/* Advanced Typography */}
      <div className="flex items-center gap-4">
        <ToolSettingInput
          label={<Baseline size={14} />}
          unit="px"
          min={-50}
          max={200}
          value={textSettings.tracking}
          onChange={(val) => updateToolSettings("text", { tracking: val })}
        />

        <ToolSettingInput
          label={<ArrowDownUp size={14} />}
          unit="%"
          min={0.1}
          max={10}
          step={5}
          displayMultiplier={100}
          value={textSettings.lineHeight}
          onChange={(val) => updateToolSettings("text", { lineHeight: val })}
        />

        <button
          onClick={() => updateToolSettings("text", { textOverflow: !textSettings.textOverflow })}
          title="Text Overflow"
          className={`p-1 flex items-center justify-center rounded transition-colors ${
            textSettings.textOverflow ? "bg-accent text-white" : "text-zinc-400 hover:bg-white/5"
          }`}
        >
          <TextOverflowIcon size={16} />
        </button>
      </div>

      {/* Rendering Mode */}
      <div className="flex items-center gap-2">
        <span title="Rendering Mode">
          <Highlighter size={16} className="text-zinc-500" />
        </span>
        <select
          value={textSettings.textRendering}
          onChange={(e) => updateToolSettings("text", { textRendering: e.target.value as any })}
          className="bg-zinc-800 border-none text-[0.75rem] text-white px-2 py-1 rounded outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="bilinear">Smooth</option>
          <option value="nearest">Pixel</option>
        </select>
      </div>

      {textSettings.isEditing && (
        <>
          <div className="w-[1px] h-4 bg-white/10" />
          <div className="flex items-center gap-1">
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
        </>
      )}
    </div>
  );
};
