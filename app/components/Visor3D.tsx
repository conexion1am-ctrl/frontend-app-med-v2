import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Visor de modelos 3D (.glb) con rotar (arrastrar), zoom (pellizcar con dos dedos) y un modo
// "medir" donde el usuario toca dos puntos sobre el modelo y se calcula la distancia real entre
// ellos usando raycasting. Pensado para planos exportados desde SketchUp con escala real (metros).
export default function Visor3D({ uri }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modoMedir, setModoMedir] = useState(false);
  const [puntosMedicion, setPuntosMedicion] = useState([]); // hasta 2 puntos THREE.Vector3
  const [distanciaMedida, setDistanciaMedida] = useState(null);

  const escenaRef = useRef(null);
  const camaraRef = useRef(null);
  const rendererRef = useRef(null);
  const modeloRef = useRef(null);
  const glRef = useRef(null);
  const marcadoresRef = useRef([]); // esferas rojas que marcan los puntos tocados
  const vistaRef = useRef({ width: 1, height: 1 });

  // Estado de orbit/zoom manual (sin librería externa, controlado con PanResponder)
  const camState = useRef({ radio: 8, azimut: 0, elevacion: 0.5, centro: new THREE.Vector3(0, 0, 0) });
  const gestoRef = useRef({ modo: null, ultimoX: 0, ultimoY: 0, distanciaInicial: 0, radioInicial: 8 });

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

  const distanciaEntreToques = (toques) => {
    const [a, b] = toques;
    const dx = a.pageX - b.pageX;
    const dy = a.pageY - b.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Convierte un toque en pantalla a un punto real sobre la superficie del modelo (raycasting).
  const tocarModelo = (pageX, pageY) => {
    const cam = camaraRef.current;
    const modelo = modeloRef.current;
    if (!cam || !modelo) return null;

    const { width, height } = vistaRef.current;
    const mouse = new THREE.Vector2((pageX / width) * 2 - 1, -(pageY / height) * 2 + 1);
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

  const manejarToqueMedicion = (evt) => {
    const { pageX, pageY } = evt.nativeEvent;
    const punto = tocarModelo(pageX, pageY);
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const toques = evt.nativeEvent.touches;
        if (modoMedir && toques.length === 1) {
          manejarToqueMedicion(evt);
          gestoRef.current.modo = null;
          return;
        }
        if (toques.length === 2) {
          gestoRef.current.modo = 'zoom';
          gestoRef.current.distanciaInicial = distanciaEntreToques(toques);
          gestoRef.current.radioInicial = camState.current.radio;
        } else {
          gestoRef.current.modo = 'orbitar';
          gestoRef.current.ultimoX = evt.nativeEvent.pageX;
          gestoRef.current.ultimoY = evt.nativeEvent.pageY;
        }
      },
      onPanResponderMove: (evt) => {
        const toques = evt.nativeEvent.touches;
        const gesto = gestoRef.current;

        if (toques.length === 2) {
          if (gesto.modo !== 'zoom') {
            gesto.modo = 'zoom';
            gesto.distanciaInicial = distanciaEntreToques(toques);
            gesto.radioInicial = camState.current.radio;
          }
          const distanciaActual = distanciaEntreToques(toques);
          const factor = gesto.distanciaInicial / Math.max(distanciaActual, 1);
          const nuevoRadio = Math.max(0.5, Math.min(60, gesto.radioInicial * factor));
          camState.current.radio = nuevoRadio;
          actualizarCamara();
        } else if (gesto.modo === 'orbitar') {
          const dx = evt.nativeEvent.pageX - gesto.ultimoX;
          const dy = evt.nativeEvent.pageY - gesto.ultimoY;
          camState.current.azimut -= dx * 0.008;
          camState.current.elevacion += dy * 0.008;
          gesto.ultimoX = evt.nativeEvent.pageX;
          gesto.ultimoY = evt.nativeEvent.pageY;
          actualizarCamara();
        }
      },
      onPanResponderRelease: () => {
        gestoRef.current.modo = null;
      },
    })
  ).current;

  const onContextCreate = async (gl) => {
    try {
      glRef.current = gl;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      vistaRef.current = { width, height };

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
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      </View>

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
          <View style={styles.barraSuperior}>
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

          {modoMedir && (
            <View style={styles.avisoMedicion}>
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
