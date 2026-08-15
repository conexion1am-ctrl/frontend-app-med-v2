import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';

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

export default function EstadisticasScreen({ route }) {
  const { empresa } = route.params;
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargandoProyectos, setCargandoProyectos] = useState(true);
  const [cargandoStats, setCargandoStats] = useState(false);
  const [sinDatos, setSinDatos] = useState(false);

  const [modalCostosVisible, setModalCostosVisible] = useState(false);
  const [costosMateriales, setCostosMateriales] = useState('');
  const [valorManoObra, setValorManoObra] = useState('');
  const [valorImprevistos, setValorImprevistos] = useState('');
  const [guardandoCostos, setGuardandoCostos] = useState(false);

  const [modalAbonoVisible, setModalAbonoVisible] = useState(false);
  const [abonoValor, setAbonoValor] = useState('');
  const [abonoFecha, setAbonoFecha] = useState('');
  const [guardandoAbono, setGuardandoAbono] = useState(false);

  useEffect(() => {
    cargarProyectos();
  }, []);

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
      setCostosMateriales(String(res.data.costos_materiales || ''));
      setValorManoObra(String(res.data.valor_mano_obra || ''));
      setValorImprevistos(String(res.data.valor_imprevistos || ''));
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

  const guardarCostos = async () => {
    setGuardandoCostos(true);
    try {
      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/estadisticas/${proyectoSeleccionado.id}`, {
        costos_materiales: costosMateriales ? parseFloat(costosMateriales) : 0,
        valor_mano_obra: valorManoObra ? parseFloat(valorManoObra) : 0,
        valor_imprevistos: valorImprevistos ? parseFloat(valorImprevistos) : 0,
      });
      setModalCostosVisible(false);
      seleccionarProyecto(proyectoSeleccionado);
    } catch (error) {
      console.error('Error actualizando costos:', error);
      Alert.alert('Error', 'No se pudieron guardar los costos.');
    } finally {
      setGuardandoCostos(false);
    }
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
            generan automáticamente cuando se acepta una cotización de este proyecto.
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
              <TouchableOpacity style={styles.botonSecundario} onPress={() => setModalCostosVisible(true)}>
                <Text style={styles.botonSecundarioTexto}>Actualizar costos</Text>
              </TouchableOpacity>

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
              <TouchableOpacity style={styles.botonSecundario} onPress={() => setModalAbonoVisible(true)}>
                <Text style={styles.botonSecundarioTexto}>+ Registrar abono</Text>
              </TouchableOpacity>
            </>
          )
        )}
      </ScrollView>

      {/* MODAL: Actualizar costos */}
      <Modal visible={modalCostosVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Actualizar Costos</Text>

            <Text style={styles.label}>Materiales</Text>
            <TextInput
              style={styles.input}
              value={costosMateriales}
              onChangeText={(t) => setCostosMateriales(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Mano de obra</Text>
            <TextInput
              style={styles.input}
              value={valorManoObra}
              onChangeText={(t) => setValorManoObra(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Imprevistos</Text>
            <TextInput
              style={styles.input}
              value={valorImprevistos}
              onChangeText={(t) => setValorImprevistos(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#999"
            />

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarCostos} disabled={guardandoCostos}>
              {guardandoCostos ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonGuardarTexto}>GUARDAR</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalCostosVisible(false)}>
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
            <TextInput
              style={styles.input}
              value={abonoValor}
              onChangeText={(t) => setAbonoValor(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="Ej: 500000"
              placeholderTextColor="#999"
            />

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
  abonoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  abonoValor: { fontSize: 15, fontWeight: '600', color: '#2e7d32' },
  abonoFecha: { fontSize: 13, color: '#999' },
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
  botonGuardar: { backgroundColor: '#1E90FF', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 28 },
  botonGuardarTexto: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
});
