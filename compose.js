// Composición de portadas 9:16: foto encuadrada, titular (Antonio o Big Shoulders) detrás
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
  small: '',           // línea pequeña opcional encima del titular (como en Voltereta)
  smallSize: 0.08,     // fracción del ancho
  titleFont: 'Antonio',
  titleWeight: 700,
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

// Interletrado del titular: -10 milésimas de em, como el tracking de Illustrator.
const TITLE_TRACKING = -10 / 1000;

// Si el navegador no admite letterSpacing en canvas, se espacia letra a letra.
function lineWidth(ctx, line, spacing) {
  if ('letterSpacing' in ctx) return ctx.measureText(line).width;
  const chars = [...line];
  return chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
}

function drawLine(ctx, line, cx, y, spacing) {
  if ('letterSpacing' in ctx) { ctx.fillText(line, cx, y); return; }
  ctx.textAlign = 'left';
  let x = cx - lineWidth(ctx, line, spacing) / 2;
  for (const ch of line) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + spacing; }
  ctx.textAlign = 'center';
}

function setTitleFont(ctx, o, px) {
  ctx.font = `${o.titleWeight} ${px}px "${o.titleFont}"`;
  const spacing = px * TITLE_TRACKING;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  return spacing;
}

// Ajusta el tamaño para que ninguna línea supere el ancho útil.
function fitSize(ctx, o, lines, px, maxW) {
  const sp = setTitleFont(ctx, o, px);
  const widest = Math.max(...lines.map((l) => lineWidth(ctx, l, sp)));
  return widest > maxW ? Math.floor(px * maxW / widest) : px;
}

function drawTitle(ctx, width, height, o) {
  const prep = (t) => {
    t = (t || '').trim();
    if (o.uppercase) t = t.toLocaleUpperCase('es-ES');
    return t.split('\n').map((l) => l.trim()).filter(Boolean);
  };
  const lines = prep(o.title);
  const small = prep(o.small).join(' ');
  if (!lines.length && !small) return;
  ctx.save();
  const maxW = width * 0.92;
  // El tamaño elegido es el máximo: si una línea no cabe, se reduce para que nunca se corte.
  const px = lines.length ? fitSize(ctx, o, lines, Math.round(width * o.titleSize), maxW) : 0;
  const smallPx = small ? fitSize(ctx, o, [small], Math.round(width * o.smallSize), maxW) : 0;
  ctx.fillStyle = o.titleColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Centra el bloque usando la altura de mayúsculas para que no quede descolgado.
  setTitleFont(ctx, o, 100);
  const capRatio = (ctx.measureText('H').actualBoundingBoxAscent || 72) / 100;
  const step = px * o.titleLeading;
  const bigH = lines.length ? px * capRatio + step * (lines.length - 1) : 0;
  // Separación entre la línea pequeña y el titular: también la controla el interlineado
  // (con 0,86 queda pegada como en Voltereta; más interlineado, más aire).
  const gap = small && lines.length ? Math.max(smallPx * 0.25, smallPx * 0.45 + px * (o.titleLeading - 0.86)) : 0;
  const blockH = (small ? smallPx * capRatio : 0) + gap + bigH;
  let top = height * o.titleY - blockH / 2;
  if (small) {
    const sp = setTitleFont(ctx, o, smallPx);
    drawLine(ctx, small, width / 2, top + smallPx * capRatio, sp);
    top += smallPx * capRatio + gap;
  }
  if (lines.length) {
    const sp = setTitleFont(ctx, o, px);
    let base = top + px * capRatio;
    for (const l of lines) { drawLine(ctx, l, width / 2, base, sp); base += step; }
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
