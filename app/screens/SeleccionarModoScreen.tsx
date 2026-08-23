import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Primera pantalla que ve cualquiera al abrir la app sin sesión activa. Separa los dos caminos
// posibles: el dueño/administrador de un negocio ("Ingresar a mi empresa", flujo ya existente en
// IngresarScreen) y cualquier persona que fue invitada por otro negocio a un proyecto puntual
// ("Me invitaron a un proyecto", flujo en IngresarInvitadoScreen). Este segundo botón cubre TANTO
// a trabajadores (asignados a un área de oficio/administrativa) como a clientes (asignados al
// área especial "AREA DE CLIENTES") — el sistema ya distingue a unos de otros por el área que
// gerencia le asignó al invitarlos, así que el texto del botón no debe sonar como si fuera solo
// para empleados; antes decía "Trabajo para alguien más", lo que confundía a los clientes que
// entran a chatear/ver el contrato de su propio proyecto. Reemplaza a "Ingresar" como ruta inicial.
export default function SeleccionarModoScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.centro}>
        <Text style={styles.titulo}>C&D Manager</Text>
        <Text style={styles.subtitulo}>Elige cómo quieres entrar</Text>
      </View>

      <View style={styles.opciones}>
        <TouchableOpacity
          style={styles.opcion}
          onPress={() => navigation.navigate('Ingresar')}
        >
          <Text style={styles.opcionTitulo}>Ingresar a mi empresa</Text>
          <Text style={styles.opcionTexto}>Soy dueño o administro un negocio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.opcion}
          onPress={() => navigation.navigate('IngresarInvitado')}
        >
          <Text style={styles.opcionTitulo}>Me invitaron a un proyecto</Text>
          <Text style={styles.opcionTexto}>Trabajo ahí o soy el cliente de ese proyecto</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, justifyContent: 'center' },
  centro: { alignItems: 'center', marginBottom: 40 },
  titulo: { fontSize: 26, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: '#666', textAlign: 'center' },
  opciones: { gap: 14 },
  opcion: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  opcionTitulo: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 4 },
  opcionTexto: { fontSize: 13, color: '#777' },
});
