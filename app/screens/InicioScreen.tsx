import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { setNavigationGlobal } from '../utils/navigationGlobal';
import { esAccesoReducido, permisosDe, usaPerfilCompleto } from '../utils/roles';
import { temaDesdeColor } from '../utils/temas';

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
  const tema = temaDesdeColor(colorEmpresa);
  const BOTONES_INICIO = construirBotones(empresa);

  useEffect(() => {
    // Guardamos "navigation" para poder abrir pantallas desde fuera (ej. al tocar una
    // notificación push), ya que Inicio siempre está montada mientras hay sesión activa.
    setNavigationGlobal(navigation);
  }, [navigation]);

  // Vuelve a Seleccionar Empresa, tanto para cambiar de empresa activa (si tiene varias) como
  // para editar/eliminar la única empresa (si solo tiene una) - esa pantalla ya trae el menú
  // de mantener presionado para ambos casos.
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
            style={[styles.inicioBoton, { backgroundColor: tema.claro }]}
            onPress={() => manejarBoton(boton)}
          >
            <Text style={[styles.inicioBotonTexto, { color: tema.oscuro }]}>{boton.titulo}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.botonCambiarEmpresa} onPress={cambiarEmpresa}>
          <Text style={styles.botonCambiarEmpresaTexto}>Cambiar o editar empresa</Text>
        </TouchableOpacity>

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
    borderRadius: 12,
    padding: 18,
  },
  inicioBotonTexto: { fontSize: 17, fontWeight: '600' },
  botonCerrarSesion: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  // Estos dos botones tienen fondo translúcido (blanco o negro) sobre el color de la empresa —
  // si la empresa eligió blanco, "Cambiar o editar empresa" quedaría prácticamente blanco sobre
  // blanco con texto blanco. Mismo sombreado que en EncabezadoLogo/BienvenidaScreen.
  botonCerrarSesionTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  botonCambiarEmpresa: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  botonCambiarEmpresaTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});