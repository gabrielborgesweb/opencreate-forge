import React, { useState, useEffect, useRef } from "react";
import { useProjectStore, Project } from "@store/projectStore";
import { useUIStore } from "@store/uiStore";
import { X, Layout, Monitor, Printer, Grid3X3, Globe, Video, Image } from "lucide-react";

interface NewProjectProps {
  isOpen: boolean;
  onClose: () => void;
}

const presetsData = {
  Social: [
    { name: "Instagram Square", w: 1080, h: 1080, icon: Image },
    { name: "Instagram Story", w: 1080, h: 1920, icon: Image },
    { name: "Instagram Portrait", w: 1080, h: 1350, icon: Image },
    { name: "Facebook Page Cover", w: 1640, h: 664, icon: Globe },
    { name: "Facebook Event Image", w: 1920, h: 1080, icon: Globe },
    { name: "Facebook Group Header", w: 1640, h: 856, icon: Globe },
    { name: "YouTube Thumbnail", w: 1280, h: 720, icon: Video },
    { name: "YouTube Profile", w: 800, h: 800, icon: Video },
    { name: "YouTube Cover", w: 2560, h: 1440, icon: Video },
    { name: "Twitter Profile", w: 400, h: 400, icon: Globe },
    { name: "Twitter Header", w: 1500, h: 500, icon: Globe },
  ],
  Print: [
    { name: "A4 Paper", w: 2480, h: 3508, icon: Printer },
    { name: "A5 Paper", w: 1748, h: 2480, icon: Printer },
    { name: "Letter", w: 2550, h: 3300, icon: Printer },
  ],
  Screen: [
    { name: "HD Video", w: 1920, h: 1080, icon: Monitor },
    { name: "4K UHD", w: 3840, h: 2160, icon: Monitor },
    { name: "MacBook Pro 14", w: 3024, h: 1964, icon: Monitor },
  ],
  "2ᴺ": [
    { name: "16x16", w: 16, h: 16, icon: Grid3X3 },
    { name: "32x32", w: 32, h: 32, icon: Grid3X3 },
    { name: "64x64", w: 64, h: 64, icon: Grid3X3 },
    { name: "128x128", w: 128, h: 128, icon: Grid3X3 },
    { name: "256x256", w: 256, h: 256, icon: Grid3X3 },
    { name: "512x512", w: 512, h: 512, icon: Grid3X3 },
    { name: "1024x1024", w: 1024, h: 1024, icon: Grid3X3 },
  ],
};

