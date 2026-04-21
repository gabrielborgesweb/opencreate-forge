import React from "react";
import { useProjectStore } from "@store/projectStore";
import { RotateCcw, RotateCw } from "lucide-react";

interface HistoryPanelProps {
  projectId: string;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ projectId }) => {
  const project = useProjectStore((state) => state.projects.find((p) => p.id === projectId));
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);

  if (!project) return null;

  const history = [...project.undoStack, ...[...project.redoStack].reverse()];

  return (
    <div className="flex flex-col h-full bg-[#222]">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {history.map((entry, i) => {
          const isRedo = i >= project.undoStack.length;
          const isActive = i === project.undoStack.length - 1;

          return (
            <div
              key={i}
              className={`text-[0.85rem] py-1.5 px-4 cursor-default transition-colors border-accent ${
                isActive
                  ? "bg-bg-tertiary border-l text-text"
                  : isRedo
                    ? "text-[#666] hover:bg-white/5"
                    : "text-text hover:bg-white/5"
              }`}
            >
              {entry.description}
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-bg-tertiary flex justify-end gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => undo(projectId)}
            disabled={project.undoStack.length === 0}
            className="p-1.5 hover:bg-white/10 rounded transition-colors text-[#ccc] hover:text-white disabled:opacity-30"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => redo(projectId)}
            disabled={project.redoStack.length === 0}
            className="p-1.5 hover:bg-white/10 rounded transition-colors text-[#ccc] hover:text-white disabled:opacity-30"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
