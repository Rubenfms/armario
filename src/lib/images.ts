/**
 * Miniatura para la rejilla: el lado mayor queda en `maxSide` px. Se respeta
 * la orientación EXIF (las fotos de móvil vienen casi siempre giradas) y se
 * codifica como JPEG, que para una foto pesa una fracción del PNG.
 */
export async function makeThumbnail(image: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el contexto 2D');
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo codificar la miniatura'))),
        'image/jpeg',
        0.85,
      );
    });
  } finally {
    bitmap.close();
  }
}