const NewProject: React.FC<NewProjectProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState("Untitled");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [background, setBackground] = useState<"white" | "black" | "transparent">("white");
  const [activeCategory, setActiveCategory] = useState<keyof typeof presetsData>("Social");

  const addProject = useProjectStore((state) => state.addProject);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleCreate = React.useCallback(() => {
    const id = crypto.randomUUID();
    let dataUrl: string | undefined = undefined;

    if (background !== "transparent") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
        dataUrl = canvas.toDataURL("image/png");
      }
    }

    const newProject: Project = {
      id,
      name: name || "Untitled",
      width,
      height,
      layers: [
        {
          id: "bg-" + id,
          name: "Background",
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
      activeLayerId: "bg-" + id,
      selection: { hasSelection: false, bounds: null },
      zoom: 1,
      panX: 0,
      panY: 0,
      isDirty: false,
    };
    addProject(newProject);
    setActiveTab(id);
    onClose();
  }, [addProject, background, height, name, onClose, setActiveTab, width]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setName("Untitled");
        setWidth(1920);
        setHeight(1080);
        setBackground("white");
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const applyPreset = (w: number, h: number, n: string) => {
    setWidth(w);
    setHeight(h);
    setName(n);
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[1000]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="bg-[#252525] w-[900px] h-[600px] rounded-lg border border-border overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-1 border-b border-bg-tertiary flex justify-between items-center ">
          <h2 className="text-sm font-bold ml-1 flex items-center gap-2 text-text">
            <Layout size={16} className="text-accent" /> New Project
          </h2>
          <button
            onClick={onClose}
            className="bg-none border-none text-inherit flex p-1 rounded cursor-pointer hover:bg-white/10 transition-colors items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Categories & Presets */}
          <div className="w-[600px] border-r border-bg-tertiary flex flex-col bg-[#1e1e1e]">
            {/* Categories Tabs */}
            <div className="flex border-b border-bg-tertiary">
              {(Object.keys(presetsData) as Array<keyof typeof presetsData>).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 text-xs font-bold uppercase transition-all ${
                    activeCategory === cat
                      ? "text-accent border-b-2 border-accent bg-bg-tertiary/50"
                      : "text-[#666] hover:text-[#999] hover:bg-bg-tertiary/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Presets Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid grid-cols-3 gap-3">
                {presetsData[activeCategory].map((p) => {
                  const maxDim = Math.max(p.w, p.h);
                  const scale = (80 / maxDim) * 0.9;
                  const pw = p.w * scale;
                  const ph = p.h * scale;

                  return (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(p.w, p.h, p.name)}
                      onDoubleClick={() => {
                        applyPreset(p.w, p.h, p.name);
                        handleCreate();
                      }}
                      className={`group flex flex-col items-center p-3 rounded border transition-all text-center outline-none bg-bg-secondary ${
                        width === p.w && height === p.h
                          ? "border-accent"
                          : "border-bg-tertiary hover:border-[#555]"
                      }`}
                    >
                      <div className="w-full h-[90px] bg-[#1a1a1a] rounded flex items-center justify-center mb-3">
                        <div
                          className="bg-[#333] border border-[#444] shadow-sm"
                          style={{ width: `${pw}px`, height: `${ph}px` }}
                        />
                      </div>

                      <div className="w-full">
                        <div className="font-bold text-[0.7rem] truncate text-[#ccc] mb-1">
                          {p.name}
                        </div>
                        <div className="text-[0.65rem] text-[#666]">
                          {p.w} x {p.h} px
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Project Details */}
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div className="space-y-5">
              {/* <h3 className="text-[0.65rem] font-bold text-[#666] uppercase tracking-wider">
                Properties
              </h3> */}

              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] text-[#999]">Project Name</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    minLength={1}
                    maxLength={50}
                    placeholder="Untitled"
                    onChange={(e) => setName(e.target.value)}
                    className="bg-bg-primary border border-border text-text p-2 rounded text-sm outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.75rem] text-[#999]">Width (px)</label>
                    <input
                      type="number"
                      value={width}
                      min={1}
                      max={10000}
                      onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                      className="bg-bg-primary border border-border text-text p-2 rounded text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.75rem] text-[#999]">Height (px)</label>
                    <input
                      type="number"
                      value={height}
                      min={1}
                      max={10000}
                      onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                      className="bg-bg-primary border border-border text-text p-2 rounded text-sm outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] text-[#999]">Background</label>
                  <div className="flex gap-2">
                    {(["white", "black", "transparent"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setBackground(type)}
                        title={type.charAt(0).toUpperCase() + type.slice(1)}
                        className={`group relative w-8 h-8 rounded-full border-2 transition-all outline-none flex items-center justify-center ${
                          background === type
                            ? "border-accent"
                            : "border-white/5 hover:border-white/20"
                        }`}
                      >
                        {/* Swatch Color */}
                        <div
                          className={`w-full h-full rounded-full overflow-hidden ${
                            type === "white"
                              ? "bg-white"
                              : type === "black"
                                ? "bg-black"
                                : "bg-transparent"
                          }`}
                          style={
                            type === "transparent"
                              ? {
                                  backgroundImage: `
                              linear-gradient(45deg, #333 25%, transparent 25%), 
                              linear-gradient(-45deg, #333 25%, transparent 25%), 
                              linear-gradient(45deg, transparent 75%, #333 75%), 
                              linear-gradient(-45deg, transparent 75%, #333 75%)
                            `,
                                  backgroundSize: "8px 8px",
                                  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                                  backgroundColor: "#1a1a1a",
                                }
                              : {}
                          }
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="mt-6 p-3 bg-accent text-white border-none rounded font-bold hover:brightness-110 transition-all text-sm"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProject;
