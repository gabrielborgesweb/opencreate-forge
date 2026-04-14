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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#252525', width: '650px', borderRadius: '8px', border: '1px solid #444',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a2a2a' }}>
          <h2 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layout size={18} color="#cc6d29" /> New Project
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1 }}>
          {/* Presets */}
          <div style={{ width: '250px', borderRight: '1px solid #333', padding: '1rem', background: '#222' }}>
            <h3 style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem', textTransform: 'uppercase' }}>Presets</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {presets.map(p => (
                <button 
                  key={p.name}
                  onClick={() => applyPreset(p.w, p.h, p.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem',
                    background: '#2a2a2a', border: '1px solid #333', borderRadius: '4px',
                    color: '#eee', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cc6d29'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                  <p.icon size={16} color="#888" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>{p.w} x {p.h} px</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#888' }}>Project Name</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#eee', padding: '0.6rem', borderRadius: '4px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#888' }}>Width (px)</label>
                <input 
                  type="number" value={width} onChange={e => setWidth(parseInt(e.target.value))}
                  style={{ background: '#1a1a1a', border: '1px solid #444', color: '#eee', padding: '0.6rem', borderRadius: '4px', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#888' }}>Height (px)</label>
                <input 
                  type="number" value={height} onChange={e => setHeight(parseInt(e.target.value))}
                  style={{ background: '#1a1a1a', border: '1px solid #444', color: '#eee', padding: '0.6rem', borderRadius: '4px', outline: 'none' }}
                />
              </div>
            </div>

            <button 
              onClick={handleCreate}
              style={{
                marginTop: '1rem', padding: '0.8rem', background: '#cc6d29', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
              }}
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
