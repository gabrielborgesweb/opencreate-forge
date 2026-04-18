const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("fs").promises;
const path = require("path");

function createWindow() {
  // A lógica para escolher o ícone da janela continua útil, vamos mantê-la.
  let iconPath = path.join(__dirname, "favicon-darwin-liquid.png");

  if (process.platform === "win32") {
    iconPath = path.join(__dirname, "favicon-windows.ico");
  } else if (process.platform === "linux") {
    iconPath = path.join(__dirname, "favicon-linux.png");
  }

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#000",
    center: true,
    darkTheme: true,
    icon: iconPath, // Esta linha define o ícone da janela.
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        "--ignore-gpu-blacklist",
        "--enable-hardware-overlays=single-fullscreen",
        "--disable-pinch",
        "--forced-compositing-mode",
        "--disable-raf-throttling",
        "--in-process-gpu",
        "--disable-frame-rate-limit",
        "--enable-logging",
      ],
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.maximize();

  const isMac = process.platform === "darwin";

  // const template = [
  //   // { role: 'appMenu' } (Menu padrão do Mac)
  //   ...(isMac
  //     ? [
  //         {
  //           label: app.name,
  //           submenu: [
  //             { role: "about" },
  //             { type: "separator" },
  //             { role: "services" },
  //             { type: "separator" },
  //             { role: "hide" },
  //             { role: "hideOthers" },
  //             { role: "unhide" },
  //             { type: "separator" },
  //             { role: "quit" },
  //           ],
  //         },
  //       ]
  //     : []),
  //   // { role: 'fileMenu' }
  //   {
  //     label: "File",
  //     submenu: [
  //       // Você pode conectar estes itens a IPC handlers se quiser
  //       // { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => { win.webContents.send('menu-action', 'new-project'); } },
  //       // { label: 'Open Image...', accelerator: 'CmdOrCtrl+O', click: () => { win.webContents.send('menu-action', 'open-image'); } },
  //       // { label: 'Save Image...', accelerator: 'CmdOrCtrl+S', click: () => { win.webContents.send('menu-action', 'save-image'); } },
  //       { type: "separator" },
  //       isMac ? { role: "close" } : { role: "quit" }, // 'close' é Cmd+W, 'quit' é Alt+F4
  //     ],
  //   },
  //   // { role: 'viewMenu' } (ESSENCIAL PARA DEBUG)
  //   {
  //     label: "View",
  //     submenu: [
  //       { role: "reload" },
  //       { role: "forceReload" },
  //       { role: "toggleDevTools" },
  //       { type: "separator" },
  //       { role: "resetZoom" },
  //       { role: "zoomIn" },
  //       { role: "zoomOut" },
  //       { type: "separator" },
  //       { role: "togglefullscreen" },
  //     ],
  //   },
  //   // { role: 'windowMenu' }
  //   {
  //     label: "Window",
  //     submenu: [
  //       { role: "minimize" },
  //       ...(isMac
  //         ? [
  //             { type: "separator" },
  //             { role: "front" },
  //             { type: "separator" },
  //             { role: "window" },
  //           ]
  //         : [{ role: "close" }]),
  //     ],
  //   },
  // ];

  // const template = [
  //   ...(isMac
  //     ? [
  //         {
  //           label: app.name,
  //           submenu: [
  //             { role: "about" },
  //             { type: "separator" },
  //             { role: "services" },
  //             { type: "separator" },
  //             { role: "hide" },
  //             { role: "hideOthers" },
  //             { role: "unhide" },
  //             { type: "separator" },
  //             { role: "quit" },
  //           ],
  //         },
  //       ]
  //     : []),
  // ]; // Menu simples

  // const menu = Menu.buildFromTemplate(template);
  // Menu.setApplicationMenu(menu);

  win.setMenu(null);
}

// Set app name before it's ready
// app.setName("OpenCreate Forge");

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
      await fs.writeFile(filePath, buffer); // Previne congelamento da aplicação enquanto escreve o arquivo
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 1. RENOMEIE o handler "dialog:saveProject" para "dialog:saveProjectAs"
  ipcMain.handle("dialog:saveProjectAs", async (event, { jsonString, defaultName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Salvar Projeto Como...", // Título atualizado
      defaultPath: defaultName || "projeto.ocfd",
      filters: [{ name: "OpenCreate Forge Document", extensions: ["ocfd"] }],
    });
    if (canceled || !filePath) {
      // Retorna o filePath como nulo se cancelado
      return { success: false, filePath: null };
    }
    let projectData = await JSON.parse(jsonString);
    projectData = {
      ...projectData,
      originalName: projectData.name,
      name: filePath.split(/[\\/]/).pop(),
    };

    jsonString = JSON.stringify(projectData);

    try {
      await fs.writeFile(filePath, jsonString);
      return { success: true, filePath }; // Retorna o caminho bem-sucedido
    } catch (err) {
      return { success: false, error: err.message, filePath: null };
    }
  });

  // 2. CRIE o NOVO handler "fs:saveProject" para salvamento rápido
  ipcMain.handle("fs:saveProject", async (event, { jsonString, filePath }) => {
    if (!filePath) {
      return { success: false, error: "Nenhum caminho de arquivo fornecido." };
    }
    try {
      await fs.writeFile(filePath, jsonString); // Salva no caminho existente
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 3. ADICIONE um handler para o diálogo de confirmação de fechamento
  ipcMain.handle("dialog:confirmClose", async (event, projectName) => {
    const { response } = await dialog.showMessageBox({
      type: "question",
      buttons: ["Salvar", "Não Salvar", "Cancelar"],
      defaultId: 0, // Botão "Salvar" é o padrão
      cancelId: 2, // Botão "Cancelar"
      message: `Deseja salvar as alterações em "${projectName}"?`,
      detail: "Suas alterações serão perdidas se você não as salvar.",
    });
    return response; // Retorna o índice do botão clicado (0, 1, ou 2)
  });

  // --- NOVO: Handler para abrir o arquivo de projeto (.ocfd) ---
  ipcMain.handle("dialog:openProject", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Abrir Projeto",
      properties: ["openFile"],
      filters: [{ name: "OpenCreate Forge Document", extensions: ["ocfd"] }],
    });
    if (canceled || !filePaths[0]) {
      return null;
    }

    const filePath = filePaths[0];
    try {
      // ***** INÍCIO DA CORREÇÃO *****
      // Esta linha é ESSENCIAL. Ela lê o arquivo.
      const content = await fs.readFile(filePath, "utf8");
      // Retorna o conteúdo para o app.js
      return { success: true, filePath, content };
      // ***** FIM DA CORREÇÃO *****
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- NOVO: Handler para ler um arquivo (usado pelo Drag-and-Drop) ---
  // ipcMain.handle("fs:readFile", async (event, filePath) => {
  //   try {
  //     const content = await fs.readFile(filePath, "utf8");
  //     return { success: true, content };
  //   } catch (err) {
  //     return { success: false, error: err.message };
  //   }
  // });

  // if (process.platform === "darwin") {
  //   const iconPath = path.join(__dirname, "favicon-darwin-liquid.png");
  //   app.dock.setIcon(iconPath);
  // }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

// Limita a criação de novas janelas e navegação
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    // Previne navegação. Sua app só deve carregar 'index.html'
    event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    // Previne que 'window.open()' funcione
    return { action: "deny" };
  });
});
