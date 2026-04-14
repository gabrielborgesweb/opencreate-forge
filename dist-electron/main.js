import { BrowserWindow, app, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
//#region src/main/main.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var win;
function createWindow() {
	win = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: "#000",
		center: true,
		darkTheme: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	});
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadFile(path.join(RENDERER_DIST, "index.html"));
	win.maximize();
	win.setMenu(null);
}
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
		win = null;
	}
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.whenReady().then(() => {
	ipcMain.handle("dialog:openFile", async () => {
		const { canceled, filePaths } = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [{
				name: "Images",
				extensions: [
					"png",
					"jpg",
					"jpeg",
					"bmp"
				]
			}]
		});
		if (canceled) return null;
		return filePaths[0];
	});
	ipcMain.handle("dialog:saveFile", async (_event, { dataURL, defaultName }) => {
		const { canceled, filePath } = await dialog.showSaveDialog({
			title: "Salvar imagem",
			defaultPath: defaultName || "image.png",
			filters: [{
				name: "PNG",
				extensions: ["png"]
			}, {
				name: "JPEG",
				extensions: ["jpg", "jpeg"]
			}]
		});
		if (canceled || !filePath) return { success: false };
		const matches = dataURL.match(/^data:(.+);base64,(.+)$/);
		if (!matches) return {
			success: false,
			error: "Formato de dataURL inválido"
		};
		const buffer = Buffer.from(matches[2], "base64");
		try {
			await fs.writeFile(filePath, buffer);
			return {
				success: true,
				filePath
			};
		} catch (err) {
			return {
				success: false,
				error: err.message
			};
		}
	});
	ipcMain.handle("dialog:saveProjectAs", async (_event, { jsonString, defaultName }) => {
		const { canceled, filePath } = await dialog.showSaveDialog({
			title: "Salvar Projeto Como...",
			defaultPath: defaultName || "projeto.ocfd",
			filters: [{
				name: "OpenCreate Forge Document",
				extensions: ["ocfd"]
			}]
		});
		if (canceled || !filePath) return {
			success: false,
			filePath: null
		};
		try {
			let projectData = JSON.parse(jsonString);
			projectData = {
				...projectData,
				originalName: projectData.name,
				name: path.basename(filePath)
			};
			await fs.writeFile(filePath, JSON.stringify(projectData));
			return {
				success: true,
				filePath
			};
		} catch (err) {
			return {
				success: false,
				error: err.message,
				filePath: null
			};
		}
	});
	ipcMain.handle("fs:saveProject", async (_event, { jsonString, filePath }) => {
		if (!filePath) return {
			success: false,
			error: "Nenhum caminho de arquivo fornecido."
		};
		try {
			await fs.writeFile(filePath, jsonString);
			return {
				success: true,
				filePath
			};
		} catch (err) {
			return {
				success: false,
				error: err.message
			};
		}
	});
	ipcMain.handle("dialog:confirmClose", async (_event, projectName) => {
		const { response } = await dialog.showMessageBox({
			type: "question",
			buttons: [
				"Salvar",
				"Não Salvar",
				"Cancelar"
			],
			defaultId: 0,
			cancelId: 2,
			message: `Deseja salvar as alterações em "${projectName}"?`,
			detail: "Suas alterações serão perdidas se você não as salvar."
		});
		return response;
	});
	ipcMain.handle("dialog:openProject", async () => {
		const { canceled, filePaths } = await dialog.showOpenDialog({
			title: "Abrir Projeto",
			properties: ["openFile"],
			filters: [{
				name: "OpenCreate Forge Document",
				extensions: ["ocfd"]
			}]
		});
		if (canceled || !filePaths[0]) return null;
		const filePath = filePaths[0];
		try {
			return {
				success: true,
				filePath,
				content: await fs.readFile(filePath, "utf8")
			};
		} catch (err) {
			return {
				success: false,
				error: err.message
			};
		}
	});
	createWindow();
});
//#endregion
export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
