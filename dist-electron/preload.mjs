let electron = require("electron");
//#region src/main/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	openFile: () => electron.ipcRenderer.invoke("dialog:openFile"),
	saveFile: (data) => electron.ipcRenderer.invoke("dialog:saveFile", data),
	saveProjectAs: (data) => electron.ipcRenderer.invoke("dialog:saveProjectAs", data),
	saveProject: (data) => electron.ipcRenderer.invoke("fs:saveProject", data),
	confirmClose: (projectName) => electron.ipcRenderer.invoke("dialog:confirmClose", projectName),
	openProject: () => electron.ipcRenderer.invoke("dialog:openProject"),
	onProjectDropped: (callback) => {
		window.addEventListener("project-dropped", (event) => callback(event.detail));
	}
});
//#endregion
