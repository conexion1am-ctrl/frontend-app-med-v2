import { useGLTF } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
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
function ControladorCamara({ camState, camaraRef, luzCamaraRef, marcadoresRef }) {
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

    // Los marcadores rojos de medición deben verse siempre del mismo tamaño EN PANTALLA, sin
    // importar qué tan cerca o lejos esté la cámara — igual que los puntos de referencia de
    // SketchUp. Como ahora el zoom mueve la cámara libremente (en vez de orbitar a un radio
    // fijo), ya no hay un "radio" único que sirva para calcular su tamaño de una sola vez al
    // crearlos: hay que reescalarlos en cada frame según su distancia real a la cámara.
    if (marcadoresRef?.current?.length) {
      marcadoresRef.current.forEach((esfera) => {
        const distancia = camera.position.distanceTo(esfera.position);
        const escala = distancia * 0.02;
        esfera.scale.setScalar(escala);
      });
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
// Agrega, a cada Mesh del modelo, una línea de contorno (EdgesGeometry) que resalta solo las
// aristas donde el ángulo entre caras vecinas es pronunciado (>35°) — es decir, exactamente las
// uniones reales entre piezas (donde termina una tabla y empieza otra), no cualquier textura o
// sombra de la superficie. threshold más alto = solo esquinas "duras" reales, ignora curvas
// suaves. Se recorre una sola vez, cuando el modelo termina de cargar.
//
// Además de dibujar el contorno, esta misma pasada devuelve la lista de segmentos de arista en
// coordenadas de MUNDO (no locales a cada pieza) — esa lista es la que usa el snap de medición
// (ver buscarPuntoDeAristaMasCercano) para "imanar" el punto tocado a la arista real más
// próxima, en vez de dejarlo flotando en cualquier parte de la superficie.
function agregarContornosDePiezas(raiz) {
  const meshesAProcesar = [];
  raiz.traverse((nodo) => {
    if (nodo.isMesh && nodo.geometry) meshesAProcesar.push(nodo);
  });

  const segmentosDeArista = []; // [{ a: Vector3, b: Vector3 }, ...] en coordenadas de mundo

  meshesAProcesar.forEach((mesh) => {
    const geometriaBordes = new THREE.EdgesGeometry(mesh.geometry, 35);
    const material = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55, // subido de 0.35 a pedido del usuario: un poco más marcado para distinguir
      // mejor las uniones, sin llegar a verse como un dibujo caricaturesco. NOTA: linewidth de
      // LineBasicMaterial NO funciona de forma confiable en móvil/OpenGL ES (limitación conocida
      // de Three.js, no es un bug de este código) — por eso el ajuste de "grosor" se logra
      // subiendo la opacidad, no el linewidth.
    });
    const lineas = new THREE.LineSegments(geometriaBordes, material);
    lineas.renderOrder = 1; // dibujar después de la pieza, encima, para que no quede tapado
    // Desactiva el raycasting de estas líneas: sin esto, el rayo del toque (tocarModelo) podría
    // "chocar" contra la línea del contorno en vez de la cara sólida de la pieza que hay
    // debajo, dando un punto de superficie ligeramente distinto al esperado.
    lineas.raycast = () => {};
    mesh.add(lineas);

    // EdgesGeometry guarda pares de puntos consecutivos (cada par = un segmento de arista), en
    // coordenadas LOCALES del mesh. Los pasamos a coordenadas de mundo con matrixWorld para que
    // todos los segmentos, de todas las piezas, queden en el mismo sistema de referencia y se
    // puedan comparar entre sí sin importar de qué pieza vengan.
    mesh.updateMatrixWorld(true);
    const posiciones = geometriaBordes.attributes.position;
    for (let i = 0; i < posiciones.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(posiciones, i).applyMatrix4(mesh.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(posiciones, i + 1).applyMatrix4(mesh.matrixWorld);
      segmentosDeArista.push({ a, b });
    }
  });

  return segmentosDeArista;
}

// Dado un punto (donde el usuario tocó la superficie) y la lista de segmentos de arista del
// modelo, busca el punto MÁS CERCANO sobre cualquiera de esas aristas — igual que el "snap a
// aristas" de SketchUp. radioIman limita qué tan lejos puede estar la arista para que aplique
// el snap (en las mismas unidades que el modelo, normalmente metros); si el punto tocado está
// más lejos que eso de cualquier arista, se devuelve tal cual, sin imanar.
function buscarPuntoDeAristaMasCercano(punto, segmentosDeArista, radioIman) {
  let mejorPunto = null;
  let mejorDistancia = radioIman;

  const segmentoAux = new THREE.Vector3();
  const puntoEnSegmento = new THREE.Vector3();

  for (const { a, b } of segmentosDeArista) {
    // Proyecta `punto` sobre el segmento a→b y recorta el resultado para que quede DENTRO del
    // segmento (t entre 0 y 1) — así el imán encuentra tanto los extremos (vértices) como
    // cualquier punto intermedio de la arista, tal como espera un carpintero midiendo un borde.
    segmentoAux.subVectors(b, a);
    const largoAlCuadrado = segmentoAux.lengthSq();
    let t = largoAlCuadrado > 0 ? punto.clone().sub(a).dot(segmentoAux) / largoAlCuadrado : 0;
    t = Math.max(0, Math.min(1, t));
    puntoEnSegmento.copy(a).addScaledVector(segmentoAux, t);

    const distancia = puntoEnSegmento.distanceTo(punto);
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejorPunto = puntoEnSegmento.clone();
    }
  }

  return mejorPunto || punto;
}

