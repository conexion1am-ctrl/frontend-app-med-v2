import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../firebaseConfig';
import EncabezadoLogo from '../components/EncabezadoLogo';
import ImagenZoom from '../components/ImagenZoom';
import Visor3D from '../components/Visor3D';
import { areasVisiblesEnEquipo, pestanasAreaProyecto, permisosDe } from '../utils/roles';

const formatearFechaFoto = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = String(d.getUTCFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
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
  const [tab, setTab] = useState(pestanasVisibles[0]); // 'equipo' | 'fotos' | 'planos3d' | 'contrato'
  const [equipo, setEquipo] = useState([]);
  const [contrato, setContrato] = useState(null);
  const [cargandoContrato, setCargandoContrato] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [modalAsignarVisible, setModalAsignarVisible] = useState(false);
  const [personalDisponible, setPersonalDisponible] = useState([]);

  const [chatAbierto, setChatAbierto] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargandoChat, setCargandoChat] = useState(false);

  // Nota de voz: se graba manteniendo presionado el botón del micrófono, estilo WhatsApp.
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(audioRecorder); // mantiene el hook activo para que el recorder se actualice
  const [grabandoNota, setGrabandoNota] = useState(false);
  const inicioGrabacionRef = useRef(null);

  const [fotos, setFotos] = useState([]);
  const [cargandoFotos, setCargandoFotos] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const [planos3d, setPlanos3d] = useState([]);
  const [cargandoPlanos3d, setCargandoPlanos3d] = useState(false);
  const [subiendoPlano3d, setSubiendoPlano3d] = useState(false);
  const [plano3dAbierto, setPlano3dAbierto] = useState(null);

  useEffect(() => {
    cargarEquipo();
  }, []);

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
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/contratos/por-proyecto/${proyecto.id}`);
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
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/fotos-avance/${proyecto.id}/${area.id}`);
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

    const resultado = desdeCamara
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });

    if (resultado.canceled) return;

    setSubiendoFoto(true);
    try {
      const url = await subirFotoAFirebase(resultado.assets[0].uri);
      await axios.post('https://backend-app-mediterraneo.onrender.com/api/fotos-avance/subir', {
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
            await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/fotos-avance/${foto.id}`);
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
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/planos-3d/${proyecto.id}/${area.id}`);
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
      await axios.post('https://backend-app-mediterraneo.onrender.com/api/planos-3d/subir', {
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
            await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/planos-3d/${plano.id}`, {
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

  const cargarEquipo = async () => {
    setCargando(true);
    try {
      const resEquipo = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}/equipo`);
      // Algunas áreas (Proveedores, Clientes) tienen visibilidad reducida: además de su
      // propia área, solo pueden ver/hablar con ciertas áreas fijas (Gerencia, Administrativa,
      // etc.), no con el resto del equipo del proyecto.
      const areasPermitidas = areasVisiblesEnEquipo(empresa);
      let personasVisibles;
      if (areasPermitidas) {
        personasVisibles = resEquipo.data.equipo.filter(
          (p) => p.area_id === area.id || areasPermitidas.includes(p.area_nombre)
        );
      } else {
        personasVisibles = resEquipo.data.equipo.filter((p) => p.area_id === area.id);
      }
      setEquipo(personasVisibles);
    } catch (error) {
      console.error('Error cargando equipo:', error);
    } finally {
      setCargando(false);
    }
  };

  const abrirAsignar = async () => {
    try {
      const response = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/${empresa.id}`);
      // Solo se puede asignar personal ya VINCULADO (con usuario_id real).
      // Las personas "pendientes" (invitadas pero que aún no aceptaron) no tienen usuario_id
      // todavía y no pueden ser asignadas a un proyecto hasta que acepten la invitación.
      const delArea = response.data.personal.filter((p) => p.area_id === area.id && p.estado === 'vinculado' && p.usuario_id);
      setPersonalDisponible(delArea);
      setModalAsignarVisible(true);
    } catch (error) {
      console.error('Error cargando personal:', error);
      Alert.alert('Error', 'No se pudo cargar el personal disponible.');
    }
  };

  const asignarPersona = async (usuarioId) => {
    try {
      await axios.post(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}/equipo/asignar`, {
        usuario_id: usuarioId,
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
      const resMensajes = await axios.get(
        `https://backend-app-mediterraneo.onrender.com/api/mensajes/${proyecto.id}/${area.id}/${persona.usuario_id}`
      );
      setMensajes(resMensajes.data.mensajes);
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
      await axios.post('https://backend-app-mediterraneo.onrender.com/api/mensajes/enviar', {
        proyecto_id: proyecto.id,
        area_id: area.id,
        usuario_id: usuario.id,
        destinatario_usuario_id: chatAbierto.usuario_id,
        contenido: nuevoMensaje,
        archivo: archivo || undefined,
      });
      setNuevoMensaje('');
      const resMensajes = await axios.get(
        `https://backend-app-mediterraneo.onrender.com/api/mensajes/${proyecto.id}/${area.id}/${chatAbierto.usuario_id}`
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
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.personaCard} onPress={() => abrirChat(item)}>
                  <View>
                    <Text style={styles.personaNombre}>{item.nombre}</Text>
                    <Text style={styles.personaSubtexto}>Toca para abrir el chat</Text>
                  </View>
                  <Text style={styles.personaFlecha}>›</Text>
                </TouchableOpacity>
              )}
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
              numColumns={3}
              contentContainerStyle={styles.galeriaLista}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.fotoMiniatura} onPress={() => setFotoAmpliada(item)}>
                  <Image source={{ uri: item.foto_url }} style={styles.fotoMiniaturaImagen} />
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
                <TouchableOpacity style={styles.personaCard} onPress={() => setPlano3dAbierto(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaNombre}>{item.nombre}</Text>
                    <Text style={styles.personaSubtexto}>
                      Subido por {item.usuario_nombre} · {formatearFechaFoto(item.created_at)}
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
                  {fotoAmpliada.usuario_nombre} · {formatearFechaFoto(fotoAmpliada.created_at)}
                </Text>
                {guardandoFoto && <ActivityIndicator color="#fff" style={{ marginTop: 10 }} />}
                <View style={styles.fotoAmpliadaBotones}>
                  <TouchableOpacity style={styles.fotoAmpliadaBoton} onPress={() => descargarFoto(fotoAmpliada)} disabled={guardandoFoto}>
                    <Text style={styles.fotoAmpliadaBotonTexto}>⬇️ Descargar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fotoAmpliadaBoton} onPress={() => compartirFoto(fotoAmpliada)} disabled={guardandoFoto}>
                    <Text style={styles.fotoAmpliadaBotonTexto}>📤 Compartir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fotoAmpliadaBoton} onPress={() => confirmarEliminarFoto(fotoAmpliada)}>
                    <Text style={styles.fotoAmpliadaBotonTexto}>🗑️ Eliminar</Text>
                  </TouchableOpacity>
                </View>
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
          <View style={styles.plano3dModalContainer}>
            <View style={styles.plano3dHeader}>
              <TouchableOpacity onPress={() => setPlano3dAbierto(null)}>
                <Text style={styles.chatVolver}>‹ Volver</Text>
              </TouchableOpacity>
              <Text style={styles.chatTitulo} numberOfLines={1}>{plano3dAbierto?.nombre}</Text>
              {permisos.gestionarPlanos3d ? (
                <TouchableOpacity onPress={() => confirmarEliminarPlano3d(plano3dAbierto)}>
                  <Text style={styles.plano3dEliminarTexto}>Eliminar</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 60 }} />
              )}
            </View>
            {plano3dAbierto && <Visor3D uri={plano3dAbierto.url_glb} />}
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal visible={modalAsignarVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitulo}>Asignar a {area.nombre}</Text>
          <FlatList
            data={personalDisponible}
            keyExtractor={(item, index) => (item.usuario_id != null ? item.usuario_id.toString() : `sin-id-${index}`)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.opcionPersona} onPress={() => asignarPersona(item.usuario_id)}>
                <Text style={styles.opcionPersonaTexto}>{item.nombre}</Text>
                <Text style={styles.opcionPersonaCelular}>{item.celular}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.vacioTexto}>
                No hay personal vinculado en esta área todavía. Ve a Grupo de Trabajo para agregar o invitar personas (las personas invitadas aparecerán aquí solo después de aceptar).
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
            <View style={styles.chatHeader}>
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
                  <View style={styles.mensajeCard}>
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
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.vacioTexto}>Sin mensajes todavía. Escribe el primero.</Text>}
              />
            )}

            <View style={[styles.chatInputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              {grabandoNota ? (
                <>
                  <View style={styles.grabandoIndicador}>
                    <Text style={styles.grabandoTexto}>🔴 Grabando nota de voz... suelta para enviar</Text>
                  </View>
                  <TouchableOpacity style={styles.chatAdjuntar} onPress={cancelarGrabacionNota}>
                    <Text style={styles.chatAdjuntarTexto}>✖️</Text>
                  </TouchableOpacity>
                </>
              ) : (
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
                  {nuevoMensaje.trim() ? (
                    <TouchableOpacity style={styles.chatEnviar} onPress={() => enviarMensaje()} disabled={enviando}>
                      <Text style={styles.chatEnviarTexto}>{enviando ? '...' : 'Enviar'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.chatMicrofono}
                      onLongPress={iniciarGrabacionNota}
                      onPressOut={detenerYEnviarNota}
                      delayLongPress={200}
                      disabled={enviando}
                    >
                      <Text style={styles.chatAdjuntarTexto}>🎤</Text>
                    </TouchableOpacity>
                  )}
                </>
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
  personaSubtexto: { fontSize: 12, color: '#999', marginTop: 2 },
  personaFlecha: { fontSize: 22, color: '#ccc' },
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  opcionPersona: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 14, marginBottom: 8 },
  opcionPersonaTexto: { fontSize: 15, fontWeight: '600' },
  opcionPersonaCelular: { fontSize: 13, color: '#777', marginTop: 2 },
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
  grabandoIndicador: { flex: 1, backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ffcccc' },
  grabandoTexto: { color: '#DC143C', fontSize: 13, fontWeight: '600' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabBoton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBotonActivo: { borderBottomColor: '#1E90FF' },
  tabBotonTexto: { fontSize: 14, color: '#888', fontWeight: '600' },
  tabBotonTextoActivo: { color: '#1E90FF' },
  galeriaLista: { padding: 8 },
  fotoMiniatura: { flex: 1 / 3, aspectRatio: 1, margin: 4, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee' },
  fotoMiniaturaImagen: { width: '100%', height: '100%' },
  fotoAmpliadaOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  fotoAmpliadaImagenContainer: { width: '100%', height: '62%', overflow: 'hidden' },
  fotoAmpliadaAyuda: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 10, textAlign: 'center' },
  fotoAmpliadaInfo: { color: '#fff', fontSize: 13, marginTop: 6, textAlign: 'center' },
  fotoAmpliadaBotones: { flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  fotoAmpliadaBoton: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  fotoAmpliadaBotonTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
  fotoAmpliadaCerrar: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  plano3dModalContainer: { flex: 1, backgroundColor: '#1c1c1c' },
  plano3dHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  plano3dEliminarTexto: { color: '#DC143C', fontSize: 14, fontWeight: '600' },
});