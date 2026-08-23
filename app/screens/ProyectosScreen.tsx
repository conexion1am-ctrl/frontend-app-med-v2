import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { esAccesoReducido, esGerencia, permisosDe } from '../utils/roles';

export default function ProyectosScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const insets = useSafeAreaInsets();
  const accesoReducido = esAccesoReducido(empresa);
  const puedeGestionar = permisosDe(empresa).gestionarProyectos;
  const puedeEliminar = esGerencia(empresa);
  const [proyectos, setProyectos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [menuProyecto, setMenuProyecto] = useState(null);
  const [eliminando, setEliminando] = useState(false);

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
      if (accesoReducido) {
        // Mano de obra / áreas especiales: solo ven los proyectos y áreas donde están
        // asignados, no el listado completo de la empresa.
        const resAsignaciones = await axios.get(
          `https://backend-app-mediterraneo.onrender.com/api/proyectos/asignaciones/${usuario.id}`
        );
        // Puede estar asignado a varias áreas del mismo proyecto: agrupamos por proyecto.
        const proyectosMap = {};
        resAsignaciones.data.asignaciones.forEach((asig) => {
          if (!proyectosMap[asig.proyecto_id]) {
            proyectosMap[asig.proyecto_id] = {
              id: asig.proyecto_id,
              nombre: asig.proyecto_nombre,
              misAreas: [],
            };
          }
          proyectosMap[asig.proyecto_id].misAreas.push({ id: asig.area_id, nombre: asig.area_nombre });
        });
        setProyectos(Object.values(proyectosMap));
      } else {
        const [resProyectos, resAreas] = await Promise.all([
          axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/listar/${empresa.id}`),
          axios.get('https://backend-app-mediterraneo.onrender.com/api/areas'),
        ]);
        setProyectos(resProyectos.data.proyectos);
        setAreas(resAreas.data.areas);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los proyectos.');
    } finally {
      setCargando(false);
    }
  };

  const abrirProyecto = (proyecto) => {
    if (accesoReducido) {
      if (proyecto.misAreas.length === 1) {
        // Asignado a una sola área: entra directo a esa área (sin pasar por el detalle
        // del proyecto, que tiene botones de editar/eliminar que no debe ver).
        navigation.navigate('AreaProyecto', { empresa, proyecto, area: proyecto.misAreas[0], usuario });
      } else {
        // Asignado a varias áreas del mismo proyecto: deja elegir cuál abrir.
        Alert.alert(
          proyecto.nombre,
          'Estás asignado a varias áreas de este proyecto. ¿Cuál quieres abrir?',
          proyecto.misAreas
            .map((area) => ({
              text: area.nombre,
              onPress: () => navigation.navigate('AreaProyecto', { empresa, proyecto, area, usuario }),
            }))
            .concat([{ text: 'Cancelar', style: 'cancel' }])
        );
      }
    } else {
      navigation.navigate('DetalleProyecto', { empresa, proyecto, usuario });
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

  const cerrarMenuProyecto = () => setMenuProyecto(null);

  // Eliminar proyecto: solo Gerencia. Borra el proyecto y todo lo que cuelga de él (fotos,
  // planos 3D, chat, equipo asignado, estadísticas), pero el contrato que lo originó (si
  // existe) se conserva: queda desvinculado y se puede volver a crear el proyecto desde la
  // pantalla de Contratos con el botón "Crear Proyecto".
  const confirmarEliminarProyecto = () => {
    const proyecto = menuProyecto;
    cerrarMenuProyecto();
    Alert.alert(
      'Eliminar proyecto',
      `¿Eliminar "${proyecto.nombre}"? Se borrarán sus fotos, planos 3D, chat y equipo asignado. Si tiene un contrato, este se conserva y podrás volver a crear el proyecto desde la pantalla de Contratos. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setEliminando(true);
            try {
              await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${proyecto.id}`, {
                data: { usuario_id: usuario?.id },
              });
              cargarDatos();
            } catch (error) {
              console.error('Error eliminando proyecto:', error);
              const mensaje = error.response?.data?.error || 'No se pudo eliminar el proyecto.';
              Alert.alert('Error', mensaje);
            } finally {
              setEliminando(false);
            }
          },
        },
      ]
    );
  };

  const textoNormalizado = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const busquedaNormalizada = textoNormalizado(busqueda);
  const proyectosFiltrados = busquedaNormalizada
    ? proyectos.filter((p) => textoNormalizado(p.nombre).includes(busquedaNormalizada))
    : proyectos;

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
      <View style={styles.buscadorContainer}>
        <TextInput
          style={styles.buscadorInput}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="🔍 Buscar proyecto..."
          placeholderTextColor="#999"
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {proyectosFiltrados.length === 0 ? (
          <Text style={styles.vacioTexto}>
            {proyectos.length === 0 ? 'Aún no hay proyectos. Toca "Nuevo Proyecto" para empezar.' : 'No se encontraron proyectos con ese texto.'}
          </Text>
        ) : (
          proyectosFiltrados.map((proyecto) => (
            <TouchableOpacity
              key={proyecto.id}
              style={styles.proyectoCard}
              onPress={() => abrirProyecto(proyecto)}
              onLongPress={() => puedeEliminar && !accesoReducido && setMenuProyecto(proyecto)}
            >
              <Text style={styles.proyectoNombre}>{proyecto.nombre}</Text>
              {proyecto.direccion ? <Text style={styles.proyectoDireccion}>{proyecto.direccion}</Text> : null}
              {proyecto.area_m2 ? <Text style={styles.proyectoArea}>{proyecto.area_m2} m²</Text> : null}
              {accesoReducido && proyecto.misAreas && (
                <Text style={styles.proyectoDireccion}>
                  {proyecto.misAreas.map((a) => a.nombre).join(', ')}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {puedeGestionar && (
        <TouchableOpacity style={[styles.botonAgregar, { bottom: Math.max(insets.bottom, 20) }]} onPress={() => setModalVisible(true)}>
          <Text style={styles.botonAgregarTexto}>NUEVO PROYECTO</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Nuevo Proyecto</Text>

            <Text style={styles.label}>Nombre del Proyecto *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Casa modelo 123" placeholderTextColor="#999" />

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

      <Modal visible={!!menuProyecto} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenuProyecto}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>{menuProyecto?.nombre}</Text>
            <TouchableOpacity style={styles.menuOpcion} onPress={confirmarEliminarProyecto} disabled={eliminando}>
              <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>
                {eliminando ? 'Eliminando...' : '🗑️  Eliminar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenuProyecto}>
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
  scrollContent: { padding: 16, paddingBottom: 100 },
  buscadorContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  buscadorInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
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
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 14, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
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