// Lee los grupos/componentes reales del modelo (los mismos nombres que tenían en SketchUp, ej.
// "Cajon 1", "Cajon 2", "Estructura") y arma el ÁRBOL que se muestra en el panel de
// Mostrar/Ocultar. Si el .glb no trae nombres reales (todo suelto sin agrupar), cae de vuelta a
// listar cada Mesh individual para que el panel no quede vacío.
//
// Algunos exportadores de SketchUp envuelven TODO el mueble dentro de un único grupo raíz (ej.
// una sola "Escena" o "Modelo" que contiene todas las piezas adentro) — mirar solo scene.children
// en ese caso solo encuentra "1 grupo" y el botón de Piezas nunca aparecía, aunque el mueble sí
// tuviera varias piezas nombradas más abajo. Por eso esta función "baja" automáticamente por la
// jerarquía mientras encuentre un único hijo contenedor (un envoltorio sin hermanos), hasta
// llegar al nivel real donde el modelo se separa en dos o más piezas.
//
// Además, cada pieza detectada puede a su vez contener sub-piezas/sub-grupos adentro (ej.
// "Cajon 1" que por dentro tiene "Frente", "Fondo", "Guías") — por eso esta función es
// RECURSIVA: cada nodo de la lista trae su propio array `hijos` (vacío si es una pieza sólida
// sin nada más adentro), y el panel se encarga de mostrar una flecha para expandir cuando
// `hijos.length > 0`.
function detectarComponentes(scene) {
  let nivelActual = scene;
  // Mientras el nivel actual tenga exactamente un hijo que a su vez tenga hijos propios (es
  // decir, sea otro grupo contenedor y no una pieza sólida), seguimos bajando un nivel.
  while (
    nivelActual.children.length === 1 &&
    nivelActual.children[0].children &&
    nivelActual.children[0].children.length > 0
  ) {
    nivelActual = nivelActual.children[0];
  }

  return construirArbolComponentes(nivelActual);
}

// Construye recursivamente el árbol de piezas a partir de un nodo de Three.js. Un nodo se
// considera "hoja" (sin más nada que expandir) si es un Mesh sin hijos propios, o si ninguno de
// sus hijos aporta información nueva (por ejemplo un Mesh con una sola línea de contorno interna
// ya agregada por agregarContornosDePiezas, que no debe listarse como "sub-pieza").
function construirArbolComponentes(nivelActual) {
  const candidatos = nivelActual.children.filter((hijo) => {
    if (hijo.isLineSegments) return false; // contornos agregados por agregarContornosDePiezas, no son piezas
    return hijo.type !== 'Object3D' || hijo.children.length > 0 || hijo.isMesh;
  });
  const base = candidatos.length > 0 ? candidatos : nivelActual.children;

  return base.map((nodo, indice) => {
    // Sub-hijos reales del nodo (mismo filtro, para no contar los contornos como sub-piezas).
    const subHijos = (nodo.children || []).filter((hijo) => !hijo.isLineSegments);
    // Solo vale la pena bajar un nivel más si hay 2+ sub-piezas reales, o 1 sub-grupo que a su
    // vez tenga más adentro — un Mesh con un único hijo trivial no necesita expandirse.
    const tieneSubgrupoUnico = subHijos.length === 1 && subHijos[0].children?.length > 0 && !subHijos[0].isMesh;
    const hijos =
      subHijos.length > 1
        ? construirArbolComponentes(nodo)
        : tieneSubgrupoUnico
        ? construirArbolComponentes(subHijos[0])
        : [];

    return {
      id: nodo.uuid,
      nombre: nodo.name && nodo.name.trim() ? nodo.name : `Pieza ${indice + 1}`,
      nodo,
      hijos,
    };
  });
}

