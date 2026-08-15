import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

  const revisarSesion = async () => {
    try {
      // Tanto si hay sesión guardada como si no, siempre arrancamos en "Ingresar":
      // - Si hay sesión guardada, el celular ya viene prellenado y puede entrar directo.
      // - Si no hay sesión (primera vez, o reinstalación), puede iniciar sesión con una
      //   cuenta existente o tocar "Crear perfil de empresa" si es realmente nuevo.
      setRutaInicial('Ingresar');
    } catch (error) {
      console.error('Error revisando sesión:', error);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Stack.Navigator initialRouteName={rutaInicial} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PerfilEmpresa" component={PerfilEmpresaScreen} />
      <Stack.Screen name="Ingresar" component={IngresarScreen} />
      <Stack.Screen name="Bienvenida" component={BienvenidaScreen} />
      <Stack.Screen name="Inicio" component={InicioScreen} />
      <Stack.Screen name="SeleccionarEmpresa" component={SeleccionarEmpresaScreen} />
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
  );
}