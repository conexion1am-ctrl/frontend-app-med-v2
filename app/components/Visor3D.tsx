import { useGLTF } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';

// Visor de modelos 3D (.glb) con rotar (arrastrar con 1 dedo), mover (arrastrar con 2 dedos),
// zoom (pellizcar con 2 dedos) y un modo "medir" donde el usuario toca dos puntos sobre el
// modelo y se calcula la distancia real entre ellos usando raycasting. Pensado para planos
// exportados desde SketchUp con escala real (metros).
//
// Migrado de expo-three + GLTFLoader "a mano" a @react-three/fiber + @react-three/drei
// (imports /native). Motivo: GLTFLoader usado directamente sobre expo-gl NO carga bien las
// texturas/colores embebidas en el .glb (usa TextureLoader estándar de Three.js, que depende de
// APIs de navegador -Image(), createImageBitmap()- no disponibles en Hermes/React Native) —
// el modelo se veía en gris plano aunque el archivo sí tuviera texturas (confirmado comparando
// contra un visor web, donde sí se veían bien). @react-three/fiber/native y
// @react-three/drei/native traen parches automáticos para que la carga de texturas funcione
// correctamente en este entorno.
//
// Los gestos táctiles se manejan por FUERA del <Canvas>, con react-native-gesture-handler
// (igual que en la versión anterior, ya verificada), y se aplican a la cámara real de R3F desde
// un componente interno (ControladorCamara) que lee el estado compartido en cada frame con
// useFrame — así se conserva toda la lógica de gestos ya probada sin reescribirla.

// Captura errores de carga del modelo (ej. .glb corrupto o URL inválida) dentro del árbol de
// React del <Canvas>. useGLTF usa Suspense, y sus rechazos de promesa solo se pueden atrapar
// con un Error Boundary de clase — no existe un hook equivalente en React todavía.
class LimiteDeError extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tieneError: false };
  }
  static getDerivedStateFromError() {
    return { tieneError: true };
  }
  componentDidCatch(error) {
    console.error('Error cargando el modelo 3D:', error);
    this.props.onError?.();
  }
  render() {
    if (this.state.tieneError) return null;
    return this.props.children;
  }
}

// Aplica en cada frame el estado de cámara (camState, calculado por los gestos táctiles fuera
// del <Canvas>) a la cámara real de R3F, y mueve la luz que acompaña a la cámara. Definido a
// nivel de módulo (no dentro de Visor3D) para que React no lo trate como un componente nuevo en
// cada render del padre, lo que forzaría un remontaje innecesario del árbol dentro del <Canvas>.
function ControladorCamara({ camState, camaraRef, luzCamaraRef }) {
  const { camera } = useThree();
  camaraRef.current = camera;

  useFrame(() => {
    const st = camState.current;
    const elevacionLimitada = Math.max(-1.4, Math.min(1.4, st.elevacion));
    const x = st.centro.x + st.radio * Math.cos(elevacionLimitada) * Math.sin(st.azimut);
    const y = st.centro.y + st.radio * Math.sin(elevacionLimitada);
    const z = st.centro.z + st.radio * Math.cos(elevacionLimitada) * Math.cos(st.azimut);
    camera.position.set(x, y, z);
    camera.lookAt(st.centro);

    if (luzCamaraRef.current) {
      luzCamaraRef.current.position.copy(camera.position);
    }
  });

  return null;
}

