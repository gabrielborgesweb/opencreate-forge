import React from 'react';
import { useProjectStore } from '@store/projectStore';
import LayerItem from './LayerItem';

const LayerList: React.FC = () => {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => 
    state.projects.find((p) => p.id === activeProjectId) || null
  );
  
  if (!project)
    return <div className="p-4 text-[#666]">No active project</div>;

  return (
    <div className="flex-1 overflow-y-auto">
      {project.layers
        .slice()
        .reverse()
        .map((layer) => (
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
