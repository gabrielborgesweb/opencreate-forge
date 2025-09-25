const canvas = document.getElementById("mainCanvas");
const ctx = canvas.getContext("2d");

let currentImageData = null;

function loadImage(filePath) {
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  };
  img.src = filePath;
}

// função para aplicar filtro genérico
function applyFilter(filterFunc) {
  if (!currentImageData) return;
  const newData = ctx.createImageData(
    currentImageData.width,
    currentImageData.height
  );
  const src = currentImageData.data;
  const dst = newData.data;
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i],
      g = src[i + 1],
      b = src[i + 2],
      a = src[i + 3];
    const [nr, ng, nb, na] = filterFunc(r, g, b, a);
    dst[i] = nr;
    dst[i + 1] = ng;
    dst[i + 2] = nb;
    dst[i + 3] = na;
  }
  ctx.putImageData(newData, 0, 0);
  currentImageData = newData;
}
