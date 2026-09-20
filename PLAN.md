# Armario — Plan de implementación

App personal (un solo usuario, sin cuentas) para catalogar la ropa, montar outfits y recibir una sugerencia diaria en la home. PWA offline, todo en el dispositivo.

---

## 1. Stack

| Pieza | Elección | Motivo |
|---|---|---|
| Build | Vite + React + TypeScript (strict) | Mismo patrón que el resto de mis proyectos |
| Estilos | Tailwind CSS | Rápido, sin fichero de CSS creciendo |
| Router | React Router en modo `HashRouter` | GitHub Pages no hace fallback de SPA |
| Persistencia | Dexie.js sobre IndexedDB | Guarda Blobs de imagen sin pasar por base64 |
| Estado UI | Zustand | Ligero; los datos vienen de Dexie vía `dexie-react-hooks` |
| Recorte de fondo | `@imgly/background-removal` | Corre en el navegador con WASM, sin API key ni coste |
| PWA | `vite-plugin-pwa` (Workbox) | Instalable y offline, incluido el modelo de recorte cacheado |
| Tests | Vitest | Solo para la lógica de sugerencia y los reductores |
| Hosting | GitHub Pages desde repo público, GitHub Actions | Igual que el proyecto de recetas |

Reglas transversales:
- TypeScript estricto, sin `any`.
- Nada de backend, cuentas ni llamadas de red en tiempo de ejecución (salvo la descarga inicial del modelo de recorte).
- Móvil primero: el diseño se valida a 390 px de ancho. El escritorio es secundario.
- Todo el texto de la interfaz en español.

---

## 2. Modelo de datos

```ts
type Category = 'superior' | 'inferior' | 'calzado' | 'abrigo' | 'accesorio';
type Season   = 'primavera' | 'verano' | 'otono' | 'invierno';

interface Garment {
  id: string;
  name: string;                 // "Camisa lino beige"
  category: Category;
  seasons: Season[];            // vacío = todo el año
  colorHex: string;             // dominante, extraído automáticamente
  colorName: string;            // nombre aproximado, editable
  tags: string[];               // libres: "oficina", "boda", "cómodo"
  imageOriginal: Blob;
  imageCutout: Blob | null;     // null mientras no se haya procesado
  thumbnail: Blob;              // 300px, para la rejilla
  useCutout: boolean;           // si false, se usa la original en los collages
  archived: boolean;
  createdAt: number;
}

interface Outfit {
  id: string;
  name: string;
  garmentIds: string[];
  tags: string[];
  createdAt: number;
}

interface WearLog {
  id: string;
  date: string;                 // YYYY-MM-DD
  garmentIds: string[];
  outfitId: string | null;
  source: 'sugerido' | 'manual';
}
```

Índices de Dexie: `garments` por `category`, `archived`, `*tags`; `outfits` por `*tags`; `wearLogs` por `date` y `*garmentIds`.

---

## 3. Fases

Una fase por sesión de Claude Code. Cada fase termina compilando, desplegada y usable.

### Fase 0 — Esqueleto
- Proyecto Vite + React + TS + Tailwind.
- `vite-plugin-pwa` con manifiesto, iconos placeholder y service worker.
- Dexie inicializado con los tres almacenes y las migraciones vacías.
- HashRouter con cuatro rutas: `/` (home), `/armario`, `/outfits`, `/prenda/:id`.
- Barra de navegación inferior fija con tres pestañas.
- Workflow de GitHub Actions que despliega a Pages en cada push a `main`, con `base` configurado.

**Hecho cuando:** se instala en el móvil desde el navegador y navega entre pestañas vacías sin conexión.

### Fase 1 — Armario
- Botón de añadir prenda: abre la cámara o la galería (`<input type="file" accept="image/*" capture>`).
- Formulario: nombre, categoría, temporadas, etiquetas. Guarda original + miniatura en IndexedDB.
- Rejilla de dos columnas con las miniaturas, agrupada por categoría.
- Detalle de prenda: imagen grande, editar campos, archivar, borrar.
- Estado vacío con instrucciones.

En esta fase la imagen se guarda **sin recortar**. No adelantar la Fase 2.

**Hecho cuando:** puedo meter 20 prendas reales desde el móvil y verlas en la rejilla.

### Fase 2 — Recorte y color
- Al guardar una prenda, encolar el recorte con `@imgly/background-removal` en un Web Worker.
- Indicador de "procesando" en la tarjeta; la prenda es usable mientras tanto.
- Extraer el color dominante del recorte (muestreo de píxeles no transparentes, k-means con k=3, descartando grises si hay alternativa) y asignar el nombre aproximado más cercano de una paleta fija.
- En el detalle: interruptor "usar recorte / usar original" y botón de reprocesar.
- Cachear el modelo WASM en el service worker para que el segundo uso sea offline.

Sin pincel ni goma de borrar. Si el recorte sale mal, se usa la original.

**Hecho cuando:** las prendas se ven sobre fondo transparente y cada una tiene un color asignado.

