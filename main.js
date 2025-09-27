const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  // handler para abrir arquivo (já vimos)
  ipcMain.handle("dialog:openFile", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp"] }],
    });
    if (canceled) return null;
    return filePaths[0];
  });

  // handler para salvar arquivo
  ipcMain.handle("dialog:saveFile", async (event, { dataURL, defaultName }) => {
    // dataURL: string base64 da imagem ou dados binários
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Salvar imagem",
      defaultPath: defaultName || "image.png",
      filters: [
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg", "jpeg"] },
      ],
    });
    if (canceled || !filePath) {
      return { success: false };
    }

    // Converter dataURL para binário (buffer)
    // Assumindo que dataURL é algo como "data:image/png;base64,AAA..."
    const matches = dataURL.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return { success: false, error: "Formato de dataURL inválido" };
    }
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    try {
      fs.writeFileSync(filePath, buffer);
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
