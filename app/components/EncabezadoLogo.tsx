import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

// Componente reutilizable para mostrar el logo de la empresa en las pantallas.
//
// Uso en la pantalla de Inicio (logo + nombre empresa + usuario):
//   <EncabezadoLogo empresa={empresa} usuario={usuario} completo />
//
// Uso en el resto de pantallas (solo el logo centrado arriba):
//   <EncabezadoLogo empresa={empresa} />

export default function EncabezadoLogo({ empresa, usuario, completo = false }) {
  if (!empresa) return null;

  return (
    <View style={styles.contenedor}>
      {empresa.logo_url ? (
        <Image source={{ uri: empresa.logo_url }} style={styles.logo} />
      ) : (
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoPlaceholderTexto}>
            {empresa.nombre ? empresa.nombre.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
      )}

      {completo && (
        <>
          <Text style={styles.nombreEmpresa}>{empresa.nombre}</Text>
          {usuario && (
            <Text style={styles.nombreUsuario}>{usuario.nombre}</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderTexto: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  nombreEmpresa: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  nombreUsuario: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    alignSelf: 'flex-start',
    marginLeft: 24,
  },
});