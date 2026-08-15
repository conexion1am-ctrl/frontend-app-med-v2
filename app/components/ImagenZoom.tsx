import React from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Imagen con zoom por pellizco (pinch) y desplazamiento (pan) mientras está ampliada.
// Doble toque para volver al tamaño normal.
export default function ImagenZoom({ uri, style }) {
  const escala = useSharedValue(1);
  const escalaGuardada = useSharedValue(1);
  const desplazamientoX = useSharedValue(0);
  const desplazamientoY = useSharedValue(0);
  const desplazamientoXGuardado = useSharedValue(0);
  const desplazamientoYGuardado = useSharedValue(0);

  const gestoPellizco = Gesture.Pinch()
    .onUpdate((evento) => {
      const nuevaEscala = escalaGuardada.value * evento.scale;
      escala.value = Math.min(Math.max(nuevaEscala, 1), 5);
    })
    .onEnd(() => {
      escalaGuardada.value = escala.value;
      if (escala.value <= 1) {
        escala.value = withTiming(1);
        escalaGuardada.value = 1;
        desplazamientoX.value = withTiming(0);
        desplazamientoY.value = withTiming(0);
        desplazamientoXGuardado.value = 0;
        desplazamientoYGuardado.value = 0;
      }
    });

  const gestoArrastrar = Gesture.Pan()
    .onUpdate((evento) => {
      if (escala.value > 1) {
        desplazamientoX.value = desplazamientoXGuardado.value + evento.translationX;
        desplazamientoY.value = desplazamientoYGuardado.value + evento.translationY;
      }
    })
    .onEnd(() => {
      desplazamientoXGuardado.value = desplazamientoX.value;
      desplazamientoYGuardado.value = desplazamientoY.value;
    });

  const gestoDobleToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      escala.value = withTiming(1);
      escalaGuardada.value = 1;
      desplazamientoX.value = withTiming(0);
      desplazamientoY.value = withTiming(0);
      desplazamientoXGuardado.value = 0;
      desplazamientoYGuardado.value = 0;
    });

  const gestoCompuesto = Gesture.Simultaneous(gestoPellizco, gestoArrastrar, gestoDobleToque);

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [
      { translateX: desplazamientoX.value },
      { translateY: desplazamientoY.value },
      { scale: escala.value },
    ],
  }));

  return (
    <GestureDetector gesture={gestoCompuesto}>
      <Animated.Image source={{ uri }} style={[styles.imagen, style, estiloAnimado]} resizeMode="contain" />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  imagen: { width: '100%', height: '100%' },
});
