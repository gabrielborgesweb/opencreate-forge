/**
 * Purpose: Sidebar component that displays the stack of layers for the active project, providing controls for adding, deleting, and reordering layers.
 */
import React from "react";
import { useProjectStore } from "@store/projectStore";
import LayerItem from "./LayerItem";
import { Plus, Trash2, Copy } from "lucide-react";

const LayerList: React.FC = () => {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore(
    (state) => state.projects.find((p) => p.id === activeProjectId) || null,
  );
  const addLayer = useProjectStore((state) => state.addLayer);
  const removeLayer = useProjectStore((state) => state.removeLayer);
  const duplicateLayer = useProjectStore((state) => state.duplicateLayer);
  const moveLayer = useProjectStore((state) => state.moveLayer);

  if (!project) return <div className="p-4 text-[#666]">No active project</div>;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (fromIndex !== toIndex) {
      moveLayer(project.id, fromIndex, toIndex);
    }
  };

  const handleAddNewLayer = () => {
    addLayer(project.id, {
      type: "raster",
      name: `Layer ${project.layers.length + 1}`,
    });
  };

  const handleDeleteActiveLayer = () => {
    if (project.activeLayerId) {
      removeLayer(project.id, project.activeLayerId);
    }
  };

  const handleDuplicateActiveLayer = () => {
    if (project.activeLayerId) {
      duplicateLayer(project.id, project.activeLayerId);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {project.layers
          .slice()
          .reverse()
          .map((layer, index) => {
            // Note: because we are reversing for display, we need to map the index back
            const actualIndex = project.layers.length - 1 - index;
            return (
              <LayerItem
                key={layer.id}
                layer={layer}
                projectId={project.id}
                isActive={project.activeLayerId === layer.id}
                index={actualIndex}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            );
          })}
      </div>

      {/* Layer Actions Footer */}
      <div className="p-2 border-t border-bg-tertiary flex justify-end gap-2">
        <button
          onClick={handleAddNewLayer}
          className="p-1.5 hover:bg-white/10 rounded transition-colors text-[#ccc] hover:text-white"
          title="New Layer"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={handleDuplicateActiveLayer}
          disabled={!project.activeLayerId}
          className="p-1.5 hover:bg-white/10 rounded transition-colors text-[#ccc] hover:text-white disabled:opacity-30"
          title="Duplicate Layer"
        >
          <Copy size={16} />
        </button>
        <button
          onClick={handleDeleteActiveLayer}
          disabled={!project.activeLayerId || project.layers.length <= 1}
          className="p-1.5 hover:bg-white/10 rounded transition-colors text-[#ccc] hover:text-red-400 disabled:opacity-30"
          title="Delete Layer"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default LayerList;
