// Composición de portadas 9:16: foto encuadrada, titular (Antonio) detrás
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
  glow: 0.02,          // resplandor del titular, fracción del ancho (como en Voltereta)
  glowOpacity: 0.8,
  punch: 0.5,          // retoque de la foto: contraste, color, persona iluminada y viñeta (0–1)
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

// Titular como en Voltereta: línea pequeña encima y línea grande debajo, cada una
// con su tamaño, sin reducir nada automáticamente (lo que marcas es lo que sale).
// Se coloca según la tinta real de las letras, tildes incluidas, para que nada se pise.
function drawTitle(ctx, width, height, o) {
  const prep = (t) => {
    t = (t || '').trim();
    if (o.uppercase) t = t.toLocaleUpperCase('es-ES');
    return t.split('\n').map((l) => l.trim()).filter(Boolean);
  };
  const big = prep(o.title);
  const small = prep(o.small);
  if (!big.length && !small.length) return;
  const bigPx = Math.round(width * o.titleSize);
  const smallPx = Math.round(width * o.smallSize);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Medidas de cada bloque: alto de la tinta de la primera línea y de la última.
  const block = (lines, px) => {
    if (!lines.length) return null;
    setTitleFont(ctx, o, px);
    const first = ctx.measureText(lines[0]);
    const last = ctx.measureText(lines[lines.length - 1]);
    const step = px * o.titleLeading;   // el interlineado separa las líneas del bloque
    const ascent = first.actualBoundingBoxAscent;
    const descent = last.actualBoundingBoxDescent;
    return { lines, px, step, ascent, height: ascent + step * (lines.length - 1) + descent };
  };
  const S = block(small, smallPx);
  const B = block(big, bigPx);
  // Separación fija entre la línea pequeña y la grande, como en Voltereta.
  const gap = S && B ? Math.round(bigPx * 0.05) : 0;
  const total = (S ? S.height : 0) + gap + (B ? B.height : 0);
  let top = height * o.titleY - total / 2;
  const cx = width / 2;
  ctx.fillStyle = o.titleColor;
  for (const blk of [S, B]) {
    if (!blk) continue;
    const sp = setTitleFont(ctx, o, blk.px);
    blk.lines.forEach((l, i) => drawLine(ctx, l, cx, top + blk.ascent + blk.step * i, sp));
    top += blk.height + gap;
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
  const k = Math.max(0, Math.min(1, o.punch || 0));
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#142116';
  ctx.fillRect(0, 0, width, height);
  // Fondo con algo más de contraste y color.
  if (image) {
    ctx.save();
    if (k > 0) ctx.filter = `contrast(${1 + 0.22 * k}) saturate(${1 + 0.18 * k}) brightness(${1 - 0.04 * k})`;
    drawFramed(ctx, image, image.width, image.height, width, height, o);
    ctx.restore();
  }
  if (o.darken > 0) {
    ctx.fillStyle = `rgba(20,33,22,${o.darken})`;
    ctx.fillRect(0, 0, width, height);
  }
  // Viñeta: oscurece los bordes para llevar la mirada al centro.
  if (k > 0) {
    const g = ctx.createRadialGradient(width / 2, height * 0.42, width * 0.25, width / 2, height * 0.5, height * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.45 * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  // Titular en una capa aparte; el glow es esa capa desenfocada (como en Voltereta).
  const layer = createCanvas(width, height);
  drawTitle(layer.getContext('2d'), width, height, o);
  const r = Math.max(0, width * (o.glow || 0));
  if (r > 0 && o.glowOpacity > 0) {
    for (const [radius, alpha] of [[r, o.glowOpacity], [r * 0.4, o.glowOpacity * 0.7]]) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${radius}px)`;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }
  ctx.drawImage(layer, 0, 0);
  // Persona por delante, algo más iluminada y con más contraste que el fondo.
  if (o.cutout && cutoutCanvas) {
    ctx.save();
    if (k > 0) ctx.filter = `brightness(${1 + 0.14 * k}) contrast(${1 + 0.16 * k}) saturate(${1 + 0.12 * k})`;
    ctx.drawImage(cutoutCanvas, 0, 0, width, height);
    ctx.restore();
  }
  drawExtra(ctx, width, height, o);
  return c;
}

  return { WIDTH, HEIGHT, defaults, maskToCanvas, makeCutout, compose };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PortadaCompose;
