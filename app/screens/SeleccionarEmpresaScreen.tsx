import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setNavigationGlobal } from '../utils/navigationGlobal';
import { obtenerMensajesSinLeer, empresaTieneSinLeer, actualizarBadge } from '../utils/mensajesSinLeer';

// Pantalla que aparece siempre después de iniciar sesión (dueño o invitado), incluso si el
// usuario pertenece a una sola empresa, para que el menú de editar/eliminar (mantener
// presionado) esté siempre disponible sin importar cuántas empresas tenga.
// elegirEmpresa usa "replace" (no "reset"): aquí el usuario ya está navegando dentro de la
// app, no acaba de loguearse, así que si va a Inicio y presiona "atrás", debe volver aquí
// (a Seleccionar Empresa) para poder cambiar o editar, no salir de la app.
export default function SeleccionarEmpresaScreen({ route, navigation }) {
  const { empresas, usuario } = route.params;
  const insets = useSafeAreaInsets();
  const [empresasVisibles, setEmpresasVisibles] = useState(empresas);
  const [menuEmpresa, setMenuEmpresa] = useState(null);
  // Mensajes sin leer del usuario en TODA la app — se usa aquí solo para saber, por cada
  // empresa, si hay algo pendiente en cualquiera de sus proyectos (ver empresaTieneSinLeer).
  const [sinLeer, setSinLeer] = useState([]);

  useEffect(() => {
    // Guardamos "navigation" para poder navegar desde fuera de una pantalla (mismo patrón que
    // InicioScreen.tsx) — en este caso, para que index.tsx pueda reconstruir el historial
    // completo (SeleccionarEmpresa → Inicio → Proyectos → AreaProyecto) cuando restaura la
    // sesión justo donde el usuario la dejó, sin dejar el stack con una sola pantalla.
    setNavigationGlobal(navigation);
  }, [navigation]);

  useEffect(() => {
    if (!usuario?.id) return;
    obtenerMensajesSinLeer(usuario.id).then(setSinLeer);
    actualizarBadge(usuario.id);
  }, [usuario?.id]);

  const elegirEmpresa = (empresaSeleccionada) => {
    navigation.replace('Inicio', {
      empresa: {
        id: empresaSeleccionada.empresa_id,
        nombre: empresaSeleccionada.empresa_nombre,
        logo_url: empresaSeleccionada.logo_url,
        color_hex: empresaSeleccionada.color_hex,
        sitio_web: empresaSeleccionada.sitio_web,
        area_id: empresaSeleccionada.area_id,
        area_nombre: empresaSeleccionada.area_nombre,
        area_tipo: empresaSeleccionada.area_tipo,
        nit: empresaSeleccionada.nit,
        cedula_representante: empresaSeleccionada.cedula_representante,
        banco_nombre: empresaSeleccionada.banco_nombre,
        banco_tipo_cuenta: empresaSeleccionada.banco_tipo_cuenta,
        banco_numero: empresaSeleccionada.banco_numero,
        banco_titular: empresaSeleccionada.banco_titular,
      },
      usuario,
    });
  };

  const cerrarMenu = () => setMenuEmpresa(null);

  const editarEmpresa = () => {
    const empresaAEditar = menuEmpresa;
    cerrarMenu();
    navigation.navigate('EditarPerfil', {
      empresa: {
        id: empresaAEditar.empresa_id,
        nombre: empresaAEditar.empresa_nombre,
        logo_url: empresaAEditar.logo_url,
        color_hex: empresaAEditar.color_hex,
        sitio_web: empresaAEditar.sitio_web,
        nit: empresaAEditar.nit,
        cedula_representante: empresaAEditar.cedula_representante,
        banco_nombre: empresaAEditar.banco_nombre,
        banco_tipo_cuenta: empresaAEditar.banco_tipo_cuenta,
        banco_numero: empresaAEditar.banco_numero,
        banco_titular: empresaAEditar.banco_titular,
      },
      usuario,
    });
  };

  const confirmarEliminar = () => {
    const empresaAEliminar = menuEmpresa;
    cerrarMenu();
    Alert.alert(
      'Eliminar empresa',
      `¿Seguro que quieres eliminar "${empresaAEliminar.empresa_nombre}"? No aparecerá más en tu lista de empresas, pero toda su información quedará guardada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/empresas/${empresaAEliminar.empresa_id}`, {
                data: { usuario_id: usuario.id },
              });

              const nuevasEmpresas = empresasVisibles.filter((e) => e.empresa_id !== empresaAEliminar.empresa_id);
              setEmpresasVisibles(nuevasEmpresas);

              // Actualizamos también la sesión guardada para que no vuelva a aparecer
              const sesionGuardada = await AsyncStorage.getItem('sesion');
              if (sesionGuardada) {
                const sesion = JSON.parse(sesionGuardada);
                sesion.empresas = nuevasEmpresas;
                await AsyncStorage.setItem('sesion', JSON.stringify(sesion));
              }

              // Si queda 1 o más empresas, simplemente se actualiza la lista visible en esta
              // misma pantalla (ya no saltamos automáticamente a Inicio con la que quede: el
              // usuario siempre pasa por aquí, incluso con una sola empresa).
              if (nuevasEmpresas.length === 0) {
                Alert.alert('Sin empresas', 'Ya no perteneces a ninguna empresa activa.');
                navigation.replace('SeleccionarModo');
              }
            } catch (error) {
              console.error('Error eliminando empresa:', error);
              const mensaje = error.response?.data?.error || 'No se pudo eliminar la empresa.';
              Alert.alert('Error', mensaje);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{empresasVisibles.length > 1 ? '¿Con cuál empresa quieres entrar?' : 'Tu empresa'}</Text>
      <Text style={styles.subtitulo}>
        {empresasVisibles.length > 1 ? 'Perteneces a más de una empresa en C&D Manager' : 'Toca para entrar'}
      </Text>

      {empresasVisibles.map((empresa, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.empresaCard, { borderColor: empresa.color_hex || '#1E90FF' }]}
          onPress={() => elegirEmpresa(empresa)}
          onLongPress={() => setMenuEmpresa(empresa)}
        >
          {empresa.logo_url ? (
            <Image source={{ uri: empresa.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: empresa.color_hex || '#1E90FF' }]}>
              <Text style={styles.logoPlaceholderTexto}>
                {empresa.empresa_nombre ? empresa.empresa_nombre.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.empresaNombreFila}>
              <Text style={styles.empresaNombre}>{empresa.empresa_nombre}</Text>
              {empresaTieneSinLeer(sinLeer, empresa.empresa_id) && <Text style={styles.iconoMensaje}>💬</Text>}
            </View>
            <Text style={styles.empresaArea}>{empresa.area_nombre}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.ayudaTexto}>Mantén presionada una empresa para editarla o eliminarla</Text>

      <Modal visible={!!menuEmpresa} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>{menuEmpresa?.empresa_nombre}</Text>

            <TouchableOpacity style={styles.menuOpcion} onPress={editarEmpresa}>
              <Text style={styles.menuOpcionTexto}>✏️  Editar</Text>
            </TouchableOpacity>

            {menuEmpresa?.area_nombre === 'GERENCIA' ? (
              <TouchableOpacity style={styles.menuOpcion} onPress={confirmarEliminar}>
                <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.menuNotaTexto}>Solo un usuario de Gerencia puede eliminar esta empresa</Text>
            )}

            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, paddingTop: 60 },
  titulo: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30 },
  empresaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    gap: 14,
  },
  logo: { width: 50, height: 50, borderRadius: 25 },
  logoPlaceholder: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  // Este círculo usa el color propio de CADA empresa como fondo (empresa.color_hex) — si esa
  // empresa eligió blanco, la letra se pierde. Mismo sombreado que en EncabezadoLogo.tsx.
  logoPlaceholderTexto: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  empresaNombreFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empresaNombre: { fontSize: 16, fontWeight: '600', color: '#222' },
  iconoMensaje: { fontSize: 15 },
  empresaArea: { fontSize: 13, color: '#777', marginTop: 2 },
  ayudaTexto: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 14, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
  menuNotaTexto: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 14 },
});
