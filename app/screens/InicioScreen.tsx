import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { setNavigationGlobal } from '../utils/navigationGlobal';
import { esAccesoReducido, permisosDe, usaPerfilCompleto } from '../utils/roles';

// Arma el menú de Inicio según los permisos del área del usuario. Cada botón se muestra
// solo si el permiso correspondiente está en true (o, para "editar_perfil", solo si tiene
// AL MENOS un permiso de gestión de empresa o es un área con permisos definidos).
function construirBotones(empresa) {
  const permisos = permisosDe(empresa);

  if (esAccesoReducido(empresa)) {
    // Mano de obra (oficio) y áreas especiales (proveedores/clientes): solo su perfil
    // reducido y los proyectos donde están asignados.
    return [
      { id: 'mi_perfil', titulo: 'Mi perfil', ruta: 'MiPerfil' },
      { id: 'proyectos', titulo: 'Proyectos', ruta: 'Proyectos' },
    ];
  }

  const botones = usaPerfilCompleto(empresa)
    ? [{ id: 'editar_perfil', titulo: 'Editar perfil', ruta: 'EditarPerfil' }]
    : [{ id: 'mi_perfil', titulo: 'Mi perfil', ruta: 'MiPerfil' }];
  if (permisos.verProyectos) botones.push({ id: 'proyectos', titulo: 'Proyectos', ruta: 'Proyectos' });
  if (permisos.verGrupoTrabajo) botones.push({ id: 'grupo_trabajo', titulo: 'Grupo de trabajo', ruta: 'GrupoTrabajo' });
  if (permisos.verCotizaciones) botones.push({ id: 'cotizaciones', titulo: 'Cotizaciones', ruta: 'Cotizaciones' });
  if (permisos.verContratos) botones.push({ id: 'contratos', titulo: 'Contratos', ruta: 'Contratos' });
  if (permisos.verClientes) botones.push({ id: 'clientes', titulo: 'Clientes', ruta: 'Clientes' });
  if (permisos.verEstadisticas) botones.push({ id: 'estadisticas', titulo: 'Estadísticas', ruta: 'Estadisticas' });
  return botones;
}

export default function InicioScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const colorEmpresa = empresa.color_hex || '#1E90FF';
  const [tieneVariasEmpresas, setTieneVariasEmpresas] = useState(false);
  const BOTONES_INICIO = construirBotones(empresa);

  useEffect(() => {
    revisarSiTieneVariasEmpresas();
    // Guardamos "navigation" para poder abrir pantallas desde fuera (ej. al tocar una
    // notificación push), ya que Inicio siempre está montada mientras hay sesión activa.
    setNavigationGlobal(navigation);
  }, [navigation]);

  const revisarSiTieneVariasEmpresas = async () => {
    try {
      const sesionGuardada = await AsyncStorage.getItem('sesion');
      if (!sesionGuardada) return;
      const sesion = JSON.parse(sesionGuardada);
      setTieneVariasEmpresas((sesion?.empresas?.length || 0) > 1);
    } catch (error) {
      console.error('Error revisando empresas de la sesión:', error);
    }
  };

  const cambiarEmpresa = async () => {
    try {
      const sesionGuardada = await AsyncStorage.getItem('sesion');
      if (!sesionGuardada) return;
      const sesion = JSON.parse(sesionGuardada);
      navigation.replace('SeleccionarEmpresa', { empresas: sesion.empresas, usuario: sesion.usuario });
    } catch (error) {
      console.error('Error cambiando de empresa:', error);
    }
  };

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
          navigation.reset({ index: 0, routes: [{ name: 'SeleccionarModo' }] });
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

        {tieneVariasEmpresas && (
          <TouchableOpacity style={styles.botonCambiarEmpresa} onPress={cambiarEmpresa}>
            <Text style={styles.botonCambiarEmpresaTexto}>Cambiar de empresa</Text>
          </TouchableOpacity>
        )}

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
  botonCambiarEmpresa: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  botonCambiarEmpresaTexto: { fontSize: 15, fontWeight: '600', color: '#fff' },
});