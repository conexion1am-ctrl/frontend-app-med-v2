import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getNavigationGlobal } from './utils/navigationGlobal';
import { registrarNotificacionesPush } from './utils/notificacionesPush';
import { temaDesdeColor } from './utils/temas';
import AreaProyectoScreen from './screens/AreaProyectoScreen';
import BienvenidaScreen from './screens/BienvenidaScreen';
import ClientesScreen from './screens/ClientesScreen';
import ContratosScreen from './screens/ContratosScreen';
import CotizacionesScreen from './screens/CotizacionesScreen';
import DetalleProyectoScreen from './screens/DetalleProyectoScreen';
import EditarPerfilScreen from './screens/EditarPerfilScreen';
import EstadisticasScreen from './screens/EstadisticasScreen';
import GrupoTrabajoScreen from './screens/GrupoTrabajoScreen';
import IngresarInvitadoScreen from './screens/IngresarInvitadoScreen';
import IngresarScreen from './screens/IngresarScreen';
import InicioScreen from './screens/InicioScreen';
import MiPerfilScreen from './screens/MiPerfilScreen';
import PerfilEmpresaScreen from './screens/PerfilEmpresaScreen';
import ProyectosScreen from './screens/ProyectosScreen';
import RevisarContratoScreen from './screens/RevisarContratoScreen';
import SeleccionarEmpresaScreen from './screens/SeleccionarEmpresaScreen';
import SeleccionarModoScreen from './screens/SeleccionarModoScreen';

const Stack = createNativeStackNavigator();

// FIX (2026-08-27, a pedido del usuario): la barra superior nativa de estas pantallas (donde
// React Navigation dibuja el título "Proyectos", "Clientes", etc. y la flecha de atrás) traía el
// color por defecto de React Navigation — blanco/gris muy claro — sin relación con el tema de la
// empresa. Sobre fondos claros, la barra de estado de Android (hora, batería, notificaciones)
// también quedaba casi invisible encima de ese gris clarito. Esta función arma las "options" de
// headerStyle/headerTintColor con el tono FUERTE del tema (empresa.color_hex, el mismo que ya usa
// EncabezadoLogo) y texto/flecha en blanco — funciona bien porque los 8 temas tienen su tono
// base oscuro o saturado. Si por algún motivo la pantalla no recibe "empresa" en sus params
// (no debería pasar en estas rutas), cae a un azul por defecto en vez de romper.
function opcionesHeaderTema({ route }) {
  const colorEmpresa = route.params?.empresa?.color_hex || '#1E90FF';
  const tema = temaDesdeColor(colorEmpresa);
  return {
    headerStyle: { backgroundColor: tema.base },
    headerTintColor: '#fff',
    headerTitleStyle: { color: '#fff' },
  };
}

