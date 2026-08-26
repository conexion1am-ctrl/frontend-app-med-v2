import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// El archivo original (icono-bienvenida.png) medía 2816x1536 px, pero el ícono real (el cuadrado
// blanco "C&D Manager") ocupaba solo una porción centrada de ~1037x1036 — el resto era un fondo
// negro con "estrellitas" que, aunque técnicamente transparente en partes, visualmente se veía
// como un margen enorme vacío alrededor del logo (2026-08-25, reportado por el usuario). Se
// recortó la imagen para que el archivo contenga solo el ícono real (ahora 1139x1138, casi
// cuadrado), así el logo se ve grande de verdad en vez de "perdido" en espacio vacío.
const { width: anchoPantalla } = Dimensions.get('window');
const RELACION_LOGO = 1138 / 1139; // alto/ancho real del archivo ya recortado
const ANCHO_LOGO = anchoPantalla * 0.9; // casi todo el ancho de pantalla, con márgenes leves
const ALTO_LOGO = ANCHO_LOGO * RELACION_LOGO;

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
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.centro}>
        <Image source={require('../../assets/images/icono-bienvenida.png')} style={styles.icono} resizeMode="contain" />
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
  // Cambiado de justifyContent: 'center' a 'flex-start' (2026-08-25): con el logo al doble de
  // tamaño (520x520), centrar TODO el bloque (logo+subtítulo+botones) como grupo dejaba muy poco
  // margen en celulares de pantalla chica. Con flex-start el logo queda pegado arriba (como pidió
  // el usuario, "subirlo hacia arriba") y los botones quedan fijos abajo con espacio garantizado.
  // paddingTop fijo removido (2026-08-25): ahora se aplica dinámicamente con insets en el
  // render (ver arriba) para no quedar tapado por la hora/notificaciones de Android.
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, justifyContent: 'flex-start' },
  centro: { alignItems: 'center', marginBottom: 12 },
  // Agrandado al doble a pedido del usuario (2026-08-25) — ver cálculo de ANCHO_LOGO/ALTO_LOGO
  // arriba: usa la proporción REAL de la imagen (ancha, no cuadrada) para que el logo se vea
  // realmente grande en vez de quedar con espacio vacío dentro de un cuadro forzado.
  icono: { width: ANCHO_LOGO, height: ALTO_LOGO, marginBottom: -10 },
  subtitulo: { fontSize: 14, color: '#666', textAlign: 'center' },
  opciones: { gap: 14, marginTop: 'auto', marginBottom: 20 },
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
