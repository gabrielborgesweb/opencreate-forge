// renderer/app.js

const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnGrayscale = document.getElementById("btnGrayscale");
const toolButtons = document.querySelectorAll(".tool-button");
// const canvas = document.getElementById("mainCanvas");

// Assumindo que openFile devolve um caminho (ou base64) - depende da interface que você fizer
btnOpen.addEventListener("click", async () => {
  console.log("Botão de abrir clicado");
  const result = await window.electronAPI.openFile();
  console.log("Result do openFile:", result);
  if (result) {
    loadImage(result);
  }
});

btnSave.addEventListener("click", async () => {
  console.log("Botão Salvar clicado");

  // Obter imagem do canvas como dataURL (PNG por exemplo)
  const canvas = document.getElementById("mainCanvas");
  const dataURL = canvas.toDataURL("image/png");

  // Opcional: definir nome padrão
  const defaultName = "opencreate_image.png";

  const result = await window.electronAPI.saveFile({ dataURL, defaultName });
  console.log("Resultado do saveFile:", result);
  if (result.success) {
    alert("Imagem salva em: " + result.filePath);
  } else {
    console.warn("Falha ao salvar:", result.error);
  }
});

btnGrayscale.addEventListener("click", () => {
  applyFilter(window.Filters.grayscale);
});

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    toolButtons.forEach((b) => b.removeAttribute("active"));
    btn.setAttribute("active", "true");
    console.log(`Ferramenta selecionada: ${btn.id}`);
    // Aqui você pode definir a ferramenta ativa no seu app
  });
});

// --------- ZOOM & PAN (touchpad + mouse) ---------
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  // Trackpad pinch (ctrlKey=true) OU mouse + Ctrl/Cmd pressionado
  if (e.ctrlKey || e.metaKey) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);

    originX = mouseX - (mouseX - originX) * (newScale / scale);
    originY = mouseY - (mouseY - originY) * (newScale / scale);

    scale = newScale;
    draw();
  } else {
    // Dois dedos no trackpad → PAN
    originX -= e.deltaX;
    originY -= e.deltaY;
    draw();
  }
});

// --------- PAN (mouse botão do meio) ---------
canvas.addEventListener("mousedown", (e) => {
  // Botão do meio (e.button === 1)
  if (e.button === 1) {
    isPanning = true;
    startX = e.clientX - originX;
    startY = e.clientY - originY;
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isPanning) return;
  originX = e.clientX - startX;
  originY = e.clientY - startY;
  draw();
});

canvas.addEventListener("mouseup", () => (isPanning = false));
canvas.addEventListener("mouseleave", () => (isPanning = false));
