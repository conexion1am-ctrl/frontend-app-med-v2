import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Visor de modelos 3D (.glb) con rotar (arrastrar con 1 dedo), mover (arrastrar con 2 dedos),
// zoom (pellizcar con 2 dedos) y un modo "medir" donde el usuario toca dos puntos sobre el
// modelo y se calcula la distancia real entre ellos usando raycasting. Pensado para planos
// exportados desde SketchUp con escala real (metros).
//
// Los gestos se manejan con react-native-gesture-handler (Pinch + Pan simultáneos) en vez de
// PanResponder manual: PanResponder leía evt.nativeEvent.touches directamente, cuyo orden puede
// cambiar entre frames al usar 2 dedos, causando saltos falsos de zoom. gesture-handler resuelve
// esto de forma nativa y confiable.
export default function Visor3D({ uri }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modoMedir, setModoMedir] = useState(false);
  const [puntosMedicion, setPuntosMedicion] = useState([]); // hasta 2 puntos THREE.Vector3
  const [distanciaMedida, setDistanciaMedida] = useState(null);
  const modoMedirRef = useRef(false); // espejo síncrono de modoMedir, legible dentro de los gestos

  const escenaRef = useRef(null);
  const camaraRef = useRef(null);
  const rendererRef = useRef(null);
  const modeloRef = useRef(null);
  const marcadoresRef = useRef([]); // esferas rojas que marcan los puntos tocados
  // Tamaño EN PUNTOS (no píxeles físicos) del área donde se dibuja el modelo, usado para
  // convertir toques de pantalla a coordenadas normalizadas para el raycasting. Se lee del
  // layout real de la View (onLayout), no del drawingBuffer del GLView, que está en píxeles
  // físicos y queda desalineado en celulares con pixelRatio distinto de 1.
  const layoutRef = useRef({ width: 1, height: 1 });

  // Estado de orbit/pan/zoom manual (sin librería de cámara externa)
  const camState = useRef({ radio: 8, azimut: 0, elevacion: 0.5, centro: new THREE.Vector3(0, 0, 0) });
  // Snapshot del estado de cámara al INICIO de cada gesto, para calcular deltas limpios en vez
  // de acumular pequeños errores frame a frame.
  const inicioGestoRef = useRef({ radio: 8, azimut: 0, elevacion: 0.5, centro: new THREE.Vector3(0, 0, 0) });

  const actualizarCamara = () => {
    const cam = camaraRef.current;
    const st = camState.current;
    if (!cam) return;
    const elevacionLimitada = Math.max(-1.4, Math.min(1.4, st.elevacion));
    const x = st.centro.x + st.radio * Math.cos(elevacionLimitada) * Math.sin(st.azimut);
    const y = st.centro.y + st.radio * Math.sin(elevacionLimitada);
    const z = st.centro.z + st.radio * Math.cos(elevacionLimitada) * Math.cos(st.azimut);
    cam.position.set(x, y, z);
    cam.lookAt(st.centro);
  };

  // Convierte un toque en coordenadas de pantalla (relativas al layout del visor) a un punto
  // real sobre la superficie del modelo, usando raycasting.
  const tocarModelo = (x, y) => {
    const cam = camaraRef.current;
    const modelo = modeloRef.current;
    if (!cam || !modelo) return null;

    const { width, height } = layoutRef.current;
    const mouse = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cam);
    const intersecciones = raycaster.intersectObject(modelo, true);
    if (intersecciones.length === 0) return null;
    return intersecciones[0].point.clone();
  };

  const agregarMarcador = (punto) => {
    const escena = escenaRef.current;
    if (!escena) return;
    const geometria = new THREE.SphereGeometry(camState.current.radio * 0.012, 12, 12);
    const material = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const esfera = new THREE.Mesh(geometria, material);
    esfera.position.copy(punto);
    escena.add(esfera);
    marcadoresRef.current.push(esfera);
  };

  const limpiarMarcadores = () => {
    const escena = escenaRef.current;
    if (escena) {
      marcadoresRef.current.forEach((m) => escena.remove(m));
    }
    marcadoresRef.current = [];
  };

  const manejarToqueMedicion = (x, y) => {
    const punto = tocarModelo(x, y);
    if (!punto) return;

    setPuntosMedicion((anteriores) => {
      let nuevos;
      if (anteriores.length >= 2) {
        limpiarMarcadores();
        nuevos = [punto];
      } else {
        nuevos = [...anteriores, punto];
      }
      agregarMarcador(punto);
      if (nuevos.length === 2) {
        const distancia = nuevos[0].distanceTo(nuevos[1]);
        setDistanciaMedida(distancia);
      } else {
        setDistanciaMedida(null);
      }
      return nuevos;
    });
  };

  // Toque simple: en modo medir, marca un punto. Fuera de modo medir, no hace nada (rotar/mover
  // se manejan con los gestos Pan/Pinch de abajo).
  const gestoToque = Gesture.Tap()
    .maxDuration(250)
    .onEnd((evt, exitoso) => {
      if (!exitoso || !modoMedirRef.current) return;
      manejarToqueMedicion(evt.x, evt.y);
    });

  // Un dedo: orbita la cámara alrededor del modelo. Dos dedos: mueve el centro de la cámara
  // (paneo), como en cualquier visor 3D estándar. Se distingue por minPointers/maxPointers en
  // dos gestos Pan separados corriendo en simultáneo con el pellizco de zoom.
  const gestoOrbitar = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      inicioGestoRef.current = { ...camState.current, centro: camState.current.centro.clone() };
    })
    .onUpdate((evt) => {
      if (modoMedirRef.current) return; // en modo medir, un dedo solo marca puntos, no orbita
      const inicio = inicioGestoRef.current;
      camState.current.azimut = inicio.azimut - evt.translationX * 0.008;
      camState.current.elevacion = inicio.elevacion + evt.translationY * 0.008;
      actualizarCamara();
    });

  const gestoMover = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onStart(() => {
      inicioGestoRef.current = { ...camState.current, centro: camState.current.centro.clone() };
    })
    .onUpdate((evt) => {
      const cam = camaraRef.current;
      if (!cam) return;
      const inicio = inicioGestoRef.current;
      // Movemos el centro de la cámara en el plano de la vista (ejes derecha/arriba de la
      // cámara), escalado por el radio actual para que el paneo se sienta igual de rápido sin
      // importar qué tan alejados o cerca estemos del modelo.
      const direccionCamara = new THREE.Vector3();
      cam.getWorldDirection(direccionCamara);
      const derecha = new THREE.Vector3().crossVectors(direccionCamara, new THREE.Vector3(0, 1, 0)).normalize();
      const arribaCamara = new THREE.Vector3().crossVectors(derecha, direccionCamara).normalize();

      const escala = camState.current.radio * 0.0015;
      const desplazamiento = new THREE.Vector3()
        .addScaledVector(derecha, -evt.translationX * escala)
        .addScaledVector(arribaCamara, evt.translationY * escala);

      camState.current.centro = inicio.centro.clone().add(desplazamiento);
      actualizarCamara();
    });

  const gestoZoom = Gesture.Pinch()
    .onStart(() => {
      inicioGestoRef.current = { ...camState.current, centro: camState.current.centro.clone() };
    })
    .onUpdate((evt) => {
      const inicio = inicioGestoRef.current;
      const nuevoRadio = Math.max(0.5, Math.min(60, inicio.radio / evt.scale));
      camState.current.radio = nuevoRadio;
      actualizarCamara();
    });

  // Pan de 1 dedo (orbitar) y Pan de 2 dedos (mover) son mutuamente excluyentes por
  // minPointers/maxPointers, así que se combinan con Race; el zoom (Pinch) corre en simultáneo
  // con el paneo de 2 dedos para que pellizcar-y-arrastrar funcione en el mismo gesto, como en
  // cualquier visor 3D o mapa.
  const gestoCompuesto = Gesture.Simultaneous(
    gestoToque,
    Gesture.Race(gestoOrbitar, Gesture.Simultaneous(gestoMover, gestoZoom))
  );

  const onContextCreate = async (gl) => {
    try {
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;

      const renderer = new Renderer({ gl });
      renderer.setSize(width, height);
      renderer.setClearColor(0xe8e8e8, 1);
      rendererRef.current = renderer;

      const escena = new THREE.Scene();
      escenaRef.current = escena;

      const camara = new THREE.PerspectiveCamera(55, width / height, 0.05, 1000);
      camaraRef.current = camara;

      escena.add(new THREE.AmbientLight(0xffffff, 0.9));
      const luzDireccional = new THREE.DirectionalLight(0xffffff, 0.8);
      luzDireccional.position.set(5, 10, 7);
      escena.add(luzDireccional);

      // Descarga el .glb y lo interpreta con GLTFLoader (funciona con URLs remotas vía fetch).
      const respuesta = await fetch(uri);
      const arrayBuffer = await respuesta.arrayBuffer();
      const loader = new GLTFLoader();

      loader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          const modelo = gltf.scene;

          // Centramos y escalamos el modelo para que siempre quepa bien en la vista,
          // sin importar el tamaño real que traiga desde SketchUp.
          const caja = new THREE.Box3().setFromObject(modelo);
          const centro = caja.getCenter(new THREE.Vector3());
          const tamano = caja.getSize(new THREE.Vector3());
          const dimensionMax = Math.max(tamano.x, tamano.y, tamano.z) || 1;

          modelo.position.sub(centro);
          escena.add(modelo);
          modeloRef.current = modelo;

          camState.current.centro = new THREE.Vector3(0, 0, 0);
          camState.current.radio = dimensionMax * 1.6;
          actualizarCamara();

          setCargando(false);
        },
        (errorCarga) => {
          console.error('Error interpretando el modelo 3D:', errorCarga);
          setError('No se pudo abrir este archivo. Verifica que sea un .glb válido.');
          setCargando(false);
        }
      );

      const render = () => {
        requestAnimationFrame(render);
        renderer.render(escena, camara);
        gl.endFrameEXP();
      };
      render();
    } catch (err) {
      console.error('Error inicializando el visor 3D:', err);
      setError('No se pudo cargar el archivo 3D. Revisa tu conexión e intenta de nuevo.');
      setCargando(false);
    }
  };

  const reiniciarVista = () => {
    if (!modeloRef.current) return;
    const caja = new THREE.Box3().setFromObject(modeloRef.current);
    const tamano = caja.getSize(new THREE.Vector3());
    const dimensionMax = Math.max(tamano.x, tamano.y, tamano.z) || 1;
    camState.current = { radio: dimensionMax * 1.6, azimut: 0, elevacion: 0.5, centro: new THREE.Vector3(0, 0, 0) };
    actualizarCamara();
  };

  const alternarModoMedir = () => {
    setModoMedir((actual) => {
      const nuevo = !actual;
      modoMedirRef.current = nuevo;
      if (!nuevo) {
        limpiarMarcadores();
        setPuntosMedicion([]);
        setDistanciaMedida(null);
      }
      return nuevo;
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={gestoCompuesto}>
        <View
          style={{ flex: 1 }}
          onLayout={(evt) => {
            const { width, height } = evt.nativeEvent.layout;
            layoutRef.current = { width, height };
          }}
        >
          <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
        </View>
      </GestureDetector>

      {cargando && (
        <View style={styles.overlayCentro} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayTexto}>Cargando modelo 3D...</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.overlayCentro} pointerEvents="none">
          <Text style={styles.overlayTextoError}>{error}</Text>
        </View>
      )}

      {!cargando && !error && (
        <>
          <View style={styles.barraSuperior} pointerEvents="box-none">
            <TouchableOpacity style={styles.botonChico} onPress={reiniciarVista}>
              <Text style={styles.botonChicoTexto}>⟲ Restablecer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonChico, modoMedir && styles.botonChicoActivo]}
              onPress={alternarModoMedir}
            >
              <Text style={[styles.botonChicoTexto, modoMedir && styles.botonChicoTextoActivo]}>
                📏 {modoMedir ? 'Midiendo' : 'Medir'}
              </Text>
            </TouchableOpacity>
          </View>

          {!modoMedir && (
            <View style={styles.avisoAyuda} pointerEvents="none">
              <Text style={styles.avisoAyudaTexto}>1 dedo: rotar · 2 dedos: mover / zoom</Text>
            </View>
          )}

          {modoMedir && (
            <View style={styles.avisoMedicion} pointerEvents="none">
              <Text style={styles.avisoMedicionTexto}>
                {distanciaMedida != null
                  ? `Distancia aproximada: ${Math.round(distanciaMedida * 1000)} mm`
                  : puntosMedicion.length === 1
                  ? 'Toca el segundo punto'
                  : 'Toca dos puntos sobre el modelo para medir'}
              </Text>
              <Text style={styles.avisoMedicionNota}>
                Medición aproximada, depende de la escala real del archivo exportado.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayCentro: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayTexto: { color: '#fff', marginTop: 10, fontSize: 13 },
  overlayTextoError: { color: '#fff', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
  barraSuperior: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  botonChico: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  botonChicoActivo: { backgroundColor: '#1E90FF' },
  botonChicoTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  botonChicoTextoActivo: { color: '#fff' },
  avisoAyuda: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  avisoAyudaTexto: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  avisoMedicion: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 12,
  },
  avisoMedicionTexto: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  avisoMedicionNota: { color: 'rgba(255,255,255,0.75)', fontSize: 11, textAlign: 'center', marginTop: 4 },
});
