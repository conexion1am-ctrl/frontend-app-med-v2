// Sistema de temas de la empresa (2026-08-27, fase 2, a pedido del usuario): además de guardar
// un solo color en empresa.color_hex (que ya usan ~18 pantallas y los PDFs, sin tocarlos), esta
// fase aplica los 4 tonos de cada tema a fondos de pantalla, tarjetas y texto, para que ninguna
// pantalla quede en blanco puro.
//
// IMPORTANTE: esta lista debe tener EXACTAMENTE los mismos 8 temas y el mismo tono "base" que
// EditarPerfilScreen.tsx (donde el usuario los elige) — si un tema cambia aquí, cambiar también
// allá, y viceversa. La búsqueda es por color "base" porque es el único dato que se guarda hoy
// en la base de datos (empresa.color_hex).
export const TEMAS = [
  { nombre: 'Gris pizarra', base: '#5F5E5A', claro: '#F1EFE8', medio: '#B4B2A9', oscuro: '#2C2C2A' },
  { nombre: 'Azul acero', base: '#185FA5', claro: '#E6F1FB', medio: '#85B7EB', oscuro: '#042C53' },
  { nombre: 'Ocre tierra', base: '#854F0B', claro: '#FAEEDA', medio: '#EF9F27', oscuro: '#412402' },
  { nombre: 'Verde bosque', base: '#3B6D11', claro: '#EAF3DE', medio: '#97C459', oscuro: '#173404' },
  { nombre: 'Rojo ladrillo', base: '#993C1D', claro: '#FAECE7', medio: '#F0997B', oscuro: '#4A1B0C' },
  { nombre: 'Amarillo quemado', base: '#A66A00', claro: '#FCF3DC', medio: '#E3A424', oscuro: '#4D3200' },
  { nombre: 'Rosa pastel', base: '#C46E90', claro: '#FBEFF3', medio: '#E3A9C0', oscuro: '#5E2C3E' },
  { nombre: 'Morado pastel', base: '#8B7BB8', claro: '#F2EFFA', medio: '#C0B4E0', oscuro: '#3C3260' },
];

const TEMA_POR_DEFECTO = TEMAS[1]; // Azul acero — mismo color que el default histórico (#1E90FF-ish)

// Recibe empresa.color_hex (el único dato guardado hoy) y devuelve el tema completo con sus 4
// tonos. Si el color no coincide con ningún tema conocido (por ejemplo, una empresa que quedó
// con un color de la paleta vieja de 16 colores sueltos, antes de este cambio), no rompe nada:
// devuelve un tema por defecto sensato en vez de fallar.
export function temaDesdeColor(colorHex) {
  const normalizado = (colorHex || '').toUpperCase();
  const encontrado = TEMAS.find((t) => t.base.toUpperCase() === normalizado);
  return encontrado || { ...TEMA_POR_DEFECTO, base: colorHex || TEMA_POR_DEFECTO.base };
}
