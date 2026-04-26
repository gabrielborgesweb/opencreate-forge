/**
 * Purpose: Preload script that exposes Electron APIs and IPC communication to the renderer process in a secure way.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: (data: any) => ipcRenderer.invoke("dialog:saveFile", data),
  saveProjectAs: (data: any) => ipcRenderer.invoke("dialog:saveProjectAs", data),
  saveProject: (data: any) => ipcRenderer.invoke("fs:saveProject", data),
  confirmClose: (projectName: string) => ipcRenderer.invoke("dialog:confirmClose", projectName),
  openProject: () => ipcRenderer.invoke("dialog:openProject"),
  getAppVersion: () => ipcRenderer.invoke("app:getVersion"),
  updateMenu: (data: { hasProject: boolean }) => ipcRenderer.invoke("app:updateMenu", data),
  onProjectDropped: (callback: any) => {
    window.addEventListener("project-dropped", (event: any) => callback(event.detail));
  },
  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: any, action: string) => callback(action);
    ipcRenderer.on("menu:action", listener);
    return () => {
      ipcRenderer.removeListener("menu:action", listener);
    };
  },
});
