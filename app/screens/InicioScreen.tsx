import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';

const BOTONES_INICIO = [
  { id: 'editar_perfil', titulo: 'Editar perfil', ruta: 'EditarPerfil' },
  { id: 'grupo_trabajo', titulo: 'Grupo de trabajo', ruta: 'GrupoTrabajo' },
  { id: 'proyectos', titulo: 'Proyectos', ruta: 'Proyectos' },
  { id: 'cotizaciones', titulo: 'Cotizaciones', ruta: 'Cotizaciones' },
  { id: 'contratos', titulo: 'Contratos', ruta: 'Contratos' },
  { id: 'clientes', titulo: 'Clientes', ruta: 'Clientes' },
  { id: 'estadisticas', titulo: 'Estadísticas', ruta: 'Estadisticas' },
];

export default function InicioScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const colorEmpresa = empresa.color_hex || '#1E90FF';

  const manejarBoton = (boton) => {
    if (boton.ruta) {
      navigation.navigate(boton.ruta, { empresa, usuario });
    } else {
      Alert.alert('Próximamente', 'Esta pantalla la construiremos pronto.');
    }
  };

  const cerrarSesion = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('sesion');
          navigation.reset({ index: 0, routes: [{ name: 'Ingresar' }] });
        },
      },
    ]);
  };

  return (
    <View style={[styles.inicioContainer, { backgroundColor: colorEmpresa }]}>
      <EncabezadoLogo empresa={empresa} usuario={usuario} completo />
      <ScrollView contentContainerStyle={styles.inicioBotones}>
        {BOTONES_INICIO.map((boton) => (
          <TouchableOpacity
            key={boton.id}
            style={styles.inicioBoton}
            onPress={() => manejarBoton(boton)}
          >
            <Text style={styles.inicioBotonTexto}>{boton.titulo}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.botonCerrarSesion} onPress={cerrarSesion}>
          <Text style={styles.botonCerrarSesionTexto}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  inicioContainer: { flex: 1, paddingTop: 20 },
  inicioBotones: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, gap: 14 },
  inicioBoton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 18,
  },
  inicioBotonTexto: { fontSize: 17, fontWeight: '600', color: '#333' },
  botonCerrarSesion: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  botonCerrarSesionTexto: { fontSize: 15, fontWeight: '600', color: '#fff' },
});