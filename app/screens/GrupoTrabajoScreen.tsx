import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import InputCelular, { detectarPaisPorDispositivo, PAISES } from '../components/InputCelular';

export default function GrupoTrabajoScreen({ route }) {
  const { empresa } = route.params;
  const [personal, setPersonal] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [areasSeleccionadas, setAreasSeleccionadas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const [menuPersona, setMenuPersona] = useState(null);

  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editCelular, setEditCelular] = useState('');
  const [editPaisCelular, setEditPaisCelular] = useState(detectarPaisPorDispositivo());
  const [editAreasSeleccionadas, setEditAreasSeleccionadas] = useState([]);
  const [editandoPersona, setEditandoPersona] = useState(null);

  // Separa un celular guardado ("+57 3002100000") en { pais, numero }
  const separarCelular = (celularCompleto) => {
    const encontrado = PAISES.find((p) => celularCompleto.startsWith(p.prefijo));
    if (encontrado) {
      const numero = celularCompleto.replace(encontrado.prefijo, '').trim();
      return { pais: encontrado, numero };
    }
    return { pais: detectarPaisPorDispositivo(), numero: celularCompleto };
  };

  const [modalProyectosVisible, setModalProyectosVisible] = useState(false);
  const [proyectosAsignados, setProyectosAsignados] = useState([]);
  const [cargandoProyectos, setCargandoProyectos] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resPersonal, resAreas] = await Promise.all([
        axios.get(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/${empresa.id}`),
        axios.get('https://backend-app-mediterraneo.onrender.com/api/areas'),
      ]);
      setPersonal(resPersonal.data.personal);
      setAreas(resAreas.data.areas);
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudo cargar el grupo de trabajo.');
    } finally {
      setCargando(false);
    }
  };

  const toggleArea = (areaId) => {
    setAreasSeleccionadas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const toggleEditArea = (areaId) => {
    setEditAreasSeleccionadas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const limpiarFormulario = () => {
    setNombre('');
    setCelular('');
    setPaisCelular(detectarPaisPorDispositivo());
    setAreasSeleccionadas([]);
  };

  const enviarInvitaciones = async () => {
    setGuardando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      for (const areaId of areasSeleccionadas) {
        await axios.post('https://backend-app-mediterraneo.onrender.com/api/invitaciones/generar', {
          empresa_id: empresa.id,
          area_id: areaId,
          nombre_invitado: nombre,
          celular_invitado: celularCompleto,
        });
      }
      Alert.alert('¡Listo!', `Invitación generada para ${nombre}. Cópiala y envíasela por WhatsApp.`);
      setModalVisible(false);
      limpiarFormulario();
      cargarDatos();
    } catch (error) {
      console.error('Error agregando personal:', error);
      Alert.alert('Error', 'No se pudo agregar el personal. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const agregarPersonal = async () => {
    if (!nombre.trim() || !celular.trim() || areasSeleccionadas.length === 0) {
      Alert.alert('Campos incompletos', 'Nombre, celular y al menos un área son obligatorios.');
      return;
    }

    setGuardando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const verificacion = await axios.get(
        `https://backend-app-mediterraneo.onrender.com/api/areas/verificar-celular/${empresa.id}/${encodeURIComponent(celularCompleto)}`
      );

      if (verificacion.data.existe) {
        setGuardando(false);
        const estadoTexto = verificacion.data.estado === 'activo' ? 'ya está en el equipo (activo)' : 'tiene una invitación pendiente sin aceptar';
        Alert.alert(
          'Este número ya existe',
          `El celular ${celularCompleto} pertenece a "${verificacion.data.nombre}", quien ${estadoTexto} en el área de ${verificacion.data.areas.join(', ')}.\n\n¿Deseas continuar y agregarlo a una nueva área de todas formas?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: () => enviarInvitaciones() },
          ]
        );
        return;
      }

      await enviarInvitaciones();
    } catch (error) {
      setGuardando(false);
      console.error('Error verificando celular:', error);
      Alert.alert('Error', 'No se pudo verificar el celular. Intenta de nuevo.');
    }
  };

  const abrirMenu = (persona) => {
    setMenuPersona(persona);
  };

  const cerrarMenu = () => {
    setMenuPersona(null);
  };

  const verProyectosAsignados = async (persona) => {
    if (persona.estado !== 'vinculado') {
      Alert.alert('Sin proyectos todavía', 'Esta persona está pendiente de aceptar la invitación, por eso no puede estar asignada a proyectos aún.');
      return;
    }
    setModalProyectosVisible(true);
    setCargandoProyectos(true);
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/asignaciones/${persona.usuario_id}`);
      setProyectosAsignados(res.data.asignaciones);
    } catch (error) {
      console.error('Error obteniendo proyectos asignados:', error);
      Alert.alert('Error', 'No se pudieron cargar los proyectos asignados.');
    } finally {
      setCargandoProyectos(false);
    }
  };

  const abrirEditar = (persona) => {
    cerrarMenu();
    setEditandoPersona(persona);
    setEditNombre(persona.nombre);
    const { pais, numero } = separarCelular(persona.celular);
    setEditCelular(numero);
    setEditPaisCelular(pais);
    const areasDeEstaPersona = personal
      .filter((p) => p.nombre === persona.nombre && p.celular === persona.celular && p.estado === persona.estado)
      .map((p) => p.area_id);
    setEditAreasSeleccionadas(areasDeEstaPersona);
    setModalEditarVisible(true);
  };

  const guardarEdicion = async () => {
    if (!editNombre.trim() || !editCelular.trim() || editAreasSeleccionadas.length === 0) {
      Alert.alert('Campos incompletos', 'Nombre, celular y al menos un área son obligatorios.');
      return;
    }

    setGuardando(true);
    try {
      if (editandoPersona.estado === 'pendiente') {
        const nuevaArea = editAreasSeleccionadas[0];
        await axios.put(`https://backend-app-mediterraneo.onrender.com/api/invitaciones/${editandoPersona.rol_id}`, {
          nombre_invitado: editNombre,
          celular_invitado: `${editPaisCelular.prefijo} ${editCelular}`,
          area_id: nuevaArea,
        });
      } else {
        await axios.put(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${editandoPersona.usuario_id}/nombre`, {
          nombre: editNombre,
        });

        const areasActuales = personal
          .filter((p) => p.usuario_id === editandoPersona.usuario_id && p.estado === 'vinculado')
          .map((p) => ({ area_id: p.area_id, rol_id: p.rol_id }));

        const idsActuales = areasActuales.map((a) => a.area_id);
        const nuevasAreas = editAreasSeleccionadas.filter((id) => !idsActuales.includes(id));
        const areasQuitadas = areasActuales.filter((a) => !editAreasSeleccionadas.includes(a.area_id));

        for (const areaId of nuevasAreas) {
          await axios.post(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${editandoPersona.usuario_id}/areas`, {
            empresa_id: empresa.id,
            area_id: areaId,
          });
        }

        for (const areaQuitada of areasQuitadas) {
          await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${areaQuitada.rol_id}`);
        }
      }

      Alert.alert('¡Listo!', 'Cambios guardados exitosamente.');
      setModalEditarVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error guardando edición:', error);
      const mensajeError = error.response?.data?.error || 'No se pudieron guardar los cambios.';
      Alert.alert('Error', mensajeError);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = (persona) => {
    cerrarMenu();
    const mensaje =
      persona.estado === 'pendiente'
        ? `¿Eliminar la invitación de ${persona.nombre}? Ya no podrá ingresar con el link enviado.`
        : `¿Eliminar a ${persona.nombre} del equipo? Ya no podrá ingresar a la app con su número, pero se conservará su historial en proyectos anteriores.`;

    Alert.alert('Eliminar persona', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminarPersona(persona) },
    ]);
  };

  const eliminarPersona = async (persona) => {
    try {
      if (persona.estado === 'pendiente') {
        await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/invitaciones/${persona.rol_id}`);
      } else {
        await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${persona.rol_id}?todas=true`);
      }
      cargarDatos();
    } catch (error) {
      console.error('Error eliminando persona:', error);
      Alert.alert('Error', 'No se pudo eliminar a esta persona.');
    }
  };

  const personalPorArea = personal.reduce((grupos, persona) => {
    const area = persona.area_nombre;
    if (!grupos[area]) grupos[area] = [];
    grupos[area].push(persona);
    return grupos;
  }, {});

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
        {Object.keys(personalPorArea).length === 0 ? (
          <Text style={styles.vacioTexto}>Aún no hay personal agregado. Toca "Agregar Personal" para empezar.</Text>
        ) : (
          Object.keys(personalPorArea).map((area) => (
            <View key={area} style={styles.grupoArea}>
              <Text style={styles.areaTitulo}>{area}</Text>
              {personalPorArea[area].map((persona) => (
                <TouchableOpacity
                  key={`${persona.estado}-${persona.rol_id}`}
                  style={styles.personaCard}
                  onPress={() => verProyectosAsignados(persona)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaNombre}>{persona.nombre}</Text>
                    <Text style={styles.personaCelular}>{persona.celular}</Text>
                  </View>
                  <View
                    style={[
                      styles.etiquetaEstado,
                      persona.estado === 'vinculado' ? styles.etiquetaVinculado : styles.etiquetaPendiente,
                    ]}
                  >
                    <Text style={styles.etiquetaTexto}>
                      {persona.estado === 'vinculado' ? 'Vinculado' : 'Pendiente'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.botonMenu} onPress={() => abrirMenu(persona)}>
                    <Text style={styles.botonMenuTexto}>⋮</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.botonAgregar} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonAgregarTexto}>AGREGAR PERSONAL</Text>
      </TouchableOpacity>

      <Modal visible={!!menuPersona} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitulo}>{menuPersona?.nombre}</Text>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => abrirEditar(menuPersona)}>
              <Text style={styles.menuOpcionTexto}>✏️  Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => confirmarEliminar(menuPersona)}>
              <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Agregar Personal</Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre completo" placeholderTextColor="#999" />

            <Text style={styles.label}>Número de celular *</Text>
            <InputCelular
              numero={celular}
              onChangeNumero={setCelular}
              pais={paisCelular}
              onChangePais={setPaisCelular}
            />

            <Text style={styles.label}>Área(s) *</Text>
            <View style={styles.areasLista}>
              {areas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.areaOpcion,
                    areasSeleccionadas.includes(area.id) && styles.areaOpcionSeleccionada,
                  ]}
                  onPress={() => toggleArea(area.id)}
                >
                  <Text
                    style={[
                      styles.areaOpcionTexto,
                      areasSeleccionadas.includes(area.id) && styles.areaOpcionTextoSeleccionado,
                    ]}
                  >
                    {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.botonGuardar} onPress={agregarPersonal} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GENERAR INVITACIÓN</Text>}
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

      <Modal visible={modalEditarVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Editar Persona</Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={editNombre} onChangeText={setEditNombre} placeholderTextColor="#999" />

            <Text style={styles.label}>Número de celular *</Text>
            <InputCelular
              numero={editCelular}
              onChangeNumero={setEditCelular}
              pais={editPaisCelular}
              onChangePais={setEditPaisCelular}
              disabled={editandoPersona?.estado === 'vinculado'}
            />
            {editandoPersona?.estado === 'vinculado' && (
              <Text style={styles.notaTexto}>El celular de una persona ya vinculada no se puede cambiar aquí.</Text>
            )}

            <Text style={styles.label}>Área(s) *</Text>
            <View style={styles.areasLista}>
              {areas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.areaOpcion,
                    editAreasSeleccionadas.includes(area.id) && styles.areaOpcionSeleccionada,
                  ]}
                  onPress={() => toggleEditArea(area.id)}
                >
                  <Text
                    style={[
                      styles.areaOpcionTexto,
                      editAreasSeleccionadas.includes(area.id) && styles.areaOpcionTextoSeleccionado,
                    ]}
                  >
                    {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarEdicion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalEditarVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalProyectosVisible} animationType="slide" transparent>
        <View style={styles.proyectosOverlay}>
          <View style={styles.proyectosBox}>
            <Text style={styles.modalTitulo}>Proyectos asignados</Text>
            {cargandoProyectos ? (
              <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginVertical: 20 }} />
            ) : proyectosAsignados.length === 0 ? (
              <Text style={styles.vacioTexto}>No está asignada a ningún proyecto en este momento.</Text>
            ) : (
              proyectosAsignados.map((asig, index) => (
                <View key={index} style={styles.proyectoAsignadoCard}>
                  <Text style={styles.proyectoAsignadoNombre}>{asig.proyecto_nombre}</Text>
                  <Text style={styles.proyectoAsignadoArea}>{asig.area_nombre}</Text>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalProyectosVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cerrar</Text>
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
  scrollContent: { padding: 16, paddingBottom: 100 },
  vacioTexto: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  grupoArea: { marginBottom: 20 },
  areaTitulo: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 8, textTransform: 'uppercase' },
  personaCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personaNombre: { fontSize: 15, fontWeight: '600', color: '#222' },
  personaCelular: { fontSize: 13, color: '#777', marginTop: 2 },
  etiquetaEstado: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginLeft: 8 },
  etiquetaVinculado: { backgroundColor: '#c8e6c9' },
  etiquetaPendiente: { backgroundColor: '#ffe0b2' },
  etiquetaTexto: { fontSize: 11, fontWeight: 'bold', color: '#333' },
  botonMenu: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
  botonMenuTexto: { fontSize: 20, color: '#999', fontWeight: 'bold' },
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
  inputDeshabilitado: { backgroundColor: '#eee', color: '#999' },
  notaTexto: { fontSize: 12, color: '#999', marginTop: 4 },
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
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#888', marginBottom: 12, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#222', textAlign: 'center' },
  proyectosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  proyectosBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '70%' },
  proyectoAsignadoCard: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 8 },
  proyectoAsignadoNombre: { fontSize: 15, fontWeight: '600', color: '#222' },
  proyectoAsignadoArea: { fontSize: 13, color: '#777', marginTop: 2 },
});