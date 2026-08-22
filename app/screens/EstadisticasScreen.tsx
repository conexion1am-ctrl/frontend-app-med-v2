import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import InputMoneda from '../components/InputMoneda';

const formatearMoneda = (valor) => {
  const numero = parseFloat(valor) || 0;
  return numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
};

const formatearFecha = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = String(d.getUTCFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
};

// Convierte texto escrito como "15-08-26" o "15-08-2026" a formato ISO "2026-08-15" para el backend
const convertirADdMmAaAIso = (texto) => {
  const partes = texto.trim().split('-');
  if (partes.length !== 3) return null;
  let [dia, mes, anio] = partes;
  if (!dia || !mes || !anio) return null;
  if (anio.length === 2) anio = `20${anio}`;
  if (dia.length !== 2 || mes.length !== 2 || anio.length !== 4) return null;
  const diaNum = parseInt(dia, 10);
  const mesNum = parseInt(mes, 10);
  if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) return null;
  return `${anio}-${mes}-${dia}`;
};

// Fecha de hoy en formato DD-MM-AA, para precargar los campos de fecha (el usuario la puede
// editar después si necesita registrar un movimiento con otra fecha).
const fechaHoyDdMmAa = () => {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = String(d.getFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
};

const ETIQUETAS_TIPO_COSTO = { materiales: 'Materiales', mano_obra: 'Mano de obra', imprevistos: 'Imprevistos' };

export default function EstadisticasScreen({ route }) {
  const { empresa } = route.params;
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargandoProyectos, setCargandoProyectos] = useState(true);
  const [cargandoStats, setCargandoStats] = useState(false);
  const [sinDatos, setSinDatos] = useState(false);

  const [modalCostoVisible, setModalCostoVisible] = useState(false);
  const [costoTipo, setCostoTipo] = useState('materiales');
  const [costoDetalle, setCostoDetalle] = useState('');
  const [costoValor, setCostoValor] = useState('');
  const [costoFecha, setCostoFecha] = useState('');
  const [guardandoCosto, setGuardandoCosto] = useState(false);

  // Categorías de costo (Carpintería, Ferretería, Estuco, etc.), reutilizables en toda la
  // empresa — se cargan una vez y se usan como chips seleccionables en el modal de costo, con
  // opción de escribir y crear una nueva al vuelo si no existe todavía.
  const [categorias, setCategorias] = useState([]);
  const [costoCategoriaId, setCostoCategoriaId] = useState(null);
  const [nuevaCategoriaTexto, setNuevaCategoriaTexto] = useState('');
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  const [modalAbonoVisible, setModalAbonoVisible] = useState(false);
  const [abonoValor, setAbonoValor] = useState('');
  const [abonoFecha, setAbonoFecha] = useState('');
  const [guardandoAbono, setGuardandoAbono] = useState(false);

  useEffect(() => {
    cargarProyectos();
    cargarCategorias();
  }, []);

  const cargarCategorias = async () => {
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/estadisticas/categorias/${empresa.id}`);
      setCategorias(res.data.categorias);
    } catch (error) {
      console.error('Error cargando categorías de costo:', error);
    }
  };

  const crearCategoria = async () => {
    if (!nuevaCategoriaTexto.trim()) return;
    setCreandoCategoria(true);
    try {
      const res = await axios.post(`https://backend-app-mediterraneo.onrender.com/api/estadisticas/categorias`, {
        empresa_id: empresa.id,
        nombre: nuevaCategoriaTexto.trim(),
      });
      const nueva = res.data.categoria;
      setCategorias((anteriores) => {
        if (anteriores.some((c) => c.id === nueva.id)) return anteriores;
        return [...anteriores, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre));
      });
      setCostoCategoriaId(nueva.id);
      setNuevaCategoriaTexto('');
    } catch (error) {
      console.error('Error creando categoría de costo:', error);
      Alert.alert('Error', 'No se pudo crear la categoría.');
    } finally {
      setCreandoCategoria(false);
    }
  };

  const cargarProyectos = async () => {
    setCargandoProyectos(true);
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/listar/${empresa.id}`);
      setProyectos(res.data.proyectos);
    } catch (error) {
      console.error('Error cargando proyectos:', error);
      Alert.alert('Error', 'No se pudieron cargar los proyectos.');
    } finally {
      setCargandoProyectos(false);
    }
  };

  const seleccionarProyecto = async (proyecto) => {
    setProyectoSeleccionado(proyecto);
    setCargandoStats(true);
    setSinDatos(false);
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/estadisticas/${proyecto.id}`);
      setEstadisticas(res.data);
    } catch (error) {
      if (error.response?.status === 404) {
        setSinDatos(true);
        setEstadisticas(null);
      } else {
        console.error('Error cargando estadísticas:', error);
        Alert.alert('Error', 'No se pudieron cargar las estadísticas.');
      }
    } finally {
      setCargandoStats(false);
    }
  };

  // Abre el modal para agregar un nuevo movimiento de costo (compra de materiales, pago de
  // mano de obra, o imprevisto), precargado con la categoría elegida y la fecha de hoy.
  const abrirModalCosto = (tipo) => {
    setCostoTipo(tipo);
    setCostoDetalle('');
    setCostoValor('');
    setCostoFecha(fechaHoyDdMmAa());
    setCostoCategoriaId(null);
    setNuevaCategoriaTexto('');
    setModalCostoVisible(true);
  };

  const registrarCosto = async () => {
    if (!costoValor) {
      Alert.alert('Campo obligatorio', 'El valor es obligatorio.');
      return;
    }
    const fechaIso = convertirADdMmAaAIso(costoFecha);
    if (!fechaIso) {
      Alert.alert('Fecha inválida', 'Escribe la fecha en formato DD-MM-AA, por ejemplo: 15-08-26');
      return;
    }
    setGuardandoCosto(true);
    try {
      await axios.post(`https://backend-app-mediterraneo.onrender.com/api/estadisticas/${proyectoSeleccionado.id}/movimiento`, {
        tipo: costoTipo,
        detalle: costoDetalle || null,
        valor: parseFloat(costoValor),
        fecha: fechaIso,
        categoria_id: costoCategoriaId,
      });
      setModalCostoVisible(false);
      seleccionarProyecto(proyectoSeleccionado);
    } catch (error) {
      console.error('Error registrando movimiento de costo:', error);
      const mensaje = error.response?.data?.error || 'No se pudo registrar el costo.';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardandoCosto(false);
    }
  };

  const abrirModalAbono = () => {
    setAbonoValor('');
    setAbonoFecha(fechaHoyDdMmAa());
    setModalAbonoVisible(true);
  };

  const registrarAbono = async () => {
    if (!abonoValor || !abonoFecha) {
      Alert.alert('Campos incompletos', 'Valor y fecha son obligatorios.');
      return;
    }
    const fechaIso = convertirADdMmAaAIso(abonoFecha);
    if (!fechaIso) {
      Alert.alert('Fecha inválida', 'Escribe la fecha en formato DD-MM-AA, por ejemplo: 15-08-26');
      return;
    }
    setGuardandoAbono(true);
    try {
      await axios.post(`https://backend-app-mediterraneo.onrender.com/api/estadisticas/${proyectoSeleccionado.id}/abono`, {
        valor: parseFloat(abonoValor),
        fecha: fechaIso,
      });
      setModalAbonoVisible(false);
      setAbonoValor('');
      setAbonoFecha('');
      seleccionarProyecto(proyectoSeleccionado);
    } catch (error) {
      console.error('Error registrando abono:', error);
      Alert.alert('Error', 'No se pudo registrar el abono.');
    } finally {
      setGuardandoAbono(false);
    }
  };

  if (cargandoProyectos) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} />
      </View>
    );
  }

  // Pantalla 1: elegir proyecto
  if (!proyectoSeleccionado) {
    return (
      <View style={[styles.container, { backgroundColor: empresa.color_hex || '#1E90FF' }]}>
        <EncabezadoLogo empresa={empresa} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.seccionTitulo}>Elige un proyecto para ver sus estadísticas</Text>
          {proyectos.length === 0 ? (
            <Text style={styles.vacioTexto}>Aún no hay proyectos creados.</Text>
          ) : (
            proyectos.map((proyecto) => (
              <TouchableOpacity key={proyecto.id} style={styles.proyectoCard} onPress={() => seleccionarProyecto(proyecto)}>
                <Text style={styles.proyectoNombre}>{proyecto.nombre}</Text>
                <Text style={styles.proyectoFlecha}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // Pantalla 2: estadísticas del proyecto elegido
  return (
    <View style={[styles.container, { backgroundColor: empresa.color_hex || '#1E90FF' }]}>
      <EncabezadoLogo empresa={empresa} />
      <TouchableOpacity style={styles.botonVolver} onPress={() => setProyectoSeleccionado(null)}>
        <Text style={styles.botonVolverTexto}>‹ Elegir otro proyecto</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.tituloProyecto}>{proyectoSeleccionado.nombre}</Text>

        {cargandoStats ? (
          <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginTop: 30 }} />
        ) : sinDatos ? (
          <Text style={styles.vacioTexto}>
            Este proyecto todavía no tiene un contrato asociado, por eso no hay estadísticas. Las estadísticas se
            generan cuando el proyecto tiene un contrato (creado al aceptar una cotización, o con el botón "Crear
            Proyecto" desde la pantalla de Contratos).
          </Text>
        ) : (
          estadisticas && (
            <>
              <View style={styles.resumenCard}>
                <View style={styles.resumenFila}>
                  <Text style={styles.resumenLabel}>Valor del contrato</Text>
                  <Text style={styles.resumenValor}>{formatearMoneda(estadisticas.valor_contrato)}</Text>
                </View>
                <View style={styles.resumenFila}>
                  <Text style={styles.resumenLabel}>Abonado</Text>
                  <Text style={styles.resumenValor}>{formatearMoneda(estadisticas.total_abonado)}</Text>
                </View>
                <View style={styles.resumenFila}>
                  <Text style={styles.resumenLabel}>Saldo pendiente</Text>
                  <Text style={styles.resumenValor}>{formatearMoneda(estadisticas.saldo_pendiente)}</Text>
                </View>
                <View style={[styles.resumenFila, { marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }]}>
                  <Text style={styles.resumenLabelDestacado}>Utilidad estimada</Text>
                  <Text
                    style={[
                      styles.resumenValorDestacado,
                      { color: estadisticas.utilidad >= 0 ? '#2e7d32' : '#c62828' },
                    ]}
                  >
                    {formatearMoneda(estadisticas.utilidad)}
                  </Text>
                </View>
              </View>

              <Text style={styles.seccionTitulo}>Costos</Text>
              <View style={styles.resumenCard}>
                <View style={styles.resumenFila}>
                  <Text style={styles.resumenLabel}>Materiales</Text>
                  <Text style={styles.resumenValor}>{formatearMoneda(estadisticas.costos_materiales)}</Text>
                </View>
                <View style={styles.resumenFila}>
                  <Text style={styles.resumenLabel}>Mano de obra</Text>
                  <Text style={styles.resumenValor}>{formatearMoneda(estadisticas.valor_mano_obra)}</Text>
                </View>
                <View style={styles.resumenFila}>
                  <Text style={styles.resumenLabel}>Imprevistos</Text>
                  <Text style={styles.resumenValor}>{formatearMoneda(estadisticas.valor_imprevistos)}</Text>
                </View>
              </View>

              <View style={styles.filaBotones}>
                <TouchableOpacity style={styles.botonChicoAgregar} onPress={() => abrirModalCosto('materiales')}>
                  <Text style={styles.botonChicoAgregarTexto}>+ Materiales</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botonChicoAgregar} onPress={() => abrirModalCosto('mano_obra')}>
                  <Text style={styles.botonChicoAgregarTexto}>+ Mano de obra</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.botonChicoAgregar} onPress={() => abrirModalCosto('imprevistos')}>
                  <Text style={styles.botonChicoAgregarTexto}>+ Imprevistos</Text>
                </TouchableOpacity>
              </View>

              {estadisticas.resumen_por_categoria && estadisticas.resumen_por_categoria.length > 0 && (
                <>
                  <Text style={styles.seccionTitulo}>Costos por categoría</Text>
                  <View style={styles.resumenCard}>
                    {estadisticas.resumen_por_categoria.map((cat) => (
                      <View key={cat.categoria_id} style={[styles.resumenFila, { paddingVertical: 8 }]}>
                        <Text style={styles.resumenLabel}>{cat.categoria_nombre}</Text>
                        <Text style={styles.resumenValor}>{formatearMoneda(cat.total)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.seccionTitulo}>Historial de costos</Text>
              {estadisticas.movimientos_costos.length === 0 ? (
                <Text style={styles.vacioTexto}>Aún no hay costos registrados.</Text>
              ) : (
                estadisticas.movimientos_costos.map((mov) => (
                  <View key={mov.id} style={styles.abonoCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.movimientoTipo}>
                        {ETIQUETAS_TIPO_COSTO[mov.tipo] || mov.tipo}
                        {mov.categoria_nombre ? ` · ${mov.categoria_nombre}` : ''}
                      </Text>
                      {mov.detalle ? <Text style={styles.movimientoDetalle}>{mov.detalle}</Text> : null}
                      <Text style={styles.abonoFecha}>{formatearFecha(mov.fecha)}</Text>
                    </View>
                    <Text style={styles.abonoValor}>{formatearMoneda(mov.valor)}</Text>
                  </View>
                ))
              )}

              <Text style={styles.seccionTitulo}>Abonos recibidos</Text>
              {estadisticas.abonos.length === 0 ? (
                <Text style={styles.vacioTexto}>Aún no hay abonos registrados.</Text>
              ) : (
                estadisticas.abonos.map((abono) => (
                  <View key={abono.id} style={styles.abonoCard}>
                    <Text style={styles.abonoValor}>{formatearMoneda(abono.valor)}</Text>
                    <Text style={styles.abonoFecha}>{formatearFecha(abono.fecha)}</Text>
                  </View>
                ))
              )}
              <TouchableOpacity style={styles.botonSecundario} onPress={abrirModalAbono}>
                <Text style={styles.botonSecundarioTexto}>+ Registrar abono</Text>
              </TouchableOpacity>
            </>
          )
        )}
      </ScrollView>

      {/* MODAL: Agregar costo (compra de materiales, pago de mano de obra, o imprevisto) */}
      <Modal visible={modalCostoVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Agregar Costo · {ETIQUETAS_TIPO_COSTO[costoTipo]}</Text>

            <Text style={styles.label}>Categoría (opcional, ej: Carpintería, Ferretería, Estuco)</Text>
            <View style={styles.chipsContenedor}>
              {categorias.map((cat) => {
                const seleccionada = costoCategoriaId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, seleccionada && styles.chipSeleccionado]}
                    onPress={() => setCostoCategoriaId(seleccionada ? null : cat.id)}
                  >
                    <Text style={[styles.chipTexto, seleccionada && styles.chipTextoSeleccionado]}>{cat.nombre}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.filaNuevaCategoria}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={nuevaCategoriaTexto}
                onChangeText={setNuevaCategoriaTexto}
                placeholder="Escribe para crear una categoría nueva"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.botonAgregarCategoria}
                onPress={crearCategoria}
                disabled={creandoCategoria || !nuevaCategoriaTexto.trim()}
              >
                {creandoCategoria ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.botonAgregarCategoriaTexto}>+</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Detalle</Text>
            <TextInput
              style={styles.input}
              value={costoDetalle}
              onChangeText={setCostoDetalle}
              placeholder="Ej: Compra de materiales, pago a proveedor, etc."
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Valor *</Text>
            <InputMoneda style={styles.input} value={costoValor} onChangeValor={setCostoValor} />

            <Text style={styles.label}>Fecha * (DD-MM-AA)</Text>
            <TextInput
              style={styles.input}
              value={costoFecha}
              onChangeText={setCostoFecha}
              placeholder="Ej: 15-08-26"
              placeholderTextColor="#999"
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity style={styles.botonGuardar} onPress={registrarCosto} disabled={guardandoCosto}>
              {guardandoCosto ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonGuardarTexto}>GUARDAR</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalCostoVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: Registrar abono */}
      <Modal visible={modalAbonoVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Registrar Abono</Text>

            <Text style={styles.label}>Valor *</Text>
            <InputMoneda style={styles.input} value={abonoValor} onChangeValor={setAbonoValor} />

            <Text style={styles.label}>Fecha * (DD-MM-AA)</Text>
            <TextInput
              style={styles.input}
              value={abonoFecha}
              onChangeText={setAbonoFecha}
              placeholder="Ej: 15-08-26"
              placeholderTextColor="#999"
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity style={styles.botonGuardar} onPress={registrarAbono} disabled={guardandoAbono}>
              {guardandoAbono ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonGuardarTexto}>REGISTRAR</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalAbonoVisible(false)}>
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
  scrollContent: { padding: 16, paddingBottom: 60 },
  vacioTexto: { textAlign: 'center', color: '#888', marginTop: 20, fontSize: 14, paddingHorizontal: 10 },
  seccionTitulo: { fontSize: 15, fontWeight: 'bold', color: '#333', marginTop: 20, marginBottom: 10 },
  proyectoCard: {
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
  proyectoNombre: { fontSize: 16, fontWeight: '600', color: '#222' },
  proyectoFlecha: { fontSize: 22, color: '#ccc' },
  botonVolver: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  botonVolverTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
  tituloProyecto: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 10 },
  resumenCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#eee' },
  resumenFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  resumenLabel: { fontSize: 14, color: '#666' },
  resumenValor: { fontSize: 14, fontWeight: '600', color: '#222' },
  resumenLabelDestacado: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  resumenValorDestacado: { fontSize: 16, fontWeight: 'bold' },
  botonSecundario: { alignItems: 'center', padding: 12, marginTop: 8 },
  botonSecundarioTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
  filaBotones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  botonChicoAgregar: {
    backgroundColor: '#eaf3ff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E90FF',
  },
  botonChicoAgregarTexto: { color: '#1E90FF', fontSize: 13, fontWeight: '600' },
  abonoCard: {
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
  abonoValor: { fontSize: 15, fontWeight: '600', color: '#2e7d32' },
  abonoFecha: { fontSize: 13, color: '#999' },
  movimientoTipo: { fontSize: 14, fontWeight: '600', color: '#222' },
  movimientoDetalle: { fontSize: 13, color: '#666', marginTop: 2 },
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
  chipsContenedor: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSeleccionado: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  chipTexto: { color: '#444', fontSize: 13, fontWeight: '600' },
  chipTextoSeleccionado: { color: '#fff' },
  filaNuevaCategoria: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  botonAgregarCategoria: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonAgregarCategoriaTexto: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  botonGuardar: { backgroundColor: '#1E90FF', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 28 },
  botonGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
});
