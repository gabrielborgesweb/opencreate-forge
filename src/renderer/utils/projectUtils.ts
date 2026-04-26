/**
 * Purpose: Utility functions for project-related operations, such as creating projects from images and loading image assets.
 */
import { Project } from "@store/projectStore";

export const createProjectFromImage = (
  dataUrl: string,
  width: number,
  height: number,
  name: string,
  filePath?: string,
): Project => {
  const id = Math.random().toString(36).substr(2, 9);
  const layerId = "layer-" + id;

  const newProject: Project = {
    id,
    name,
    width,
    height,
    layers: [
      {
        id: layerId,
        name: "Layer 1",
        type: "raster",
        visible: true,
        locked: false,
        opacity: 100,
        x: 0,
        y: 0,
        width,
        height,
        data: dataUrl,
        blendMode: "source-over",
      },
    ],
    activeLayerId: layerId,
    selection: { hasSelection: false, bounds: null },
    zoom: 1,
    panX: 0,
    panY: 0,
    isDirty: false,
    filePath,
    undoStack: [{ description: "New Project from Image", state: {} as any }],
    redoStack: [],
  };

  return newProject;
};

export const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
};
