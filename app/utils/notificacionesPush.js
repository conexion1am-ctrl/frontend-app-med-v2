import api from './apiClient';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Controla cómo se muestra una notificación mientras la app está abierta en primer plano
// (sin esto, por defecto no se mostraría nada hasta que el usuario sale de la app).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Pide permiso de notificaciones (si aún no se ha dado) y obtiene el "push token" único de este
// dispositivo. Luego lo guarda en el backend asociado al usuario, para poder enviarle avisos.
// No lanza errores hacia afuera: si algo falla (ej. estamos en Expo Go, donde esto no funciona
// completamente), simplemente no se registra el token y la app sigue funcionando normal.
export async function registrarNotificacionesPush(usuarioId) {
  try {
    if (!Device.isDevice) {
      // Los simuladores/emuladores no pueden recibir push reales.
      return;
    }

    // FIX (2026-08-26): en Android 13+ el aviso del sistema pidiendo permiso de notificaciones
    // NO aparece hasta que existe al menos un canal de notificación creado (documentación oficial
    // de Expo: "This prompt will not appear until at least one notification channel is created.
    // setNotificationChannelAsync must be called before getExpoPushTokenAsync"). El código nacía
    // pidiendo el permiso ANTES de crear el canal, así que en celulares con Android 13+ el permiso
    // probablemente nunca se concedía de verdad, el token nunca se generaba, y por eso nunca
    // llegaban notificaciones aunque todo lo demás (backend, envío, badge) estuviera bien armado.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: estadoActual } = await Notifications.getPermissionsAsync();
    let estadoFinal = estadoActual;
    if (estadoActual !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      estadoFinal = status;
    }
    if (estadoFinal !== 'granted') {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const pushToken = tokenResponse.data;

    if (usuarioId && pushToken) {
      await api.put(`/auth/usuario/${usuarioId}/push-token`, {
        push_token: pushToken,
      });
    }
  } catch (error) {
    console.error('Error registrando notificaciones push:', error);
  }
}
