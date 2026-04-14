// renderer/engineHistory.js

/** Salva o estado atual na pilha de "desfazer" */
export function saveState(context) {
  const {
    layers,
    activeLayer,
    hasSelection,
    selectionCanvas,
    selectionBounds,
    undoStack,
    redoStack,
    projectWidth,
    projectHeight,
    MAX_HISTORY,
  } = context;

  const state = {
    projectWidth: projectWidth,
    projectHeight: projectHeight,
    // Verifica o tipo da camada antes de tentar acessar image.src
    layers: layers.map((l) => {
      if (l.type === "text") {
        // Camadas de texto: salvamos o objeto como está (sem image.src)
        return { ...l, image: null };
      } else {
        // Camadas Raster: salvamos o base64 da imagem
        return { ...l, image: l.image ? l.image.src : null };
      }
    }),
    activeLayer: activeLayer ? activeLayer.id : null,
    hasSelection: hasSelection,
    selectionDataURL: hasSelection ? selectionCanvas.toDataURL() : null,
    selectionBounds: hasSelection ? { ...selectionBounds } : null,
  };
  console.log("Saving state for undo:", state);

  undoStack.push(state);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

/** Restaura um estado salvo */
export function restoreState(context, state) {
  // Restaura dimensões do projeto
  context.projectWidth = state.projectWidth;
  context.projectHeight = state.projectHeight;
  if (context.selectionCanvas) {
    // Atualiza o tamanho do canvas de seleção para o tamanho do projeto
    context.selectionCanvas.width = context.projectWidth;
    context.selectionCanvas.height = context.projectHeight;
  }

  // Recria as camadas (carregando imagens APENAS se necessário)
  const promises = state.layers.map(
    (l) =>
      new Promise((resolve) => {
        if (l.type === "text") {
          // Se for TEXTO, não precisa carregar imagem. Resolve imediatamente.
          // Precisamos garantir que a propriedade image continue null no objeto vivo
          resolve({
            ...l,
            image: null,
          });
        } else {
          // Se for RASTER, carrega a imagem
          const img = new Image();
          img.onload = () => {
            resolve({
              ...l,
              image: img,
            });
          };
          // Tratamento de erro caso a imagem esteja corrompida ou vazia
          img.onerror = () => {
            console.warn(
              "Falha ao carregar imagem do histórico para a camada:",
              l.name
            );
            resolve({ ...l, image: null });
          };

          if (l.image) {
            img.src = l.image;
          } else {
            // Se não tiver source (ex: camada vazia antiga), resolve direto
            resolve({ ...l, image: null });
          }
        }
      })
  );

  Promise.all(promises).then((loadedLayers) => {
    context.layers = loadedLayers;
    context.activeLayer = state.activeLayer
      ? context.layers.find((l) => l.id === state.activeLayer)
      : null;

    // Notifica a UI de camadas (em app.js)
    if (typeof window.Engine.updateLayersPanel === "function") {
      window.Engine.updateLayersPanel();
    }

    context.selectionBounds = state.selectionBounds
      ? { ...state.selectionBounds }
      : null;

    if (
      state.hasSelection &&
      state.selectionDataURL &&
      context.selectionBounds
    ) {
      const img = new Image();
      img.onload = () => {
        context.selectionCanvas.width = context.selectionBounds.width;
        context.selectionCanvas.height = context.selectionBounds.height;
        context.selectionCtx.drawImage(img, 0, 0);
        context.hasSelection = true;
        context.cacheSelectionEdges();
        context.startAnimation();
        context.draw();
      };
      img.src = state.selectionDataURL;
    } else {
      context.clearSelection();
    }

    context.draw();
  });
}

/** Executa a ação "desfazer" */
export function undo(context) {
  if (context.undoStack.length <= 1) return;
  const prevState = context.undoStack.pop();
  context.redoStack.push(prevState);
  const newState = context.undoStack[context.undoStack.length - 1];
  restoreState(context, newState);
  context.draw();
}

/** Executa a ação "refazer" */
export function redo(context) {
  if (context.redoStack.length === 0) return;
  const nextState = context.redoStack.pop();
  context.undoStack.push(nextState);
  restoreState(context, nextState);
  context.draw();
}
