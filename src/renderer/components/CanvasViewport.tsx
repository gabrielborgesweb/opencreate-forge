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

  // 1. Inicializa o Engine apenas uma vez
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      // Garantir tamanho inicial correto antes de criar o engine
      const parent = canvasRef.current.parentElement;
      if (parent) {
        canvasRef.current.width = parent.clientWidth;
        canvasRef.current.height = parent.clientHeight;
      }

      engineRef.current = new ForgeEngine(canvasRef.current, (zoom, x, y) => {
        const id = useProjectStore.getState().activeProjectId;
        if (id) {
          // Atualiza a store APENAS quando o zoom/pan muda via interação
          useProjectStore.getState().updateProject(id, { 
            zoom, 
            panX: x, 
            panY: y,
            isDirty: false 
          });
        }
      });
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.stopRenderLoop();
        engineRef.current = null;
      }
    };
  }, []);

  // 2. Sincroniza o projeto ativo com o engine
  useEffect(() => {
    if (engineRef.current && project) {
      engineRef.current.setProject(project);
    }
  }, [project]);

  // 3. Centralização inicial (Fit to Screen) - APENAS NA PRIMEIRA VEZ por projeto
  const centeredProjectsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (engineRef.current && project && !centeredProjectsRef.current.has(project.id)) {
      // Se o projeto foi recém-criado (está no estado padrão 1:1 e 0:0) ou simplesmente ainda não foi centralizado nesta sessão
      if (project.zoom === 1 && project.panX === 0 && project.panY === 0) {
        engineRef.current.fitToScreen();
        centeredProjectsRef.current.add(project.id);
      } else {
        // Se já tem valores (ex: projeto carregado), marcamos como já centralizado para não forçar
        centeredProjectsRef.current.add(project.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]); // Apenas quando mudar o projeto, não quando mudar o zoom

  // 4. Handle window resize (SEM fitToScreen forçado)
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && engineRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    // Garantir que o primeiro resize ocorra antes de qualquer lógica de posicionamento
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex-1 relative overflow-hidden bg-[#111]">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default CanvasViewport;
