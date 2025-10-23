// renderer/engineInput.js

/** Evento: Roda do mouse (Zoom/Pan) */
export function handleWheel(context, e) {
  e.preventDefault();
  const { canvas, ZOOM_SENSITIVITY, ZOOM_SMOOTHING, brushPreview } = context;

  if (e.ctrlKey || e.metaKey) {
    const mx = e.offsetX;
    const my = e.offsetY;
    const wheelDelta = -e.deltaY;
    const normalizedDelta =
      Math.sign(wheelDelta) *
      Math.min(Math.abs(wheelDelta * ZOOM_SENSITIVITY), 0.5);

    const zoomFactor = Math.exp(normalizedDelta);
    context.targetScale = Math.min(
      Math.max(context.scale * zoomFactor, 0.05),
      50
    );

    const scaleChange = (context.targetScale - context.scale) * ZOOM_SMOOTHING;
    const newScale = context.scale + scaleChange;

    context.originX = mx - (mx - context.originX) * (newScale / context.scale);
    context.originY = my - (my - context.originY) * (newScale / context.scale);
    context.scale = newScale;
    context.ctx.imageSmoothingEnabled = context.scale <= 1.0;

    brushPreview.style.display = "none";
    context.draw();

    if (Math.abs(context.targetScale - context.scale) > 0.001) {
      requestAnimationFrame(() => {
        const evt = new WheelEvent("wheel", {
          deltaY: 0,
          ctrlKey: true,
          metaKey: true,
        });
        canvas.dispatchEvent(evt);
      });
    }
  } else {
    context.originX -= e.deltaX;
    context.originY -= e.deltaY;
    context.draw();
  }
}

/** Evento: Mouse Down na Transformação */
export function handleTransformMouseDown(context, e) {
  const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
  const handle = context.getHandleAtPoint(px, py);

  if (!handle) return;

  context.transformState.activeHandle = handle;

  if (handle.name !== "rotate") {
    context.transformState.dragStartCoords = {
      x: parseInt(px),
      y: parseInt(py),
    };
  } else {
    context.transformState.dragStartCoords = { x: px, y: py };
  }

  context.transformState.dragStartTransform = JSON.parse(
    JSON.stringify(context.transformState.currentTransform)
  );

  if (
    handle.name !== "move" &&
    handle.name !== "rotate" &&
    handle.name !== "anchor"
  ) {
    let oppositeHandleName = handle.name;
    if (oppositeHandleName.includes("top")) {
      oppositeHandleName = oppositeHandleName.replace("top", "bottom");
    } else if (oppositeHandleName.includes("bottom")) {
      oppositeHandleName = oppositeHandleName.replace("bottom", "top");
    }
    if (oppositeHandleName.includes("left")) {
      oppositeHandleName = oppositeHandleName.replace("left", "right");
    } else if (oppositeHandleName.includes("right")) {
      oppositeHandleName = oppositeHandleName.replace("right", "left");
    }

    const oppositeHandle = context
      .getTransformHandles(true)
      .find((h) => h.name === oppositeHandleName);
    if (oppositeHandle) {
      context.transformState.scaleAnchor = context.localToWorld(
        oppositeHandle.x,
        oppositeHandle.y
      );
    } else {
      context.transformState.scaleAnchor =
        context.transformState.currentTransform;
    }
  }
}

