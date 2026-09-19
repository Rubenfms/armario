/**
 * Puente entre el botón de «Añadir prenda» del armario y el formulario de
 * alta: el usuario elige la foto y navegamos con ella ya en mano. Se guarda
 * en memoria, no en el estado del router, porque una foto de móvil son varios
 * MB y el historial tiene límites de tamaño según el navegador.
 */
let pending: Blob | null = null;

export function setPendingPhoto(photo: Blob): void {
  pending = photo;
}

/** Devuelve la foto pendiente (si la hay) y la olvida. */
export function takePendingPhoto(): Blob | null {
  const photo = pending;
  pending = null;
  return photo;
}
