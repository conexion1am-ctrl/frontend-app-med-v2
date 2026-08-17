import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { esGerencia } from '../utils/roles';

const formatearMoneda = (valor) => {
  const numero = parseFloat(valor) || 0;
  return numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
};

const formatearFecha = (fecha) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = String(d.getUTCFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
};

export default function ContratosScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const puedeEliminarContratos = esGerencia(empresa);
  const [contratos, setContratos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [menuContrato, setMenuContrato] = useState(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    cargarContratos();
  }, []);

  const cargarContratos = async () => {
    setCargando(true);
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/contratos/listar/${empresa.id}`);
      setContratos(res.data.contratos);
    } catch (error) {
      console.error('Error cargando contratos:', error);
      Alert.alert('Error', 'No se pudieron cargar los contratos.');
    } finally {
      setCargando(false);
    }
  };

  const abrirMenu = (contrato) => setMenuContrato(contrato);
  const cerrarMenu = () => setMenuContrato(null);

  const finalizarProyecto = async () => {
    const contrato = menuContrato;
    cerrarMenu();
    if (!contrato.proyecto_id) return;
    try {
      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${contrato.proyecto_id}/finalizar`);
      cargarContratos();
    } catch (error) {
      console.error('Error finalizando proyecto:', error);
      Alert.alert('Error', 'No se pudo marcar el proyecto como finalizado.');
    }
  };

  const reactivarProyecto = async () => {
    const contrato = menuContrato;
    cerrarMenu();
    if (!contrato.proyecto_id) return;
    try {
      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/proyectos/${contrato.proyecto_id}/reactivar`);
      cargarContratos();
    } catch (error) {
      console.error('Error reactivando proyecto:', error);
      Alert.alert('Error', 'No se pudo reactivar el proyecto.');
    }
  };

  // El PDF del contrato se genera automáticamente en el servidor al aceptar la cotización
  // (tomando todos sus datos). Aquí solo lo abrimos; si por algún motivo todavía no existe
  // (falló la primera vez, o es un contrato antiguo), lo regeneramos en el servidor sin pedir
  // nada al usuario, usando los datos ya guardados.
  const verPdf = async () => {
    const contrato = menuContrato;
    cerrarMenu();
    if (!contrato?.cotizacion_id) {
      Alert.alert('No disponible', 'Este contrato no tiene una cotización asociada para generar el PDF.');
      return;
    }
    if (contrato.pdf_url) {
      Linking.openURL(contrato.pdf_url);
      return;
    }
    setGenerandoPdf(true);
    try {
      const res = await axios.post(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/contratos/${contrato.id}/regenerar-pdf`);
      const url = res.data?.contrato?.pdf_url;
      if (url) {
        Linking.openURL(url);
        cargarContratos();
      } else {
        Alert.alert('Error', 'No se pudo generar el PDF. Intenta de nuevo en unos minutos.');
      }
    } catch (error) {
      console.error('Error generando PDF del contrato:', error);
      Alert.alert('Error', 'No se pudo generar el PDF. Intenta de nuevo en unos minutos.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Eliminar contrato: solo Gerencia. Borra también el proyecto asociado con todo lo que
  // tenga (fotos, planos 3D, chat, equipo asignado, estadísticas) y la cotización que lo
  // originó, igual que al eliminar un cliente.
  const confirmarEliminarContrato = () => {
    const contrato = menuContrato;
    cerrarMenu();
    Alert.alert(
      'Eliminar contrato',
      `¿Eliminar el contrato de "${contrato.proyecto_nombre || 'este proyecto'}"? Esto borra también el proyecto completo (fotos, planos 3D, chat, equipo asignado) y la cotización que lo originó. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/contratos/${contrato.id}`, {
                data: { solicitante_id: usuario?.id },
              });
              cargarContratos();
            } catch (error) {
              console.error('Error eliminando contrato:', error);
              const mensaje = error.response?.data?.error || 'No se pudo eliminar el contrato.';
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
        {contratos.length === 0 ? (
          <Text style={styles.vacioTexto}>
            Aún no hay contratos. Los contratos se generan automáticamente al aceptar una cotización.
          </Text>
        ) : (
          contratos.map((contrato) => {
            const finalizado = contrato.proyecto_estado === 'finalizado';
            return (
              <View key={contrato.id} style={styles.contratoCard}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (contrato.proyecto_id) {
                      navigation.navigate('DetalleProyecto', {
                        empresa,
                        usuario,
                        proyecto: { id: contrato.proyecto_id, nombre: contrato.proyecto_nombre },
                      });
                    }
                  }}
                  activeOpacity={contrato.proyecto_id ? 0.7 : 1}
                >
                  <View style={styles.contratoEncabezado}>
                    <Text style={styles.contratoProyecto}>{contrato.proyecto_nombre || 'Sin proyecto asociado'}</Text>
                    {finalizado && (
                      <View style={styles.etiquetaFinalizado}>
                        <Text style={styles.etiquetaFinalizadoTexto}>Finalizado</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.contratoValor}>{formatearMoneda(contrato.valor_total)}</Text>
                  {contrato.fecha_entrega ? (
                    <Text style={styles.contratoFecha}>Entrega: {formatearFecha(contrato.fecha_entrega)}</Text>
                  ) : (
                    <Text style={styles.contratoFecha}>Sin fecha de entrega definida</Text>
                  )}
                  {contrato.proyecto_id && <Text style={styles.contratoVerMas}>Ver estadísticas del proyecto ›</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.botonMenu} onPress={() => abrirMenu(contrato)}>
                  <Text style={styles.botonMenuTexto}>⋮</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!menuContrato} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitulo}>{menuContrato?.proyecto_nombre || 'Contrato'}</Text>
            {menuContrato?.proyecto_id && (
              menuContrato?.proyecto_estado === 'finalizado' ? (
                <TouchableOpacity style={styles.menuOpcion} onPress={reactivarProyecto}>
                  <Text style={styles.menuOpcionTexto}>↩️  Reactivar proyecto</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.menuOpcion} onPress={finalizarProyecto}>
                  <Text style={styles.menuOpcionTexto}>✅  Marcar como finalizado</Text>
                </TouchableOpacity>
              )
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={verPdf} disabled={generandoPdf}>
              <Text style={styles.menuOpcionTexto}>{generandoPdf ? 'Generando PDF...' : '📄  Ver contrato (PDF)'}</Text>
            </TouchableOpacity>
            {puedeEliminarContratos && (
              <TouchableOpacity style={styles.menuOpcion} onPress={confirmarEliminarContrato}>
                <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
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
  scrollContent: { padding: 16, paddingBottom: 40 },
  vacioTexto: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15, paddingHorizontal: 20 },
  contratoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contratoEncabezado: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  contratoProyecto: { fontSize: 16, fontWeight: '600', color: '#222' },
  contratoValor: { fontSize: 17, fontWeight: 'bold', color: '#1E90FF', marginTop: 4 },
  contratoFecha: { fontSize: 13, color: '#777', marginTop: 4 },
  contratoVerMas: { fontSize: 12, color: '#1E90FF', marginTop: 8, fontWeight: '600' },
  etiquetaFinalizado: { backgroundColor: '#e0e0e0', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  etiquetaFinalizadoTexto: { fontSize: 11, fontWeight: 'bold', color: '#555' },
  botonMenu: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 },
  botonMenuTexto: { fontSize: 22, color: '#888', fontWeight: 'bold' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 14, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  notaTexto: { fontSize: 13, color: '#999', marginBottom: 10 },
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
    marginTop: 20,
  },
  botonAgregarTexto: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
});
