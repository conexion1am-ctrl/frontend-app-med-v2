import axios from 'axios';
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

    const { status: estadoActual } = await Notifications.getPermissionsAsync();
    let estadoFinal = estadoActual;
    if (estadoActual !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      estadoFinal = status;
    }
    if (estadoFinal !== 'granted') {
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const pushToken = tokenResponse.data;

    if (usuarioId && pushToken) {
      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/auth/usuario/${usuarioId}/push-token`, {
        push_token: pushToken,
      });
    }
  } catch (error) {
    console.error('Error registrando notificaciones push:', error);
  }
}
