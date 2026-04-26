import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
const APP_ROOT = path.join(__dirname, "..");
process.env.APP_ROOT = APP_ROOT;

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - https://github.com/vitejs/vite/discussions/5912
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(APP_ROOT, "public") : RENDERER_DIST;

let win: BrowserWindow | null;

app.commandLine.appendSwitch("ignore-gpu-blacklist"); // Garante uso da GPU em mais máquinas
app.commandLine.appendSwitch("enable-gpu-rasterization"); // Melhora o render de formas vetoriais e desenhos
app.commandLine.appendSwitch("enable-zero-copy"); // Melhora a velocidade de escrita de texturas (bom para Canvas)
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer"); // Crucial para WASM multithread

function createMenu(hasProject = false) {
  const isDev = !!VITE_DEV_SERVER_URL;

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => win?.webContents.send("menu:action", "new-project"),
        },
        { type: "separator" },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => win?.webContents.send("menu:action", "open-project"),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "save-project"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "save-project-as"),
        },
        { type: "separator" },
        {
          label: "Export as PNG...",
          accelerator: "CmdOrCtrl+E",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "export-png"),
        },
        { type: "separator" },
        {
          label: "Close Project",
          accelerator: "CmdOrCtrl+W",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "close-project"),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "undo"),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Shift+Z",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "redo"),
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        {
          label: "Preferences...",
          accelerator: "CmdOrCtrl+,",
          click: () => win?.webContents.send("menu:action", "preferences"),
        },
      ],
    },
    { label: "Image", submenu: [{ label: "Canvas Size...", enabled: false }] },
    {
      label: "Layer",
      submenu: [
        {
          label: "New Layer",
          accelerator: "CmdOrCtrl+Shift+N",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "add-layer"),
        },
        {
          label: "Duplicate Layer",
          accelerator: "CmdOrCtrl+J",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "duplicate-layer"),
        },
        { type: "separator" },
        {
          label: "Delete Layer",
          accelerator: "Backspace",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "remove-layer"),
        },
      ],
    },
    {
      label: "Select",
      submenu: [
        {
          label: "All",
          accelerator: "CmdOrCtrl+A",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "select-all"),
        },
        {
          label: "Deselect",
          accelerator: "CmdOrCtrl+D",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "deselect"),
        },
      ],
    },
    { label: "Filter", submenu: [{ label: "Blur", enabled: false }] },
    {
      label: "View",
      submenu: [
        ...(isDev
          ? ([
              { role: "toggleDevTools" },
              { type: "separator" },
            ] as Electron.MenuItemConstructorOptions[])
          : []),
        {
          label: "Rulers",
          accelerator: "CmdOrCtrl+R",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "toggle-rulers"),
        },
        { type: "separator" },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "zoom-in"),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "zoom-out"),
        },
        { type: "separator" },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+1",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "zoom-100"),
        },
        {
          label: "Fit to Screen",
          accelerator: "CmdOrCtrl+0",
          enabled: hasProject,
          click: () => win?.webContents.send("menu:action", "zoom-fit"),
        },
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }] },
    { label: "Help", submenu: [{ label: "About OpenCreate Forge", enabled: false }] },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const iconPath =
    process.platform === "win32"
      ? path.join(APP_ROOT, "shared/favicon/favicon-windows.ico")
      : process.platform === "darwin"
        ? path.join(APP_ROOT, "shared/favicon/favicon-darwin-liquid.icns")
        : path.join(APP_ROOT, "shared/favicon/favicon-linux.png");

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#1a1a1a",
    center: true,
    darkTheme: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        "--disable-pinch", // Próprio sistema de zoom
      ],
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  win.maximize();
  createMenu();
  // win.setAutoHideMenuBar(true);
}

app.on("window-all-closed", () => {
  app.quit();
  win = null;
  // if (process.platform !== 'darwin') {}
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  // IPC Handlers
  ipcMain.handle("dialog:openFile", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp"] }],
    });
    if (canceled) return null;
    return filePaths[0];
  });

  ipcMain.handle("app:updateMenu", (_event, { hasProject }) => {
    createMenu(hasProject);
  });

  ipcMain.handle("dialog:saveFile", async (_event, { dataURL, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Exportar imagem",
      defaultPath: defaultName || "export.png",
      filters: [
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg", "jpeg"] },
      ],
    });
    if (canceled || !filePath) return { success: false };

    const matches = dataURL.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return { success: false, error: "Formato de dataURL inválido" };

    const buffer = Buffer.from(matches[2], "base64");
    try {
      await fs.writeFile(filePath, buffer);
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("app:getVersion", () => app.getVersion());

  ipcMain.handle("dialog:saveProjectAs", async (_event, { jsonString, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Salvar Projeto Como...",
      defaultPath: defaultName || "projeto.ocfd",
      filters: [{ name: "OpenCreate Forge Document", extensions: ["ocfd"] }],
    });
    if (canceled || !filePath) return { success: false, filePath: null };

    try {
      const projectData = JSON.parse(jsonString);
      const name = path.basename(filePath, ".ocfd");

      // Clean up internal-only fields before saving to disk
      const dataToSave = { ...projectData };
      delete dataToSave.filePath;
      delete dataToSave.isDirty;
      dataToSave.name = name;
      dataToSave.updatedAt = new Date().toISOString();

      await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
      return { success: true, filePath, name };
    } catch (err: any) {
      return { success: false, error: err.message, filePath: null };
    }
  });

  ipcMain.handle("fs:saveProject", async (_event, { jsonString, filePath }) => {
    if (!filePath) return { success: false, error: "Nenhum caminho de arquivo fornecido." };
    try {
      const projectData = JSON.parse(jsonString);

      // Clean up internal-only fields before saving to disk
      const dataToSave = { ...projectData };
      delete dataToSave.filePath;
      delete dataToSave.isDirty;
      dataToSave.updatedAt = new Date().toISOString();

      await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("dialog:confirmClose", async (_event, projectName) => {
    const { response } = await dialog.showMessageBox({
      type: "question",
      buttons: ["Salvar", "Não Salvar", "Cancelar"],
      defaultId: 0,
      cancelId: 2,
      message: `Deseja salvar as alterações em "${projectName}"?`,
      detail: "Suas alterações serão perdidas se você não as salvar.",
    });
    return response;
  });

  ipcMain.handle("dialog:openProject", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Abrir Projeto ou Imagem",
      properties: ["openFile"],
      filters: [
        {
          name: "Todos os Arquivos Suportados",
          extensions: ["ocfd", "png", "jpg", "jpeg", "bmp", "webp"],
        },
        { name: "OpenCreate Forge Document", extensions: ["ocfd"] },
        { name: "Imagens", extensions: ["png", "jpg", "jpeg", "bmp", "webp"] },
      ],
    });
    if (canceled || !filePaths[0]) return null;

    const filePath = filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === ".ocfd") {
        const content = await fs.readFile(filePath, "utf8");
        return { success: true, filePath, type: "project", content };
      } else {
        // É uma imagem
        const buffer = await fs.readFile(filePath);
        const mimeType =
          {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".bmp": "image/bmp",
            ".webp": "image/webp",
          }[ext] || "image/png";

        const dataURL = `data:${mimeType};base64,${buffer.toString("base64")}`;
        return { success: true, filePath, type: "image", dataURL };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  createWindow();
});
