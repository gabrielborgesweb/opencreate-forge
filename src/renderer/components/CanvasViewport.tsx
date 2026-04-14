import React, { useEffect, useRef } from 'react';
import { useProjectStore } from '@store/projectStore';
import { ForgeEngine } from '@core/engine/ForgeEngine';

const CanvasViewport: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ForgeEngine | null>(null);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => 
    state.projects.find((p) => p.id === activeProjectId) || null
  );

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new ForgeEngine(canvasRef.current);
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.stopRenderLoop();
        engineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (engineRef.current && project) {
      engineRef.current.setProject(project);
    }
  }, [project]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.parentElement?.clientWidth || 800;
        canvasRef.current.height = canvasRef.current.parentElement?.clientHeight || 600;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="canvas-container" style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default CanvasViewport;
