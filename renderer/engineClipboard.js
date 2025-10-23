// renderer/engineClipboard.js

/** Copia a seleção (ou camada) para a área de transferência do sistema */
export async function copySelection(context) {
  const { activeLayer, hasSelection, selectionBounds, selectionCanvas } =
    context;
  if (!activeLayer) return;

  let sourceCanvas;
  let originalBounds = {};

  if (!hasSelection) {
    sourceCanvas = activeLayer.image;
    originalBounds = { x: activeLayer.x, y: activeLayer.y };
  } else {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = selectionBounds.width;
    tempCanvas.height = selectionBounds.height;
    const tempCtx = tempCanvas.getContext("2d");

    const layerOffsetX = activeLayer.x - selectionBounds.x;
    const layerOffsetY = activeLayer.y - selectionBounds.y;
    tempCtx.drawImage(activeLayer.image, layerOffsetX, layerOffsetY);
    tempCtx.globalCompositeOperation = "destination-in";
    tempCtx.drawImage(selectionCanvas, 0, 0);

    const bounds = context.getOptimizedBoundingBox(tempCanvas, {
      x: 0,
      y: 0,
      width: tempCanvas.width,
      height: tempCanvas.height,
    });
    if (!bounds) return;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = bounds.width;
    finalCanvas.height = bounds.height;
    const finalCtx = finalCanvas.getContext("2d");
    finalCtx.drawImage(
      tempCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    sourceCanvas = finalCanvas;

    originalBounds = {
      x: selectionBounds.x + bounds.x,
      y: selectionBounds.y + bounds.y,
    };
  }

  try {
    const blob = await new Promise((resolve) =>
      sourceCanvas.toBlob(resolve, "image/png")
    );

    const activeTab = document.querySelector(
      "#projectsTabs button.active:not(#homeTab)"
    );
    const currentProjectID = activeTab ? activeTab.id : "";

    const metadata = {
      source: `opencreate-forge-editor__${currentProjectID}`,
      x: originalBounds.x,
      y: originalBounds.y,
    };
    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: "text/plain",
    });

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
        "text/plain": metadataBlob,
      }),
    ]);
    console.log("Image copied to system clipboard.");
  } catch (err) {
    console.error("Failed to copy image to clipboard:", err);
    alert(
      "Could not copy image to clipboard. Check permissions or console for errors."
    );
  }
}

/** Cola uma imagem da área de transferência como nova camada */
export async function pasteFromClipboard(context) {
  try {
    const clipboardItems = await navigator.clipboard.read();

    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue;

      let isInternalPaste = false;
      let pastePosition = null;

      if (item.types.includes("text/plain")) {
        const metadataBlob = await item.getType("text/plain");
        const metadataText = await metadataBlob.text();
        console.log("Clipboard metadata:", metadataText);

        try {
          const metadata = JSON.parse(metadataText);
          const activeTab = document.querySelector(
            "#projectsTabs button.active:not(#homeTab)"
          );
          const currentProjectID = activeTab ? activeTab.id : "";

          if (
            metadata.source === `opencreate-forge-editor__${currentProjectID}`
          ) {
            isInternalPaste = true;
            pastePosition = { x: metadata.x, y: metadata.y };
          }
        } catch (e) {
          /* Não é nosso JSON */
        }
      }

      if (!isInternalPaste) {
        const center = context.screenToProject(
          context.canvas.width / 2,
          context.canvas.height / 2
        );
        pastePosition = center;
      }

      const blob = await item.getType(imageType);
      createLayerFromBlob(context, blob, pastePosition, !isInternalPaste);

      context.saveState();
      return;
    }
    console.log("No image found in clipboard.", clipboardItems);
  } catch (err) {
    console.error("Failed to read from clipboard:", err);
    alert(
      "Could not paste from clipboard. Check permissions or console for errors."
    );
  }
}

/** Deleta o conteúdo dentro da seleção da camada ativa */
export function deleteSelectionContent(context) {
  const { activeLayer, hasSelection, selectionBounds, selectionCanvas } =
    context;
  if (!activeLayer || !hasSelection || !selectionBounds) return;

  const newLayerCanvas = document.createElement("canvas");
  newLayerCanvas.width = activeLayer.image.width;
  newLayerCanvas.height = activeLayer.image.height;
  const newCtx = newLayerCanvas.getContext("2d");
  newCtx.drawImage(activeLayer.image, 0, 0);

  newCtx.globalCompositeOperation = "destination-out";
  const drawX = selectionBounds.x - activeLayer.x;
  const drawY = selectionBounds.y - activeLayer.y;
  newCtx.drawImage(selectionCanvas, drawX, drawY);

  const bounds = context.getOptimizedBoundingBox(newLayerCanvas, {
    x: 0,
    y: 0,
    width: newLayerCanvas.width,
    height: newLayerCanvas.height,
  });

  if (bounds) {
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = bounds.width;
    finalCanvas.height = bounds.height;
    const finalCtx = finalCanvas.getContext("2d");
    finalCtx.drawImage(
      newLayerCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );

    const img = new Image();
    img.onload = () => {
      activeLayer.image = img;
      activeLayer.x += bounds.x;
      activeLayer.y += bounds.y;
      context.saveState();
      context.draw();
      if (typeof window.Engine.updateLayersPanel === "function") {
        window.Engine.updateLayersPanel();
      }
    };
    img.src = finalCanvas.toDataURL();
  } else {
    // Camada ficou vazia
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = 1;
    emptyCanvas.height = 1;
    const img = new Image();
    img.onload = () => {
      activeLayer.image = img;
      activeLayer.x = 0;
      activeLayer.y = 0;
      context.saveState();
      context.draw();
      if (typeof window.Engine.updateLayersPanel === "function") {
        window.Engine.updateLayersPanel();
      }
    };
    img.src = emptyCanvas.toDataURL();
  }
}

/** Recorta a área selecionada (Copia e Deleta) */
export async function cutSelection(context) {
  if (!context.activeLayer || !context.hasSelection) return;
  await copySelection(context);
  deleteSelectionContent(context);
}

/** Helper para criar camada a partir de um Blob (colar, arrastar-e-soltar) */
export function createLayerFromBlob(
  context,
  blob,
  position,
  isCenterPosition = false
) {
  const imageUrl = URL.createObjectURL(blob);
  const img = new Image();
  const imgName = blob.name || "Imported Image";

  img.onload = () => {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(img, 0, 0);

    URL.revokeObjectURL(imageUrl);
    const dataURL = tempCanvas.toDataURL();

    const finalImage = new Image();
    finalImage.onload = () => {
      let layerX, layerY;
      if (isCenterPosition) {
        layerX = position.x - finalImage.width / 2;
        layerY = position.y - finalImage.height / 2;
      } else {
        layerX = position.x;
        layerY = position.y;
      }

      const newLayer = {
        id: context.uid(),
        name: imgName,
        image: finalImage,
        x: layerX,
        y: layerY,
        visible: true,
      };

      context.layers.push(newLayer);
      context.setActiveLayer(newLayer.id);
      context.clearSelection(); // Limpa seleção após colar

      if (typeof window.Engine.updateLayersPanel === "function") {
        window.Engine.updateLayersPanel();
      }
      context.saveState();
      context.draw();
      console.log("Image from blob converted and added as a new layer.");
    };
    finalImage.src = dataURL;
  };

  img.src = imageUrl;
}
