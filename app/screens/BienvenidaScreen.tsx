import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { temaDesdeColor } from '../utils/temas';

export default function BienvenidaScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const colorEmpresa = empresa.color_hex || '#1E90FF';
  // Esta pantalla se queda en el tono FUERTE del tema (tema.base, igual a colorEmpresa) a
  // propósito: es la bienvenida inicial, mismo criterio de "franja de acento" que EncabezadoLogo.
  // Por eso el texto sigue blanco con sombra (sombreadoTexto) — NO se cambia a tema.oscuro aquí.
  const tema = temaDesdeColor(colorEmpresa);

  return (
    <View style={[styles.center, { backgroundColor: tema.base }]}>
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

// Ver el mismo comentario en components/EncabezadoLogo.tsx: el fondo de esta pantalla es el
// color que la empresa eligió (puede ser blanco), así que todo texto blanco fijo necesita este
// contorno oscuro difuminado para seguir siendo legible sin importar qué color se haya elegido.
const sombreadoTexto = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  bienvenidaTitulo: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 12, textAlign: 'center', ...sombreadoTexto },
  bienvenidaEmpresa: { fontSize: 20, color: '#fff', marginBottom: 8, textAlign: 'center', ...sombreadoTexto },
  bienvenidaUsuario: { fontSize: 16, color: '#fff', textAlign: 'center', ...sombreadoTexto },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold', ...sombreadoTexto },
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