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
    layers: layers.map((l) => ({ ...l, image: l.image.src })),
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

  const promises = state.layers.map(
    (l) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...l, image: img });
        img.src = l.image;
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
