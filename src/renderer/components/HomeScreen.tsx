import React, { useState } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import NewProjectModal from './NewProjectModal';

const HomeScreen: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="home-screen" style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#1a1a1a',
      color: '#eee',
      gap: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#cc6d29' }}>OpenCreate Forge</h2>
        <p style={{ color: '#888' }}>Modern Image Editor powered by React & Electron</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '2rem',
            background: '#252525',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '160px',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#cc6d29';
            e.currentTarget.style.transform = 'translateY(-5px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Plus size={32} color="#cc6d29" />
          <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>New Project</span>
        </button>

        <button 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '2rem',
            background: '#252525',
            border: '1px solid #333',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '160px',
            transition: 'transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#cc6d29';
            e.currentTarget.style.transform = 'translateY(-5px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <FolderOpen size={32} color="#cc6d29" />
          <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Open Project</span>
        </button>
      </div>

      <NewProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default HomeScreen;
