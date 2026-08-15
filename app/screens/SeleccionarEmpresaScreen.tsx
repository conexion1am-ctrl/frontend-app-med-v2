import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Pantalla que aparece solo cuando un usuario pertenece a más de una empresa.
// Le permite elegir con cuál empresa quiere entrar en este momento.
export default function SeleccionarEmpresaScreen({ route, navigation }) {
  const { empresas, usuario } = route.params;

  const elegirEmpresa = (empresaSeleccionada) => {
    navigation.replace('Inicio', {
      empresa: {
        id: empresaSeleccionada.empresa_id,
        nombre: empresaSeleccionada.empresa_nombre,
        logo_url: empresaSeleccionada.logo_url,
        color_hex: empresaSeleccionada.color_hex,
        sitio_web: empresaSeleccionada.sitio_web,
      },
      usuario,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>¿Con cuál empresa quieres entrar?</Text>
      <Text style={styles.subtitulo}>Perteneces a más de una empresa en CyD Manager</Text>

      {empresas.map((empresa, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.empresaCard, { borderColor: empresa.color_hex || '#1E90FF' }]}
          onPress={() => elegirEmpresa(empresa)}
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
});
