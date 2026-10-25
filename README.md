# Portadas · Manu

Hacedor de portadas de reels (1080×1920): sube una foto, escribe el titular y descarga la portada con el texto detrás de la persona.

- Titular detrás de la persona, en **Antonio** (Bold o SemiBold) o **Big Shoulders Display** (Black o ExtraBold).
- Texto extra opcional en **Rethink Sans**, por delante.
- Color del texto a un clic: verde claro `#6FBF84`, verde oscuro `#142116` o blanco `#FFFFFF`.
- Encuadre de la foto (zoom y posición) y guía del recorte 3:4 que se ve en la cuadrícula del perfil.

Todo corre en el navegador. No hay servidor ni servicios de pago: el recorte lo hace el modelo MODNet (licencia Apache 2.0) descargado desde Hugging Face la primera vez y guardado en caché.

## Abrir

Doble clic en `index.html`. Funciona directamente desde la carpeta en Chrome, Safari o Firefox actuales. Hace falta conexión a internet la primera vez para descargar el modelo de recorte.

Alternativa: doble clic en `Abrir portadas.command`, que arranca un servidor local y abre http://localhost:8080.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo (por ejemplo `portadas-manu`) y sube el contenido de esta carpeta.
2. En el repositorio: Settings → Pages → Source: *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. En un minuto estará en `https://<tu-usuario>.github.io/portadas-manu/`.

## Archivos

- `index.html`, `style.css`: interfaz.
- `app.js`: carga de fotos, recorte, controles y descarga.
- `compose.js`: composición (foto encuadrada, titular, persona recortada, texto extra). Expone `PortadaCompose`.
- `fonts/`: Antonio, Big Shoulders Display y Rethink Sans (licencia SIL Open Font License, uso comercial libre).

Al cambiar `style.css`, `compose.js` o `app.js`, sube el número `?v=` en `index.html` para que los navegadores no sigan usando la versión guardada en caché.
