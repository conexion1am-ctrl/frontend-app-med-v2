import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import InputCelular, { detectarPaisPorDispositivo, PAISES } from '../components/InputCelular';
import { permisosDe } from '../utils/roles';

export default function ClientesScreen({ route }) {
  const { empresa, usuario } = route.params;
  const permisos = permisosDe(empresa);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [nombreProyecto, setNombreProyecto] = useState('');
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [guardando, setGuardando] = useState(false);

  const [menuCliente, setMenuCliente] = useState(null);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState(null);
  const [editNombreProyecto, setEditNombreProyecto] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editCelular, setEditCelular] = useState('');
  const [editPaisCelular, setEditPaisCelular] = useState(detectarPaisPorDispositivo());

  useEffect(() => {
    cargarDatos();
  }, []);

  const separarCelular = (celularCompleto) => {
    const encontrado = PAISES.find((p) => celularCompleto?.startsWith(p.prefijo));
    if (encontrado) {
      return { pais: encontrado, numero: celularCompleto.replace(encontrado.prefijo, '').trim() };
    }
    return { pais: detectarPaisPorDispositivo(), numero: celularCompleto || '' };
  };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/clientes/listar/${empresa.id}`);
      setClientes(res.data.clientes);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      Alert.alert('Error', 'No se pudieron cargar los clientes.');
    } finally {
      setCargando(false);
    }
  };

  const limpiarFormulario = () => {
    setNombreProyecto('');
    setNombre('');
    setCelular('');
    setPaisCelular(detectarPaisPorDispositivo());
  };

  const crearCliente = async () => {
    if (!nombre.trim()) {
      Alert.alert('Campo obligatorio', 'El nombre del cliente es obligatorio.');
      return;
    }

    setGuardando(true);
    try {
      await axios.post('https://backend-app-mediterraneo.onrender.com/api/clientes/crear', {
        empresa_id: empresa.id,
        nombre,
        nombre_proyecto: nombreProyecto || null,
        celular: celular ? `${paisCelular.prefijo} ${celular}` : null,
      });
      Alert.alert('¡Listo!', 'Cliente creado exitosamente.');
      setModalVisible(false);
      limpiarFormulario();
      cargarDatos();
    } catch (error) {
      console.error('Error creando cliente:', error);
      Alert.alert('Error', 'No se pudo crear el cliente. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const llamarCliente = (celularCompleto) => {
    if (!celularCompleto) return;
    Linking.openURL(`tel:${celularCompleto.replace(/\s/g, '')}`);
  };

  const abrirMenu = (cliente) => setMenuCliente(cliente);
  const cerrarMenu = () => setMenuCliente(null);

  const abrirEditar = (cliente) => {
    cerrarMenu();
    setEditandoCliente(cliente);
    setEditNombreProyecto(cliente.nombre_proyecto || '');
    setEditNombre(cliente.nombre);
    const { pais, numero } = separarCelular(cliente.celular);
    setEditPaisCelular(pais);
    setEditCelular(numero);
    setModalEditarVisible(true);
  };

  const guardarEdicion = async () => {
    if (!editNombre.trim()) {
      Alert.alert('Campo obligatorio', 'El nombre del cliente es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/clientes/${editandoCliente.id}`, {
        nombre: editNombre,
        nombre_proyecto: editNombreProyecto || null,
        celular: editCelular ? `${editPaisCelular.prefijo} ${editCelular}` : null,
      });
      setModalEditarVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error editando cliente:', error);
      Alert.alert('Error', 'No se pudo actualizar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = (cliente) => {
    cerrarMenu();
    Alert.alert('Eliminar cliente', `¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/clientes/${cliente.id}`, {
              data: { usuario_id: usuario?.id },
            });
            cargarDatos();
          } catch (error) {
            console.error('Error eliminando cliente:', error);
            const mensaje = error.response?.data?.error || 'No se pudo eliminar el cliente.';
            Alert.alert('Error', mensaje);
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

  return (
    <View style={[styles.container, { backgroundColor: empresa.color_hex || '#1E90FF' }]}>
      <EncabezadoLogo empresa={empresa} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {clientes.length === 0 ? (
          <Text style={styles.vacioTexto}>Aún no hay clientes. Toca "Nuevo Cliente" para empezar.</Text>
        ) : (
          clientes.map((cliente) => (
            <View key={cliente.id} style={styles.clienteCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clienteProyectoNombre}>
                  {cliente.nombre_proyecto || 'Sin nombre de proyecto'}
                </Text>
                <Text style={styles.clienteNombre}>{cliente.nombre}</Text>
                {cliente.celular ? (
                  <TouchableOpacity onPress={() => llamarCliente(cliente.celular)}>
                    <Text style={styles.clienteCelular}>📞 {cliente.celular}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity style={styles.botonMenu} onPress={() => abrirMenu(cliente)}>
                <Text style={styles.botonMenuTexto}>⋮</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.botonAgregar} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonAgregarTexto}>NUEVO CLIENTE</Text>
      </TouchableOpacity>

      {/* MENÚ 3 PUNTOS */}
      <Modal visible={!!menuCliente} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitulo}>{menuCliente?.nombre}</Text>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => abrirEditar(menuCliente)}>
              <Text style={styles.menuOpcionTexto}>✏️  Editar</Text>
            </TouchableOpacity>
            {permisos.eliminarClientes && (
              <TouchableOpacity style={styles.menuOpcion} onPress={() => confirmarEliminar(menuCliente)}>
                <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Nuevo cliente */}
      <Modal visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Nuevo Cliente</Text>

            <Text style={styles.label}>Nombre del proyecto</Text>
            <TextInput
              style={styles.input}
              value={nombreProyecto}
              onChangeText={setNombreProyecto}
              placeholder="Ej: Llano Azul Casa 430"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Nombre del cliente *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre completo" placeholderTextColor="#999" />

            <Text style={styles.label}>Número de celular (opcional)</Text>
            <InputCelular numero={celular} onChangeNumero={setCelular} pais={paisCelular} onChangePais={setPaisCelular} />

            <TouchableOpacity style={styles.botonGuardar} onPress={crearCliente} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>CREAR CLIENTE</Text>}
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

      {/* MODAL: Editar cliente */}
      <Modal visible={modalEditarVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Editar Cliente</Text>

            <Text style={styles.label}>Nombre del proyecto</Text>
            <TextInput
              style={styles.input}
              value={editNombreProyecto}
              onChangeText={setEditNombreProyecto}
              placeholder="Ej: Llano Azul Casa 430"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Nombre del cliente *</Text>
            <TextInput style={styles.input} value={editNombre} onChangeText={setEditNombre} placeholderTextColor="#999" />

            <Text style={styles.label}>Número de celular (opcional)</Text>
            <InputCelular numero={editCelular} onChangeNumero={setEditCelular} pais={editPaisCelular} onChangePais={setEditPaisCelular} />

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarEdicion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalEditarVisible(false)}>
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
  clienteCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  clienteProyectoNombre: { fontSize: 16, fontWeight: 'bold', color: '#1E90FF' },
  clienteNombre: { fontSize: 15, fontWeight: '600', color: '#222', marginTop: 4 },
  clienteCelular: { fontSize: 13, color: '#2e7d32', marginTop: 4, fontWeight: '600' },
  botonMenu: { paddingHorizontal: 10, paddingVertical: 4 },
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
});
