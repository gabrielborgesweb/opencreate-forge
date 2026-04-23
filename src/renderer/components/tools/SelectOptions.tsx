import React from "react";
import {
  MousePointer2,
  SquaresUnite,
  SquaresSubtract,
  SquaresIntersect,
  Square,
  Circle,
} from "lucide-react";
import { useToolStore } from "@/renderer/store/toolStore";

export const SelectOptions: React.FC = () => {
  const toolSettings = useToolStore((state) => state.toolSettings);
  const updateToolSettings = useToolStore((state) => state.updateToolSettings);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label className="text-[0.75rem] text-[#999] font-medium">Mode</label>
        <div className="flex items-center bg-black/20 rounded p-0.5">
          <button
            onClick={() => updateToolSettings("select", { mode: "replace" })}
            tabIndex={-1}
            className={`p-1 rounded ${
              toolSettings.select.mode === "replace"
                ? "bg-accent text-white shadow-sm"
                : "text-[#999] hover:text-white"
            } transition-all`}
            title="New Selection"
          >
            <MousePointer2 size={16} />
          </button>
          <button
            onClick={() => updateToolSettings("select", { mode: "unite" })}
            tabIndex={-1}
            className={`p-1 rounded ${
              toolSettings.select.mode === "unite"
                ? "bg-accent text-white shadow-sm"
                : "text-[#999] hover:text-white"
            } transition-all`}
            title="Unite (Shift)"
          >
            <SquaresUnite size={16} />
          </button>
          <button
            onClick={() => updateToolSettings("select", { mode: "subtract" })}
            tabIndex={-1}
            className={`p-1 rounded ${
              toolSettings.select.mode === "subtract"
                ? "bg-accent text-white shadow-sm"
                : "text-[#999] hover:text-white"
            } transition-all`}
            title="Subtract (Alt)"
          >
            <SquaresSubtract size={16} />
          </button>
          <button
            onClick={() => updateToolSettings("select", { mode: "intersect" })}
            tabIndex={-1}
            className={`p-1 rounded ${
              toolSettings.select.mode === "intersect"
                ? "bg-accent text-white shadow-sm"
                : "text-[#999] hover:text-white"
            } transition-all`}
            title="Intersect (Shift+Alt)"
          >
            <SquaresIntersect size={16} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[0.75rem] text-[#999] font-medium">Shape</label>
        <div className="flex items-center bg-black/20 rounded p-0.5">
          <button
            onClick={() => updateToolSettings("select", { shape: "rectangle" })}
            tabIndex={-1}
            className={`p-1 rounded ${
              toolSettings.select.shape === "rectangle"
                ? "bg-accent text-white shadow-sm"
                : "text-[#999] hover:text-white"
            } transition-all`}
            title="Rectangular Marquee"
          >
            <Square size={16} />
          </button>
          <button
            onClick={() => updateToolSettings("select", { shape: "ellipse" })}
            tabIndex={-1}
            className={`p-1 rounded ${
              toolSettings.select.shape === "ellipse"
                ? "bg-accent text-white shadow-sm"
                : "text-[#999] hover:text-white"
            } transition-all`}
            title="Elliptical Marquee"
          >
            <Circle size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
