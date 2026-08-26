import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/apiClient';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../firebaseConfig';
import EncabezadoLogo from '../components/EncabezadoLogo';
import ImagenZoom from '../components/ImagenZoom';
import Visor3D from '../components/Visor3D';
import { gerenciaRequiereContactoPrevio, pestanasAreaProyecto, permisosDe } from '../utils/roles';
import { obtenerMensajesSinLeer, personaTieneSinLeer, actualizarBadge } from '../utils/mensajesSinLeer';

// Fecha + hora en la hora local del celular (no UTC), para que "8:32 PM" coincida con el reloj
// real del usuario. Se usa como pie de página en fotos de avance, planos 3D y mensajes de chat.
const formatearFechaHora = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = String(d.getFullYear()).slice(-2);
  let horas = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const sufijo = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12;
  if (horas === 0) horas = 12;
  return `${dia}-${mes}-${anio} ${horas}:${minutos} ${sufijo}`;
};

// Burbuja de nota de voz dentro del chat: botón play/pausa + tiempo transcurrido, estilo
// WhatsApp. Cada nota tiene su propio reproductor (useAudioPlayer), por eso es un componente
// separado en vez de manejarlo dentro del renderItem de la lista de mensajes.
function BurbujaAudio({ uri }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const alternarReproduccion = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.currentTime >= status.duration && status.duration > 0) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const formatearTiempo = (segundos) => {
    const s = Math.max(0, Math.floor(segundos || 0));
    const min = Math.floor(s / 60);
    const seg = String(s % 60).padStart(2, '0');
    return `${min}:${seg}`;
  };

  return (
    <TouchableOpacity style={styles.notaVozContainer} onPress={alternarReproduccion}>
      <Text style={styles.notaVozBoton}>{status.playing ? '⏸️' : '▶️'}</Text>
      <View style={styles.notaVozBarra}>
        <View
          style={[
            styles.notaVozBarraProgreso,
            { width: status.duration > 0 ? `${Math.min(100, (status.currentTime / status.duration) * 100)}%` : '0%' },
          ]}
        />
      </View>
      <Text style={styles.notaVozTiempo}>
        {formatearTiempo(status.playing || status.currentTime > 0 ? status.currentTime : status.duration)}
      </Text>
    </TouchableOpacity>
  );
}

