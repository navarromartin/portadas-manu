const { WIDTH, HEIGHT, compose, maskToCanvas, makeCutout, defaults } = PortadaCompose;
const LIB_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let lib = null; // { pipeline, env, RawImage }

async function getLib() {
  if (!lib) {
    lib = await import(LIB_URL);
    lib.env.allowLocalModels = false;
  }
  return lib;
}

const MAX_SIDE = 2400;    // resolución máxima con la que se guarda cada foto
const PREVIEW_W = 540;    // vista previa a la mitad de 1080×1920
const PREVIEW_H = 960;

// Colores de marca para los textos.
const BRAND = [
  { name: 'Verde claro', hex: '#6FBF84' },
  { name: 'Verde oscuro', hex: '#142116' },
  { name: 'Blanco', hex: '#FFFFFF' },
];

// Grosores disponibles de cada tipografía del titular.
const TITLE_WEIGHTS = {
  'Antonio': [{ name: 'Bold', value: 700 }, { name: 'SemiBold', value: 600 }],
  'Big Shoulders Display': [{ name: 'Black', value: 900 }, { name: 'ExtraBold', value: 800 }],
};

const $ = (id) => document.getElementById(id);
const createCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

const optionKeys = [
  'title', 'titleY', 'titleSize', 'titleLeading', 'titleFont', 'titleWeight', 'titleColor', 'uppercase', 'cutout',
  'extra', 'extraY', 'extraSize', 'extraWeight', 'extraColor',
  'zoom', 'panX', 'panY', 'darken',
];
const numeric = new Set(['titleY', 'titleSize', 'titleLeading', 'titleWeight', 'extraY', 'extraSize', 'extraWeight', 'zoom', 'panX', 'panY', 'darken']);
// Al cambiar de foto se conservan los textos y estilos, pero el encuadre es propio de cada foto.
const perPhoto = ['zoom', 'panX', 'panY'];

const ui = {
  drop: $('drop'), file: $('file'), thumbs: $('thumbs'), status: $('status'),
  preview: $('preview'), empty: $('empty'), download: $('download'), downloadAll: $('downloadAll'),
  format: $('format'), grid: $('grid'), gridGuide: $('gridGuide'),
};
for (const k of optionKeys) ui[k] = $(k);

const items = [];       // { name, image, maskCanvas, options, thumb, ready }
let current = null;
let segmenter = null;
let modelPromise = null;
let lastOptions = { ...defaults };

const setStatus = (t) => { ui.status.textContent = t; };

// ---------- modelo de recorte ----------
async function getSegmenter() {
  if (segmenter) return segmenter;
  if (!modelPromise) {
    modelPromise = (async () => {
      setStatus('Preparando el modelo de recorte, solo tarda la primera vez…');
      const opts = {
        dtype: 'fp32',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.file && p.file.endsWith('.onnx')) {
            setStatus(`Descargando el modelo de recorte… ${Math.round(p.progress)} %`);
          }
        },
      };
      const { pipeline } = await getLib();
      let seg;
      try {
        seg = await pipeline('image-segmentation', 'Xenova/modnet', { ...opts, device: 'webgpu' });
      } catch (e) {
        console.warn('WebGPU no disponible, usando wasm', e);
        seg = await pipeline('image-segmentation', 'Xenova/modnet', { ...opts, device: 'wasm' });
      }
      setStatus('');
      segmenter = seg;
      return seg;
    })();
  }
  return modelPromise;
}

async function segment(canvas) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const { RawImage, pipeline } = await getLib();
  const raw = await RawImage.fromBlob(blob);
  const seg = await getSegmenter();
  let out;
  try {
    out = await seg(raw);
  } catch (e) {
    // Si la inferencia en WebGPU falla, se reconstruye en wasm.
    console.warn('Fallo en inferencia, reintentando con wasm', e);
    segmenter = await pipeline('image-segmentation', 'Xenova/modnet', { dtype: 'fp32', device: 'wasm' });
    out = await segmenter(raw);
  }
  return out[0].mask;
}

// ---------- carga de fotos ----------
async function loadFile(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const image = createCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  image.getContext('2d').drawImage(bitmap, 0, 0, image.width, image.height);
  bitmap.close();

  const item = {
    name: file.name.replace(/\.[^.]+$/, ''),
    image, maskCanvas: null, ready: false,
    options: { ...lastOptions, zoom: 1, panX: 0.5, panY: 0.5 },
  };
  const thumb = document.createElement('img');
  thumb.src = image.toDataURL('image/jpeg', 0.6);
  thumb.title = file.name;
  thumb.addEventListener('click', () => select(item));
  item.thumb = thumb;
  ui.thumbs.appendChild(thumb);
  ui.thumbs.hidden = false;
  items.push(item);
  if (items.length > 1) ui.downloadAll.hidden = false;
  return item;
}

async function addFiles(files) {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  const added = [];
  for (const f of list) added.push(await loadFile(f));
  select(added[0]);
  for (const item of added) {
    setStatus(`Recortando ${item.name}…`);
    try {
      const mask = await segment(item.image);
      item.maskCanvas = maskToCanvas(createCanvas, mask, 1);
    } catch (e) {
      console.error(e);
      setStatus('No se ha podido recortar la persona. El titular se muestra por delante.');
      item.options.cutout = false;
    }
    item.ready = true;
    if (item === current) { syncControls(); render(); }
    updateButtons();
  }
  if (ui.status.textContent.startsWith('Recortando')) setStatus('');
}

