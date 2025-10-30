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

/** * NOVO: Mescla o conteúdo flutuante (se houver) na camada ativa.
 * Retorna true se uma mesclagem ocorreu.
 */
export function mergeFloatingContent(context) {
  if (
    !context.hasFloatingContent ||
    !context.floatingContent ||
    !context.activeLayer
  ) {
    return false; // Nada a fazer
  }

  // --- INÍCIO DA CORREÇÃO FINAL ---

  const l1 = context.activeLayer; // Camada ativa (com o "buraco")
  const f = context.floatingContent; // Conteúdo flutuante
  const fImg = f.image;
  const fX = f.x;
  const fY = f.y;
  const fW = f.image.width;
  const fH = f.image.height;

  // l_orig é o snapshot da camada original (SEM o buraco)
  const l_orig = f.originalLayerState;

  if (!l_orig) {
    console.error("Falha na mesclagem: originalLayerState está ausente.");
    context.hasFloatingContent = false;
    context.floatingContent = null;
    return false;
  }

  // 1. Encontra os bounds combinados
  const l_origImg = l_orig.image; // O *canvas* do snapshot
  const combinedMinX = Math.min(l_orig.x, fX);
  const combinedMinY = Math.min(l_orig.y, fY);
  const combinedMaxX = Math.max(l_orig.x + l_origImg.width, fX + fW);
  const combinedMaxY = Math.max(l_orig.y + l_origImg.height, fY + fH);
  const combinedWidth = Math.ceil(combinedMaxX - combinedMinX);
  const combinedHeight = Math.ceil(combinedMaxY - combinedMinY);

  // 2. Cria o novo canvas de mesclagem
  const mergeCanvas = document.createElement("canvas");
  mergeCanvas.width = combinedWidth;
  mergeCanvas.height = combinedHeight;
  const mergeCtx = mergeCanvas.getContext("2d");

  // 3. Desenha a imagem original (o snapshot)
  // CORREÇÃO: Para garantir que estamos usando pixels puros e não
  // uma referência a um canvas que possa ter sido modificado,
  // nós criamos uma cópia "fresca" do snapshot *aqui*.
  // Isso é uma medida de segurança contra mutação de estado.
  const pristineSnapshot = document.createElement("canvas");
  pristineSnapshot.width = l_origImg.width;
  pristineSnapshot.height = l_origImg.height;
  pristineSnapshot.getContext("2d").drawImage(l_origImg, 0, 0);

  // Agora desenhamos a cópia fresca (pristineSnapshot)
  mergeCtx.drawImage(
    pristineSnapshot,
    l_orig.x - combinedMinX,
    l_orig.y - combinedMinY
  );

  // 4. Desenha o conteúdo flutuante (transformado)
  mergeCtx.drawImage(fImg, fX - combinedMinX, fY - combinedMinY);

  // 5. ATUALIZA a camada ativa (l1) com o resultado final.
  l1.image = mergeCanvas;
  l1.x = combinedMinX;
  l1.y = combinedMinY;

  // 6. Limpa o estado flutuante
  context.hasFloatingContent = false;
  context.floatingContent = null;

  console.log("Conteúdo flutuante mesclado com sucesso (com cópia).");
  return true; // Mesclagem ocorreu
  // --- FIM DA CORREÇÃO FINAL ---
}

/** Limpa a seleção ativa */
export function clearSelection(context) {
  // --- MODIFICADO ---
  // Se houver conteúdo flutuante, mescla-o ANTES de limpar a seleção.
  const didMerge = mergeFloatingContent(context);
  // --- FIM ---

  if (context.hasSelection) {
    context.hasSelection = false;
    context.selectionBounds = null;
    context.cacheSelectionEdges();
    context.stopAnimation();
    context.draw(); // O draw é chamado aqui
    if (!didMerge) {
      // Só salva se a *única* ação foi deselecionar
      context.saveState();
    }
  }

  if (didMerge) {
    context.saveState(); // Salva o estado *depois* do merge
    context.draw(); // Garante o redesenho após o merge
  }
}

/** Seleciona todo o canvas */
export function selectAll(context) {
  // --- MODIFICADO ---
  // Mescla qualquer conteúdo flutuante antes de criar uma nova seleção
  const didMerge = mergeFloatingContent(context);
  if (didMerge) {
    context.saveState();
  }
  // --- FIM ---

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

  context.saveState(); // Salva a nova seleção (e o merge, se houve)
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
  // --- MODIFICADO ---
  // Se houver conteúdo flutuante, mescla-o ANTES de criar uma nova seleção.
  const didMerge = mergeFloatingContent(context);
  if (didMerge) {
    context.saveState(); // Salva o merge
  }
  // --- FIM ---

  if (!rect || rect.width < 1 || rect.height < 1) {
    if (didMerge) context.draw(); // Apenas desenha o merge e sai
    return;
  }

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
