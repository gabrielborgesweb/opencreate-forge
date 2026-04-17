import React, { useState, useRef, useEffect } from "react";
import { useProjectStore, Layer } from "@store/projectStore";
import { useUIStore } from "@store/uiStore";
import { getOptimizedBoundingBox } from "@/core/utils/imageUtils";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  // Trash2,
  // Copy
} from "lucide-react";

interface LayerItemProps {
  layer: Layer;
  projectId: string;
  isActive: boolean;
  index: number;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  projectId,
  isActive,
  index,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const setActiveLayer = useProjectStore((state) => state.setActiveLayer);
  const updateProject = useProjectStore((state) => state.updateProject);
  const showToast = useUIStore((state) => state.showToast);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLayer(projectId, layer.id, { visible: !layer.visible });
  };

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLayer(projectId, layer.id, { locked: !layer.locked });
  };

  const handleThumbnailClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      if (!layer.data) {
        showToast("Layer is empty", "warning");
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = layer.width;
        canvas.height = layer.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);

        const bounds = getOptimizedBoundingBox(canvas, {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        });

        if (!bounds) {
          showToast("Layer is empty", "warning");
          return;
        }

        // Create mask (white on black)
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = bounds.width;
        maskCanvas.height = bounds.height;
        const mctx = maskCanvas.getContext("2d")!;
        
        mctx.drawImage(
          canvas,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          0,
          0,
          bounds.width,
          bounds.height
        );
        mctx.globalCompositeOperation = "source-in";
        mctx.fillStyle = "white";
        mctx.fillRect(0, 0, bounds.width, bounds.height);

        updateProject(projectId, {
          selection: {
            hasSelection: true,
            bounds: {
              x: layer.x + bounds.x,
              y: layer.y + bounds.y,
              width: bounds.width,
              height: bounds.height,
            },
            mask: maskCanvas.toDataURL(),
          },
        });
      };
      img.src = layer.data;
    }
  };

  const handleRename = () => {
    if (editName.trim() && editName !== layer.name) {
      updateLayer(projectId, layer.id, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRename();
    if (e.key === "Escape") {
      setEditName(layer.name);
      setIsEditing(false);
    }
  };

  // const handleDelete = (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   removeLayer(projectId, layer.id);
  // };

  // const handleDuplicate = (e: React.MouseEvent) => {
  //   e.stopPropagation();
  //   duplicateLayer(projectId, layer.id);
  // };

  return (
    <div
      className={`group flex items-center p-2 cursor-pointer select-none border-b border-bg-tertiary transition-colors ${
        isActive ? "bg-bg-tertiary" : "bg-transparent hover:bg-white/5"
      } ${!layer.visible ? "opacity-60" : ""} ${
        isDragOver ? "border-t-2 border-t-accent" : ""
      }`}
      onClick={() => setActiveLayer(projectId, layer.id)}
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => {
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onDrop(e, index);
      }}
    >
      <button
        onClick={toggleVisibility}
        tabIndex={-1}
        className={`bg-none border-none cursor-pointer flex transition-colors mr-2 ${
          layer.visible ? "text-[#eee]" : "text-[#666]"
        }`}
      >
        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>

      {/* Thumbnail */}
      <div
        className={`w-6 h-6 bg-[#333] rounded border flex items-center justify-center overflow-hidden mr-2 shrink-0 transition-colors ${isActive ? "border-accent" : "border-white/10"}`}
        onClick={handleThumbnailClick}
      >
        {layer.data ? (
          <img
            src={layer.data}
            alt=""
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="text-[0.6rem] text-[#555] pointer-events-none">
            {layer.type[0].toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            className="w-full bg-transparent text-[#eee] text-[0.85rem] px-1 rounded outline-none -m-1 selection:bg-accent"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="text-[0.85rem] truncate"
            onDoubleClick={() => setIsEditing(true)}
          >
            {layer.name}
          </div>
        )}
      </div>

      <div
        className={`flex items-center gap-1 ${!layer.locked ? "opacity-0" : ""} group-hover:opacity-100 transition-opacity ml-1`}
      >
        {/* <button
          onClick={handleDuplicate}
          title="Duplicate Layer"
          className="p-1 hover:text-accent text-[#666] transition-colors"
        >
          <Copy size={12} />
        </button> */}
        {/* <button
          onClick={handleDelete}
          title="Delete Layer"
          className="p-1 hover:text-red-400 text-[#666] transition-colors"
        >
          <Trash2 size={12} />
        </button> */}
        <button
          onClick={toggleLock}
          tabIndex={-1}
          className={`p-1 transition-colors ${
            layer.locked ? "text-[#ffcc00]" : "text-[#666] hover:text-[#eee]"
          }`}
        >
          {layer.locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
      </div>
    </div>
  );
};

export default LayerItem;
