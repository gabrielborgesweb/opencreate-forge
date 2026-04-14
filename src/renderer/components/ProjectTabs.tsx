import React from 'react';
import { useProjectStore } from '@store/projectStore';
import { useUIStore } from '@store/uiStore';
import { Home, X } from 'lucide-react';

const ProjectTabs: React.FC = () => {
  const { projects, removeProject, setActiveProject } = useProjectStore();
  const { activeTab, setActiveTab } = useUIStore();

  const handleTabClick = (id: "home" | string) => {
    setActiveTab(id);
    if (id !== "home") {
      setActiveProject(id);
    }
  };

  const handleCloseTab = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    if (project.isDirty) {
      // @ts-expect-error - Electron API
      const result = await window.electronAPI.confirmClose(project.name);
      if (result === 2) return; // Cancel
      if (result === 0) {
        // TODO: Implement Save before closing
        console.log("Saving project before close...");
      }
    }
    
    removeProject(id);
    if (activeTab === id) {
      setActiveTab('home');
    }
  };

  return (
    <div className="project-tabs" style={{ 
      display: 'flex', 
      background: '#111', 
      height: '35px', 
      borderBottom: '1px solid #333',
      padding: '0 5px',
      alignItems: 'flex-end',
      overflowX: 'auto'
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
          gap: '8px',
          flexShrink: 0
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
            minWidth: '150px',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}{project.isDirty ? '*' : ''}.ocfd
          </span>
          <button 
            onClick={(e) => handleCloseTab(e, project.id)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'inherit', 
              display: 'flex', 
              padding: '2px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#444'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ProjectTabs;
