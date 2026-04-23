import React, { useState, useEffect, useCallback } from "react";
// import { Plus, FolderOpen } from "lucide-react";
import { useProjectStore, Project } from "@store/projectStore";
import { useUIStore } from "@store/uiStore";
import { ShortcutSpan } from "./ui/Global";

const HomeScreen: React.FC = () => {
  const addProject = useProjectStore((state) => state.addProject);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // const handleNewProjectClick = () => {
  //   window.dispatchEvent(new CustomEvent("forge:new-project"));
  // };

  const handleCreateFromImage = useCallback(
    (dataUrl: string, width: number, height: number, name: string) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newProject: Project = {
        id,
        name,
        width,
        height,
        layers: [
          {
            id: "layer-" + id,
            name: "Layer 1",
            type: "raster",
            visible: true,
            locked: false,
            opacity: 100,
            x: 0,
            y: 0,
            width,
            height,
            data: dataUrl,
            blendMode: "source-over",
          },
        ],
        activeLayerId: "layer-" + id,
        selection: { hasSelection: false, bounds: null },
        zoom: 1,
        panX: 0,
        panY: 0,
        isDirty: false,
        undoStack: [{ description: "New Project", state: {} as any }],
        redoStack: [],
      };

      addProject(newProject);
      setActiveTab(id);
    },
    [addProject, setActiveTab],
  );

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const img = new Image();
            img.onload = () => {
              handleCreateFromImage(dataUrl, img.naturalWidth, img.naturalHeight, "Pasted Image");
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleCreateFromImage]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            handleCreateFromImage(
              dataUrl,
              img.naturalWidth,
              img.naturalHeight,
              file.name.replace(/\.[^/.]+$/, ""),
            );
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        break; // Just create one project for the first image
      }
    }
  };

  const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center bg-bg-primary text-text gap-8 ${
        isDraggingOver
          ? "ring-2 ring-accent ring-inset relative after:absolute after:inset-0 after:bg-accent after:opacity-[20%]"
          : ""
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center gap-2 flex flex-col">
        <h1 className="text-[2rem] mb-2 font-bold text-text">
          OpenCreate <span className="text-accent">Forge</span>
        </h1>
        <p className="mb-2">Image Editor powered by React & Electron</p>

        <div className="flex flex-col gap-3">
          <p className="flex items-center justify-center gap-1">
            <ShortcutSpan shortcut={"Ctrl+N"} macos={isMacOS} />
            <span className="ml-1">to create a new project</span>
          </p>

          <p className="flex items-center justify-center gap-1">
            <ShortcutSpan shortcut={"Ctrl+O"} macos={isMacOS} />
            <span className="ml-1">to open an existing project</span>
          </p>
        </div>
      </div>

      {/* <div className="flex gap-6">
        <button
          onClick={handleNewProjectClick}
          className="flex flex-col items-center gap-4 p-8 bg-[#252525] border border-bg-tertiary rounded-lg cursor-pointer w-40 transition-all hover:border-accent hover:-translate-y-1"
        >
          <Plus size={32} className="text-accent" />
          <span className="text-[0.9rem] font-medium">New Project</span>
        </button>

        <button className="flex flex-col items-center gap-4 p-8 bg-[#252525] border border-bg-tertiary rounded-lg cursor-pointer w-40 transition-all hover:border-accent hover:-translate-y-1">
          <FolderOpen size={32} className="text-accent" />
          <span className="text-[0.9rem] font-medium">Open Project</span>
        </button>
      </div> */}
    </div>
  );
};

export default HomeScreen;
