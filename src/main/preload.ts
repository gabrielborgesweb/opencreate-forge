import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data: any) => ipcRenderer.invoke('dialog:saveFile', data),
  saveProjectAs: (data: any) => ipcRenderer.invoke('dialog:saveProjectAs', data),
  saveProject: (data: any) => ipcRenderer.invoke('fs:saveProject', data),
  confirmClose: (projectName: string) => ipcRenderer.invoke('dialog:confirmClose', projectName),
  openProject: () => ipcRenderer.invoke('dialog:openProject'),
  onProjectDropped: (callback: any) => {
    window.addEventListener('project-dropped', (event: any) => callback(event.detail))
  }
})