// Carga el .glb con drei (usa internamente el TextureLoader parcheado para React Native, por eso
// sí se ven los colores/texturas del archivo, a diferencia del GLTFLoader "a mano" que se usaba
// antes). Centra y escala el modelo una sola vez cuando termina de cargar, dentro de un
// useEffect (no directamente en el cuerpo del componente, que se ejecutaría en cada render y
// podría re-centrar el modelo mientras el usuario lo está rotando/moviendo). También definido a
// nivel de módulo por el mismo motivo que ControladorCamara.
function Modelo({ uri, camState, escenaRef, modeloRef, listoParaposicionarRef, onCargado }) {
  const { scene } = useGLTF(uri);
  const { scene: escenaThree } = useThree();

  useEffect(() => {
    escenaRef.current = escenaThree;

    if (!listoParaposicionarRef.current) {
      const caja = new THREE.Box3().setFromObject(scene);
      const centro = caja.getCenter(new THREE.Vector3());
      const tamano = caja.getSize(new THREE.Vector3());
      const dimensionMax = Math.max(tamano.x, tamano.y, tamano.z) || 1;

      scene.position.sub(centro);
      camState.current.centro = new THREE.Vector3(0, 0, 0);
      camState.current.radio = dimensionMax * 1.6;
      listoParaposicionarRef.current = true;
    }

    modeloRef.current = scene;
    onCargado();
    // Solo debe correr una vez, cuando el modelo (scene) cambia — no en cada render de este
    // componente, para no re-centrar/re-escalar mientras el usuario interactúa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return <primitive object={scene} />;
}

export default function Visor3D({ uri }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modoMedir, setModoMedir] = useState(false);
  const [puntosMedicion, setPuntosMedicion] = useState([]); // hasta 2 puntos THREE.Vector3
  const [distanciaMedida, setDistanciaMedida] = useState(null);
  const modoMedirRef = useRef(false); // espejo síncrono de modoMedir, legible dentro de los gestos

  const camaraRef = useRef(null);
  const escenaRef = useRef(null);
  const modeloRef = useRef(null);
  const luzCamaraRef = useRef(null);
  const marcadoresRef = useRef([]); // esferas rojas que marcan los puntos tocados
  // Tamaño EN PUNTOS del área donde se dibuja el visor, usado para convertir toques de pantalla
  // a coordenadas normalizadas para el raycasting.
  const layoutRef = useRef({ width: 1, height: 1 });

  // Estado de orbit/pan/zoom manual (sin OrbitControls, para conservar el mismo comportamiento
  // ya probado y no depender de otra librería más).
  const camState = useRef({ radio: 8, azimut: 0, elevacion: 0.5, centro: new THREE.Vector3(0, 0, 0) });
  // Snapshot del estado de cámara al INICIO de cada gesto, para calcular deltas limpios.
  const inicioGestoRef = useRef({ radio: 8, azimut: 0, elevacion: 0.5, centro: new THREE.Vector3(0, 0, 0) });
  // Se pone en true una vez que el modelo carga y calculamos el radio inicial según su tamaño;
  // ControladorCamara usa esto para saber cuándo aplicar la posición inicial de la cámara.
  const listoParaposicionarRef = useRef(false);

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

  // Toque simple: en modo medir, marca un punto.
  const gestoToque = Gesture.Tap()
    .maxDuration(250)
    .onEnd((evt, exitoso) => {
      if (!exitoso || !modoMedirRef.current) return;
      manejarToqueMedicion(evt.x, evt.y);
    });

  // Un dedo: orbita la cámara alrededor del modelo. Dos dedos: mueve el centro de la cámara.
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
      const direccionCamara = new THREE.Vector3();
      cam.getWorldDirection(direccionCamara);
      const derecha = new THREE.Vector3().crossVectors(direccionCamara, new THREE.Vector3(0, 1, 0)).normalize();
      const arribaCamara = new THREE.Vector3().crossVectors(derecha, direccionCamara).normalize();

      const escala = camState.current.radio * 0.0015;
      const desplazamiento = new THREE.Vector3()
        .addScaledVector(derecha, -evt.translationX * escala)
        .addScaledVector(arribaCamara, evt.translationY * escala);

      camState.current.centro = inicio.centro.clone().add(desplazamiento);
    });

  const gestoZoom = Gesture.Pinch()
    .onStart(() => {
      inicioGestoRef.current = { ...camState.current, centro: camState.current.centro.clone() };
    })
    .onUpdate((evt) => {
      const inicio = inicioGestoRef.current;
      const nuevoRadio = Math.max(0.5, Math.min(60, inicio.radio / evt.scale));
      camState.current.radio = nuevoRadio;
    });

  const gestoCompuesto = Gesture.Simultaneous(
    gestoToque,
    Gesture.Race(gestoOrbitar, Gesture.Simultaneous(gestoMover, gestoZoom))
  );

  const reiniciarVista = () => {
    if (!modeloRef.current) return;
    const caja = new THREE.Box3().setFromObject(modeloRef.current);
    const tamano = caja.getSize(new THREE.Vector3());
    const dimensionMax = Math.max(tamano.x, tamano.y, tamano.z) || 1;
    camState.current = { radio: dimensionMax * 1.6, azimut: 0, elevacion: 0.5, centro: new THREE.Vector3(0, 0, 0) };
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
          <Canvas
            camera={{ fov: 55, near: 0.05, far: 1000 }}
            gl={{ antialias: true }}
            onCreated={() => setError('')}
          >
            <color attach="background" args={['#e8e8e8']} />
            {/* Iluminación pensada para que ninguna cara del modelo quede oscura sin importar
                cómo se rote: luz ambiental fuerte como base pareja, varias luces direccionales
                fijas desde distintos ángulos, y una luz extra que acompaña a la cámara. */}
            <ambientLight intensity={1.1} />
            <hemisphereLight args={['#ffffff', '#666666', 0.6]} />
            <directionalLight position={[0, 10, 0]} intensity={0.7} />
            <directionalLight position={[5, 5, 10]} intensity={0.6} />
            <directionalLight position={[-5, 3, -10]} intensity={0.5} />
            <directionalLight position={[-10, 4, 0]} intensity={0.4} />
            <pointLight ref={luzCamaraRef} intensity={0.6} />

            <ControladorCamara camState={camState} camaraRef={camaraRef} luzCamaraRef={luzCamaraRef} />

            <LimiteDeError
              onError={() => {
                setError('No se pudo abrir este archivo. Verifica que sea un .glb válido.');
                setCargando(false);
              }}
            >
              <Suspense fallback={null}>
                <Modelo
                  uri={uri}
                  camState={camState}
                  escenaRef={escenaRef}
                  modeloRef={modeloRef}
                  listoParaposicionarRef={listoParaposicionarRef}
                  onCargado={() => setCargando(false)}
                />
              </Suspense>
            </LimiteDeError>
          </Canvas>
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