/** Evento: Mouse Move na Transformação */
export function handleTransformMouseMove(context, e) {
  const { transformState } = context;
  const { x: raw_px, y: raw_py } = context.screenToProject(
    e.offsetX,
    e.offsetY
  );

  const handle = transformState.activeHandle;

  if (!handle) {
    const hoverHandle = context.getHandleAtPoint(raw_px, raw_py);
    document.body.style.cursor = hoverHandle?.cursor || "default";
    return;
  }

  const t = transformState.currentTransform;
  const startT = transformState.dragStartTransform;

  let px, py;
  if (handle.name === "rotate") {
    px = raw_px;
    py = raw_py;
  } else {
    px = parseInt(raw_px);
    py = parseInt(raw_py);
  }

  const dx = px - transformState.dragStartCoords.x;
  const dy = py - transformState.dragStartCoords.y;

  switch (handle.name) {
    case "move":
    case "anchor":
      const targetX = startT.x + dx;
      const targetY = startT.y + dy;
      const rot = (t.rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const local_left = -t.width * t.anchor.x * t.scaleX;
      const local_top = -t.height * t.anchor.y * t.scaleY;
      const world_offset_x = local_left * cos - local_top * sin;
      const world_offset_y = local_left * sin + local_top * cos;
      const target_visual_left = targetX + world_offset_x;
      const target_visual_top = targetY + world_offset_y;
      const snapped_visual_left = parseInt(target_visual_left);
      const snapped_visual_top = parseInt(target_visual_top);
      const correction_x = snapped_visual_left - target_visual_left;
      const correction_y = snapped_visual_top - target_visual_top;
      t.x = targetX + correction_x;
      t.y = targetY + correction_y;
      break;

    case "rotate": {
      const startAngle = Math.atan2(
        transformState.dragStartCoords.y - startT.y,
        transformState.dragStartCoords.x - startT.x
      );
      const currentAngle = Math.atan2(py - startT.y, px - startT.x);
      const deltaAngle = currentAngle - startAngle;
      let newRotation = startT.rotation + (deltaAngle * 180) / Math.PI;

      if (e.shiftKey) {
        const snapAngle = 15;
        newRotation = Math.round(newRotation / snapAngle) * snapAngle;
      }
      t.rotation = newRotation % 360;
      break;
    }

    default: {
      // Escala
      if (!transformState.scaleAnchor) break;
      const scaleAnchor = transformState.scaleAnchor;
      const keepAspect = e.shiftKey;

      const rot = (startT.rotation * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const world_axis_x = { x: cos, y: sin };
      const world_axis_y = { x: -sin, y: cos };

      const vec_start = {
        x: transformState.dragStartCoords.x - scaleAnchor.x,
        y: transformState.dragStartCoords.y - scaleAnchor.y,
      };
      const vec_current = {
        x: px - scaleAnchor.x,
        y: py - scaleAnchor.y,
      };

      const start_proj_x =
        vec_start.x * world_axis_x.x + vec_start.y * world_axis_x.y;
      const start_proj_y =
        vec_start.x * world_axis_y.x + vec_start.y * world_axis_y.y;
      const current_proj_x =
        vec_current.x * world_axis_x.x + vec_current.y * world_axis_x.y;
      const current_proj_y =
        vec_current.x * world_axis_y.x + vec_current.y * world_axis_y.y;

      let scaleFactorX = start_proj_x === 0 ? 1 : current_proj_x / start_proj_x;
      let scaleFactorY = start_proj_y === 0 ? 1 : current_proj_y / start_proj_y;

      let applyScaleX =
        handle.name.includes("left") || handle.name.includes("right");
      let applyScaleY =
        handle.name.includes("top") || handle.name.includes("bottom");
      const isCorner = applyScaleX && applyScaleY;

      if (keepAspect) {
        if (isCorner) {
          const start_mag = Math.hypot(start_proj_x, start_proj_y);
          if (start_mag > 0) {
            const proj_axis = {
              x: start_proj_x / start_mag,
              y: start_proj_y / start_mag,
            };
            const current_proj =
              current_proj_x * proj_axis.x + current_proj_y * proj_axis.y;
            const globalScaleFactor = current_proj / start_mag;
            scaleFactorX = globalScaleFactor;
            scaleFactorY = globalScaleFactor;
          }
        } else if (applyScaleX) {
          scaleFactorY = scaleFactorX;
          applyScaleY = true;
        } else if (applyScaleY) {
          scaleFactorX = scaleFactorY;
          applyScaleX = true;
        }
      }

      if (applyScaleX) t.scaleX = startT.scaleX * scaleFactorX;
      if (applyScaleY) t.scaleY = startT.scaleY * scaleFactorY;

      const vec_anchor_to_center = {
        x: startT.x - scaleAnchor.x,
        y: startT.y - scaleAnchor.y,
      };
      const center_proj_x =
        vec_anchor_to_center.x * world_axis_x.x +
        vec_anchor_to_center.y * world_axis_x.y;
      const center_proj_y =
        vec_anchor_to_center.x * world_axis_y.x +
        vec_anchor_to_center.y * world_axis_y.y;
      const new_center_proj_x =
        center_proj_x * (applyScaleX ? scaleFactorX : 1);
      const new_center_proj_y =
        center_proj_y * (applyScaleY ? scaleFactorY : 1);
      const new_world_vec = {
        x:
          new_center_proj_x * world_axis_x.x +
          new_center_proj_y * world_axis_y.x,
        y:
          new_center_proj_x * world_axis_x.y +
          new_center_proj_y * world_axis_y.y,
      };
      t.x = scaleAnchor.x + new_world_vec.x;
      t.y = scaleAnchor.y + new_world_vec.y;
      break;
    }
  }

  context.draw();
  context.notifyTransformUI();
}

/** Evento: Mouse Up na Transformação */
export function handleTransformMouseUp(context, e) {
  if (!context.transformState.activeHandle) return;
  context.transformState.activeHandle = null;
  context.transformState.dragStartTransform = null;
}

/** Evento: Mouse Down Principal */
export function handleMouseDown(context, e) {
  if (context.isTransforming) {
    handleTransformMouseDown(context, e);
    return;
  }

  if (e.button === 1) {
    // Pan
    context.isPanning = true;
    context.startX = e.clientX - context.originX;
    context.startY = e.clientY - context.originY;
    e.preventDefault();
    return;
  }

  if (context.activeToolId === "selectTool" && e.button === 0) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const toolOptions = context.tools.selectTool;
    const canMoveSelection =
      toolOptions.mode === "replace" || toolOptions.mode === "unite";

    if (
      context.hasSelection &&
      canMoveSelection &&
      context.isPointInSelection(px, py)
    ) {
      context.isMovingSelection = true;
      context.selectionMoveStart = { x: px, y: py };
      context.selectionMoveStartBounds = { ...context.selectionBounds };
      return;
    }

    context.isSelecting = true;
    context.selectionStartX = parseInt(px);
    context.selectionStartY = parseInt(py);

    if (toolOptions.mode === "replace" && !context.isMovingSelection) {
      context.clearSelection();
    }
    return;
  }

  // Iniciar Desenho
  context.startDrawing(e);

  // Mover Camada
  if (
    document.getElementById("moveTool").hasAttribute("active") &&
    context.activeLayer &&
    e.button === 0
  ) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const { activeLayer } = context;
    if (
      px >= activeLayer.x &&
      px <= activeLayer.x + activeLayer.image.width &&
      py >= activeLayer.y &&
      py <= activeLayer.y + activeLayer.image.height
    ) {
      context.draggingLayerState.isDragging = true;
      context.draggingLayerState.offsetX = px - activeLayer.x;
      context.draggingLayerState.offsetY = py - activeLayer.y;
    }
  }
}

