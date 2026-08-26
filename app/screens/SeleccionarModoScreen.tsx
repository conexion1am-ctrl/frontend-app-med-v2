import React from 'react';
import { Dimensions, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// El archivo original (icono-bienvenida.png) medía 2816x1536 px, pero el ícono real (el cuadrado
// blanco "C&D Manager") ocupaba solo una porción centrada de ~1037x1036 — el resto era un fondo
// negro con "estrellitas" que, aunque técnicamente transparente en partes, visualmente se veía
// como un margen enorme vacío alrededor del logo (2026-08-25, reportado por el usuario). Se
// recortó la imagen para que el archivo contenga solo el ícono real (ahora 1139x1138, casi
// cuadrado), así el logo se ve grande de verdad en vez de "perdido" en espacio vacío.
const { width: anchoPantalla } = Dimensions.get('window');
const RELACION_LOGO = 1138 / 1139; // alto/ancho real del archivo ya recortado
// Vuelto a 0.45 (2026-08-25, cuarta ronda): el usuario aclaró que el término medio pedido era
// entre 90% (tamaño original, muy grande) y 45% (primera reducción a la mitad) — es decir, 45%
// YA ERA el término medio pedido, no un punto de partida a reducir más. Vista previa pendiente
// de confirmación con este valor.
const ANCHO_LOGO = anchoPantalla * 0.45;
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
//
// Fondo con imagen (2026-08-25, a pedido del usuario): reemplaza el fondo blanco liso por
// fondo-seleccionar-modo.jpg (imagen de circuito/espacio azul oscuro provista por el usuario).
// Esto es SOLO para esta pantalla de portada — las pantallas siguientes (Ingresar, Ingresar
// Invitado) siguen con su fondo claro normal hasta que el usuario entra a una empresa (ahí ya
// aplican los colores propios de esa compañía, lógica que no se toca aquí).
export default function SeleccionarModoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <ImageBackground
      source={require('../../assets/images/fondo-seleccionar-modo.jpg')}
      style={styles.fondo}
      resizeMode="cover"
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.centro}>
          <ImageBackground
            source={require('../../assets/images/icono-bienvenida.png')}
            style={styles.icono}
            imageStyle={{ resizeMode: 'contain' }}
          />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, width: '100%', height: '100%' },
  // justifyContent: 'center' quitado (2026-08-25, cuarta ronda): con 'center', al volver el logo
  // a 0.45 el bloque completo se agranda y empuja los botones hacia abajo otra vez. El usuario
  // pidió "sube el logo un poco, pero deja los botones en la misma posición" — así que ahora el
  // logo se ancla arriba (marginTop reducido) y los botones quedan fijos con marginTop absoluto,
  // independientes del tamaño del logo.
  container: { flex: 1, padding: 24 },
  centro: { alignItems: 'center', marginTop: 40, marginBottom: 12 },
  // Vuelto a 0.45 — ver ANCHO_LOGO arriba. "Subir un poco" se logra con menos separación hacia
  // el subtítulo (subtitulo.marginTop bajado de 30 a 16) en vez de mover el logo mismo, para no
  // desplazar el bloque de botones que debe quedar fijo.
  icono: { width: ANCHO_LOGO, height: ALTO_LOGO, marginBottom: 0 },
  // Texto claro (2026-08-25): con el fondo oscuro de circuito/espacio, el gris oscuro anterior
  // (#666) quedaba casi ilegible. Se agregó sombra de texto por legibilidad extra sobre la imagen.
  subtitulo: {
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // marginTop fijo en vez de depender de justifyContent: 'center' (2026-08-25, cuarta ronda):
  // este valor mantiene los botones en la MISMA posición aproximada de la ronda anterior (32%),
  // independiente de que el logo haya vuelto a crecer a 0.45.
  opciones: { gap: 14, marginTop: 90 },
  // Tarjetas semi-transparentes (2026-08-25): sobre el fondo oscuro de circuito, un fondo blanco
  // sólido se veía como "una caja pegada encima" de la imagen; con transparencia se integra mejor
  // sin perder legibilidad del texto.
  opcion: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  opcionTitulo: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 4 },
  opcionTexto: { fontSize: 13, color: '#777' },
});