// Junta, en una sola lista plana, TODOS los ids del árbol (el nodo y todos sus descendientes) —
// usado para ocultar/mostrar de golpe una pieza padre junto con todo lo que tiene adentro.
function idsDelArbol(pieza) {
  return [pieza.id, ...pieza.hijos.flatMap(idsDelArbol)];
}

// Recorre el árbol completo y devuelve la lista aplanada de TODAS las piezas (padres e hijos),
// usada por el useEffect que aplica node.visible = true/false sobre cada nodo real de Three.js.
function aplanarArbol(piezas) {
  return piezas.flatMap((pieza) => [pieza, ...aplanarArbol(pieza.hijos)]);
}

function Modelo({ uri, camState, escenaRef, modeloRef, listoParaposicionarRef, onCargado, onComponentesDetectados, onAristasDetectadas }) {
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

      // IMPORTANTE: los segmentos de arista se calculan DESPUÉS de mover la escena a su
      // posición centrada (scene.position.sub(centro), arriba), para que sus coordenadas de
      // mundo ya coincidan con las de los puntos que toque el usuario al medir. Si se
      // calcularan antes del recentrado, quedarían desplazados y el imán apuntaría a un lugar
      // vacío en vez de a la arista real que se ve en pantalla.
      const segmentosDeArista = agregarContornosDePiezas(scene);
      onComponentesDetectados(detectarComponentes(scene));
      // El radio del imán es proporcional al tamaño del modelo (3% de su dimensión más grande,
      // subido de 1.5% porque con el dedo el toque es menos preciso que con un mouse y el imán
      // casi no se sentía). Así funciona igual de bien en una mesa de noche chiquita que en un
      // mueble grande, sin tener que ajustarlo a mano según el archivo. Esta misma escala
      // también se reutiliza para calcular qué tan rápido avanza el zoom libre (ver gestoZoom).
      onAristasDetectadas(segmentosDeArista, dimensionMax * 0.03);
    }

    modeloRef.current = scene;
    onCargado();
    // Solo debe correr una vez, cuando el modelo (scene) cambia — no en cada render de este
    // componente, para no re-centrar/re-escalar mientras el usuario interactúa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return <primitive object={scene} />;
}

// Una fila del panel de Piezas, recursiva: si la pieza tiene sub-piezas (hijos.length > 0),
// muestra una flecha para expandir/colapsar y, al expandirse, dibuja sus hijos debajo con un
// poco más de indentación (nivel + 1) — así de "Cajon 1" se puede desplegar "Frente", "Fondo",
// "Guías", etc., a cualquier profundidad que tenga el modelo real.
function FilaPieza({ pieza, nivel, ocultos, expandidos, onAlternarVisibilidad, onAlternarExpandido }) {
  const tieneHijos = pieza.hijos.length > 0;
  const expandida = expandidos.has(pieza.id);
  return (
    <View>
      <View style={[styles.panelPiezaFila, { paddingLeft: 4 + nivel * 18 }]}>
        {tieneHijos ? (
          <TouchableOpacity onPress={() => onAlternarExpandido(pieza.id)} style={styles.panelPiezaFlecha} hitSlop={8}>
            <Text style={styles.panelPiezaFlechaTexto}>{expandida ? '▾' : '▸'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.panelPiezaFlecha} />
        )}
        <Text style={styles.panelPiezaNombre} numberOfLines={1}>
          {pieza.nombre}
        </Text>
        <Switch
          value={!ocultos.has(pieza.id)}
          onValueChange={() => onAlternarVisibilidad(pieza)}
          trackColor={{ false: '#555', true: '#1E90FF' }}
          thumbColor="#fff"
        />
      </View>
      {tieneHijos &&
        expandida &&
        pieza.hijos.map((hijo) => (
          <FilaPieza
            key={hijo.id}
            pieza={hijo}
            nivel={nivel + 1}
            ocultos={ocultos}
            expandidos={expandidos}
            onAlternarVisibilidad={onAlternarVisibilidad}
            onAlternarExpandido={onAlternarExpandido}
          />
        ))}
    </View>
  );
}

