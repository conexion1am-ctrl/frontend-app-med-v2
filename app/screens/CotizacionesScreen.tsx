import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';

const formatearMoneda = (valor) => {
  const numero = parseFloat(valor) || 0;
  return numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
};

export default function CotizacionesScreen({ route }) {
  const { empresa } = route.params;
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [numero, setNumero] = useState('');
  const [items, setItems] = useState([{ descripcion: '', valor: '' }]);
  const [guardando, setGuardando] = useState(false);

  const [menuCotizacion, setMenuCotizacion] = useState(null);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [editandoCotizacion, setEditandoCotizacion] = useState(null);
  const [editNumero, setEditNumero] = useState('');
  const [editItems, setEditItems] = useState([{ descripcion: '', valor: '' }]);

  const [modalAdicionalesVisible, setModalAdicionalesVisible] = useState(false);
  const [cotizacionAdicionales, setCotizacionAdicionales] = useState(null);
  const [itemsAdicionales, setItemsAdicionales] = useState([{ descripcion: '', valor: '' }]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resCotizaciones, resClientes] = await Promise.all([
        axios.get(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/listar/${empresa.id}`),
        axios.get(`https://backend-app-mediterraneo.onrender.com/api/clientes/listar/${empresa.id}`),
      ]);
      setCotizaciones(resCotizaciones.data.cotizaciones);
      setClientes(resClientes.data.clientes);
    } catch (error) {
      console.error('Error cargando cotizaciones:', error);
      Alert.alert('Error', 'No se pudieron cargar las cotizaciones.');
    } finally {
      setCargando(false);
    }
  };

  const limpiarFormulario = () => {
    setClienteSeleccionado(null);
    setNumero('');
    setItems([{ descripcion: '', valor: '' }]);
  };

  const actualizarItem = (index, campo, valor) => {
    const nuevosItems = [...items];
    nuevosItems[index][campo] = valor;
    setItems(nuevosItems);
  };

  const agregarItem = () => {
    setItems([...items, { descripcion: '', valor: '' }]);
  };

  const quitarItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const totalCotizacion = items.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);
  const totalEditCotizacion = editItems.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);

  const crearCotizacion = async () => {
    if (!clienteSeleccionado) {
      Alert.alert('Campo obligatorio', 'Selecciona un cliente.');
      return;
    }
    const itemsValidos = items.filter((i) => i.descripcion.trim() && i.valor);
    if (itemsValidos.length === 0) {
      Alert.alert('Campos incompletos', 'Agrega al menos un ítem con descripción y valor.');
      return;
    }

    setGuardando(true);
    try {
      await axios.post('https://backend-app-mediterraneo.onrender.com/api/cotizaciones/crear', {
        empresa_id: empresa.id,
        cliente_id: clienteSeleccionado,
        numero: numero || null,
        items: itemsValidos,
      });
      Alert.alert('¡Listo!', 'Cotización creada exitosamente.');
      setModalVisible(false);
      limpiarFormulario();
      cargarDatos();
    } catch (error) {
      console.error('Error creando cotización:', error);
      Alert.alert('Error', 'No se pudo crear la cotización.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirMenu = (cot) => setMenuCotizacion(cot);
  const cerrarMenu = () => setMenuCotizacion(null);

  const abrirEditar = async (cot) => {
    cerrarMenu();
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/${cot.id}`);
      setEditandoCotizacion(cot);
      setEditNumero(cot.numero || '');
      setEditItems(res.data.items.map((i) => ({ descripcion: i.descripcion, valor: String(i.valor) })));
      setModalEditarVisible(true);
    } catch (error) {
      console.error('Error cargando cotización:', error);
      Alert.alert('Error', 'No se pudo cargar la cotización para editar.');
    }
  };

  const actualizarEditItem = (index, campo, valor) => {
    const nuevos = [...editItems];
    nuevos[index][campo] = valor;
    setEditItems(nuevos);
  };

  const agregarEditItem = () => setEditItems([...editItems, { descripcion: '', valor: '' }]);

  const quitarEditItem = (index) => {
    if (editItems.length === 1) return;
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const guardarEdicion = async () => {
    const itemsValidos = editItems.filter((i) => i.descripcion.trim() && i.valor);
    if (itemsValidos.length === 0) {
      Alert.alert('Campos incompletos', 'Agrega al menos un ítem con descripción y valor.');
      return;
    }
    setGuardando(true);
    try {
      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/${editandoCotizacion.id}`, {
        numero: editNumero || null,
        items: itemsValidos,
      });
      setModalEditarVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error editando cotización:', error);
      const mensaje = error.response?.data?.error || 'No se pudo editar la cotización.';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const abrirAdicionales = (cot) => {
    cerrarMenu();
    setCotizacionAdicionales(cot);
    setItemsAdicionales([{ descripcion: '', valor: '' }]);
    setModalAdicionalesVisible(true);
  };

  const actualizarItemAdicional = (index, campo, valor) => {
    const nuevos = [...itemsAdicionales];
    nuevos[index][campo] = valor;
    setItemsAdicionales(nuevos);
  };

  const agregarItemAdicional = () => setItemsAdicionales([...itemsAdicionales, { descripcion: '', valor: '' }]);

  const quitarItemAdicional = (index) => {
    if (itemsAdicionales.length === 1) return;
    setItemsAdicionales(itemsAdicionales.filter((_, i) => i !== index));
  };

  const totalItemsAdicionales = itemsAdicionales.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);

  const guardarAdicionales = async () => {
    const itemsValidos = itemsAdicionales.filter((i) => i.descripcion.trim() && i.valor);
    if (itemsValidos.length === 0) {
      Alert.alert('Campos incompletos', 'Agrega al menos un ítem con descripción y valor.');
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/${cotizacionAdicionales.id}/adicionales`, {
        items: itemsValidos,
      });
      Alert.alert('¡Listo!', 'Ítems adicionales agregados. El contrato fue actualizado.');
      setModalAdicionalesVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error agregando adicionales:', error);
      const mensaje = error.response?.data?.error || 'No se pudieron agregar los adicionales.';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = (cot) => {
    cerrarMenu();
    if (cot.aceptada) {
      Alert.alert('No se puede eliminar', 'Esta cotización ya fue aceptada y generó un contrato.');
      return;
    }
    Alert.alert('Eliminar cotización', `¿Eliminar la cotización de ${cot.cliente_nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/${cot.id}`);
            cargarDatos();
          } catch (error) {
            console.error('Error eliminando cotización:', error);
            const mensaje = error.response?.data?.error || 'No se pudo eliminar la cotización.';
            Alert.alert('Error', mensaje);
          }
        },
      },
    ]);
  };

  const aceptarCotizacion = (cotizacion) => {
    Alert.alert(
      'Aceptar cotización',
      `¿Confirmas que ${cotizacion.cliente_nombre} aceptó la cotización de ${empresa.nombre}? Esto generará un contrato automáticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            try {
              await axios.post(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/${cotizacion.id}/aceptar`, {});
              Alert.alert('¡Listo!', 'Contrato generado exitosamente.');
              cargarDatos();
            } catch (error) {
              console.error('Error aceptando cotización:', error);
              const mensaje = error.response?.data?.error || 'No se pudo aceptar la cotización.';
              Alert.alert('Error', mensaje);
            }
          },
        },
      ]
    );
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
        {cotizaciones.length === 0 ? (
          <Text style={styles.vacioTexto}>Aún no hay cotizaciones. Toca "Nueva Cotización" para empezar.</Text>
        ) : (
          cotizaciones.map((cot) => (
            <View key={cot.id} style={styles.cotizacionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cotizacionCliente}>{cot.cliente_nombre}</Text>
                {cot.numero ? <Text style={styles.cotizacionNumero}>N° {cot.numero}</Text> : null}
                <Text style={styles.cotizacionTotal}>{formatearMoneda(cot.total)}</Text>
                <View
                  style={[
                    styles.etiquetaEstado,
                    cot.aceptada ? styles.etiquetaAceptada : styles.etiquetaPendiente,
                  ]}
                >
                  <Text style={styles.etiquetaTexto}>{cot.aceptada ? 'Aceptada' : 'Pendiente'}</Text>
                </View>
              </View>
              {!cot.aceptada && (
                <TouchableOpacity style={styles.botonAceptar} onPress={() => aceptarCotizacion(cot)}>
                  <Text style={styles.botonAceptarTexto}>Aceptar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.botonMenu} onPress={() => abrirMenu(cot)}>
                <Text style={styles.botonMenuTexto}>⋮</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.botonAgregar} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonAgregarTexto}>NUEVA COTIZACIÓN</Text>
      </TouchableOpacity>

      {/* MENÚ 3 PUNTOS */}
      <Modal visible={!!menuCotizacion} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitulo}>{menuCotizacion?.cliente_nombre}</Text>
            {menuCotizacion?.aceptada ? (
              <>
                <Text style={styles.menuNotaTexto}>Esta cotización ya fue aceptada y no se puede editar ni eliminar.</Text>
                <TouchableOpacity style={styles.menuOpcion} onPress={() => abrirAdicionales(menuCotizacion)}>
                  <Text style={styles.menuOpcionTexto}>➕  Agregar adicionales</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.menuOpcion} onPress={() => abrirEditar(menuCotizacion)}>
                  <Text style={styles.menuOpcionTexto}>✏️  Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuOpcion} onPress={() => confirmarEliminar(menuCotizacion)}>
                  <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Nueva Cotización</Text>

            <Text style={styles.label}>Cliente *</Text>
            {clientes.length === 0 ? (
              <Text style={styles.notaTexto}>No hay clientes creados. Ve primero a la pantalla de Clientes.</Text>
            ) : (
              <View style={styles.opcionesLista}>
                {clientes.map((cliente) => (
                  <TouchableOpacity
                    key={cliente.id}
                    style={[styles.opcion, clienteSeleccionado === cliente.id && styles.opcionSeleccionada]}
                    onPress={() => setClienteSeleccionado(cliente.id)}
                  >
                    <Text style={[styles.opcionTexto, clienteSeleccionado === cliente.id && styles.opcionTextoSeleccionado]}>
                      {cliente.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Número de cotización (opcional)</Text>
            <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholder="Ej: COT-001" placeholderTextColor="#999" />

            <Text style={styles.label}>Ítems de la cotización *</Text>
            {items.map((item, index) => (
              <View key={index} style={styles.itemFila}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  value={item.descripcion}
                  onChangeText={(texto) => actualizarItem(index, 'descripcion', texto)}
                  placeholder="Descripción"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={item.valor}
                  onChangeText={(texto) => actualizarItem(index, 'valor', texto.replace(/[^0-9.]/g, ''))}
                  placeholder="Valor"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => quitarItem(index)} style={styles.botonQuitarItem}>
                    <Text style={styles.botonQuitarItemTexto}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.botonAgregarItem} onPress={agregarItem}>
              <Text style={styles.botonAgregarItemTexto}>+ Agregar ítem</Text>
            </TouchableOpacity>

            <Text style={styles.totalTexto}>Total: {formatearMoneda(totalCotizacion)}</Text>

            <TouchableOpacity style={styles.botonGuardar} onPress={crearCotizacion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>CREAR COTIZACIÓN</Text>}
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

      {/* MODAL: Editar cotización */}
      <Modal visible={modalEditarVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Editar Cotización</Text>
            <Text style={styles.notaTexto}>Cliente: {editandoCotizacion?.cliente_nombre}</Text>

            <Text style={styles.label}>Número de cotización (opcional)</Text>
            <TextInput style={styles.input} value={editNumero} onChangeText={setEditNumero} placeholder="Ej: COT-001" placeholderTextColor="#999" />

            <Text style={styles.label}>Ítems de la cotización *</Text>
            {editItems.map((item, index) => (
              <View key={index} style={styles.itemFila}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  value={item.descripcion}
                  onChangeText={(texto) => actualizarEditItem(index, 'descripcion', texto)}
                  placeholder="Descripción"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={item.valor}
                  onChangeText={(texto) => actualizarEditItem(index, 'valor', texto.replace(/[^0-9.]/g, ''))}
                  placeholder="Valor"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                {editItems.length > 1 && (
                  <TouchableOpacity onPress={() => quitarEditItem(index)} style={styles.botonQuitarItem}>
                    <Text style={styles.botonQuitarItemTexto}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.botonAgregarItem} onPress={agregarEditItem}>
              <Text style={styles.botonAgregarItemTexto}>+ Agregar ítem</Text>
            </TouchableOpacity>

            <Text style={styles.totalTexto}>Total: {formatearMoneda(totalEditCotizacion)}</Text>

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarEdicion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalEditarVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: Agregar adicionales a cotización ya aceptada */}
      <Modal visible={modalAdicionalesVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Agregar Adicionales</Text>
            <Text style={styles.notaTexto}>
              Cliente: {cotizacionAdicionales?.cliente_nombre}{'\n'}
              Estos ítems se sumarán al total y actualizarán el contrato automáticamente.
            </Text>

            <Text style={styles.label}>Ítems adicionales *</Text>
            {itemsAdicionales.map((item, index) => (
              <View key={index} style={styles.itemFila}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  value={item.descripcion}
                  onChangeText={(texto) => actualizarItemAdicional(index, 'descripcion', texto)}
                  placeholder="Descripción"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={item.valor}
                  onChangeText={(texto) => actualizarItemAdicional(index, 'valor', texto.replace(/[^0-9.]/g, ''))}
                  placeholder="Valor"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                {itemsAdicionales.length > 1 && (
                  <TouchableOpacity onPress={() => quitarItemAdicional(index)} style={styles.botonQuitarItem}>
                    <Text style={styles.botonQuitarItemTexto}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.botonAgregarItem} onPress={agregarItemAdicional}>
              <Text style={styles.botonAgregarItemTexto}>+ Agregar ítem</Text>
            </TouchableOpacity>

            <Text style={styles.totalTexto}>Total adicional: {formatearMoneda(totalItemsAdicionales)}</Text>

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarAdicionales} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR ADICIONALES</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalAdicionalesVisible(false)}>
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
  cotizacionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cotizacionCliente: { fontSize: 16, fontWeight: '600', color: '#222' },
  cotizacionNumero: { fontSize: 12, color: '#999', marginTop: 2 },
  cotizacionTotal: { fontSize: 15, fontWeight: 'bold', color: '#1E90FF', marginTop: 4 },
  etiquetaEstado: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 6 },
  etiquetaAceptada: { backgroundColor: '#c8e6c9' },
  etiquetaPendiente: { backgroundColor: '#ffe0b2' },
  etiquetaTexto: { fontSize: 11, fontWeight: 'bold', color: '#333' },
  botonAceptar: { backgroundColor: '#1E90FF', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  botonAceptarTexto: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
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
  notaTexto: { fontSize: 13, color: '#999' },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  opcionesLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  opcion: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  opcionSeleccionada: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  opcionTexto: { fontSize: 13, color: '#555' },
  opcionTextoSeleccionado: { color: '#fff', fontWeight: '600' },
  itemFila: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  botonQuitarItem: { padding: 8 },
  botonQuitarItemTexto: { fontSize: 16, color: '#DC143C', fontWeight: 'bold' },
  botonAgregarItem: { marginTop: 10, padding: 8 },
  botonAgregarItemTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
  totalTexto: { fontSize: 17, fontWeight: 'bold', color: '#222', marginTop: 20, textAlign: 'right' },
  botonGuardar: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
  botonMenu: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 },
  botonMenuTexto: { fontSize: 22, color: '#888', fontWeight: 'bold' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 14, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
  menuNotaTexto: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 14 },
});
