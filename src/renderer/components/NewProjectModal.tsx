import React, { useState, useEffect, useRef } from 'react';
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
  const [background, setBackground] = useState<'white' | 'black' | 'transparent'>('white');
  
  const addProject = useProjectStore((state) => state.addProject);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state and focus
      setName('Untitled');
      setWidth(1080);
      setHeight(1080);
      setBackground('white');
      
      // Small timeout to ensure the modal is rendered before focusing
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Focus Trap Logic
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) { // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else { // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreate = () => {
    const id = Math.random().toString(36).substr(2, 9);
    
    let dataUrl: string | undefined = undefined;
    
    if (background !== 'transparent') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
        dataUrl = canvas.toDataURL('image/png');
      }
    }

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
          data: dataUrl,
          blendMode: 'source-over',
        }
      ],
      activeLayerId: 'bg-' + id,
      selection: { hasSelection: false, bounds: null },
      zoom: 1,
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div 
        ref={modalRef}
        className="bg-[#252525] w-[650px] rounded-lg border border-border overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-bg-tertiary flex justify-between items-center bg-bg-secondary">
          <h2 className="text-base m-0 flex items-center gap-2">
            <Layout size={18} className="text-accent" /> New Project
          </h2>
          <button
            onClick={onClose}
            className="bg-none border-none text-[#666] cursor-pointer hover:text-white transition-colors p-1 rounded focus:ring-2 focus:ring-accent outline-none"
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
                  className="flex items-center gap-3 p-2 bg-bg-secondary border border-bg-tertiary rounded cursor-pointer text-left text-[0.8rem] text-[#eee] transition-colors hover:border-accent focus:ring-2 focus:ring-accent outline-none"
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
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="bg-bg-primary border border-border text-[#eee] p-2 rounded outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-[0.8rem] text-[#888]">Width (px)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="bg-bg-primary border border-border text-[#eee] p-2 rounded outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-[0.8rem] text-[#888]">Height (px)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="bg-bg-primary border border-border text-[#eee] p-2 rounded outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[0.8rem] text-[#888]">Background</label>
              <div className="flex gap-2">
                {(['white', 'black', 'transparent'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBackground(type)}
                    className={`flex-1 p-2 rounded border text-[0.8rem] capitalize transition-all outline-none focus:ring-2 focus:ring-accent ${
                      background === type 
                        ? 'bg-accent border-accent text-white' 
                        : 'bg-bg-primary border-border text-[#888] hover:border-[#666]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              className="mt-4 p-3 bg-accent text-white border-none rounded cursor-pointer font-bold hover:brightness-110 transition-all focus:ring-2 focus:ring-accent outline-none"
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
