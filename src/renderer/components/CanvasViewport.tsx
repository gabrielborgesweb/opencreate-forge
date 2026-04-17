import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@store/projectStore';
import { useUIStore } from '@store/uiStore';
import { ForgeEngine } from '@core/engine/ForgeEngine';

const CanvasViewport: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ForgeEngine | null>(null);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const project = useProjectStore((state) => 
    state.projects.find((p) => p.id === activeProjectId) || null
  );

  const showToast = useUIStore((state) => state.showToast);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (!activeProjectId || !project) return;

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            // Coordenadas do centro da tela (viewport)
            const viewportWidth = canvasRef.current?.width || 0;
            const viewportHeight = canvasRef.current?.height || 0;

            // Converte o centro da tela para coordenadas dentro do projeto
            // levando em conta o zoom e o pan atual
            const projCenterX = (viewportWidth / 2 - project.panX) / project.zoom;
            const projCenterY = (viewportHeight / 2 - project.panY) / project.zoom;

            // Posiciona a imagem centralizada nesse ponto do projeto
            const x = Math.round(projCenterX - (img.naturalWidth / 2));
            const y = Math.round(projCenterY - (img.naturalHeight / 2));

            useProjectStore.getState().addLayer(activeProjectId, {
              name: file.name.replace(/\.[^/.]+$/, ""),
              type: 'raster',
              data: dataUrl,
              width: img.naturalWidth,
              height: img.naturalHeight,
              x: x,
              y: y,
              visible: true,
              opacity: 100,
            });
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      } else {
        showToast(`File "<b>${file.name}</b>" is not supported.`, 'error');
      }
    }
  };

  return (
    <div 
      className={`flex-1 relative overflow-hidden bg-[#111] transition-colors duration-200 ${
        isDraggingOver ? 'ring-2 ring-blue-500 ring-inset bg-[#1a1a1a]' : ''
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default CanvasViewport;
