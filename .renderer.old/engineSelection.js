// renderer/engineSelection.js

/** Atualiza o cache das bordas da seleção */
export function cacheSelectionEdges(context) {
  if (!context.hasSelection) {
    context.selectionEdges = null;
    return;
  }
  context.selectionEdges = findSelectionEdges(context);
}

/** Analisa a máscara e encontra as bordas */
export function findSelectionEdges(context) {
  const { hasSelection, selectionCtx, selectionBounds } = context;
  if (!hasSelection || !selectionCtx || !selectionBounds) {
    return { horizontal: [], vertical: [] };
  }

  const w = selectionBounds.width;
  const h = selectionBounds.height;
  const imageData = selectionCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const horizontal = [];
  const vertical = [];

  const isSelected = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return data[(y * w + x) * 4 + 3] > 0;
  };

  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const current = isSelected(x, y);
      if (current !== isSelected(x, y + 1)) {
        horizontal.push({ x: x, y: y + 1, length: 1 });
      }
      if (current !== isSelected(x + 1, y)) {
        vertical.push({ x: x + 1, y: y, length: 1 });
      }
    }
  }

  const mergeSegments = (segments, orientation) => {
    if (segments.length === 0) return [];
    const isHorizontal = orientation === "horizontal";
    if (isHorizontal) {
      segments.sort((a, b) => a.y - b.y || a.x - b.x);
    } else {
      segments.sort((a, b) => a.x - b.x || a.y - b.y);
    }
    const merged = [segments[0]];
    for (let i = 1; i < segments.length; i++) {
      const last = merged[merged.length - 1];
      const current = segments[i];
      if (isHorizontal) {
        if (current.y === last.y && current.x === last.x + last.length) {
          last.length += current.length;
        } else {
          merged.push(current);
        }
      } else {
        if (current.x === last.x && current.y === last.y + last.length) {
          last.length += current.length;
        } else {
          merged.push(current);
        }
      }
    }
    return merged;
  };

  return {
    horizontal: mergeSegments(horizontal, "horizontal"),
    vertical: mergeSegments(vertical, "vertical"),
  };
}

/** Limpa a seleção ativa */
export function clearSelection(context) {
  if (context.hasSelection) {
    context.hasSelection = false;
    context.selectionBounds = null;
    context.cacheSelectionEdges();
    context.stopAnimation();
    context.draw();
    context.saveState();
  }
}

/** Seleciona todo o canvas */
export function selectAll(context) {
  const { projectWidth, projectHeight, selectionCanvas, selectionCtx } =
    context;
  if (!projectWidth) return;

  context.selectionBounds = {
    x: 0,
    y: 0,
    width: projectWidth,
    height: projectHeight,
  };
  selectionCanvas.width = projectWidth;
  selectionCanvas.height = projectHeight;
  selectionCtx.fillStyle = "white";
  selectionCtx.fillRect(0, 0, projectWidth, projectHeight);

  context.hasSelection = true;
  context.cacheSelectionEdges();
  context.startAnimation();
  context.draw();
  context.saveState();
}

/** Verifica se um ponto (coords do projeto) está dentro da seleção */
export function isPointInSelection(context, px, py) {
  const { hasSelection, selectionBounds, selectionCtx } = context;
  if (!hasSelection || !selectionBounds) return false;

  const localX = Math.floor(px - selectionBounds.x);
  const localY = Math.floor(py - selectionBounds.y);

  if (
    localX < 0 ||
    localX >= selectionBounds.width ||
    localY < 0 ||
    localY >= selectionBounds.height
  ) {
    return false;
  }
  const pixelData = selectionCtx.getImageData(localX, localY, 1, 1).data;
  return pixelData[3] > 0;
}

/** Função central para criar ou modificar a seleção com um retângulo */
export function updateSelectionWithRect(context, rect, mode) {
  if (!rect || rect.width < 1 || rect.height < 1) return;

  if (mode === "replace") {
    context.clearSelection();
  }

  if (!context.hasSelection) {
    // Primeira seleção
    context.selectionBounds = { ...rect };
    context.selectionCanvas.width = rect.width;
    context.selectionCanvas.height = rect.height;
    context.selectionCtx.fillStyle = "white";
    context.selectionCtx.fillRect(0, 0, rect.width, rect.height);
  } else {
    // Unindo com seleção existente
    const oldBounds = context.selectionBounds;
    const newBounds = {
      x: Math.min(oldBounds.x, rect.x),
      y: Math.min(oldBounds.y, rect.y),
      right: Math.max(oldBounds.x + oldBounds.width, rect.x + rect.width),
      bottom: Math.max(oldBounds.y + oldBounds.height, rect.y + rect.height),
    };
    newBounds.width = newBounds.right - newBounds.x;
    newBounds.height = newBounds.bottom - newBounds.y;

    if (
      newBounds.width > oldBounds.width ||
      newBounds.height > oldBounds.height
    ) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = newBounds.width;
      tempCanvas.height = newBounds.height;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

      const offsetX = oldBounds.x - newBounds.x;
      const offsetY = oldBounds.y - newBounds.y;
      tempCtx.drawImage(context.selectionCanvas, offsetX, offsetY);

      context.selectionCanvas.width = newBounds.width;
      context.selectionCanvas.height = newBounds.height;
      context.selectionCtx.drawImage(tempCanvas, 0, 0);
      context.selectionBounds = {
        x: newBounds.x,
        y: newBounds.y,
        width: newBounds.width,
        height: newBounds.height,
      };
    }

    const localRect = {
      x: rect.x - context.selectionBounds.x,
      y: rect.y - context.selectionBounds.y,
      width: rect.width,
      height: rect.height,
    };

    switch (mode) {
      case "unite":
      case "replace":
        context.selectionCtx.globalCompositeOperation = "source-over";
        break;
      case "subtract":
        context.selectionCtx.globalCompositeOperation = "destination-out";
        break;
      case "intersect":
        context.selectionCtx.globalCompositeOperation = "destination-in";
        break;
    }

    context.selectionCtx.fillStyle = "white";
    context.selectionCtx.fillRect(
      localRect.x,
      localRect.y,
      localRect.width,
      localRect.height
    );
    context.selectionCtx.globalCompositeOperation = "source-over"; // Reset
  }

  // Verifica se a seleção ainda existe
  const selectionData = context.selectionCtx.getImageData(
    0,
    0,
    context.selectionCanvas.width,
    context.selectionCanvas.height
  ).data;
  let stillHasSelection = false;
  for (let i = 3; i < selectionData.length; i += 4) {
    if (selectionData[i] > 0) {
      stillHasSelection = true;
      break;
    }
  }
  context.hasSelection = stillHasSelection;

  if (context.hasSelection) {
    context.cacheSelectionEdges();
    context.startAnimation();
  } else {
    context.clearSelection();
  }
  context.draw();
  context.saveState();
}
