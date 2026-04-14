// renderer/engineProject.js

/** Ajusta o canvas do viewport para preencher o container */
export function resizeViewport(context) {
  const { canvas, container, originX, originY } = context;
  const oldW = canvas.width || 0;
  const oldH = canvas.height || 0;

  canvas.width = container.clientWidth;
  canvas.height =
    container.clientHeight -
    document.getElementById("projectsTabs").clientHeight;

  context.originX += (canvas.width - oldW) / 2;
  context.originY += (canvas.height - oldH) / 2;

  context.draw();
}

/** Cria um novo projeto em branco */
export function createNewProject(context, w, h) {
  context.projectWidth = Math.max(1, Math.floor(w));
  context.projectHeight = Math.max(1, Math.floor(h));

  if (!context.selectionCanvas) {
    context.selectionCanvas = document.createElement("canvas");
    context.selectionCtx = context.selectionCanvas.getContext("2d", {
      willReadFrequently: true,
    });
  }
  context.selectionCanvas.width = context.projectWidth;
  context.selectionCanvas.height = context.projectHeight;

  context.layers = [];
  context.activeLayer = null;
  context.clearSelection();
  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }

  // resizeViewport(context);
  context.fitToScreen();
  context.draw();
  context.saveState();
  console.log(`Novo projeto: ${context.projectWidth}x${context.projectHeight}`);
}

/** Centraliza e ajusta o zoom do projeto para caber na tela */
export function fitToScreen(context) {
  const { projectWidth, projectHeight, canvas } = context;
  if (!projectWidth || !projectHeight) return;

  const viewW = canvas.width;
  const viewH = canvas.height;

  const scaleX = viewW / projectWidth;
  const scaleY = viewH / projectHeight;
  context.scale = Math.min(scaleX, scaleY) * 0.7;

  context.originX = (viewW - projectWidth * context.scale) / 2;
  context.originY = (viewH - projectHeight * context.scale) / 2;

  context.draw();
}

/** Reseta o viewport para a tela inicial (sem projeto) */
export function resetViewport(context) {
  context.projectWidth = undefined;
  context.projectHeight = undefined;
  context.layers = [];
  context.activeLayer = null;
  context.scale = 1;
  context.originX = context.canvas.width / 2;
  context.originY = context.canvas.height / 2;
  context.clearSelection();
  if (typeof window.Engine.updateLayersPanel === "function") {
    window.Engine.updateLayersPanel();
  }
  context.draw();
}

/** Carrega os dados de um projeto existente no motor */
export function setProject(
  context,
  w,
  h,
  projLayers,
  viewportState = {},
  selectionDataURL = null,
  selBounds = null,
  // ***** INÍCIO DA CORREÇÃO *****
  activeLayerId = null, // 1. Aceita activeLayerId
  historyStack = null // 2. Aceita historyStack
  // ***** FIM DA CORREÇÃO *****
) {
  context.projectWidth = w;
  context.projectHeight = h;

  if (context.selectionCanvas) {
    context.selectionCanvas.width = w;
    context.selectionCanvas.height = h;
  }

  const promises = projLayers.map(
    (l) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...l, image: img });
        img.src = l.image.src || l.image;
      })
  );

  Promise.all(promises).then((loadedLayers) => {
    context.layers = loadedLayers;
    context.activeLayer =
      context.layers.length > 0
        ? context.layers[context.layers.length - 1]
        : null;

    if (typeof window.Engine.updateLayersPanel === "function") {
      window.Engine.updateLayersPanel();
    }

    context.selectionBounds = selBounds ? { ...selBounds } : null;
    if (selectionDataURL && context.selectionBounds) {
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
      img.src = selectionDataURL;
    } else {
      context.clearSelection();
    }

    if (viewportState.scale) {
      context.scale = viewportState.scale;
      context.originX = viewportState.originX;
      context.originY = viewportState.originY;
    } else {
      context.fitToScreen();
    }

    // 4. Restaura o histórico
    // O seu engineHistory.js já salva/lê estados com dataURLs,
    // então podemos carregar o stack diretamente.
    if (
      historyStack &&
      Array.isArray(historyStack) &&
      historyStack.length > 0
    ) {
      context.undoStack = historyStack;
      context.redoStack = []; // Limpa o "refazer"
    } else {
      // Se não há histórico, este estado carregado é o primeiro
      context.undoStack = [];
      context.redoStack = [];
      // context.saveState(); // Salva o estado "aberto"
    }

    resizeViewport(context);
    context.draw();
  });
}

/** Exporta a imagem final do projeto como dataURL */
export function exportImage(context) {
  const { projectWidth, projectHeight, canvas, layers } = context;
  if (!projectWidth || !projectHeight) {
    return canvas.toDataURL("image/png");
  }
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = projectWidth;
  exportCanvas.height = projectHeight;
  const ectx = exportCanvas.getContext("2d");

  ectx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

  for (let layer of layers) {
    if (!layer.visible) continue;
    ectx.drawImage(layer.image, layer.x, layer.y);
  }

  return exportCanvas.toDataURL("image/png");
}