### Fase 3 — Outfits
- Crear outfit: selector por categorías, máximo una prenda por categoría salvo accesorios.
- Collage con posiciones **fijas** por categoría, renderizado en un `<canvas>` y cacheado como Blob:
  - abrigo arriba-izquierda, superior centro-arriba, inferior centro-abajo, calzado abajo-derecha, accesorios en columna lateral.
- Guardar con nombre y etiquetas. Lista de outfits con su collage.
- Filtro de outfits por etiqueta. Editar y borrar.

Nada de composición dinámica ni arrastrar y soltar. Posiciones fijas.

**Hecho cuando:** tengo cinco outfits guardados y sus collages se ven bien.

### Fase 4 — Home y sugerencia
- La home muestra una tarjeta grande con el outfit del día y una etiqueta que indica su origen: *Guardado* o *Nuevo*.
- El motor alterna: 50 % un outfit guardado al azar, 50 % una combinación generada.
- Generación: una prenda por categoría (superior, inferior, calzado; abrigo según temporada actual por fecha), respetando `seasons`, excluyendo archivadas y excluyendo cualquier prenda registrada en `wearLogs` en los últimos 7 días. Si no hay candidatos suficientes, relajar primero la regla de repetición y luego la de temporada, e indicarlo en la interfaz.
- Botones: "Otra sugerencia" y "Me lo puse hoy" (escribe el `WearLog`).
- Desde la sugerencia generada: "Guardar como outfit".
- Tests de Vitest para el motor: respeta temporada, respeta no-repetición, degrada correctamente con armario pequeño.

**Hecho cuando:** abro la app por la mañana y la sugerencia es usable sin tocar nada más.

### Fase 5 — Copia de seguridad y pulido
- **Export/import en JSON + imágenes dentro de un `.zip`.** No es opcional: todos los datos viven solo en este dispositivo.
- Filtros del armario por categoría, color y etiqueta.
- Iconos y splash de la PWA en condiciones.
- Estados vacíos, de carga y de error en todas las pantallas.
- Aviso al ocupar mucho almacenamiento (`navigator.storage.estimate`) y solicitud de almacenamiento persistente.

### Fase 6 — Estilo y puntuación
Motor de reglas **en el dispositivo** (sin red, sin claves): objetivo y reproducible.
- `src/lib/style.ts`: puntuación 0–100 de un conjunto de prendas con desglose explicable:
  - Armonía de color (0–35): neutros vs cromáticos en LCh; un acento sobre neutros es lo mejor; dos cromáticos según relación de tono (monocromo, análogos, complementarios, triádicos, choque); penaliza más de tres cromáticos.
  - Contraste de luminosidad entre superior e inferior (0–20).
  - Equilibrio de saturación: cuántas prendas muy saturadas (0–15).
  - Temporada: todas las prendas encajan con la actual (0–15).
  - Coherencia de estilo por etiquetas: formal vs casual (0–15).
- La sugerencia generada deja de ser al azar: se generan varias candidatas válidas y se elige entre las mejor puntuadas (con algo de azar para variar).
- Score visible en la tarjeta de Hoy, en las tarjetas y el editor de outfits (en vivo mientras eliges), con "por qué" desplegable.
- Tests de Vitest de cada regla y del ranking.

**Hecho cuando:** dos outfits que a ojo funcionan y chirrían obtienen notas claramente distintas, y el desglose explica por qué.

### Fase 7 — Animaciones
Con `motion` (`motion/react`), respetando `prefers-reduced-motion`.
- Transición entre pantallas; entrada escalonada de rejillas; hoja de añadir prenda y panel de filtros animados.
- La tarjeta de Hoy se voltea al pedir otra sugerencia y se puede **deslizar** para pedirla.
- El collage de la sugerencia y del editor se monta **pieza a pieza** (prendas posicionadas en DOM con las mismas cajas que el canvas).
- El score sube con un contador y anillo.
- Deslizar una tarjeta del armario para archivar, con deshacer.
- Confeti al registrar un outfit con nota alta.

---

## 4. Fuera de alcance

No implementar sin que yo lo pida explícitamente:

- Cuentas, login, sincronización o compartir con terceros.
- Recomendación con un LLM externo (API con clave, red, coste). La teoría del color y la compatibilidad van por reglas locales (Fase 6).
- API del tiempo (candidata a una Fase 6, no antes).
- Estadísticas de uso, prendas sin usar, coste por puesta.
- Planificador de maleta, lista de la compra, precios, marcas, enlaces a tiendas.
- Escaneo de etiquetas o códigos de barras.
- Modo oscuro dedicado (basta con respetar `prefers-color-scheme`).

---

## 5. Riesgos conocidos

1. **Tamaño del modelo de recorte** (~40 MB la primera vez). Si la descarga inicial resulta intolerable en móvil, la alternativa es hacer el recorte en el escritorio y sincronizar por el export/import.
2. **Cuota de IndexedDB.** Guardar original + recorte + miniatura por prenda multiplica por tres. Si pesa demasiado, descartar la original una vez validado el recorte.
3. **Calidad del recorte** con prendas blancas o negras sobre fondos similares. Por eso el interruptor de la Fase 2 es imprescindible.
