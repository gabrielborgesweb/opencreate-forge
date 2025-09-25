const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");

async function handleOpenFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "gif"] },
    ],
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  // Registra o handler **antes** de criar janela / carregar HTML
  ipcMain.handle("dialog:openFile", handleOpenFile);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
