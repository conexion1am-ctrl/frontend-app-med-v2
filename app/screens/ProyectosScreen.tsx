import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';

export default function ProyectosScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const [proyectos, setProyectos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [nombre, setNombre] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [direccion, setDireccion] = useState('');
  const [actividadesSeleccionadas, setActividadesSeleccionadas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resProyectos, resAreas] = await Promise.all([
        axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/listar/${empresa.id}`),
        axios.get('https://backend-app-mediterraneo.onrender.com/api/areas'),
      ]);
      setProyectos(resProyectos.data.proyectos);
      setAreas(resAreas.data.areas);
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los proyectos.');
    } finally {
      setCargando(false);
    }
  };

  const toggleActividad = (areaId) => {
    setActividadesSeleccionadas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const limpiarFormulario = () => {
    setNombre('');
    setAreaM2('');
    setDireccion('');
    setActividadesSeleccionadas([]);
  };

  const crearProyecto = async () => {
    if (!nombre.trim()) {
      Alert.alert('Campo obligatorio', 'El nombre del proyecto es obligatorio.');
      return;
    }

    setGuardando(true);
    try {
      await axios.post('https://backend-app-mediterraneo.onrender.com/api/proyectos/crear', {
        empresa_id: empresa.id,
        nombre,
        direccion: direccion || null,
        area_m2: areaM2 ? parseFloat(areaM2) : null,
        areas_ids: actividadesSeleccionadas,
      });
      Alert.alert('¡Listo!', 'Proyecto creado exitosamente.');
      setModalVisible(false);
      limpiarFormulario();
      cargarDatos();
    } catch (error) {
      console.error('Error creando proyecto:', error);
      Alert.alert('Error', 'No se pudo crear el proyecto. Intenta de nuevo.');
    } finally {
      setGuardando(false);
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {proyectos.length === 0 ? (
          <Text style={styles.vacioTexto}>Aún no hay proyectos. Toca "Nuevo Proyecto" para empezar.</Text>
        ) : (
          proyectos.map((proyecto) => (
            <TouchableOpacity
              key={proyecto.id}
              style={styles.proyectoCard}
              onPress={() => navigation.navigate('DetalleProyecto', { empresa, proyecto, usuario })}
            >
              <Text style={styles.proyectoNombre}>{proyecto.nombre}</Text>
              {proyecto.direccion ? <Text style={styles.proyectoDireccion}>{proyecto.direccion}</Text> : null}
              {proyecto.area_m2 ? <Text style={styles.proyectoArea}>{proyecto.area_m2} m²</Text> : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.botonAgregar} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonAgregarTexto}>NUEVO PROYECTO</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Nuevo Proyecto</Text>

            <Text style={styles.label}>Nombre del Proyecto *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Llano Azul Casa 340" placeholderTextColor="#999" />

            <Text style={styles.label}>Área (m²)</Text>
            <TextInput
              style={styles.input}
              value={areaM2}
              onChangeText={setAreaM2}
              placeholder="Ej: 180.5"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Dirección</Text>
            <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} placeholder="Dirección del proyecto" placeholderTextColor="#999" />

            <Text style={styles.label}>Actividades (áreas que se requieren)</Text>
            <View style={styles.areasLista}>
              {areas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.areaOpcion,
                    actividadesSeleccionadas.includes(area.id) && styles.areaOpcionSeleccionada,
                  ]}
                  onPress={() => toggleActividad(area.id)}
                >
                  <Text
                    style={[
                      styles.areaOpcionTexto,
                      actividadesSeleccionadas.includes(area.id) && styles.areaOpcionTextoSeleccionado,
                    ]}
                  >
                    {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.botonGuardar} onPress={crearProyecto} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>CREAR PROYECTO</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botonCancelar}
              onPress={() => {
                setModalVisible(false);
                limpiarFormulario();
              }}
            >
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  vacioTexto: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  proyectoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  proyectoNombre: { fontSize: 16, fontWeight: '600', color: '#222' },
  proyectoDireccion: { fontSize: 13, color: '#777', marginTop: 2 },
  proyectoArea: { fontSize: 12, color: '#999', marginTop: 2 },
  botonAgregar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  botonAgregarTexto: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  areasLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  areaOpcion: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  areaOpcionSeleccionada: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  areaOpcionTexto: { fontSize: 13, color: '#555' },
  areaOpcionTextoSeleccionado: { color: '#fff', fontWeight: '600' },
  botonGuardar: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
});