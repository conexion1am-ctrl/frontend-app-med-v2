import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getNavigationGlobal } from './utils/navigationGlobal';
import { registrarNotificacionesPush } from './utils/notificacionesPush';
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
import SeleccionarEmpresaScreen from './screens/SeleccionarEmpresaScreen';
import SeleccionarModoScreen from './screens/SeleccionarModoScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [cargando, setCargando] = useState(true);
  const [rutaInicial, setRutaInicial] = useState('SeleccionarModo');
  const [paramsIniciales, setParamsIniciales] = useState(undefined);

  useEffect(() => {
    revisarSesion();
  }, []);

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
            setRutaInicial('AreaProyecto');
            setParamsIniciales({
              empresa: ultimaPantalla.empresa,
              proyecto: ultimaPantalla.proyecto,
              area: ultimaPantalla.area,
              usuario: ultimaPantalla.usuario || usuario,
              tabInicial: ultimaPantalla.tab,
            });
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
        options={{ headerShown: true, title: 'Editar Perfil' }}
      />
      <Stack.Screen
        name="GrupoTrabajo"
        component={GrupoTrabajoScreen}
        options={{ headerShown: true, title: 'Grupo de Trabajo' }}
      />
      <Stack.Screen
        name="Proyectos"
        component={ProyectosScreen}
        options={{ headerShown: true, title: 'Proyectos' }}
      />
      <Stack.Screen
        name="DetalleProyecto"
        component={DetalleProyectoScreen}
        options={{ headerShown: true, title: 'Proyecto' }}
      />
      <Stack.Screen
        name="AreaProyecto"
        component={AreaProyectoScreen}
        initialParams={rutaInicial === 'AreaProyecto' ? paramsIniciales : undefined}
        options={({ route }) => ({ headerShown: true, title: route.params.area.nombre })}
      />
      <Stack.Screen
        name="Clientes"
        component={ClientesScreen}
        options={{ headerShown: true, title: 'Clientes' }}
      />
      <Stack.Screen
        name="Cotizaciones"
        component={CotizacionesScreen}
        options={{ headerShown: true, title: 'Cotizaciones' }}
      />
      <Stack.Screen
        name="Contratos"
        component={ContratosScreen}
        options={{ headerShown: true, title: 'Contratos' }}
      />
      <Stack.Screen
        name="Estadisticas"
        component={EstadisticasScreen}
        options={{ headerShown: true, title: 'Estadísticas' }}
      />
    </Stack.Navigator>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}