import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Cliente axios centralizado (2026-08-25, Paso 2 de la migración a autenticación real).
//
// Antes, cada una de las ~18 pantallas importaba axios directo y escribía la URL completa del
// backend en cada llamada. Eso significaba que, para que las requests empezaran a mandar el
// token de sesión (ver middleware/auth.js en el backend), había que editar mano a mano decenas
// de llamadas repartidas por toda la app — con alto riesgo de dejar alguna por fuera.
//
// Con este cliente, todas las pantallas importan "api" desde aquí en vez de "axios", y usan
// rutas relativas (ej. api.get('/mensajes/no-leidos/5')) en vez de la URL completa. El
// interceptor de abajo agrega automáticamente el header "Authorization: Bearer <token>" a
// TODA request saliente, leyendo el token guardado en AsyncStorage tras el login — así ninguna
// pantalla nueva puede "olvidarse" de mandarlo.
export const BASE_URL = 'https://backend-app-mediterraneo.onrender.com/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  try {
    const sesionGuardada = await AsyncStorage.getItem('sesion');
    if (sesionGuardada) {
      const sesion = JSON.parse(sesionGuardada);
      if (sesion?.token) {
        config.headers.Authorization = `Bearer ${sesion.token}`;
      }
    }
  } catch (error) {
    // Si algo falla leyendo la sesión guardada, dejamos que la request siga sin token: el
    // backend decide qué hacer con eso (ver Pasos 3/4 de la migración), no cortamos la app aquí.
    console.error('Error leyendo token de sesión para request:', error);
  }
  return config;
});

export default api;
