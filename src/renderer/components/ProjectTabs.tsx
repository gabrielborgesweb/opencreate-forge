import React from 'react';
import { useProjectStore } from '@store/projectStore';
import { useUIStore } from '@store/uiStore';
import { Home, X } from 'lucide-react';

const ProjectTabs: React.FC = () => {
  const { projects } = useProjectStore();
  const { activeTab, setActiveTab } = useUIStore();
  const setActiveProject = useProjectStore((state) => state.setActiveProject);

  const handleTabClick = (id: 'home' | string) => {
    setActiveTab(id);
    if (id !== 'home') {
      setActiveProject(id);
    }
  };

  return (
    <div className="project-tabs" style={{ 
      display: 'flex', 
      background: '#111', 
      height: '35px', 
      borderBottom: '1px solid #333',
      padding: '0 5px',
      alignItems: 'flex-end'
    }}>
      <button 
        onClick={() => handleTabClick('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 15px',
          height: '30px',
          border: 'none',
          background: activeTab === 'home' ? '#222' : 'transparent',
          color: activeTab === 'home' ? '#eee' : '#666',
          borderTopLeftRadius: '4px',
          borderTopRightRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.8rem',
          gap: '8px'
        }}
      >
        <Home size={14} />
        Home
      </button>

      {projects.map((project) => (
        <div 
          key={project.id}
          onClick={() => handleTabClick(project.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            height: '30px',
            background: activeTab === project.id ? '#1a1a1a' : 'transparent',
            color: activeTab === project.id ? '#eee' : '#666',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            gap: '8px',
            borderRight: '1px solid #222',
            minWidth: '120px',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}.ocfd
          </span>
          <X size={12} className="close-tab" style={{ cursor: 'pointer', opacity: 0.5 }} />
        </div>
      ))}
    </div>
  );
};

export default ProjectTabs;
