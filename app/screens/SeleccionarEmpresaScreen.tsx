import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Pantalla que aparece solo cuando un usuario pertenece a más de una empresa.
// Le permite elegir con cuál empresa quiere entrar en este momento.
export default function SeleccionarEmpresaScreen({ route, navigation }) {
  const { empresas, usuario } = route.params;
  const [empresasVisibles, setEmpresasVisibles] = useState(empresas);
  const [menuEmpresa, setMenuEmpresa] = useState(null);

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

              if (nuevasEmpresas.length === 1) {
                elegirEmpresa(nuevasEmpresas[0]);
              } else if (nuevasEmpresas.length === 0) {
                Alert.alert('Sin empresas', 'Ya no perteneces a ninguna empresa activa.');
                navigation.replace('Ingresar');
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
      <Text style={styles.titulo}>¿Con cuál empresa quieres entrar?</Text>
      <Text style={styles.subtitulo}>Perteneces a más de una empresa en C&D Manager</Text>

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
            <Text style={styles.empresaNombre}>{empresa.empresa_nombre}</Text>
            <Text style={styles.empresaArea}>{empresa.area_nombre}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.ayudaTexto}>Mantén presionada una empresa para editarla o eliminarla</Text>

      <Modal visible={!!menuEmpresa} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={styles.menuBox}>
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
  logoPlaceholderTexto: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  empresaNombre: { fontSize: 16, fontWeight: '600', color: '#222' },
  empresaArea: { fontSize: 13, color: '#777', marginTop: 2 },
  ayudaTexto: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 14, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
  menuNotaTexto: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 14 },
});