export default function App() {
  const [cargando, setCargando] = useState(true);
  const [rutaInicial, setRutaInicial] = useState('SeleccionarModo');
  const [paramsIniciales, setParamsIniciales] = useState(undefined);
  // Cuando hay que restaurar "ultimaPantalla" en AreaProyecto, NO usamos rutaInicial/
  // initialRouteName para eso (ver comentario más abajo, en revisarSesion) — en su lugar
  // guardamos aquí los datos, y una vez la pantalla SeleccionarEmpresa ya está montada (y por
  // tanto registró su "navigation" en navigationGlobal, igual que hace InicioScreen para las
  // notificaciones push — ver utils/navigationGlobal.js), disparamos un navigation.reset con las
  // 4 rutas de una sola vez, para que el botón atrás SÍ tenga historial hacia dónde volver.
  const [restaurarAreaProyecto, setRestaurarAreaProyecto] = useState(null);

  useEffect(() => {
    revisarSesion();
  }, []);

  useEffect(() => {
    if (!restaurarAreaProyecto) return;
    // La pantalla SeleccionarEmpresa (rutaInicial en este caso) registra su "navigation" en
    // navigationGlobal al montarse (ver el useEffect agregado en SeleccionarEmpresaScreen.tsx).
    // Reintentamos brevemente por si este efecto corre una fracción de segundo antes de que ese
    // registro ocurra.
    let intentos = 0;
    const intervalo = setInterval(() => {
      const navigation = getNavigationGlobal();
      intentos += 1;
      if (navigation) {
        clearInterval(intervalo);
        const { empresas, empresa, proyecto, area, usuario, tabInicial } = restaurarAreaProyecto;
        navigation.reset({
          index: 3,
          routes: [
            { name: 'SeleccionarEmpresa', params: { empresas, usuario } },
            { name: 'Inicio', params: { empresa, usuario } },
            { name: 'Proyectos', params: { empresa, usuario } },
            { name: 'AreaProyecto', params: { empresa, proyecto, area, usuario, tabInicial } },
          ],
        });
        setRestaurarAreaProyecto(null);
      } else if (intentos > 20) {
        // ~2 segundos sin éxito: nos rendimos y dejamos al usuario en SeleccionarEmpresa en vez
        // de dejarlo atascado esperando indefinidamente.
        clearInterval(intervalo);
        setRestaurarAreaProyecto(null);
      }
    }, 100);
    return () => clearInterval(intervalo);
  }, [restaurarAreaProyecto]);

  // Cuando el usuario toca una notificación de mensaje nuevo, lo llevamos directo al área del
  // proyecto donde está ese chat. Reconstruimos los datos de empresa/usuario desde la sesión
  // guardada en el celular (el push solo trae los ids/nombres del proyecto y área).
  useEffect(() => {
    const suscripcion = Notifications.addNotificationResponseReceivedListener(async (respuesta) => {
      try {
        const data = respuesta.notification.request.content.data;
        const navigation = getNavigationGlobal();
        if (data?.tipo !== 'mensaje' || !navigation) return;

        const sesionGuardada = await AsyncStorage.getItem('sesion');
        if (!sesionGuardada) return;
        const sesion = JSON.parse(sesionGuardada);
        const usuario = sesion?.usuario;
        const empresaSesion = (sesion?.empresas || []).find((e) => e.empresa_id === data.empresa_id);
        if (!usuario || !empresaSesion) return;

        navigation.navigate('AreaProyecto', {
          empresa: {
            id: empresaSesion.empresa_id,
            nombre: empresaSesion.empresa_nombre,
            logo_url: empresaSesion.logo_url,
            color_hex: empresaSesion.color_hex,
            sitio_web: empresaSesion.sitio_web,
            area_id: empresaSesion.area_id,
            area_nombre: empresaSesion.area_nombre,
            area_tipo: empresaSesion.area_tipo,
            nit: empresaSesion.nit,
            cedula_representante: empresaSesion.cedula_representante,
            banco_nombre: empresaSesion.banco_nombre,
            banco_tipo_cuenta: empresaSesion.banco_tipo_cuenta,
            banco_numero: empresaSesion.banco_numero,
            banco_titular: empresaSesion.banco_titular,
          },
          proyecto: { id: data.proyecto_id, nombre: data.proyecto_nombre },
          area: { id: data.area_id, nombre: data.area_nombre },
          usuario,
        });
      } catch (error) {
        console.error('Error abriendo chat desde notificación:', error);
      }
    });
    return () => suscripcion.remove();
  }, []);

  const revisarSesion = async () => {
    try {
      const sesionGuardada = await AsyncStorage.getItem('sesion');
      if (!sesionGuardada) {
        // Sin sesión (primera vez, o reinstalación): mostrar la portada para elegir dueño/trabajador.
        setRutaInicial('SeleccionarModo');
        return;
      }

      const sesion = JSON.parse(sesionGuardada);
      const empresas = sesion?.empresas || [];
      const usuario = sesion?.usuario;

      if (!usuario || empresas.length === 0) {
        setRutaInicial('SeleccionarModo');
        return;
      }

      registrarNotificacionesPush(usuario.id);

      // Si Android mató la app por falta de memoria hace muy poco (por ejemplo mientras la
      // cámara estaba abierta) y la está reviviendo ahora, "ultimaPantalla" tiene guardado dónde
      // estaba el usuario. Lo devolvemos directo ahí en vez de mandarlo a Seleccionar Empresa,
      // para que no sienta que "se salió" de donde estaba. Si pasaron más de 2 minutos, asumimos
      // que cerró la app normalmente y seguimos con el flujo de siempre.
      const ultimaPantallaGuardada = await AsyncStorage.getItem('ultimaPantalla');
      if (ultimaPantallaGuardada) {
        try {
          const ultimaPantalla = JSON.parse(ultimaPantallaGuardada);
          const reciente = ultimaPantalla?.ts && Date.now() - ultimaPantalla.ts < 2 * 60 * 1000;
          if (reciente && ultimaPantalla.pantalla === 'AreaProyecto' && ultimaPantalla.empresa && ultimaPantalla.proyecto && ultimaPantalla.area) {
            // IMPORTANTE: NO usamos rutaInicial/initialRouteName para saltar directo a
            // AreaProyecto — eso deja el Stack.Navigator nativo con UNA sola ruta en su
            // historial (índice 0), y Android interpreta "atrás" en esa pantalla como "salir de
            // la app" en vez de retroceder, dejando al usuario atrapado sin poder volver ni
            // cerrar sesión (bug reportado). En su lugar, dejamos que el Stack monte su ruta
            // normal (SeleccionarEmpresa) y, una vez listo, reconstruimos el historial completo
            // con reset() más abajo — así el botón atrás sí tiene a dónde volver.
            setRestaurarAreaProyecto({
              empresas,
              empresa: ultimaPantalla.empresa,
              proyecto: ultimaPantalla.proyecto,
              area: ultimaPantalla.area,
              usuario: ultimaPantalla.usuario || usuario,
              tabInicial: ultimaPantalla.tab,
            });
            setRutaInicial('SeleccionarEmpresa');
            setParamsIniciales({ empresas, usuario });
            return;
          }
        } catch (error) {
          // Si el dato guardado está corrupto, lo ignoramos y seguimos con el flujo normal.
        } finally {
          AsyncStorage.removeItem('ultimaPantalla').catch(() => {});
        }
      }

      // Siempre entra por Seleccionar Empresa (incluso con una sola), para que el menú de
      // editar/eliminar (mantener presionado) esté siempre disponible sin importar cuántas
      // empresas tenga.
      setRutaInicial('SeleccionarEmpresa');
      setParamsIniciales({ empresas, usuario });
    } catch (error) {
      console.error('Error revisando sesión:', error);
      setRutaInicial('SeleccionarModo');
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1E90FF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
    {/* FIX (2026-08-27): íconos de la barra de estado (hora, batería, notificaciones) fijos en
        blanco — todos los tonos "base" de los 8 temas son oscuros/saturados, así que blanco
        siempre contrasta bien encima, tanto en pantallas con header nativo como sin él. */}
    <StatusBar style="light" />
    <Stack.Navigator initialRouteName={rutaInicial} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SeleccionarModo" component={SeleccionarModoScreen} />
      <Stack.Screen name="PerfilEmpresa" component={PerfilEmpresaScreen} />
      <Stack.Screen name="Ingresar" component={IngresarScreen} />
      <Stack.Screen name="IngresarInvitado" component={IngresarInvitadoScreen} />
      <Stack.Screen name="Bienvenida" component={BienvenidaScreen} />
      <Stack.Screen name="Inicio" component={InicioScreen} initialParams={paramsIniciales} />
      <Stack.Screen name="MiPerfil" component={MiPerfilScreen} />
      <Stack.Screen name="SeleccionarEmpresa" component={SeleccionarEmpresaScreen} initialParams={paramsIniciales} />
      <Stack.Screen
        name="EditarPerfil"
        component={EditarPerfilScreen}
        options={(props) => ({ headerShown: true, title: 'Editar Perfil', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="GrupoTrabajo"
        component={GrupoTrabajoScreen}
        options={(props) => ({ headerShown: true, title: 'Grupo de Trabajo', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="Proyectos"
        component={ProyectosScreen}
        options={(props) => ({ headerShown: true, title: 'Proyectos', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="DetalleProyecto"
        component={DetalleProyectoScreen}
        options={(props) => ({ headerShown: true, title: 'Proyecto', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="AreaProyecto"
        component={AreaProyectoScreen}
        initialParams={rutaInicial === 'AreaProyecto' ? paramsIniciales : undefined}
        options={(props) => ({ headerShown: true, title: props.route.params.area.nombre, ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="Clientes"
        component={ClientesScreen}
        options={(props) => ({ headerShown: true, title: 'Clientes', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="Cotizaciones"
        component={CotizacionesScreen}
        options={(props) => ({ headerShown: true, title: 'Cotizaciones', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="Contratos"
        component={ContratosScreen}
        options={(props) => ({ headerShown: true, title: 'Contratos', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="RevisarContrato"
        component={RevisarContratoScreen}
        options={(props) => ({ headerShown: true, title: 'Revisar Contrato', ...opcionesHeaderTema(props) })}
      />
      <Stack.Screen
        name="Estadisticas"
        component={EstadisticasScreen}
        options={(props) => ({ headerShown: true, title: 'Estadísticas', ...opcionesHeaderTema(props) })}
      />
    </Stack.Navigator>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}