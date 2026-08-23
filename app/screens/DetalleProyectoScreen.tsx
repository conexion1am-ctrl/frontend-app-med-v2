import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { permisosDe } from '../utils/roles';

export default function DetalleProyectoScreen({ route, navigation }) {
  const { empresa, proyecto, usuario } = route.params;
  const insets = useSafeAreaInsets();
  const puedeGestionar = permisosDe(empresa).gestionarProyectos;
  const [detalle, setDetalle] = useState(null);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalEditar, setModalEditar] = useState(false);
  const [modalActividades, setModalActividades] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [actividadesSeleccionadas, setActividadesSeleccionadas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarDetalle();
  }, []);

  const cargarDetalle = async () => {
    setCargando(true);
    try {
      const [resDetalle, resAreas] = await Promise.all([
        axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}`),
        axios.get('https://backend-app-mediterraneo.onrender.com/api/areas'),
      ]);
      setDetalle(resDetalle.data);
      setNombre(resDetalle.data.nombre);
      setDireccion(resDetalle.data.direccion || '');
      setAreaM2(resDetalle.data.area_m2 ? String(resDetalle.data.area_m2) : '');
      setAreas(resAreas.data.areas);
    } catch (error) {
      console.error('Error cargando detalle:', error);
    } finally {
      setCargando(false);
    }
  };

  const guardarEdicion = async () => {
    setGuardando(true);
    try {
      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}`, {
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
        await axios.post(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}/actividades/agregar`, {
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

  const eliminarProyecto = () => {
    Alert.alert('Eliminar proyecto', '¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}`);
            navigation.goBack();
          } catch (error) {
            console.error('Error eliminando proyecto:', error);
            Alert.alert('Error', 'No se pudo eliminar el proyecto.');
          }
        },
      },
    ]);
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
        {detalle.area_m2 ? <Text style={styles.info}>{detalle.area_m2} m²</Text> : null}

        {puedeGestionar && (
          <View style={styles.accionesFila}>
            <TouchableOpacity style={styles.botonAccion} onPress={() => setModalEditar(true)}>
              <Text style={styles.botonAccionTexto}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonAccion} onPress={abrirModalActividades}>
              <Text style={styles.botonAccionTexto}>+ Actividad</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonEliminar} onPress={eliminarProyecto}>
              <Text style={styles.botonEliminarTexto}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.seccionTitulo}>Actividades</Text>
        <View style={styles.actividadesLista}>
          {detalle.actividades.length === 0 ? (
            <Text style={styles.vacioTexto}>No hay actividades asignadas a este proyecto.</Text>
          ) : (
            detalle.actividades.map((area) => (
              <TouchableOpacity
                key={area.id}
                style={styles.actividadCard}
                onPress={() => navigation.navigate('AreaProyecto', { empresa, proyecto: detalle, area, usuario })}
              >
                <Text style={styles.actividadTexto}>
                  {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                </Text>
                <Text style={styles.actividadFlecha}>›</Text>
              </TouchableOpacity>
            ))
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
  botonEliminar: { flex: 1, backgroundColor: '#DC143C', borderRadius: 8, padding: 10, alignItems: 'center' },
  botonEliminarTexto: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
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
  actividadTexto: { fontSize: 15, color: '#222', fontWeight: '500' },
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
});