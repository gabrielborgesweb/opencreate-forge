import React from 'react';
import { useProjectStore, Layer } from '@store/projectStore';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';

interface LayerItemProps {
  layer: Layer;
  projectId: string;
  isActive: boolean;
}

const LayerItem: React.FC<LayerItemProps> = ({ layer, projectId, isActive }) => {
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
      className={`layer-item ${isActive ? 'active' : ''}`}
      onClick={() => setActiveLayer(projectId, layer.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.5rem',
        background: isActive ? '#333' : 'transparent',
        borderBottom: '1px solid #333',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <button 
        onClick={toggleVisibility}
        style={{ background: 'none', border: 'none', color: layer.visible ? '#eee' : '#666', cursor: 'pointer', display: 'flex' }}
      >
        {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      
      <div style={{ flex: 1, marginLeft: '0.5rem', fontSize: '0.85rem' }}>
        {layer.name}
      </div>

      <button 
        onClick={toggleLock}
        style={{ background: 'none', border: 'none', color: layer.locked ? '#ffcc00' : '#666', cursor: 'pointer', display: 'flex' }}
      >
        {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
      </button>
    </div>
  );
};

export default LayerItem;
