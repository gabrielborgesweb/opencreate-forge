import React from 'react';
import { useProjectStore } from '@store/projectStore';
import LayerItem from './LayerItem';

const LayerList: React.FC = () => {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => 
    state.projects.find((p) => p.id === activeProjectId) || null
  );
  
  if (!project) return <div style={{ padding: '1rem', color: '#666' }}>No active project</div>;

  return (
    <div className="layer-list" style={{ flex: 1, overflowY: 'auto' }}>
      {project.layers.slice().reverse().map((layer) => (
        <LayerItem 
          key={layer.id} 
          layer={layer} 
          projectId={project.id}
          isActive={project.activeLayerId === layer.id}
        />
      ))}
    </div>
  );
};

export default LayerList;
