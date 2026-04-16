import React from "react";
import { useProjectStore, Layer } from "@store/projectStore";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";

interface LayerItemProps {
  layer: Layer;
  projectId: string;
  isActive: boolean;
}

const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  projectId,
  isActive,
}) => {
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const setActiveLayer = useProjectStore((state) => state.setActiveLayer);

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLayer(projectId, layer.id, { visible: !layer.visible });
  };

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLayer(projectId, layer.id, { locked: !layer.locked });
  };

  return (
    <div
      className={`flex items-center p-2 cursor-pointer select-none border-b border-bg-tertiary transition-colors ${
        isActive ? "bg-bg-tertiary" : "bg-transparent hover:bg-white/5"
      }`}
      onClick={() => setActiveLayer(projectId, layer.id)}
    >
      <button
        onClick={toggleVisibility}
        tabIndex={-1}
        className={`bg-none border-none cursor-pointer flex transition-colors ${
          layer.visible ? "text-[#eee]" : "text-[#666]"
        }`}
      >
        {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>

      <div className="flex-1 ml-2 text-[0.85rem]">{layer.name}</div>

      <button
        onClick={toggleLock}
        tabIndex={-1}
        className={`bg-none border-none cursor-pointer flex transition-colors ${
          layer.locked ? "text-[#ffcc00]" : "text-[#666]"
        }`}
      >
        {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
      </button>
    </div>
  );
};

export default LayerItem;
