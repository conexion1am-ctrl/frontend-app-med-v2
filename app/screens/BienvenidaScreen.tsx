import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';

export default function BienvenidaScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const colorEmpresa = empresa.color_hex || '#1E90FF';

  return (
    <View style={[styles.center, { backgroundColor: colorEmpresa }]}>
      <EncabezadoLogo empresa={empresa} />
      <Text style={styles.bienvenidaTitulo}>¡Bienvenido a C&D Manager!</Text>
      <Text style={styles.bienvenidaEmpresa}>{empresa.nombre}</Text>
      <Text style={styles.bienvenidaUsuario}>Gerencia: {usuario.nombre}</Text>
      <TouchableOpacity
        style={styles.botonContinuar}
        onPress={() => navigation.replace('Inicio', { empresa, usuario })}
      >
        <Text style={styles.botonTexto}>CONTINUAR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  bienvenidaTitulo: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 12, textAlign: 'center' },
  bienvenidaEmpresa: { fontSize: 20, color: '#fff', marginBottom: 8, textAlign: 'center' },
  bienvenidaUsuario: { fontSize: 16, color: '#fff', textAlign: 'center' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  botonContinuar: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#fff',
  },
});