// ---------- selección y controles ----------
function select(item) {
  if (current) current.thumb.classList.remove('active');
  current = item;
  item.thumb.classList.add('active');
  syncControls();
  render();
  updateButtons();
}

// Rellena el selector de grosor con los de la tipografía elegida.
function fillWeights(font) {
  ui.titleWeight.replaceChildren(...TITLE_WEIGHTS[font].map((w) => new Option(w.name, w.value)));
}

function syncControls() {
  const o = current ? current.options : lastOptions;
  fillWeights(o.titleFont);
  for (const k of optionKeys) {
    const el = ui[k];
    if (el.type === 'checkbox') el.checked = !!o[k]; else el.value = o[k];
  }
  ui.cutout.disabled = !(current && current.maskCanvas);
  updateSwatches();
}

function readControls() {
  const o = {};
  for (const k of optionKeys) {
    const el = ui[k];
    if (el.type === 'checkbox') o[k] = el.checked;
    else if (numeric.has(k)) o[k] = parseFloat(el.value);
    else o[k] = el.value;
  }
  return o;
}

function updateButtons() {
  ui.download.disabled = !!(current && !current.ready);
  ui.downloadAll.disabled = !items.length || !items.every((i) => i.ready);
}

// ---------- muestras de color ----------
function buildSwatches() {
  for (const box of document.querySelectorAll('.swatches')) {
    const target = ui[box.dataset.target];
    for (const c of BRAND) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = c.hex;
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      b.dataset.hex = c.hex;
      b.addEventListener('click', () => {
        target.value = c.hex.toLowerCase();
        target.dispatchEvent(new Event('input'));
      });
      box.appendChild(b);
    }
  }
}
function updateSwatches() {
  for (const box of document.querySelectorAll('.swatches')) {
    const v = ui[box.dataset.target].value.toLowerCase();
    for (const b of box.children) b.classList.toggle('on', b.dataset.hex.toLowerCase() === v);
  }
}

// ---------- render ----------
function renderAt(item, width, height) {
  const o = item ? item.options : lastOptions;
  const cut = item && item.maskCanvas ? makeCutout(createCanvas, item.image, item.maskCanvas, width, height, o) : null;
  return compose(createCanvas, { image: item ? item.image : null, cutoutCanvas: cut, width, height, options: o });
}

let frame = 0;
function render() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    ui.empty.hidden = !!current;
    const out = renderAt(current, PREVIEW_W, PREVIEW_H);
    ui.preview.getContext('2d').drawImage(out, 0, 0);
    ui.gridGuide.hidden = !ui.grid.checked;
  });
}

async function download(item) {
  const type = ui.format.value;
  const canvas = renderAt(item, WIDTH, HEIGHT);
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.93));
  const o = item ? item.options : lastOptions;
  const base = (o.title || '').replace(/\n/g, ' ') || (item && item.name) || 'portada';
  const slug = base.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'portada';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}.${type === 'image/png' ? 'png' : 'jpg'}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- eventos ----------
for (const k of optionKeys) {
  ui[k].addEventListener('input', () => {
    if (k === 'titleFont') fillWeights(ui.titleFont.value);
    const o = readControls();
    const shared = { ...o };
    for (const p of perPhoto) delete shared[p];
    lastOptions = { ...lastOptions, ...shared };
    if (current) current.options = o;
    updateSwatches();
    render();
  });
}
ui.grid.addEventListener('change', render);
ui.download.addEventListener('click', () => download(current));
ui.downloadAll.addEventListener('click', async () => {
  for (const item of items) { await download(item); await new Promise((r) => setTimeout(r, 400)); }
});
ui.file.addEventListener('change', () => { addFiles(ui.file.files); ui.file.value = ''; });
['dragenter', 'dragover'].forEach((ev) => ui.drop.addEventListener(ev, (e) => { e.preventDefault(); ui.drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => ui.drop.addEventListener(ev, (e) => { e.preventDefault(); ui.drop.classList.remove('over'); }));
ui.drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
document.addEventListener('paste', (e) => {
  const files = Array.from(e.clipboardData?.files || []);
  if (files.length) addFiles(files);
});

// ---------- arranque ----------
(async () => {
  buildSwatches();
  syncControls();
  await Promise.all([
    document.fonts.load('700 40px "Antonio"'),
    document.fonts.load('600 40px "Antonio"'),
    document.fonts.load('900 40px "Big Shoulders Display"'),
    document.fonts.load('800 40px "Big Shoulders Display"'),
    document.fonts.load('400 20px "Rethink Sans"'),
    document.fonts.load('600 20px "Rethink Sans"'),
    document.fonts.load('700 20px "Rethink Sans"'),
  ]).catch(() => {});
  render();
  getSegmenter().catch((e) => { console.error(e); setStatus('No se ha podido cargar el modelo de recorte. Hace falta conexión a internet la primera vez. Recarga la página.'); });
})();
