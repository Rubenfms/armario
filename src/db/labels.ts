import type { Category, Season } from './types';

export const CATEGORY_LABELS: Record<Category, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  calzado: 'Calzado',
  abrigo: 'Abrigo',
  accesorio: 'Accesorio',
};

export const SEASON_LABELS: Record<Season, string> = {
  primavera: 'Primavera',
  verano: 'Verano',
  otono: 'Otoño',
  invierno: 'Invierno',
};