/** Evento: Mouse Move Principal */
export function handleMouseMove(context, e) {
  if (context.isTransforming) {
    handleTransformMouseMove(context, e);
    context.draw();
    return;
  }

  if (context.isPanning) {
    context.originX = e.clientX - context.startX;
    context.originY = e.clientY - context.startY;
    context.draw();
    return;
  }

  if (context.isMovingSelection) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const dx = parseInt(px - context.selectionMoveStart.x);
    const dy = parseInt(py - context.selectionMoveStart.y);
    context.selectionBounds.x = context.selectionMoveStartBounds.x + dx;
    context.selectionBounds.y = context.selectionMoveStartBounds.y + dy;
    context.draw();
    return;
  }

  if (context.isSelecting) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    const currentX = parseInt(px);
    const currentY = parseInt(py);
    const x = Math.min(context.selectionStartX, currentX);
    const y = Math.min(context.selectionStartY, currentY);
    const width = Math.abs(currentX - context.selectionStartX);
    const height = Math.abs(currentY - context.selectionStartY);
    context.newSelectionRect = { x, y, width, height };
    context.draw();
    return;
  }

  if (context.draggingLayerState.isDragging && context.activeLayer) {
    const { x: px, y: py } = context.screenToProject(e.offsetX, e.offsetY);
    context.activeLayer.x = parseInt(px - context.draggingLayerState.offsetX);
    context.activeLayer.y = parseInt(py - context.draggingLayerState.offsetY);
    context.draw();
    return;
  }
}

/** Evento: Mouse Up Principal */
export function handleMouseUp(context, e) {
  if (context.isTransforming) {
    handleTransformMouseUp(context, e);
    return;
  }

  if (e.button === 1) {
    context.isPanning = false;
  }

  if (context.isMovingSelection) {
    context.isMovingSelection = false;
    context.selectionMoveStartBounds = null;
    context.saveState();
    return;
  }

  if (context.isSelecting) {
    context.isSelecting = false;
    const finalRect = context.newSelectionRect;
    context.newSelectionRect = null;

    if (!finalRect || finalRect.width < 1 || finalRect.height < 1) {
      if (context.tools.selectTool.mode === "replace") {
        context.clearSelection();
      }
      context.draw();
      return;
    }
    context.updateSelectionWithRect(finalRect, context.tools.selectTool.mode);
  }

  if (context.draggingLayerState.isDragging) {
    context.saveState();
    context.draggingLayerState.isDragging = false;
  }
}

/** Evento: Mouse Leave Principal */
export function handleMouseLeave(context) {
  context.isPanning = false;
  context.draggingLayerState.isDragging = false;
}

/** Evento: Double Click Principal */
export function handleDoubleClick(context, e) {
  if (context.activeToolId === "selectTool") {
    context.selectAll();
  }
}

/** Anexa todos os ouvintes de eventos ao canvas */
export function attachInputListeners(context) {
  const { canvas } = context;

  // Bind 'this' (context) to the event handlers
  const onWheel = handleWheel.bind(null, context);
  const onMouseDown = handleMouseDown.bind(null, context);
  const onMouseMove = handleMouseMove.bind(null, context);
  const onMouseUp = handleMouseUp.bind(null, context);
  const onMouseLeave = handleMouseLeave.bind(null, context);
  const onDoubleClick = handleDoubleClick.bind(null, context);

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("dblclick", onDoubleClick);
}
