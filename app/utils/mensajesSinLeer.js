import api from './apiClient';
import * as Notifications from 'expo-notifications';

// Utilidad compartida para el indicador de "mensajes sin leer" en cascada (Empresas → Proyecto →
// Actividad → Persona) y el badge numérico del ícono de la app. Todas las pantallas que muestran
// el logo de mensaje llaman a obtenerMensajesSinLeer() y agrupan localmente el resultado según lo
// que necesiten mostrar — así solo hay UNA llamada al backend por pantalla, no una por fila.

// Trae la lista plana de mensajes sin leer dirigidos a este usuario, en toda la app.
// Cada fila: { id, proyecto_id, area_id, remitente_usuario_id, empresa_id }.
export async function obtenerMensajesSinLeer(usuarioId) {
  if (!usuarioId) return [];
  try {
    const res = await api.get(`/mensajes/no-leidos/${usuarioId}`);
    return res.data.sinLeer || [];
  } catch (error) {
    console.error('Error obteniendo mensajes sin leer:', error);
    return [];
  }
}

// true si hay al menos un mensaje sin leer para esa empresa (en cualquier proyecto).
export function empresaTieneSinLeer(sinLeer, empresaId) {
  return sinLeer.some((m) => m.empresa_id === empresaId);
}

// true si hay al menos un mensaje sin leer en ese proyecto puntual.
export function proyectoTieneSinLeer(sinLeer, proyectoId) {
  return sinLeer.some((m) => m.proyecto_id === proyectoId);
}

// true si hay al menos un mensaje sin leer en esa ficha de área, dentro de un proyecto.
export function areaTieneSinLeer(sinLeer, proyectoId, areaId) {
  return sinLeer.some((m) => m.proyecto_id === proyectoId && m.area_id === areaId);
}

// true si esa persona específica (remitente) tiene mensajes sin leer para mí, en esa área/proyecto.
export function personaTieneSinLeer(sinLeer, proyectoId, areaId, remitenteUsuarioId) {
  return sinLeer.some(
    (m) => m.proyecto_id === proyectoId && m.area_id === areaId && m.remitente_usuario_id === remitenteUsuarioId
  );
}

// Actualiza el numerito rojo sobre el ícono de la app con el total real de mensajes sin leer.
// Se llama después de cargar/recargar la lista de sin-leídos, y también al marcar algo como
// leído (abrir un chat) para que el número baje de inmediato sin esperar a la próxima recarga.
export async function actualizarBadge(usuarioId) {
  try {
    const sinLeer = await obtenerMensajesSinLeer(usuarioId);
    await Notifications.setBadgeCountAsync(sinLeer.length);
    return sinLeer;
  } catch (error) {
    console.error('Error actualizando badge:', error);
    return [];
  }
}
