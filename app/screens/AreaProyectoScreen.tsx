import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { storage } from '../../firebaseConfig';
import EncabezadoLogo from '../components/EncabezadoLogo';
import ImagenZoom from '../components/ImagenZoom';

const formatearFechaFoto = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = String(d.getUTCFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
};

export default function AreaProyectoScreen({ route }) {
  const { empresa, proyecto, area, usuario } = route.params;
  const [tab, setTab] = useState('equipo'); // 'equipo' | 'fotos'
  const [equipo, setEquipo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAsignarVisible, setModalAsignarVisible] = useState(false);
  const [personalDisponible, setPersonalDisponible] = useState([]);

  const [chatAbierto, setChatAbierto] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargandoChat, setCargandoChat] = useState(false);

  const [fotos, setFotos] = useState([]);
  const [cargandoFotos, setCargandoFotos] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  useEffect(() => {
    cargarEquipo();
  }, []);

  useEffect(() => {
    if (tab === 'fotos') {
      cargarFotos();
    }
  }, [tab]);

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

  const cargarEquipo = async () => {
    setCargando(true);
    try {
      const resEquipo = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}/equipo`);
      setEquipo(resEquipo.data.equipo.filter((p) => p.area_id === area.id));
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

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !chatAbierto) return;
    setEnviando(true);
    try {
      await axios.post('https://backend-app-mediterraneo.onrender.com/api/mensajes/enviar', {
        proyecto_id: proyecto.id,
        area_id: area.id,
        usuario_id: usuario.id,
        destinatario_usuario_id: chatAbierto.usuario_id,
        contenido: nuevoMensaje,
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
        <TouchableOpacity style={[styles.tabBoton, tab === 'equipo' && styles.tabBotonActivo]} onPress={() => setTab('equipo')}>
          <Text style={[styles.tabBotonTexto, tab === 'equipo' && styles.tabBotonTextoActivo]}>Equipo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBoton, tab === 'fotos' && styles.tabBotonActivo]} onPress={() => setTab('fotos')}>
          <Text style={[styles.tabBotonTexto, tab === 'fotos' && styles.tabBotonTextoActivo]}>Fotos de avance</Text>
        </TouchableOpacity>
      </View>

      {tab === 'equipo' ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Personas en {area.nombre}</Text>
            <TouchableOpacity style={styles.botonAsignar} onPress={abrirAsignar}>
              <Text style={styles.botonAsignarTexto}>ASIGNAR</Text>
            </TouchableOpacity>
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
      ) : (
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

      <Modal visible={!!chatAbierto} animationType="slide">
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
                    <Text style={styles.mensajeTexto}>{item.contenido}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.vacioTexto}>Sin mensajes todavía. Escribe el primero.</Text>}
              />
            )}

            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                value={nuevoMensaje}
                onChangeText={setNuevoMensaje}
                placeholder="Escribe un mensaje..."
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.chatEnviar} onPress={enviarMensaje} disabled={enviando}>
                <Text style={styles.chatEnviarTexto}>{enviando ? '...' : 'Enviar'}</Text>
              </TouchableOpacity>
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
  chatInputContainer: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  chatInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ddd' },
  chatEnviar: { backgroundColor: '#1E90FF', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  chatEnviarTexto: { color: '#fff', fontWeight: 'bold' },
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
});