export default function AreaProyectoScreen({ route }) {
  const { empresa, proyecto, area, usuario } = route.params;
  const insets = useSafeAreaInsets();

  const permisos = permisosDe(empresa);
  const pestanasVisibles = pestanasAreaProyecto(empresa); // ['equipo', 'fotos', 'planos3d'] o subconjunto
  // tabInicial: viene de index.tsx cuando se restaura la posición del usuario tras un reinicio
  // de la app (ver "ultimaPantalla" en index.tsx). Si no viene, se usa la primera pestaña visible
  // como siempre.
  const [tab, setTab] = useState(
    route.params.tabInicial && pestanasVisibles.includes(route.params.tabInicial)
      ? route.params.tabInicial
      : pestanasVisibles[0]
  ); // 'equipo' | 'fotos' | 'planos3d' | 'contrato'

  // Guardamos en qué pantalla y pestaña está el usuario ahora mismo. Si Android mata la app por
  // falta de memoria (por ejemplo mientras la cámara está abierta) y luego la revive, toda la
  // navegación en memoria se pierde y normalmente el usuario aterrizaría de nuevo en "Seleccionar
  // Empresa". Con este dato guardado, revisarSesion() en index.tsx puede detectar que venía de
  // aquí y devolverlo directo a esta misma área Y pestaña (ej. Fotos), en vez de preguntarle la
  // empresa otra vez o dejarlo en la pestaña por defecto (Equipo). Depende de `tab` para
  // actualizarse cada vez que el usuario cambia de pestaña, no solo al entrar a la pantalla.
  // Se guarda con un timestamp para no aplicar esto si el usuario cerró la app hace horas y la
  // abre de nuevo normalmente (en ese caso sí queremos el flujo normal).
  useEffect(() => {
    AsyncStorage.setItem(
      'ultimaPantalla',
      JSON.stringify({ pantalla: 'AreaProyecto', empresa, proyecto, area, usuario, tab, ts: Date.now() })
    ).catch(() => {});
  }, [tab]);
  const [equipo, setEquipo] = useState([]);
  const [contrato, setContrato] = useState(null);
  const [cargandoContrato, setCargandoContrato] = useState(false);
  // "cargando" solo controla el spinner de pantalla completa la PRIMERA vez que se entra a esta
  // pantalla. "cargandoEquipo" es el loading local de la pestaña Equipo, usado en los refrescos
  // posteriores (useFocusEffect) — antes ambos eran el mismo flag, así que cada vez que la
  // pantalla recibía foco (por ejemplo al volver de la cámara al subir una foto) toda la UI
  // desaparecía de golpe detrás de un spinner, incluido el chat si estaba abierto.
  const [cargando, setCargando] = useState(true);
  const [cargandoEquipo, setCargandoEquipo] = useState(false);
  const [modalAsignarVisible, setModalAsignarVisible] = useState(false);
  const [personalDisponible, setPersonalDisponible] = useState([]);

  // Menú (Pausar asignación / Eliminar chat / Eliminar) que aparece al mantener presionada una
  // persona del equipo — mismo patrón que ya se usa en Fotos, Planos 3D y Estadísticas.
  const [menuPersona, setMenuPersona] = useState(null); // la persona (item de `equipo`) sobre la que se hizo long-press

  const [chatAbierto, setChatAbierto] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargandoChat, setCargandoChat] = useState(false);
  // Mensajes sin leer del usuario en toda la app — aquí se usa para marcar con 💬 cada persona
  // del roster que tenga mensajes pendientes en ESTA área/proyecto (ver personaTieneSinLeer).
  // Se recarga al entrar y también al abrir un chat (para que el ícono desaparezca de inmediato,
  // ya que abrir el chat marca esos mensajes como leídos en el backend).
  const [sinLeer, setSinLeer] = useState([]);

  const cargarSinLeer = () => {
    if (!usuario?.id) return;
    obtenerMensajesSinLeer(usuario.id).then(setSinLeer);
    actualizarBadge(usuario.id);
  };

  useEffect(() => {
    cargarSinLeer();
  }, [usuario?.id]);

  // Nota de voz: se graba manteniendo presionado el botón del micrófono, estilo WhatsApp.
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder); // mantiene el hook activo para que el recorder se actualice
  const [grabandoNota, setGrabandoNota] = useState(false);
  const inicioGrabacionRef = useRef(null);

  const [fotos, setFotos] = useState([]);
  const [cargandoFotos, setCargandoFotos] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  // Menú al mantener presionada una miniatura en la cuadrícula de fotos de avance (reemplaza
  // el botón "Eliminar" que antes vivía dentro de la vista ampliada).
  const [menuFoto, setMenuFoto] = useState(null);
  const cerrarMenuFoto = () => setMenuFoto(null);

  // Menú al mantener presionado un mensaje propio en el chat (solo se puede eliminar lo que
  // uno mismo envió — el backend también valida esto, así que aunque alguien manipulara la
  // app no podría borrar mensajes ajenos).
  const [menuMensaje, setMenuMensaje] = useState(null);
  const cerrarMenuMensaje = () => setMenuMensaje(null);
  const eliminarMensaje = async (mensaje) => {
    try {
      await api.delete(`/mensajes/${mensaje.id}`, {
        data: { usuario_id: usuario.id },
      });
      setMensajes((anteriores) => anteriores.filter((m) => m.id !== mensaje.id));
    } catch (error) {
      // Mostramos el motivo real que devuelve el servidor (ej. "Solo quien envió el mensaje
      // puede eliminarlo") en vez de un texto genérico, para poder diagnosticar el bug reportado
      // sin adivinar — antes solo se veía "No se pudo eliminar el mensaje" sin más contexto.
      const detalle = error.response?.data?.error || error.message || 'Error desconocido';
      console.error('Error eliminando mensaje:', error.response?.status, detalle);
      Alert.alert('Error', `No se pudo eliminar el mensaje.\n\n${detalle}`);
    }
  };

  const [planos3d, setPlanos3d] = useState([]);
  const [cargandoPlanos3d, setCargandoPlanos3d] = useState(false);
  const [subiendoPlano3d, setSubiendoPlano3d] = useState(false);
  const [plano3dAbierto, setPlano3dAbierto] = useState(null);
  // Menú de opciones al mantener presionado un plano 3D en la lista (reemplaza el botón
  // "Eliminar" que antes vivía dentro del visor — ahora se elimina desde la lista, sin
  // necesidad de entrar al modelo primero).
  const [menuPlano3d, setMenuPlano3d] = useState(null);
  const cerrarMenuPlano3d = () => setMenuPlano3d(null);

  // Primera carga: usa el spinner de pantalla completa (cargando=true), igual que antes.
  const primeraCargaHecha = useRef(false);
  useEffect(() => {
    cargarEquipo(true);
    primeraCargaHecha.current = true;
  }, []);

  // useFocusEffect (no un simple useEffect) para que el equipo se vuelva a pedir cada vez que
  // esta pantalla recibe foco, no solo la primera vez que se monta. Sin esto, si un gerente entra
  // aquí, sale a otra pantalla sin que el componente se desmonte, y luego vuelve (por ejemplo tras
  // aceptar una invitación pendiente desde otra sesión), seguía viendo el estado "pendiente" viejo
  // en memoria aunque el backend ya lo hubiera actualizado a "vinculado". Usa el loading LOCAL
  // (no el spinner de pantalla completa) para no botar de golpe toda la UI —incluido el chat si
  // estaba abierto— cada vez que la pantalla recibe foco (por ejemplo al volver de la cámara).
  useFocusEffect(
    useCallback(() => {
      if (primeraCargaHecha.current) cargarEquipo(false);
    }, [])
  );

  useEffect(() => {
    if (tab === 'fotos') {
      cargarFotos();
    } else if (tab === 'planos3d') {
      cargarPlanos3d();
    } else if (tab === 'contrato') {
      cargarContrato();
    }
  }, [tab]);

  const cargarContrato = async () => {
    setCargandoContrato(true);
    setContrato(null);
    try {
      const res = await api.get(`/cotizaciones/contratos/por-proyecto/${proyecto.id}`);
      setContrato(res.data.contrato);
    } catch (error) {
      // 404 = todavía no hay contrato asociado a este proyecto; no es un error real.
      setContrato(null);
    } finally {
      setCargandoContrato(false);
    }
  };

  const cargarFotos = async () => {
    setCargandoFotos(true);
    try {
      const res = await api.get(`/fotos-avance/${proyecto.id}/${area.id}`);
      setFotos(res.data.fotos);
    } catch (error) {
      console.error('Error cargando fotos de avance:', error);
      Alert.alert('Error', 'No se pudieron cargar las fotos de avance.');
    } finally {
      setCargandoFotos(false);
    }
  };

  const subirFotoAFirebase = async (uri) => {
    const respuesta = await fetch(uri);
    const blob = await respuesta.blob();
    const nombreArchivo = `avance/${proyecto.id}_${area.id}_${Date.now()}.jpg`;
    const storageRef = ref(storage, nombreArchivo);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const elegirYSubirFoto = async (desdeCamara) => {
    const permiso = desdeCamara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      Alert.alert('Permiso necesario', desdeCamara ? 'Necesitamos acceso a la cámara.' : 'Necesitamos acceso a tus fotos.');
      return;
    }

    // Envolvemos la apertura de la cámara/galería en su propio try/catch: si launchCameraAsync
    // lanza una excepción (por ejemplo, poco almacenamiento o un problema nativo al escribir la
    // foto temporal), antes esa excepción no se capturaba en ningún lado y podía tumbar toda la
    // pantalla, lo cual en Android puede forzar un reinicio de la app (y de ahí el salto
    // inesperado a la pantalla de Seleccionar Empresa). Mismo fix ya aplicado en adjuntarImagen.
    let resultado;
    try {
      resultado = desdeCamara
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
    } catch (error) {
      console.error('Error abriendo cámara/galería:', error.message, error.stack);
      Alert.alert('Error', 'No se pudo abrir la cámara. Intenta de nuevo.');
      return;
    }

    if (resultado.canceled) return;

    setSubiendoFoto(true);
    try {
      const url = await subirFotoAFirebase(resultado.assets[0].uri);
      await api.post('/fotos-avance/subir', {
        proyecto_id: proyecto.id,
        area_id: area.id,
        usuario_id: usuario.id,
        foto_url: url,
      });
      cargarFotos();
    } catch (error) {
      console.error('Error subiendo foto de avance:', error);
      Alert.alert('Error', 'No se pudo subir la foto.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const elegirOrigenFoto = () => {
    Alert.alert('Agregar foto de avance', '¿De dónde quieres tomar la foto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cámara', onPress: () => elegirYSubirFoto(true) },
      { text: 'Galería', onPress: () => elegirYSubirFoto(false) },
    ]);
  };

  const [guardandoFoto, setGuardandoFoto] = useState(false);

  const descargarFoto = async (foto) => {
    setGuardandoFoto(true);
    try {
      const permiso = await MediaLibrary.requestPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para poder guardarla.');
        return;
      }
      const nombreArchivo = `avance_${Date.now()}.jpg`;
      const rutaLocal = `${FileSystem.cacheDirectory}${nombreArchivo}`;
      const { uri } = await FileSystem.downloadAsync(foto.foto_url, rutaLocal);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('¡Listo!', 'La foto se guardó en la galería de tu celular.');
    } catch (error) {
      console.error('Error descargando foto:', error);
      Alert.alert('Error', `No se pudo guardar la foto.\n${error?.message || error}`);
    } finally {
      setGuardandoFoto(false);
    }
  };

  const compartirFoto = async (foto) => {
    setGuardandoFoto(true);
    try {
      const disponible = await Sharing.isAvailableAsync();
      if (!disponible) {
        Alert.alert('No disponible', 'Compartir no está disponible en este dispositivo.');
        return;
      }
      const nombreArchivo = `avance_${Date.now()}.jpg`;
      const rutaLocal = `${FileSystem.cacheDirectory}${nombreArchivo}`;
      const { uri } = await FileSystem.downloadAsync(foto.foto_url, rutaLocal);
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error('Error compartiendo foto:', error);
      Alert.alert('Error', `No se pudo compartir la foto.\n${error?.message || error}`);
    } finally {
      setGuardandoFoto(false);
    }
  };

  const confirmarEliminarFoto = (foto) => {
    Alert.alert('Eliminar foto', '¿Eliminar esta foto de avance?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/fotos-avance/${foto.id}`);
            setFotoAmpliada(null);
            cargarFotos();
          } catch (error) {
            console.error('Error eliminando foto:', error);
            Alert.alert('Error', 'No se pudo eliminar la foto.');
          }
        },
      },
    ]);
  };

  const cargarPlanos3d = async () => {
    setCargandoPlanos3d(true);
    try {
      const res = await api.get(`/planos-3d/${proyecto.id}/${area.id}`);
      setPlanos3d(res.data.planos);
    } catch (error) {
      console.error('Error cargando planos 3D:', error);
      Alert.alert('Error', 'No se pudieron cargar los planos 3D.');
    } finally {
      setCargandoPlanos3d(false);
    }
  };

  const subirPlano3dAFirebase = async (uri, nombreOriginal) => {
    const respuesta = await fetch(uri);
    const blob = await respuesta.blob();
    const nombreArchivo = `planos3d/${proyecto.id}_${area.id}_${Date.now()}_${nombreOriginal || 'plano.glb'}`;
    const storageRef = ref(storage, nombreArchivo);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const elegirYSubirPlano3d = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: ['model/gltf-binary', 'application/octet-stream', '*/*'],
      copyToCacheDirectory: true,
    });
    if (resultado.canceled) return;

    const archivo = resultado.assets[0];
    if (!archivo.name?.toLowerCase().endsWith('.glb')) {
      Alert.alert('Formato no válido', 'Solo se pueden subir archivos .glb (exportados desde SketchUp como "Archivo binario glTF").');
      return;
    }

    setSubiendoPlano3d(true);
    try {
      const url = await subirPlano3dAFirebase(archivo.uri, archivo.name);
      await api.post('/planos-3d/subir', {
        proyecto_id: proyecto.id,
        area_id: area.id,
        usuario_id: usuario.id,
        nombre: archivo.name,
        url_glb: url,
      });
      cargarPlanos3d();
    } catch (error) {
      console.error('Error subiendo plano 3D:', error);
      const mensaje = error.response?.data?.error || 'No se pudo subir el plano 3D.';
      Alert.alert('Error', mensaje);
    } finally {
      setSubiendoPlano3d(false);
    }
  };

  const confirmarEliminarPlano3d = (plano) => {
    Alert.alert('Eliminar plano 3D', `¿Eliminar "${plano.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/planos-3d/${plano.id}`, {
              data: { usuario_id: usuario.id },
            });
            setPlano3dAbierto(null);
            cargarPlanos3d();
          } catch (error) {
            console.error('Error eliminando plano 3D:', error);
            const mensaje = error.response?.data?.error || 'No se pudo eliminar el plano 3D.';
            Alert.alert('Error', mensaje);
          }
        },
      },
    ]);
  };

  // primeraCarga=true solo en el montaje inicial (usa el spinner de pantalla completa);
  // en cualquier otro refresco (useFocusEffect) usa el loading local "cargandoEquipo", que no
  // bloquea el resto de la pantalla (chat abierto, scroll de otras pestañas, etc.).
  const cargarEquipo = async (primeraCarga = false) => {
    if (primeraCarga) setCargando(true);
    else setCargandoEquipo(true);
    try {
      // "solicitante_id" le permite al backend calcular, solo para filas de GERENCIA,
      // si ESE gerente ya le escribió antes al usuario logueado (campo "le_ha_escrito" —
      // ver GET /:id/equipo en proyectos_v2.js). Se usa más abajo para exigir que gerencia
      // hable primero antes de aparecer como contacto disponible para oficio/Proveedores/Clientes.
      const resEquipo = await api.get(
        `/proyectos/${proyecto.id}/equipo`,
        { params: { solicitante_id: usuario.id } }
      );
      // Rediseño 2026-08-24: cada ficha de área muestra EXCLUSIVAMENTE a quien está asignado a
      // esa área exacta — ya no se "arrastra" gente de otras áreas dentro de una ficha distinta
      // (antes, por ejemplo, un Administrativo podía ver a otro Administrativo colado dentro de
      // la ficha de Logística/Carpintería sin haberlo asignado ahí; ver utils/roles.js para el
      // control de a qué fichas se puede ENTRAR, que es un control aparte de este filtro).
      let personasVisibles = resEquipo.data.equipo.filter((p) => p.area_id === area.id);
      // Caso especial: dentro de la ficha GERENCIA, para quien no sea Gerencia/Administrativa/
      // Logística, solo se muestra al gerente en particular que YA le escribió primero
      // (le_ha_escrito === true, calculado por el backend) — nunca a todos los gerentes por
      // defecto. Esta ficha ni siquiera debería ser accesible hasta que esto sea cierto (ver
      // tieneAccesoAFicha en roles.js, aplicado en DetalleProyectoScreen), este filtro es una
      // segunda defensa por si se llega a este punto de otra forma.
      if (area.nombre === 'GERENCIA' && gerenciaRequiereContactoPrevio(empresa)) {
        personasVisibles = personasVisibles.filter((p) => p.le_ha_escrito === true);
      }
      // Nunca mostrar al propio usuario logueado como fila de su propio roster: antes esto
      // permitía tocar "tu propia foto" y abrir un chat contigo mismo (que traía por casualidad
      // los mensajes correctos del otro participante, pero con tu propio nombre mal puesto en
      // el título — bug reportado). Cada fila del roster debe ser SIEMPRE otra persona real.
      personasVisibles = personasVisibles.filter((p) => p.usuario_id !== usuario.id);
      setEquipo(personasVisibles);
    } catch (error) {
      console.error('Error cargando equipo:', error);
    } finally {
      if (primeraCarga) setCargando(false);
      else setCargandoEquipo(false);
    }
  };

  const abrirMenuPersona = (persona) => setMenuPersona(persona);
  const cerrarMenuPersona = () => setMenuPersona(null);

  // Pausa (o reanuda, si ya estaba pausada) el acceso de esta persona a este proyecto. Mientras
  // está pausada, deja de ver este proyecto en su lista — es un bloqueo real de acceso, no solo
  // visual (ver PUT /equipo/:id/pausar en el backend).
  const alternarPausaPersona = async (persona) => {
    try {
      const res = await api.put(
        `/proyectos/equipo/${persona.asignacion_id}/pausar`
      );
      Alert.alert(res.data.asignacion.pausado ? 'Asignación pausada' : 'Asignación reanudada');
      cargarEquipo();
    } catch (error) {
      console.error('Error pausando/reanudando asignación:', error);
      Alert.alert('Error', 'No se pudo cambiar el estado de la asignación.');
    }
  };

  // Vacía por completo el chat con esta persona en esta área/proyecto (mensajes y archivos
  // adjuntos), sin quitarla del proyecto.
  const eliminarChatPersona = (persona) => {
    Alert.alert(
      'Eliminar chat',
      `¿Vaciar completamente el chat con ${persona.nombre}? Se eliminarán todos los mensajes y archivos. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar chat',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(
                `/mensajes/vaciar/${proyecto.id}/${persona.usuario_id}/${usuario.id}`
              );
              Alert.alert('Listo', 'El chat fue eliminado.');
            } catch (error) {
              console.error('Error eliminando chat:', error);
              Alert.alert('Error', 'No se pudo eliminar el chat.');
            }
          },
        },
      ]
    );
  };

  // Elimina a la persona del proyecto por completo (pierde acceso) y, junto con eso, vacía el
  // chat que tuvieron en esta área — confirmado con el usuario que ambas cosas van juntas.
  const eliminarPersonaDelProyecto = (persona) => {
    Alert.alert(
      'Eliminar del proyecto',
      `¿Eliminar a ${persona.nombre} de este proyecto? Perderá el acceso y se borrará también el chat que tuvieron. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(
                `/proyectos/equipo/${persona.asignacion_id}`,
                { data: { usuario_solicitante_id: usuario.id } }
              );
              cargarEquipo();
            } catch (error) {
              console.error('Error eliminando persona del proyecto:', error);
              Alert.alert('Error', 'No se pudo eliminar a la persona del proyecto.');
            }
          },
        },
      ]
    );
  };

  const abrirAsignar = async () => {
    try {
      const response = await api.get(`/areas/personal/${empresa.id}`);
      // Se puede asignar tanto personal ya VINCULADO (usuario_id real) como personal PENDIENTE
      // (invitado pero que aún no acepta el link, identificado por rol_id = id de la invitación).
      // Así gerencia puede dejar armado el equipo del proyecto desde ya, sin esperar a que la
      // persona acepte; cuando acepte, el backend migra su asignación automáticamente.
      const delArea = response.data.personal.filter((p) => p.area_id === area.id);
      setPersonalDisponible(delArea);
      setModalAsignarVisible(true);
    } catch (error) {
      console.error('Error cargando personal:', error);
      Alert.alert('Error', 'No se pudo cargar el personal disponible.');
    }
  };

  const asignarPersona = async (persona) => {
    try {
      await api.post(`/proyectos/${proyecto.id}/equipo/asignar`, {
        usuario_id: persona.usuario_id || null,
        // Para personal pendiente, rol_id devuelto por /areas/personal es el id de la invitación.
        invitacion_id: persona.usuario_id ? null : persona.rol_id,
        area_id: area.id,
      });
      Alert.alert('¡Listo!', 'Persona asignada al proyecto.');
      setModalAsignarVisible(false);
      cargarEquipo();
    } catch (error) {
      console.error('Error asignando:', error);
      Alert.alert('Error', 'No se pudo asignar a esta persona.');
    }
  };

  const abrirChat = async (persona) => {
    setChatAbierto({ usuario_id: persona.usuario_id, nombre: persona.nombre });
    setCargandoChat(true);
    try {
      const resMensajes = await api.get(
        `/mensajes/${proyecto.id}/${persona.usuario_id}?mi_usuario_id=${usuario.id}`
      );
      setMensajes(resMensajes.data.mensajes);
      // Abrir el chat marca esos mensajes como leídos en el backend (ver GET en mensajes.js) —
      // recargamos sinLeer/badge para que el ícono 💬 de esta persona desaparezca de inmediato.
      cargarSinLeer();
    } catch (error) {
      console.error('Error cargando chat:', error);
      Alert.alert('Error', 'No se pudo cargar la conversación.');
    } finally {
      setCargandoChat(false);
    }
  };

  const cerrarChat = () => {
    setChatAbierto(null);
    setMensajes([]);
    setNuevoMensaje('');
  };

  const enviarMensaje = async (archivo) => {
    if (!chatAbierto) return;
    if (!nuevoMensaje.trim() && !archivo) return;
    setEnviando(true);
    try {
      await api.post('/mensajes/enviar', {
        proyecto_id: proyecto.id,
        usuario_id: usuario.id,
        destinatario_usuario_id: chatAbierto.usuario_id,
        contenido: nuevoMensaje,
        archivo: archivo || undefined,
      });
      setNuevoMensaje('');
      const resMensajes = await api.get(
        `/mensajes/${proyecto.id}/${chatAbierto.usuario_id}?mi_usuario_id=${usuario.id}`
      );
      setMensajes(resMensajes.data.mensajes);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  // Adjuntar archivo al chat, estilo WhatsApp: tomar foto con la cámara, elegir de la galería
  // o elegir un documento, subirlo a Firebase Storage y enviarlo como mensaje (con o sin texto
  // acompañante).
  const elegirYAdjuntarArchivo = async () => {
    Alert.alert('Adjuntar', '¿Qué quieres enviar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: '📷 Cámara', onPress: () => adjuntarImagen(true) },
      { text: '🖼️ Galería', onPress: () => adjuntarImagen(false) },
      { text: '📎 Documento', onPress: adjuntarDocumento },
    ]);
  };

  const subirArchivoChatAFirebase = async (uri, nombreArchivo, contentType) => {
    const respuesta = await fetch(uri);
    const blob = await respuesta.blob();
    const rutaDestino = `chat/${proyecto.id}_${area.id}_${Date.now()}_${nombreArchivo}`;
    const storageRef = ref(storage, rutaDestino);
    await uploadBytes(storageRef, blob, contentType ? { contentType } : undefined);
    return await getDownloadURL(storageRef);
  };

  const adjuntarImagen = async (desdeCamara) => {
    const permiso = desdeCamara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', desdeCamara ? 'Necesitamos acceso a la cámara.' : 'Necesitamos acceso a tus fotos para adjuntar una imagen.');
      return;
    }

    // Envolvemos también la apertura de la cámara/galería en su propio try/catch: si
    // launchCameraAsync lanza una excepción (por ejemplo, poco almacenamiento o un problema
    // nativo al escribir la foto temporal), antes esa excepción no se capturaba en ningún lado
    // y podía tumbar toda la pantalla, lo cual en Android puede forzar un reinicio de la app
    // (y de ahí el salto inesperado a la pantalla de Seleccionar Empresa).
    let resultado;
    try {
      resultado = desdeCamara
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    } catch (error) {
      console.error('Error abriendo cámara/galería:', error.message, error.stack);
      Alert.alert('Error', 'No se pudo abrir la cámara. Intenta de nuevo.');
      return;
    }
    if (resultado.canceled) return;

    setEnviando(true);
    try {
      const asset = resultado.assets[0];
      const nombreArchivo = asset.fileName || `foto_${Date.now()}.jpg`;
      const url = await subirArchivoChatAFirebase(asset.uri, nombreArchivo, 'image/jpeg');
      await enviarMensaje({ nombre_archivo: nombreArchivo, url_archivo: url, tipo_archivo: 'imagen' });
    } catch (error) {
      console.error('Error adjuntando imagen:', error.message, error.stack);
      Alert.alert('Error', 'No se pudo enviar la imagen.');
    } finally {
      setEnviando(false);
    }
  };

  const adjuntarDocumento = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (resultado.canceled) return;

    setEnviando(true);
    try {
      const asset = resultado.assets[0];
      const url = await subirArchivoChatAFirebase(asset.uri, asset.name, asset.mimeType);
      await enviarMensaje({ nombre_archivo: asset.name, url_archivo: url, tipo_archivo: 'documento' });
    } catch (error) {
      console.error('Error adjuntando documento:', error);
      Alert.alert('Error', 'No se pudo enviar el documento.');
    } finally {
      setEnviando(false);
    }
  };

  // Nota de voz: se mantiene presionado el botón del micrófono para grabar (como WhatsApp).
  // Al soltar, se detiene la grabación y se envía automáticamente; si se graba menos de medio
  // segundo (toque accidental), se descarta sin enviar nada.
  const iniciarGrabacionNota = async () => {
    try {
      const permiso = await AudioModule.requestRecordingPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso necesario', 'Necesitamos acceso al micrófono para grabar una nota de voz.');
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      inicioGrabacionRef.current = Date.now();
      setGrabandoNota(true);
    } catch (error) {
      console.error('Error iniciando grabación:', error);
      Alert.alert('Error', 'No se pudo iniciar la grabación.');
      setGrabandoNota(false);
      inicioGrabacionRef.current = null;
    }
  };

  const detenerYEnviarNota = async () => {
    if (!grabandoNota) return;
    setGrabandoNota(false);
    try {
      // Medimos la duración nosotros mismos con un timestamp (en vez de depender del estado
      // del hook useAudioRecorderState, que puede no haberse actualizado todavía en el mismo
      // tick en que se suelta el botón) para decidir de forma confiable si fue un toque
      // accidental (menos de medio segundo) y descartarlo sin enviar nada.
      const duracionMs = inicioGrabacionRef.current ? Date.now() - inicioGrabacionRef.current : 0;
      inicioGrabacionRef.current = null;
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri || duracionMs < 500) {
        // Grabación demasiado corta (toque accidental): se descarta sin enviar.
        return;
      }

      setEnviando(true);
      const nombreArchivo = `nota_voz_${Date.now()}.m4a`;
      const url = await subirArchivoChatAFirebase(uri, nombreArchivo, 'audio/m4a');
      await enviarMensaje({ nombre_archivo: nombreArchivo, url_archivo: url, tipo_archivo: 'audio' });
    } catch (error) {
      console.error('Error enviando nota de voz:', error);
      Alert.alert('Error', 'No se pudo enviar la nota de voz.');
    } finally {
      setEnviando(false);
    }
  };

  const cancelarGrabacionNota = async () => {
    if (!grabandoNota) return;
    setGrabandoNota(false);
    inicioGrabacionRef.current = null;
    try {
      await audioRecorder.stop();
    } catch (error) {
      console.error('Error cancelando grabación:', error);
    }
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: empresa.color_hex || '#1E90FF' }]}>
      <EncabezadoLogo empresa={empresa} />

      <View style={styles.tabsContainer}>
        {pestanasVisibles.includes('equipo') && (
          <TouchableOpacity style={[styles.tabBoton, tab === 'equipo' && styles.tabBotonActivo]} onPress={() => setTab('equipo')}>
            <Text style={[styles.tabBotonTexto, tab === 'equipo' && styles.tabBotonTextoActivo]}>Equipo</Text>
          </TouchableOpacity>
        )}
        {pestanasVisibles.includes('fotos') && (
          <TouchableOpacity style={[styles.tabBoton, tab === 'fotos' && styles.tabBotonActivo]} onPress={() => setTab('fotos')}>
            <Text style={[styles.tabBotonTexto, tab === 'fotos' && styles.tabBotonTextoActivo]}>Fotos</Text>
          </TouchableOpacity>
        )}
        {pestanasVisibles.includes('planos3d') && (
          <TouchableOpacity style={[styles.tabBoton, tab === 'planos3d' && styles.tabBotonActivo]} onPress={() => setTab('planos3d')}>
            <Text style={[styles.tabBotonTexto, tab === 'planos3d' && styles.tabBotonTextoActivo]}>Planos 3D</Text>
          </TouchableOpacity>
        )}
        {pestanasVisibles.includes('contrato') && (
          <TouchableOpacity style={[styles.tabBoton, tab === 'contrato' && styles.tabBotonActivo]} onPress={() => setTab('contrato')}>
            <Text style={[styles.tabBotonTexto, tab === 'contrato' && styles.tabBotonTextoActivo]}>Contrato</Text>
          </TouchableOpacity>
        )}
      </View>

      {tab === 'equipo' ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Personas en {area.nombre}</Text>
            {permisos.asignarPersonal && (
              <TouchableOpacity style={styles.botonAsignar} onPress={abrirAsignar}>
                <Text style={styles.botonAsignarTexto}>ASIGNAR</Text>
              </TouchableOpacity>
            )}
          </View>

          {equipo.length === 0 ? (
            <Text style={styles.vacioTexto}>Nadie asignado todavía en esta área. Toca "Asignar" para agregar personas.</Text>
          ) : (
            <FlatList
              data={equipo}
              keyExtractor={(item) => item.asignacion_id.toString()}
              contentContainerStyle={styles.lista}
              renderItem={({ item }) => {
                const esPendiente = item.estado === 'pendiente';
                return (
                  <TouchableOpacity
                    style={styles.personaCard}
                    onPress={() => !esPendiente && !item.pausado && abrirChat(item)}
                    onLongPress={() => permisos.asignarPersonal && abrirMenuPersona(item)}
                    delayLongPress={350}
                    disabled={esPendiente && !permisos.asignarPersonal}
                  >
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.personaNombre}>{item.nombre}</Text>
                        {!esPendiente && !item.pausado && personaTieneSinLeer(sinLeer, proyecto.id, area.id, item.usuario_id) && (
                          <Text style={styles.iconoMensaje}>💬</Text>
                        )}
                        {esPendiente && (
                          <View style={styles.etiquetaPendiente}>
                            <Text style={styles.etiquetaPendienteTexto}>Pendiente</Text>
                          </View>
                        )}
                        {item.pausado && (
                          <View style={styles.etiquetaPausado}>
                            <Text style={styles.etiquetaPendienteTexto}>Pausado</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.personaSubtexto}>
                        {esPendiente
                          ? 'Todavía no acepta la invitación · el chat se habilita al aceptar'
                          : item.pausado
                          ? 'Acceso pausado a este proyecto'
                          : 'Toca para abrir el chat'}
                      </Text>
                    </View>
                    {!esPendiente && !item.pausado && <Text style={styles.personaFlecha}>›</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      ) : tab === 'fotos' ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Avance de {area.nombre}</Text>
            <TouchableOpacity style={styles.botonAsignar} onPress={elegirOrigenFoto} disabled={subiendoFoto}>
              <Text style={styles.botonAsignarTexto}>{subiendoFoto ? 'SUBIENDO...' : '+ FOTO'}</Text>
            </TouchableOpacity>
          </View>

          {cargandoFotos ? (
            <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginTop: 20 }} />
          ) : fotos.length === 0 ? (
            <Text style={styles.vacioTexto}>Aún no hay fotos de avance. Toca "+ Foto" para agregar la primera.</Text>
          ) : (
            <FlatList
              data={fotos}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.lista}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.fotoFila}
                  onPress={() => setFotoAmpliada(item)}
                  onLongPress={() => setMenuFoto(item)}
                >
                  <Image source={{ uri: item.foto_url }} style={styles.fotoFilaMiniatura} />
                  <View style={{ flex: 1 }}>
                    {/* Si el usuario no puso descripción al subir la foto (lo más común), se
                        muestra "Foto de avance" como título genérico, igual que pidió el
                        usuario: nombre/descripción arriba, fecha y hora debajo. */}
                    <Text style={styles.personaNombre} numberOfLines={1}>
                      {item.descripcion?.trim() || 'Foto de avance'}
                    </Text>
                    <Text style={styles.personaSubtexto}>{formatearFechaHora(item.created_at)}</Text>
                  </View>
                  <Text style={styles.personaFlecha}>›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : tab === 'contrato' ? (
        <View style={{ flex: 1, padding: 20 }}>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Contrato</Text>
          </View>
          {cargandoContrato ? (
            <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginTop: 20 }} />
          ) : contrato?.pdf_url ? (
            <TouchableOpacity
              style={styles.botonAsignar}
              onPress={() => Linking.openURL(contrato.pdf_url)}
            >
              <Text style={styles.botonAsignarTexto}>ABRIR CONTRATO (PDF)</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.vacioTexto}>
              Tu contrato todavía no está disponible. Cuando la empresa lo genere, aparecerá aquí.
            </Text>
          )}
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Planos 3D de {area.nombre}</Text>
            {permisos.gestionarPlanos3d && (
              <TouchableOpacity style={styles.botonAsignar} onPress={elegirYSubirPlano3d} disabled={subiendoPlano3d}>
                <Text style={styles.botonAsignarTexto}>{subiendoPlano3d ? 'SUBIENDO...' : '+ PLANO .GLB'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {cargandoPlanos3d ? (
            <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginTop: 20 }} />
          ) : planos3d.length === 0 ? (
            <Text style={styles.vacioTexto}>
              {permisos.gestionarPlanos3d
                ? 'Aún no hay planos 3D. Toca "+ Plano .glb" y elige un archivo exportado desde SketchUp como "Archivo binario glTF (.glb)".'
                : 'Aún no hay planos 3D subidos para esta área.'}
            </Text>
          ) : (
            <FlatList
              data={planos3d}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.lista}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.personaCard}
                  onPress={() => setPlano3dAbierto(item)}
                  onLongPress={() => permisos.gestionarPlanos3d && setMenuPlano3d(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaNombre}>{item.nombre}</Text>
                    <Text style={styles.personaSubtexto}>
                      Subido por {item.usuario_nombre} · {formatearFechaHora(item.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.personaFlecha}>›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}

      <Modal visible={!!fotoAmpliada} animationType="fade" transparent>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.fotoAmpliadaOverlay}>
            {fotoAmpliada && (
              <>
                <View style={styles.fotoAmpliadaImagenContainer}>
                  <ImagenZoom uri={fotoAmpliada.foto_url} />
                </View>
                <Text style={styles.fotoAmpliadaAyuda}>Pellizca para hacer zoom · doble toque para volver al tamaño normal</Text>
                <Text style={styles.fotoAmpliadaInfo}>
                  {fotoAmpliada.usuario_nombre} · {formatearFechaHora(fotoAmpliada.created_at)}
                </Text>
                {guardandoFoto && <ActivityIndicator color="#fff" style={{ marginTop: 10 }} />}
                {/* Eliminar, Descargar y Compartir se movieron al menú de mantener-presionado en
                    la lista (mismo patrón que Planos 3D y Proyectos) — esta pantalla ampliada
                    solo sirve para ver la foto en grande y hacer zoom. */}
                <TouchableOpacity style={styles.fotoAmpliadaCerrar} onPress={() => setFotoAmpliada(null)}>
                  <Text style={styles.fotoAmpliadaBotonTexto}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal visible={!!plano3dAbierto} animationType="slide">
        {/* GestureHandlerRootView es indispensable aquí: un <Modal> de React Native se monta en
            su propio árbol nativo separado, así que el GestureHandlerRootView que envuelve toda
            la app (en app/index.tsx) NO alcanza a cubrir lo que hay dentro del Modal. Sin este
            wrapper propio, react-native-gesture-handler no recibe ningún toque y el visor 3D
            queda "congelado" (no responde a rotar/mover/zoom), aunque el resto de la lógica de
            gestos esté bien. Mismo motivo por el que el Modal de fotoAmpliada, más arriba, ya
            lo tenía. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/* Este Modal se dibuja en Android por debajo de la barra de notificaciones/hora y, con
              navegación gesticular, también puede montarse detrás de los botones nativos de abajo
              (el usuario reportó el header y el aviso inferior tapados). paddingTop/paddingBottom
              con los insets reales del dispositivo (useSafeAreaInsets, ya usado en el resto de esta
              pantalla) evita que el header y los avisos del visor queden tapados por esas zonas. */}
          <View style={[styles.plano3dModalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.plano3dHeader}>
              <TouchableOpacity onPress={() => setPlano3dAbierto(null)}>
                <Text style={styles.chatVolver}>‹ Volver</Text>
              </TouchableOpacity>
              <Text style={styles.chatTitulo} numberOfLines={1}>{plano3dAbierto?.nombre}</Text>
              {/* El botón "Eliminar" que vivía aquí se movió a un menú de mantener-presionado
                  en la lista de planos 3D (mismo patrón que Proyectos), para no tener que
                  entrar al modelo primero solo para borrarlo. Este espacio vacío mantiene el
                  título centrado, igual que antes. */}
              <View style={{ width: 60 }} />
            </View>
            {plano3dAbierto && <Visor3D uri={plano3dAbierto.url_glb} />}
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal visible={!!menuPlano3d} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenuPlano3d}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>{menuPlano3d?.nombre}</Text>
            <TouchableOpacity
              style={styles.menuOpcion}
              onPress={() => {
                cerrarMenuPlano3d();
                confirmarEliminarPlano3d(menuPlano3d);
              }}
            >
              <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenuPlano3d}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!menuFoto} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenuFoto}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>Foto de avance</Text>
            <TouchableOpacity
              style={styles.menuOpcion}
              onPress={() => {
                const foto = menuFoto;
                cerrarMenuFoto();
                descargarFoto(foto);
              }}
            >
              <Text style={styles.menuOpcionTexto}>⬇️  Descargar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuOpcion}
              onPress={() => {
                const foto = menuFoto;
                cerrarMenuFoto();
                compartirFoto(foto);
              }}
            >
              <Text style={styles.menuOpcionTexto}>📤  Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuOpcion}
              onPress={() => {
                const foto = menuFoto;
                cerrarMenuFoto();
                confirmarEliminarFoto(foto);
              }}
            >
              <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenuFoto}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!menuMensaje} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenuMensaje}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>Mensaje</Text>
            <TouchableOpacity
              style={styles.menuOpcion}
              onPress={() => {
                const mensaje = menuMensaje;
                cerrarMenuMensaje();
                eliminarMensaje(mensaje);
              }}
            >
              <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenuMensaje}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!menuPersona} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenuPersona}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>{menuPersona?.nombre}</Text>
            <TouchableOpacity
              style={styles.menuOpcion}
              onPress={() => {
                const persona = menuPersona;
                cerrarMenuPersona();
                alternarPausaPersona(persona);
              }}
            >
              <Text style={styles.menuOpcionTexto}>
                {menuPersona?.pausado ? '▶️  Reanudar asignación' : '⏸️  Pausar asignación'}
              </Text>
            </TouchableOpacity>
            {menuPersona?.estado === 'vinculado' && (
              <TouchableOpacity
                style={styles.menuOpcion}
                onPress={() => {
                  const persona = menuPersona;
                  cerrarMenuPersona();
                  eliminarChatPersona(persona);
                }}
              >
                <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuOpcion}
              onPress={() => {
                const persona = menuPersona;
                cerrarMenuPersona();
                eliminarPersonaDelProyecto(persona);
              }}
            >
              <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>❌  Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenuPersona}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalAsignarVisible} animationType="slide">
        {/* insets.top/bottom evitan que el contenido quede pegado a la barra de estado y a la barra de gestos en Android (edgeToEdgeEnabled);
            se mantiene 60 como mínimo de paddingTop porque es el valor original de styles.modalContainer */}
        <View style={[styles.modalContainer, { paddingTop: Math.max(insets.top, 60), paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.modalTitulo}>Asignar a {area.nombre}</Text>
          <FlatList
            data={personalDisponible}
            keyExtractor={(item, index) => (item.usuario_id != null ? `u-${item.usuario_id}` : `inv-${item.rol_id}-${index}`)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.opcionPersona} onPress={() => asignarPersona(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcionPersonaTexto}>{item.nombre}</Text>
                  <Text style={styles.opcionPersonaCelular}>{item.celular}</Text>
                </View>
                {item.estado === 'pendiente' && (
                  <View style={styles.etiquetaPendiente}>
                    <Text style={styles.etiquetaPendienteTexto}>Pendiente</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.vacioTexto}>
                No hay personal en esta área todavía. Ve a Grupo de Trabajo para agregar o invitar personas.
              </Text>
            }
          />
          <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalAsignarVisible(false)}>
            <Text style={styles.botonCancelarTexto}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* statusBarTranslucent + hardwareAccelerated ayudan a que este Modal sobreviva bien cuando
          se abre una app externa desde adentro (como la cámara nativa) y el usuario vuelve —
          en Android, un Modal de React Native sin estas props puede perder su estado o dar la
          impresión de que la app entera se reinició al volver de la cámara. */}
      <Modal
        visible={!!chatAbierto}
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={cerrarChat}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
          <View style={styles.chatModalContainer}>
            {/* paddingTop dinámico: en Android con edgeToEdgeEnabled el paddingTop fijo del estilo no alcanza para esquivar la barra de estado */}
            <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 50 : 16) }]}>
              <TouchableOpacity onPress={cerrarChat}>
                <Text style={styles.chatVolver}>‹ Volver</Text>
              </TouchableOpacity>
              <Text style={styles.chatTitulo}>{chatAbierto?.nombre}</Text>
              <View style={{ width: 50 }} />
            </View>

            {cargandoChat ? (
              <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={mensajes}
                keyExtractor={(item) => item.id.toString()}
                style={styles.chatLista}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={item.usuario_id === usuario.id ? 0.6 : 1}
                    onLongPress={() => item.usuario_id === usuario.id && setMenuMensaje(item)}
                    style={styles.mensajeCard}
                  >
                    <Text style={styles.mensajeAutor}>{item.usuario_nombre}</Text>
                    {item.archivos?.map((archivo) =>
                      archivo.tipo_archivo === 'imagen' ? (
                        <TouchableOpacity key={archivo.id} onPress={() => setFotoAmpliada({ foto_url: archivo.url_archivo, usuario_nombre: item.usuario_nombre, created_at: item.created_at })}>
                          <Image source={{ uri: archivo.url_archivo }} style={styles.mensajeImagenAdjunta} />
                        </TouchableOpacity>
                      ) : archivo.tipo_archivo === 'audio' ? (
                        <BurbujaAudio key={archivo.id} uri={archivo.url_archivo} />
                      ) : (
                        <TouchableOpacity key={archivo.id} style={styles.mensajeDocumentoAdjunto} onPress={() => Linking.openURL(archivo.url_archivo)}>
                          <Text style={styles.mensajeDocumentoTexto}>📎 {archivo.nombre_archivo || 'Archivo adjunto'}</Text>
                        </TouchableOpacity>
                      )
                    )}
                    {!!item.contenido && <Text style={styles.mensajeTexto}>{item.contenido}</Text>}
                    <Text style={styles.mensajeHora}>{formatearFechaHora(item.created_at)}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.vacioTexto}>Sin mensajes todavía. Escribe el primero.</Text>}
              />
            )}

            <View style={[styles.chatInputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              {grabandoNota && (
                <View style={styles.grabandoIndicador}>
                  <Text style={styles.grabandoTexto}>🔴 Grabando... suelta el micrófono para enviar</Text>
                </View>
              )}
              {!grabandoNota && (
                <>
                  <TouchableOpacity style={styles.chatAdjuntar} onPress={elegirYAdjuntarArchivo} disabled={enviando}>
                    <Text style={styles.chatAdjuntarTexto}>📎</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.chatInput}
                    value={nuevoMensaje}
                    onChangeText={setNuevoMensaje}
                    placeholder="Escribe un mensaje..."
                    placeholderTextColor="#999"
                  />
                </>
              )}
              {!grabandoNota && nuevoMensaje.trim() ? (
                <TouchableOpacity style={styles.chatEnviar} onPress={() => enviarMensaje()} disabled={enviando}>
                  <Text style={styles.chatEnviarTexto}>{enviando ? '...' : 'Enviar'}</Text>
                </TouchableOpacity>
              ) : (
                // Este botón permanece siempre montado (mismo elemento, mismo lugar en pantalla)
                // tanto antes como durante la grabación. Antes intercambiábamos este TouchableOpacity
                // por otro distinto (uno de cancelar) apenas grabandoNota pasaba a true, y al hacerlo
                // React desmontaba el elemento que tenía el dedo encima a mitad del gesto: el evento
                // onPressOut (soltar el dedo) se perdía y la nota nunca se enviaba, quedando "pegada".
                // Ahora solo cambia el ícono/color, nunca el componente en sí, así el gesto de soltar
                // siempre llega a detenerYEnviarNota.
                <TouchableOpacity
                  style={[styles.chatMicrofono, grabandoNota && styles.chatMicrofonoActivo]}
                  onLongPress={iniciarGrabacionNota}
                  onPressOut={detenerYEnviarNota}
                  delayLongPress={200}
                  disabled={enviando}
                >
                  <Text style={styles.chatAdjuntarTexto}>{grabandoNota ? '🔴' : '🎤'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitulo: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  botonAsignar: { backgroundColor: '#1E90FF', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  botonAsignarTexto: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  vacioTexto: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 30, paddingHorizontal: 20 },
  lista: { padding: 16 },
  personaCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personaNombre: { fontSize: 16, fontWeight: '600', color: '#222' },
  iconoMensaje: { fontSize: 14 },
  personaSubtexto: { fontSize: 12, color: '#999', marginTop: 2 },
  personaFlecha: { fontSize: 22, color: '#ccc' },
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  opcionPersona: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opcionPersonaTexto: { fontSize: 15, fontWeight: '600' },
  opcionPersonaCelular: { fontSize: 13, color: '#777', marginTop: 2 },
  etiquetaPendiente: { backgroundColor: '#FFF3CD', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 9 },
  etiquetaPendienteTexto: { fontSize: 11, color: '#8A6D00', fontWeight: '700' },
  etiquetaPausado: { backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 9 },
  botonCancelar: { alignItems: 'center', marginTop: 16, padding: 12 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
  chatModalContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatVolver: { color: '#1E90FF', fontSize: 15, fontWeight: '600' },
  chatTitulo: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  chatLista: { flex: 1 },
  mensajeCard: { backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  mensajeAutor: { fontSize: 12, fontWeight: 'bold', color: '#1E90FF' },
  mensajeTexto: { fontSize: 14, color: '#333', marginTop: 2 },
  mensajeHora: { fontSize: 10, color: '#999', marginTop: 4, textAlign: 'right' },
  mensajeImagenAdjunta: { width: 180, height: 180, borderRadius: 8, marginTop: 6, backgroundColor: '#eee' },
  mensajeDocumentoAdjunto: { backgroundColor: '#f0f6ff', borderRadius: 6, padding: 8, marginTop: 6 },
  mensajeDocumentoTexto: { fontSize: 13, color: '#1E90FF', fontWeight: '600' },
  notaVozContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f6ff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, marginTop: 6, gap: 8, minWidth: 160 },
  notaVozBoton: { fontSize: 18 },
  notaVozBarra: { flex: 1, height: 4, backgroundColor: '#cddcf5', borderRadius: 2, overflow: 'hidden' },
  notaVozBarraProgreso: { height: '100%', backgroundColor: '#1E90FF' },
  notaVozTiempo: { fontSize: 11, color: '#1E90FF', fontWeight: '600', minWidth: 32, textAlign: 'right' },
  chatInputContainer: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center' },
  chatAdjuntar: { paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  chatAdjuntarTexto: { fontSize: 22 },
  chatInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ddd' },
  chatEnviar: { backgroundColor: '#1E90FF', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  chatEnviarTexto: { color: '#fff', fontWeight: 'bold' },
  chatMicrofono: { paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  chatMicrofonoActivo: { backgroundColor: '#ffe0e0', borderRadius: 20 },
  grabandoIndicador: { flex: 1, backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ffcccc' },
  grabandoTexto: { color: '#DC143C', fontSize: 13, fontWeight: '600' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabBoton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBotonActivo: { borderBottomColor: '#1E90FF' },
  tabBotonTexto: { fontSize: 14, color: '#888', fontWeight: '600' },
  tabBotonTextoActivo: { color: '#1E90FF' },
  fotoFila: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fotoFilaMiniatura: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#eee' },
  fotoAmpliadaOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  fotoAmpliadaImagenContainer: { width: '100%', height: '62%', overflow: 'hidden' },
  fotoAmpliadaAyuda: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 10, textAlign: 'center' },
  fotoAmpliadaInfo: { color: '#fff', fontSize: 13, marginTop: 6, textAlign: 'center' },
  fotoAmpliadaBotonTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
  fotoAmpliadaCerrar: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  plano3dModalContainer: { flex: 1, backgroundColor: '#1c1c1c' },
  plano3dHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 14, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
});