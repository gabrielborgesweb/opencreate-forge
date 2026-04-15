import React, { useState } from 'react';
import { useProjectStore, Project } from '@store/projectStore';
import { useUIStore } from '@store/uiStore';
import { X, Layout, Monitor, FileCode, FileImage, Printer } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const presets = [
  { name: 'Instagram', w: 1080, h: 1080, icon: FileImage, category: 'Social' },
  { name: 'HD Video', w: 1920, h: 1080, icon: Monitor, category: 'Video' },
  { name: 'A4 Print', w: 2480, h: 3508, icon: Printer, category: 'Print' },
  { name: 'Facebook Cover', w: 1640, h: 664, icon: FileCode, category: 'Social' },
];

const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('Untitled');
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  
  const addProject = useProjectStore((state) => state.addProject);
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  if (!isOpen) return null;

  const handleCreate = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const newProject: Project = {
      id,
      name,
      width,
      height,
      layers: [
        {
          id: 'bg-' + id,
          name: 'Background',
          type: 'raster',
          visible: true,
          locked: false,
          opacity: 100,
          x: 0,
          y: 0,
          width,
          height,
          blendMode: 'source-over',
        }
      ],
      activeLayerId: 'bg-' + id,
      zoom: 1, // Será ajustado pelo engine no carregamento
      panX: 0,
      panY: 0,
      isDirty: false
    };
    addProject(newProject);
    setActiveTab(id);
    onClose();
  };

  const applyPreset = (w: number, h: number, n: string) => {
    setWidth(w);
    setHeight(h);
    setName(n);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]">
      <div className="bg-[#252525] w-[650px] rounded-lg border border-border overflow-hidden flex flex-col">
        <div className="p-4 border-b border-bg-tertiary flex justify-between items-center bg-bg-secondary">
          <h2 className="text-base m-0 flex items-center gap-2">
            <Layout size={18} className="text-accent" /> New Project
          </h2>
          <button
            onClick={onClose}
            className="bg-none border-none text-[#666] cursor-pointer hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1">
          {/* Presets */}
          <div className="w-[250px] border-r border-bg-tertiary p-4 bg-[#222]">
            <h3 className="text-[0.75rem] text-[#666] mb-4 uppercase font-bold">
              Presets
            </h3>
            <div className="flex flex-col gap-2">
              {presets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p.w, p.h, p.name)}
                  className="flex items-center gap-3 p-2 bg-bg-secondary border border-bg-tertiary rounded cursor-pointer text-left text-[0.8rem] text-[#eee] transition-colors hover:border-accent"
                >
                  <p.icon size={16} className="text-[#888]" />
                  <div className="flex-1">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[0.7rem] text-[#666]">
                      {p.w} x {p.h} px
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8rem] text-[#888]">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-bg-primary border border-border text-[#eee] p-2 rounded outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-[0.8rem] text-[#888]">Width (px)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value))}
                  className="bg-bg-primary border border-border text-[#eee] p-2 rounded outline-none focus:border-accent"
                />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-[0.8rem] text-[#888]">Height (px)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value))}
                  className="bg-bg-primary border border-border text-[#eee] p-2 rounded outline-none focus:border-accent"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="mt-4 p-3 bg-accent text-white border-none rounded cursor-pointer font-bold hover:brightness-110 transition-all"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;
