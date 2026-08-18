import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getNavigationGlobal } from './utils/navigationGlobal';
import { registrarNotificacionesPush } from './utils/notificacionesPush';
import AceptarInvitacionScreen from './screens/AceptarInvitacionScreen';
import AreaProyectoScreen from './screens/AreaProyectoScreen';
import BienvenidaScreen from './screens/BienvenidaScreen';
import ClientesScreen from './screens/ClientesScreen';
import ContratosScreen from './screens/ContratosScreen';
import CotizacionesScreen from './screens/CotizacionesScreen';
import DetalleProyectoScreen from './screens/DetalleProyectoScreen';
import EditarPerfilScreen from './screens/EditarPerfilScreen';
import EstadisticasScreen from './screens/EstadisticasScreen';
import GrupoTrabajoScreen from './screens/GrupoTrabajoScreen';
import IngresarScreen from './screens/IngresarScreen';
import InicioScreen from './screens/InicioScreen';
import MiPerfilScreen from './screens/MiPerfilScreen';
import PerfilEmpresaScreen from './screens/PerfilEmpresaScreen';
import ProyectosScreen from './screens/ProyectosScreen';
import SeleccionarEmpresaScreen from './screens/SeleccionarEmpresaScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [cargando, setCargando] = useState(true);
  const [rutaInicial, setRutaInicial] = useState('Ingresar');
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
        // Sin sesión (primera vez, o reinstalación): mostrar login, con opción de crear empresa.
        setRutaInicial('Ingresar');
        return;
      }

      const sesion = JSON.parse(sesionGuardada);
      const empresas = sesion?.empresas || [];
      const usuario = sesion?.usuario;

      if (!usuario || empresas.length === 0) {
        setRutaInicial('Ingresar');
        return;
      }

      registrarNotificacionesPush(usuario.id);

      if (empresas.length > 1) {
        // Pertenece a varias empresas: que elija con cuál entrar, sin pedir contraseña de nuevo.
        setRutaInicial('SeleccionarEmpresa');
        setParamsIniciales({ empresas, usuario });
      } else {
        // Solo una empresa: entrar directo a Inicio.
        const primeraEmpresa = empresas[0];
        setRutaInicial('Inicio');
        setParamsIniciales({
          empresa: {
            id: primeraEmpresa.empresa_id,
            nombre: primeraEmpresa.empresa_nombre,
            logo_url: primeraEmpresa.logo_url,
            color_hex: primeraEmpresa.color_hex,
            sitio_web: primeraEmpresa.sitio_web,
            area_id: primeraEmpresa.area_id,
            area_nombre: primeraEmpresa.area_nombre,
            area_tipo: primeraEmpresa.area_tipo,
            nit: primeraEmpresa.nit,
            cedula_representante: primeraEmpresa.cedula_representante,
            banco_nombre: primeraEmpresa.banco_nombre,
            banco_tipo_cuenta: primeraEmpresa.banco_tipo_cuenta,
            banco_numero: primeraEmpresa.banco_numero,
            banco_titular: primeraEmpresa.banco_titular,
          },
          usuario,
        });
      }
    } catch (error) {
      console.error('Error revisando sesión:', error);
      setRutaInicial('Ingresar');
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
      <Stack.Screen name="PerfilEmpresa" component={PerfilEmpresaScreen} />
      <Stack.Screen name="Ingresar" component={IngresarScreen} />
      <Stack.Screen name="Bienvenida" component={BienvenidaScreen} />
      <Stack.Screen name="Inicio" component={InicioScreen} initialParams={paramsIniciales} />
      <Stack.Screen name="MiPerfil" component={MiPerfilScreen} />
      <Stack.Screen name="SeleccionarEmpresa" component={SeleccionarEmpresaScreen} initialParams={paramsIniciales} />
      <Stack.Screen name="AceptarInvitacion" component={AceptarInvitacionScreen} />
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