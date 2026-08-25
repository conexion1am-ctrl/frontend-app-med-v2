import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

// Componente reutilizable para mostrar el logo de la empresa en las pantallas.
//
// Uso en la pantalla de Inicio (logo + nombre empresa + usuario):
//   <EncabezadoLogo empresa={empresa} usuario={usuario} completo />
//
// Uso en el resto de pantallas (logo + nombre de la empresa centrados arriba):
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

      {/* El nombre de la empresa aparece siempre bajo el logo. El nombre del usuario solo en Inicio. */}
      <Text style={styles.nombreEmpresa}>{empresa.nombre}</Text>
      {completo && usuario && (
        <Text style={styles.nombreUsuario}>{usuario.nombre}</Text>
      )}
    </View>
  );
}

// Cada empresa elige su propio color de fondo (empresa.color_hex) en Editar Perfil, y ese color
// puede ser blanco. Estos textos van siempre en blanco fijo sobre ese fondo — sin este sombreado,
// si la empresa eligió blanco como su color, el nombre de la empresa (y el resto de este
// encabezado, que se repite en casi todas las pantallas) se volvería invisible. El efecto es un
// contorno oscuro difuminado alrededor de la letra (mismo recurso que usan WhatsApp/Instagram
// para texto blanco sobre fotos), no un color de texto distinto — así se sigue viendo bien sobre
// cualquier color de empresa, no solo blanco.
const sombreadoTexto = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

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
    ...sombreadoTexto,
  },
  nombreEmpresa: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
    ...sombreadoTexto,
  },
  nombreUsuario: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    alignSelf: 'flex-start',
    marginLeft: 24,
    ...sombreadoTexto,
  },
});