export default function Visor3D({ uri }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modoMedir, setModoMedir] = useState(false);
  const [puntosMedicion, setPuntosMedicion] = useState([]); // hasta 2 puntos THREE.Vector3
  const [distanciaMedida, setDistanciaMedida] = useState(null);
  const modoMedirRef = useRef(false); // espejo síncrono de modoMedir, legible dentro de los gestos
  const puntosMedicionRef = useRef([]); // espejo síncrono de puntosMedicion, legible dentro de los gestos
  const marcadorArrastradoRef = useRef(null); // índice (0 o 1) del marcador que se está arrastrando, o null

  // Árbol de piezas/componentes detectados en el modelo (para el panel de Mostrar/Ocultar,
  // ahora con sub-piezas anidadas: cada pieza trae su propio `hijos`) y el set de ids
  // actualmente OCULTOS (todo empieza visible, por eso el set arranca vacío).
  const [componentes, setComponentes] = useState([]); // [{ id, nombre, nodo, hijos }]
  const [ocultos, setOcultos] = useState(() => new Set());
  const [expandidos, setExpandidos] = useState(() => new Set()); // ids de piezas con sub-piezas desplegadas
  const [panelAbierto, setPanelAbierto] = useState(false);

  // Ocultar/mostrar una pieza afecta también a TODAS sus sub-piezas de golpe (confirmado con el
  // usuario: si ocultas "Cajon 1" completo, todo lo que tiene adentro se oculta junto, sin
  // importar si alguna sub-pieza estaba marcada visible individualmente antes).
  const alternarVisibilidadComponente = (pieza) => {
    const idsAfectados = idsDelArbol(pieza);
    setOcultos((anteriores) => {
      const nuevos = new Set(anteriores);
      const ocultarla = !nuevos.has(pieza.id); // si estaba visible, la vamos a ocultar (y viceversa)
      idsAfectados.forEach((id) => {
        if (ocultarla) nuevos.add(id);
        else nuevos.delete(id);
      });
      return nuevos;
    });
  };

  const alternarExpandido = (id) => {
    setExpandidos((anteriores) => {
      const nuevos = new Set(anteriores);
      if (nuevos.has(id)) nuevos.delete(id);
      else nuevos.add(id);
      return nuevos;
    });
  };

  const camaraRef = useRef(null);
  const escenaRef = useRef(null);
  const modeloRef = useRef(null);
  const luzCamaraRef = useRef(null);
  const marcadoresRef = useRef([]); // esferas rojas que marcan los puntos tocados
  const lineaMedicionRef = useRef(null); // línea azul entre los dos puntos, mientras haya 2
  // Segmentos de arista del modelo (en coordenadas de mundo) y el radio del imán, usados por
  // el snap de medición para "imanar" el punto tocado a la arista real más cercana.
  const segmentosAristaRef = useRef([]);
  const radioImanRef = useRef(0.05);
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
    // Geometría de radio 1: el tamaño real en pantalla lo controla ControladorCamara en cada
    // frame (esfera.scale), recalculado según la distancia a la cámara — así el punto se ve
    // igual de grande sin importar qué tan cerca o lejos esté el usuario del modelo.
    const geometria = new THREE.SphereGeometry(1, 12, 12);
    const material = new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false });
    const esfera = new THREE.Mesh(geometria, material);
    esfera.renderOrder = 2; // dibujar encima del modelo y de las líneas de contorno
    esfera.position.copy(punto);
    escena.add(esfera);
    marcadoresRef.current.push(esfera);
  };

  const limpiarMarcadores = () => {
    const escena = escenaRef.current;
    if (escena) {
      marcadoresRef.current.forEach((m) => escena.remove(m));
      if (lineaMedicionRef.current) {
        escena.remove(lineaMedicionRef.current);
        lineaMedicionRef.current = null;
      }
    }
    marcadoresRef.current = [];
  };

  // Dibuja (o actualiza) el rayo azul entre los dos puntos de medición, para que se vea
  // exactamente qué tramo del modelo se está midiendo — igual que pidió el usuario, como
  // referencia visual entre los dos puntos rojos.
  const dibujarLineaMedicion = (puntoA, puntoB) => {
    const escena = escenaRef.current;
    if (!escena) return;
    if (lineaMedicionRef.current) {
      escena.remove(lineaMedicionRef.current);
      lineaMedicionRef.current = null;
    }
    const geometria = new THREE.BufferGeometry().setFromPoints([puntoA, puntoB]);
    const material = new THREE.LineBasicMaterial({ color: 0x1e90ff, transparent: true, opacity: 0.9, depthTest: false });
    const linea = new THREE.Line(geometria, material);
    linea.renderOrder = 2; // igual que los marcadores: siempre visible, encima del modelo
    escena.add(linea);
    lineaMedicionRef.current = linea;
  };

  // El radio del imán guardado en radioImanRef es una fracción FIJA del tamaño del modelo (en
  // metros). Eso funcionaba bien con el zoom limitado de antes, pero ahora que el zoom es libre
  // (se puede acercar hasta casi tocar la superficie, o alejar mucho) ese mismo radio en metros
  // se ve gigante de lejos y casi invisible de cerca en términos de qué tan fácil es acertarle
  // con el dedo en la pantalla. Por eso el radio efectivo se calcula combinando el radio base
  // con la distancia real cámara→punto: de cerca, un radio pequeño en metros ya alcanza para
  // cubrir una zona cómoda en pantalla; de lejos, hace falta un radio más grande en metros para
  // esa misma comodidad en pantalla. El máximo entre ambos asegura que el imán nunca se sienta
  // "muerto" en ningún nivel de zoom.
  const radioImanEfectivo = (puntoDeSuperficie) => {
    const cam = camaraRef.current;
    const base = radioImanRef.current;
    if (!cam) return base;
    const distancia = cam.position.distanceTo(puntoDeSuperficie);
    // 4% de la distancia a la cámara, con el radio base como piso mínimo.
    return Math.max(base, distancia * 0.04);
  };

  const manejarToqueMedicion = (x, y) => {
    const puntoDeSuperficie = tocarModelo(x, y);
    if (!puntoDeSuperficie) return;

    // Imanta el punto tocado a la arista/vértice real más cercana del modelo, igual que hace
    // SketchUp — las mediciones reales se hacen de arista a arista, no en cualquier punto
    // arbitrario de una cara plana.
    const punto = buscarPuntoDeAristaMasCercano(puntoDeSuperficie, segmentosAristaRef.current, radioImanEfectivo(puntoDeSuperficie));

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
        dibujarLineaMedicion(nuevos[0], nuevos[1]);
      } else {
        setDistanciaMedida(null);
      }
      puntosMedicionRef.current = nuevos;
      return nuevos;
    });
  };

  // Convierte un toque de pantalla a coordenadas normalizadas y devuelve, además del punto 3D
  // tocado, la posición en pantalla (en puntos, no normalizada) — usado para saber a qué
  // distancia EN PANTALLA está el dedo de cada marcador ya puesto, y así decidir si el usuario
  // está intentando agarrar uno de ellos para arrastrarlo.
  const proyectarAPantalla = (punto3D) => {
    const cam = camaraRef.current;
    if (!cam) return null;
    const { width, height } = layoutRef.current;
    const proyectado = punto3D.clone().project(cam);
    return {
      x: ((proyectado.x + 1) / 2) * width,
      y: ((1 - proyectado.y) / 2) * height,
    };
  };

  // Busca si el toque (x, y en pantalla) cayó suficientemente cerca de alguno de los marcadores
  // ya colocados (índice 0 o 1), para permitir agarrarlo y arrastrarlo. Devuelve el índice del
  // marcador más cercano dentro del radio de agarre, o null si no hay ninguno cerca.
  const buscarMarcadorCercano = (x, y) => {
    const puntos = puntosMedicionRef.current;
    let mejorIndice = null;
    let mejorDistancia = 40; // radio de agarre en puntos de pantalla, generoso para el dedo
    puntos.forEach((punto, indice) => {
      const enPantalla = proyectarAPantalla(punto);
      if (!enPantalla) return;
      const distancia = Math.hypot(enPantalla.x - x, enPantalla.y - y);
      if (distancia < mejorDistancia) {
        mejorDistancia = distancia;
        mejorIndice = indice;
      }
    });
    return mejorIndice;
  };

  // Mueve el marcador ya colocado en `indice` a un nuevo punto (con snap magnético incluido),
  // actualizando la esfera roja, la línea azul y la distancia medida en tiempo real mientras el
  // usuario arrastra el dedo.
  const arrastrarMarcador = (indice, x, y) => {
    const puntoDeSuperficie = tocarModelo(x, y);
    if (!puntoDeSuperficie) return;
    const punto = buscarPuntoDeAristaMasCercano(puntoDeSuperficie, segmentosAristaRef.current, radioImanEfectivo(puntoDeSuperficie));

    const esfera = marcadoresRef.current[indice];
    if (esfera) esfera.position.copy(punto);

    const nuevos = [...puntosMedicionRef.current];
    nuevos[indice] = punto;
    puntosMedicionRef.current = nuevos;
    setPuntosMedicion(nuevos);

    if (nuevos.length === 2) {
      dibujarLineaMedicion(nuevos[0], nuevos[1]);
      setDistanciaMedida(nuevos[0].distanceTo(nuevos[1]));
    }
  };

  // IMPORTANTE — .runOnJS(true) en los 4 gestos de abajo:
  // Por defecto, react-native-gesture-handler 2.x + react-native-reanimated 4.x ejecutan los
  // callbacks de gestos (.onStart/.onUpdate/.onEnd) como "worklets": código que corre en un
  // hilo nativo aparte (el "UI runtime"), separado del hilo normal de JavaScript. Ese hilo
  // especial NO puede tocar objetos JS complejos como refs de React (camState.current,
  // inicioGestoRef.current) ni instancias de clases de Three.js (THREE.Vector3, con métodos
  // como .clone()) — solo puede recibir datos simples. Al intentarlo, revienta con
  // "[Worklets] Trying to access property `clone` of an object which cannot be sent to the UI
  // runtime" (visto en logs reales del dispositivo). .runOnJS(true) le dice al gesto: "no me
  // conviertas en worklet, ejecuta este callback en el hilo de JS de siempre" — que es donde
  // SÍ se puede tocar refs y objetos de Three.js sin problema, tal como estaba pensado este
  // componente desde el principio.

  // Toque simple: en modo medir, marca un punto (si no cayó sobre un marcador ya puesto — en ese
  // caso el gesto de arrastre, más abajo, se encarga).
  const gestoToque = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(250)
    .onEnd((evt, exitoso) => {
      if (!exitoso || !modoMedirRef.current) return;
      if (buscarMarcadorCercano(evt.x, evt.y) != null) return; // ya se movió con el arrastre
      manejarToqueMedicion(evt.x, evt.y);
    });

  // En modo medir: tocar y mantener sobre un punto rojo ya puesto, y arrastrarlo hasta otra
  // posición — con el mismo imán a aristas/vértices aplicándose en tiempo real mientras se
  // mueve el dedo, para poder corregir una medición sin tener que reiniciarla.
  const gestoArrastrarMarcador = Gesture.Pan()
    .runOnJS(true)
    .minPointers(1)
    .maxPointers(1)
    .onStart((evt) => {
      if (!modoMedirRef.current) {
        marcadorArrastradoRef.current = null;
        return;
      }
      marcadorArrastradoRef.current = buscarMarcadorCercano(evt.x, evt.y);
    })
    .onUpdate((evt) => {
      if (marcadorArrastradoRef.current == null) return;
      arrastrarMarcador(marcadorArrastradoRef.current, evt.x, evt.y);
    })
    .onEnd(() => {
      marcadorArrastradoRef.current = null;
    });

  // Un dedo: orbita la cámara alrededor del modelo. Dos dedos: mueve el centro de la cámara.
  // Si el dedo agarró un marcador (ver gestoArrastrarMarcador, que corre en simultáneo), no debe
  // orbitar también — se descarta el movimiento de cámara mientras se está arrastrando un punto.
  const gestoOrbitar = Gesture.Pan()
    .runOnJS(true)
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      inicioGestoRef.current = { ...camState.current, centro: camState.current.centro.clone() };
    })
    .onUpdate((evt) => {
      if (modoMedirRef.current) return; // en modo medir, un dedo solo marca/arrastra puntos, no orbita
      const inicio = inicioGestoRef.current;
      camState.current.azimut = inicio.azimut - evt.translationX * 0.008;
      camState.current.elevacion = inicio.elevacion + evt.translationY * 0.008;
    });

  const gestoMover = Gesture.Pan()
    .runOnJS(true)
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

      // La escala del desplazamiento se basaba en `radio` (la distancia orbital fija con la que
      // arrancó el modelo), pero desde que el zoom es libre tipo dron, acercarse mueve `centro`
      // -no `radio`-, así que `radio` se queda fijo en su valor inicial sin importar qué tan
      // cerca esté la cámara. Resultado: mover con 2 dedos siempre desplazaba la misma distancia
      // en metros, y de cerca esa distancia se siente gigante en pantalla (te saca del área que
      // querías ver). El fix: usar la distancia REAL cámara→centro (que sí cambia con el zoom
      // libre) para escalar el desplazamiento — de cerca, el mismo gesto mueve pocos centímetros;
      // de lejos, sigue moviendo a la velocidad de siempre.
      const distanciaCamaraCentro = cam.position.distanceTo(inicio.centro);
      const escala = distanciaCamaraCentro * 0.0015;
      const desplazamiento = new THREE.Vector3()
        .addScaledVector(derecha, -evt.translationX * escala)
        .addScaledVector(arribaCamara, evt.translationY * escala);

      camState.current.centro = inicio.centro.clone().add(desplazamiento);
    });

  // Zoom "libre" tipo SketchUp: en vez de acortar la distancia a un centro fijo (lo que antes
  // topaba contra un mínimo y no dejaba pasar de cierto punto), el pellizco ahora AVANZA la
  // cámara en línea recta, en la dirección exacta hacia la que está mirando — igual que volar
  // un dron hacia el modelo. Esto permite acercarse hasta la superficie de una pieza e incluso
  // atravesarla de lado a lado, sin ningún límite artificial de cercanía.
  //
  // Técnicamente: se mueve `centro` (el punto que la cámara mira) hacia adelante/atrás a lo
  // largo de la dirección de vista, manteniendo `radio` fijo — como la cámara siempre se coloca
  // a `radio` de distancia de `centro` mirando hacia él, mover `centro` hacia adelante logra el
  // mismo efecto que "la cámara avanza", sin tener que reescribir ControladorCamara.
  const gestoZoom = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      inicioGestoRef.current = { ...camState.current, centro: camState.current.centro.clone() };
      const cam = camaraRef.current;
      if (cam) {
        const direccion = new THREE.Vector3();
        cam.getWorldDirection(direccion);
        inicioGestoRef.current.direccionZoom = direccion;
      }
    })
    .onUpdate((evt) => {
      const inicio = inicioGestoRef.current;
      const direccion = inicio.direccionZoom;
      if (!direccion) return;

      // (evt.scale - 1) > 0 = dedos separándose = acercar (avanzar); < 0 = alejar (retroceder).
      // La distancia que avanza es proporcional al tamaño del modelo (radioIman ya viene
      // calculado como una fracción de la dimensión máxima del modelo, así que reutilizamos esa
      // escala para que el zoom se sienta igual de "rápido" en un mueble chico o uno grande).
      const escalaAvance = Math.max(radioImanRef.current * 20, 0.05);
      const avance = (evt.scale - 1) * escalaAvance * 3;

      camState.current.centro = inicio.centro.clone().addScaledVector(direccion, avance);
    });

  // Antes, gestoOrbitar (1 dedo) y el par gestoMover+gestoZoom (2 dedos) estaban en un mismo
  // Gesture.Race: como orbitar solo necesita 1 dedo, "arrancaba a correr" apenas tocaba el
  // primer dedo, y casi siempre ganaba la carrera antes de que el segundo dedo del pellizco
  // llegara a la pantalla — por eso había que poner los dos dedos casi perfectamente juntos y
  // despacio para que el zoom funcionara. La solución: decirle explícitamente a gestoOrbitar que
  // ESPERE a que el gesto de 2 dedos falle antes de activarse (.requireExternalGestureToFail),
  // en vez de competir por quién se activa primero. Así, en cuanto aparece un segundo dedo,
  // gesture-handler le da la oportunidad al pellizco/mover de tomar el control, y orbitar con 1
  // dedo solo gana cuando de verdad nunca aparece un segundo dedo.
  const gestoDosDedos = Gesture.Simultaneous(gestoMover, gestoZoom);
  const gestoOrbitarConEspera = gestoOrbitar.requireExternalGestureToFail(gestoDosDedos);
  const gestoUnDedo = Gesture.Race(gestoArrastrarMarcador, gestoOrbitarConEspera);

  const gestoCompuesto = Gesture.Simultaneous(gestoToque, gestoDosDedos, gestoUnDedo);

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

  // Aplica la visibilidad real en Three.js cada vez que el usuario oculta/muestra una pieza
  // desde el panel. No se quita del modelo (eso perdería la referencia), solo se marca
  // node.visible = false, que Three.js respeta al dibujar cada frame. Se recorre el árbol
  // COMPLETO aplanado (padres e hijos a cualquier profundidad), no solo el primer nivel, para
  // que las sub-piezas también respeten su propio estado oculto/visible.
  useEffect(() => {
    aplanarArbol(componentes).forEach(({ id, nodo }) => {
      nodo.visible = !ocultos.has(id);
    });
  }, [ocultos, componentes]);

  const mostrarTodo = () => setOcultos(new Set());

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(evt) => {
        const { width, height } = evt.nativeEvent.layout;
        layoutRef.current = { width, height };
      }}
    >
      {/* IMPORTANTE: el GestureDetector NO envuelve al <Canvas>, es HERMANO y se dibuja
          ENCIMA (después en el árbol = mayor z-order) mediante una View absoluta transparente.
          Motivo: @react-three/fiber/native SIEMPRE monta, dentro del <Canvas>, una View interna
          con su propio PanResponder clásico de React Native (reactNative.PanResponder.create),
          sin importar el prop `events` ni pointerEvents. React Native usa un "gesture responder
          system" único y global: en cuanto CUALQUIER view dentro del árbol que envuelve el
          GestureDetector se vuelve el "responder" (como hace ese PanResponder interno de fiber
          en cuanto detecta el primer toque), esa view se queda con el toque y el GestureDetector
          (que usa un sistema nativo distinto, gesture-handler) nunca llega a reconocer el gesto
          — esto es un problema documentado y conocido de usar GestureDetector como ANCESTRO de
          un <Canvas> de r3f (ver pmndrs/react-three-fiber#3332: "react-native gesture responders
          can't be nested"). Ya se probó desactivar esa View interna con pointerEvents="none" (no
          alcanza: pointerEvents="none" no saca a la view de la negociación del responder, solo
          evita que ESA view en particular reciba el toque directamente) y no funcionó en un build
          real. La solución robusta es que el GestureDetector tenga su PROPIA superficie táctil,
          sin ningún descendiente nativo que compita por el responder: una View vacía y
          transparente, posicionada encima del Canvas. Como está encima en el orden de dibujado,
          Android le entrega el toque a ELLA primero y el Canvas/GLView de abajo nunca llega a
          participar. */}
      <Canvas
        camera={{ fov: 55, near: 0.05, far: 1000 }}
        gl={{ antialias: true }}
        onCreated={() => setError('')}
        pointerEvents="none"
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
        {/* Reducida de 0.6 a 0.24 (-60%): de cerca, esta luz "pegaba" tan fuerte sobre la
            superficie que la saturaba de blanco y no dejaba ver el detalle de las uniones
            entre piezas. El decay/distance ayudan a que se atenúe de forma natural con la
            cercanía, en vez de mantener la misma fuerza sin importar qué tan cerca esté. */}
        <pointLight ref={luzCamaraRef} intensity={0.24} distance={20} decay={1.5} />

        <ControladorCamara camState={camState} camaraRef={camaraRef} luzCamaraRef={luzCamaraRef} marcadoresRef={marcadoresRef} />

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
              onComponentesDetectados={setComponentes}
              onAristasDetectadas={(segmentos, radioIman) => {
                segmentosAristaRef.current = segmentos;
                radioImanRef.current = radioIman;
              }}
            />
          </Suspense>
        </LimiteDeError>
      </Canvas>

      {/* Superficie táctil real: View vacía, absoluta, encima del Canvas, sin ningún hijo
          nativo propio (nada que pueda volverse "responder" y competir con gesture-handler).
          El GestureDetector se ancla A ESTA VIEW, no al Canvas. */}
      <GestureDetector gesture={gestoCompuesto}>
        <View style={StyleSheet.absoluteFill} collapsable={false} />
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
            {componentes.length > 1 && (
              <TouchableOpacity
                style={[styles.botonChico, panelAbierto && styles.botonChicoActivo]}
                onPress={() => setPanelAbierto((actual) => !actual)}
              >
                <Text style={[styles.botonChicoTexto, panelAbierto && styles.botonChicoTextoActivo]}>
                  🧩 Piezas{ocultos.size > 0 ? ` (${ocultos.size} oculta${ocultos.size > 1 ? 's' : ''})` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {panelAbierto && (
            <View style={styles.panelPiezas}>
              <View style={styles.panelPiezasCabecera}>
                <Text style={styles.panelPiezasTitulo}>Mostrar / ocultar piezas</Text>
                {ocultos.size > 0 && (
                  <TouchableOpacity onPress={mostrarTodo}>
                    <Text style={styles.panelPiezasMostrarTodo}>Mostrar todo</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.panelPiezasLista}>
                {componentes.map((pieza) => (
                  <FilaPieza
                    key={pieza.id}
                    pieza={pieza}
                    nivel={0}
                    ocultos={ocultos}
                    expandidos={expandidos}
                    onAlternarVisibilidad={alternarVisibilidadComponente}
                    onAlternarExpandido={alternarExpandido}
                  />
                ))}
              </ScrollView>
            </View>
          )}

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
                {distanciaMedida != null
                  ? 'Puedes arrastrar cualquiera de los dos puntos rojos para ajustarlos.'
                  : 'Medición aproximada, depende de la escala real del archivo exportado.'}
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
  panelPiezas: {
    position: 'absolute',
    top: 56,
    right: 10,
    left: 10,
    maxHeight: 260,
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 10,
    padding: 10,
  },
  panelPiezasCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  panelPiezasTitulo: { color: '#fff', fontSize: 13, fontWeight: '700' },
  panelPiezasMostrarTodo: { color: '#1E90FF', fontSize: 12, fontWeight: '600' },
  panelPiezasLista: { maxHeight: 220 },
  panelPiezaFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  panelPiezaNombre: { color: '#fff', fontSize: 13, flex: 1, marginRight: 10 },
  panelPiezaFlecha: { width: 22, alignItems: 'center', justifyContent: 'center' },
  panelPiezaFlechaTexto: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
});
