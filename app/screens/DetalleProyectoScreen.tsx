import api from '../utils/apiClient';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { permisosDe, tieneAccesoAFicha } from '../utils/roles';
import { obtenerMensajesSinLeer, areaTieneSinLeer, actualizarBadge } from '../utils/mensajesSinLeer';

export default function DetalleProyectoScreen({ route, navigation }) {
  const { empresa, proyecto, usuario } = route.params;
  const insets = useSafeAreaInsets();
  const puedeGestionar = permisosDe(empresa).gestionarProyectos;
  const [detalle, setDetalle] = useState(null);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  // true si ALGÚN gerente ya le escribió a este usuario en este proyecto (sin importar en qué
  // área/pantalla). Se usa solo para decidir si la ficha "GERENCIA" tiene borde de acceso — la
  // regla real es "gerencia debe escribir primero" para todo lo que no sea Gerencia/Admin/Log.
  const [leHaEscritoAlgunGerente, setLeHaEscritoAlgunGerente] = useState(false);
  // Mensajes sin leer del usuario en toda la app — aquí se usa para marcar con 💬 cada ficha de
  // actividad que tenga algo pendiente en ESTE proyecto puntual (ver areaTieneSinLeer).
  const [sinLeer, setSinLeer] = useState([]);

  const [modalEditar, setModalEditar] = useState(false);
  const [modalActividades, setModalActividades] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [actividadesSeleccionadas, setActividadesSeleccionadas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [menuActividad, setMenuActividad] = useState(null);
  const [eliminandoActividad, setEliminandoActividad] = useState(false);

  useEffect(() => {
    cargarDetalle();
  }, []);

  // useFocusEffect (no un simple useEffect) para refrescar el ícono de mensaje cada vez que se
  // vuelve a esta pantalla — antes solo se cargaba al montar, así que mensajes nuevos llegados
  // mientras el usuario ya navegaba dentro de la app no se veían hasta reabrir la app entera.
  useFocusEffect(
    useCallback(() => {
      if (!usuario?.id) return;
      obtenerMensajesSinLeer(usuario.id).then(setSinLeer);
      actualizarBadge(usuario.id);
    }, [usuario?.id])
  );

  const cargarDetalle = async () => {
    setCargando(true);
    try {
      const [resDetalle, resAreas, resEquipo] = await Promise.all([
        api.get(`/proyectos/${proyecto.id}`),
        api.get('/areas'),
        // Mismo endpoint que ya usa AreaProyectoScreen para calcular "le_ha_escrito" por cada
        // gerente — aquí solo necesitamos saber si AL MENOS UNO de ellos ya le escribió a este
        // usuario en este proyecto, para decidir si la ficha GERENCIA tiene borde de acceso.
        api.get(`/proyectos/${proyecto.id}/equipo`, {
          params: { solicitante_id: usuario.id },
        }),
      ]);
      setDetalle(resDetalle.data);
      setNombre(resDetalle.data.nombre);
      setDireccion(resDetalle.data.direccion || '');
      // FIX (2026-08-27): proyectos.area_m2 es DECIMAL(10,2) — pg lo devuelve como string con
      // decimales (ej. "180.00"). Sin normalizar, el campo mostraba "180.00" en vez de "180".
      setAreaM2(resDetalle.data.area_m2 ? String(parseFloat(resDetalle.data.area_m2)) : '');
      setAreas(resAreas.data.areas);
      setLeHaEscritoAlgunGerente(
        resEquipo.data.equipo.some((p) => p.area_nombre === 'GERENCIA' && p.le_ha_escrito === true)
      );
    } catch (error) {
      console.error('Error cargando detalle:', error);
    } finally {
      setCargando(false);
    }
  };

  const guardarEdicion = async () => {
    setGuardando(true);
    try {
      await api.put(`/proyectos/${proyecto.id}`, {
        nombre,
        direccion,
        area_m2: areaM2 ? parseFloat(areaM2) : null,
      });
      setModalEditar(false);
      cargarDetalle();
    } catch (error) {
      console.error('Error editando proyecto:', error);
      Alert.alert('Error', 'No se pudo actualizar el proyecto.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalActividades = () => {
    // Pre-marcar las actividades que ya están agregadas al proyecto
    setActividadesSeleccionadas(detalle.actividades.map((a) => a.id));
    setModalActividades(true);
  };

  const toggleActividad = (areaId, yaEstaba) => {
    if (yaEstaba) return; // no se puede desmarcar una que ya está agregada, solo se agregan nuevas aquí
    setActividadesSeleccionadas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const guardarActividades = async () => {
    const idsActuales = detalle.actividades.map((a) => a.id);
    const nuevas = actividadesSeleccionadas.filter((id) => !idsActuales.includes(id));

    if (nuevas.length === 0) {
      setModalActividades(false);
      return;
    }

    setGuardando(true);
    try {
      for (const areaId of nuevas) {
        await api.post(`/proyectos/${proyecto.id}/actividades/agregar`, {
          area_id: areaId,
        });
      }
      setModalActividades(false);
      cargarDetalle();
    } catch (error) {
      console.error('Error agregando actividades:', error);
      Alert.alert('Error', 'No se pudieron agregar algunas actividades.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminarActividad = (area) => {
    setMenuActividad(null);
    Alert.alert(
      `¿Eliminar "${area.nombre}"?`,
      'Se borrará TODO lo que tenga adentro en este proyecto: chats y sus archivos adjuntos, fotos de avance, y diseños 3D. También se quitará a cualquier persona asignada aquí (su cuenta no se toca, solo esta asignación). Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar todo', style: 'destructive', onPress: () => eliminarActividad(area) },
      ]
    );
  };

  const eliminarActividad = async (area) => {
    setEliminandoActividad(true);
    try {
      await api.delete(`/proyectos/${proyecto.id}/actividades/${area.id}`);
      cargarDetalle();
    } catch (error) {
      console.error('Error eliminando actividad:', error);
      const mensaje = error.response?.data?.error || 'No se pudo eliminar la actividad. Intenta de nuevo.';
      Alert.alert('Error', mensaje);
    } finally {
      setEliminandoActividad(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} />
      </View>
    );
  }

  const idsActuales = detalle.actividades.map((a) => a.id);

  // Abre Google Maps (o el navegador si no está instalada) buscando la dirección como texto.
  // No usamos coordenadas guardadas: Maps ubica la dirección escrita directamente.
  const abrirEnMaps = (direccionTexto) => {
    const query = encodeURIComponent(direccionTexto);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <EncabezadoLogo empresa={empresa} />
      <ScrollView style={[styles.container, { backgroundColor: empresa.color_hex || '#1E90FF' }]} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.nombre}>{detalle.nombre}</Text>
        {detalle.direccion ? (
          <View style={styles.direccionFila}>
            <Text style={[styles.info, { flex: 1 }]}>{detalle.direccion}</Text>
            <TouchableOpacity style={styles.botonMaps} onPress={() => abrirEnMaps(detalle.direccion)}>
              <Text style={styles.botonMapsTexto}>📍 Ver en Maps</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {detalle.area_m2 ? <Text style={styles.info}>{parseFloat(detalle.area_m2)} m²</Text> : null}

        {puedeGestionar && (
          <View style={styles.accionesFila}>
            <TouchableOpacity style={styles.botonAccion} onPress={() => setModalEditar(true)}>
              <Text style={styles.botonAccionTexto}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonAccion} onPress={abrirModalActividades}>
              <Text style={styles.botonAccionTexto}>+ Actividad</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.seccionTitulo}>Actividades</Text>
        {puedeGestionar && detalle.actividades.length > 0 && (
          <Text style={styles.notaTexto}>Mantén presionada una actividad para eliminarla.</Text>
        )}
        <View style={styles.actividadesLista}>
          {detalle.actividades.length === 0 ? (
            <Text style={styles.vacioTexto}>No hay actividades asignadas a este proyecto.</Text>
          ) : (
            detalle.actividades.map((area) => {
              // Todas las fichas se ven siempre; solo las que tienen acceso llevan borde oscuro
              // y son tocables — el resto se ve pero no se puede abrir (ver utils/roles.js).
              const conAcceso = tieneAccesoAFicha(empresa, area, leHaEscritoAlgunGerente);
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.actividadCard, conAcceso && styles.actividadCardConAcceso]}
                  activeOpacity={conAcceso ? 0.7 : 1}
                  onPress={() => {
                    if (!conAcceso) return;
                    navigation.navigate('AreaProyecto', { empresa, proyecto: detalle, area, usuario });
                  }}
                  onLongPress={() => puedeGestionar && setMenuActividad(area)}
                >
                  <View style={styles.actividadTextoFila}>
                    <Text style={[styles.actividadTexto, !conAcceso && styles.actividadTextoSinAcceso]}>
                      {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                    </Text>
                    {conAcceso && areaTieneSinLeer(sinLeer, proyecto.id, area.id) && (
                      <Text style={styles.iconoMensaje}>💬</Text>
                    )}
                  </View>
                  {conAcceso && <Text style={styles.actividadFlecha}>›</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={modalEditar} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Editar Proyecto</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholderTextColor="#999" />

            <Text style={styles.label}>Dirección</Text>
            <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} placeholderTextColor="#999" />

            <Text style={styles.label}>Área (m²)</Text>
            <TextInput style={styles.input} value={areaM2} onChangeText={setAreaM2} keyboardType="numeric" placeholderTextColor="#999" />

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarEdicion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAccionTextoBlanco}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalEditar(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalActividades} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitulo}>Actividades del Proyecto</Text>
          <Text style={styles.modalSubtitulo}>Las marcadas ya están agregadas. Toca las nuevas que quieras sumar.</Text>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.areasLista}>
              {areas.map((area) => {
                const yaEstaba = idsActuales.includes(area.id);
                const seleccionada = actividadesSeleccionadas.includes(area.id);
                return (
                  <TouchableOpacity
                    key={area.id}
                    style={[
                      styles.areaOpcion,
                      seleccionada && styles.areaOpcionSeleccionada,
                      yaEstaba && styles.areaOpcionYaAgregada,
                    ]}
                    onPress={() => toggleActividad(area.id, yaEstaba)}
                    disabled={yaEstaba}
                  >
                    <Text
                      style={[
                        styles.areaOpcionTexto,
                        seleccionada && styles.areaOpcionTextoSeleccionado,
                      ]}
                    >
                      {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                      {yaEstaba ? ' ✓' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <View style={[styles.modalBotonesFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity style={styles.botonGuardar} onPress={guardarActividades} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAccionTextoBlanco}>GUARDAR</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalActividades(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!menuActividad} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuActividad(null)}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
            <Text style={styles.menuTitulo}>
              {menuActividad?.categoria_padre ? `${menuActividad.categoria_padre} · ${menuActividad.nombre}` : menuActividad?.nombre}
            </Text>
            <TouchableOpacity
              style={styles.menuOpcion}
              disabled={eliminandoActividad}
              onPress={() => confirmarEliminarActividad(menuActividad)}
            >
              <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>
                🗑️  {eliminandoActividad ? 'Eliminando...' : 'Eliminar actividad'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => setMenuActividad(null)}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  nombre: { fontSize: 22, fontWeight: 'bold', color: '#222', marginBottom: 6 },
  info: { fontSize: 14, color: '#666', marginBottom: 2 },
  direccionFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 8 },
  botonMaps: { backgroundColor: '#1E90FF', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  botonMapsTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  accionesFila: { flexDirection: 'row', gap: 8, marginTop: 16 },
  botonAccion: { flex: 1, backgroundColor: '#1E90FF', borderRadius: 8, padding: 10, alignItems: 'center' },
  botonAccionTexto: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  botonAccionTextoBlanco: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  seccionTitulo: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 24, marginBottom: 10 },
  actividadesLista: { gap: 10 },
  vacioTexto: { color: '#888', fontSize: 14 },
  actividadCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Distintivo visual de acceso (punto 5 del rediseño de Actividades): borde oscuro solo en
  // las fichas que el usuario puede abrir. Las demás se ven igual pero sin ese borde y con el
  // texto atenuado, para que quede claro que están ahí pero no son tocables.
  actividadCardConAcceso: { borderColor: '#333', borderWidth: 2 },
  actividadTextoFila: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  actividadTexto: { fontSize: 15, color: '#222', fontWeight: '500' },
  actividadTextoSinAcceso: { color: '#aaa' },
  iconoMensaje: { fontSize: 14 },
  actividadFlecha: { fontSize: 20, color: '#ccc' },
  modalContainer: { flex: 1, backgroundColor: '#fff', paddingTop: 40 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 6, paddingHorizontal: 20 },
  modalSubtitulo: { fontSize: 13, color: '#888', paddingHorizontal: 20, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  botonGuardar: { backgroundColor: '#1E90FF', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 12 },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
  areasLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaOpcion: { backgroundColor: '#f0f0f0', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#ddd' },
  areaOpcionSeleccionada: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  areaOpcionYaAgregada: { backgroundColor: '#c8e6c9', borderColor: '#4caf50' },
  areaOpcionTexto: { fontSize: 13, color: '#555' },
  areaOpcionTextoSeleccionado: { color: '#fff', fontWeight: '600' },
  modalBotonesFooter: { paddingHorizontal: 20, paddingBottom: 20 },
  notaTexto: { fontSize: 12, color: '#eee', marginBottom: 8, fontStyle: 'italic' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#888', marginBottom: 12, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#222', textAlign: 'center' },
});