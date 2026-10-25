// Composición de portadas 9:16: foto encuadrada, titular (Big Shoulders) detrás
// de la persona y texto extra (Rethink Sans) por delante.
// Funciona en navegador (script clásico, expone PortadaCompose) y en Node (require).

const PortadaCompose = (function () {
const WIDTH = 1080;
const HEIGHT = 1920;

const defaults = {
  title: 'MEJORA\nTU SWING',
  titleY: 0.3,         // centro del titular, fracción de la altura
  titleSize: 0.3,      // fracción del ancho
  titleLeading: 0.86,  // interlineado del titular
  titleWeight: 900,
  titleColor: '#FFFFFF',
  uppercase: true,
  extra: 'Tres ejercicios para ganar rotación',
  extraY: 0.8,
  extraSize: 0.05,
  extraWeight: 600,
  extraColor: '#FFFFFF',
  zoom: 1,             // encuadre de la foto
  panX: 0.5,
  panY: 0.5,
  darken: 0.15,
  cutout: true,
};

// Dibuja la foto (o la máscara) cubriendo el lienzo con zoom y desplazamiento.
function drawFramed(ctx, source, sw, sh, width, height, o) {
  const scale = Math.max(width / sw, height / sh) * o.zoom;
  const dw = sw * scale;
  const dh = sh * scale;
  const x = (width - dw) * o.panX;
  const y = (height - dh) * o.panY;
  ctx.drawImage(source, x, y, dw, dh);
}

// mask: { width, height, data } con un canal (0–255).
function maskToCanvas(createCanvas, mask, feather = 1) {
  const c = createCanvas(mask.width, mask.height);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(mask.width, mask.height);
  const d = img.data;
  const ch = mask.channels || 1;
  for (let i = 0, j = 0; i < mask.data.length; i += ch, j += 4) {
    d[j] = 255; d[j + 1] = 255; d[j + 2] = 255; d[j + 3] = mask.data[i];
  }
  ctx.putImageData(img, 0, 0);
  if (feather > 0) {
    const f = createCanvas(mask.width, mask.height);
    const fctx = f.getContext('2d');
    fctx.filter = `blur(${feather}px)`;
    fctx.drawImage(c, 0, 0);
    return f;
  }
  return c;
}

// Persona recortada ya encuadrada al tamaño final.
function makeCutout(createCanvas, image, maskCanvas, width, height, o) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  drawFramed(ctx, image, image.width, image.height, width, height, o);
  ctx.globalCompositeOperation = 'destination-in';
  drawFramed(ctx, maskCanvas, maskCanvas.width, maskCanvas.height, width, height, o);
  return c;
}

function drawTitle(ctx, width, height, o) {
  let text = (o.title || '').trim();
  if (!text) return;
  if (o.uppercase) text = text.toLocaleUpperCase('es-ES');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  ctx.save();
  // El tamaño elegido es el máximo: si la línea más larga no cabe, se reduce para que nunca se corte.
  let px = Math.round(width * o.titleSize);
  ctx.font = `${o.titleWeight} ${px}px "Big Shoulders Display"`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const maxW = width * 0.92;
  if (widest > maxW) {
    px = Math.floor(px * maxW / widest);
    ctx.font = `${o.titleWeight} ${px}px "Big Shoulders Display"`;
  }
  const step = px * o.titleLeading;
  ctx.fillStyle = o.titleColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Centra el bloque usando la altura de mayúsculas para que no quede descolgado.
  const capH = px * 0.72;
  const blockH = capH + step * (lines.length - 1);
  let base = height * o.titleY - blockH / 2 + capH;
  for (const l of lines) {
    ctx.fillText(l, width / 2, base);
    base += step;
  }
  ctx.restore();
}

// Corta el texto extra en líneas que caben en el ancho útil (respeta los saltos manuales).
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function drawExtra(ctx, width, height, o) {
  const text = (o.extra || '').trim();
  if (!text) return;
  const px = Math.round(width * o.extraSize);
  ctx.save();
  ctx.font = `${o.extraWeight} ${px}px "Rethink Sans"`;
  ctx.fillStyle = o.extraColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrap(ctx, text, width * 0.82);
  const step = px * 1.22;
  // Sombra muy suave para que se lea sobre cualquier foto.
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = px * 0.5;
  let y = height * o.extraY - (step * (lines.length - 1)) / 2;
  for (const l of lines) { ctx.fillText(l, width / 2, y); y += step; }
  ctx.restore();
}

// image: canvas o imagen con la foto original. cutoutCanvas: persona encuadrada o null.
function compose(createCanvas, { image, cutoutCanvas, width = WIDTH, height = HEIGHT, options }) {
  const o = { ...defaults, ...options };
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#142116';
  ctx.fillRect(0, 0, width, height);
  if (image) drawFramed(ctx, image, image.width, image.height, width, height, o);
  if (o.darken > 0) {
    ctx.fillStyle = `rgba(20,33,22,${o.darken})`;
    ctx.fillRect(0, 0, width, height);
  }
  drawTitle(ctx, width, height, o);
  if (o.cutout && cutoutCanvas) ctx.drawImage(cutoutCanvas, 0, 0, width, height);
  drawExtra(ctx, width, height, o);
  return c;
}

  return { WIDTH, HEIGHT, defaults, maskToCanvas, makeCutout, compose };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PortadaCompose;
