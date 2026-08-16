import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import { compartirPdfDocumento, descargarPdfDocumento, generarPdfDocumento } from '../utils/generarPdfCotizacion';

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
  const [contratos, setContratos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [menuContrato, setMenuContrato] = useState(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [modalPdfVisible, setModalPdfVisible] = useState(false);
  const [contratoParaPdf, setContratoParaPdf] = useState(null);
  const [pdfCiudad, setPdfCiudad] = useState('');
  const [pdfPropietario, setPdfPropietario] = useState('');
  const [pdfParrafo, setPdfParrafo] = useState('');
  const [pdfCondicionesPago, setPdfCondicionesPago] = useState('');
  const [pdfTiempoEntrega, setPdfTiempoEntrega] = useState('');
  const [pdfFirmante, setPdfFirmante] = useState('');

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

  const abrirModalPdf = () => {
    const contrato = menuContrato;
    cerrarMenu();
    if (!contrato?.cotizacion_id) {
      Alert.alert('No disponible', 'Este contrato no tiene una cotización asociada para generar el PDF.');
      return;
    }
    setContratoParaPdf(contrato);
    setPdfCiudad('');
    setPdfPropietario('');
    setPdfParrafo('');
    setPdfCondicionesPago('');
    setPdfTiempoEntrega('');
    setPdfFirmante('');
    setModalPdfVisible(true);
  };

  const generarYCompartirPdf = async () => {
    const contrato = contratoParaPdf;
    setModalPdfVisible(false);
    setGenerandoPdf(true);
    try {
      const resCot = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/${contrato.cotizacion_id}`);
      const cotizacion = resCot.data;
      const resClientes = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/clientes/listar/${empresa.id}`);
      const cliente = resClientes.data.clientes.find((c) => c.id === cotizacion.cliente_id) || {};

      const uriPdf = await generarPdfDocumento({
        tipoDocumento: 'contrato',
        empresa,
        cliente,
        numero: cotizacion.numero,
        fecha: contrato.created_at,
        fechaEntrega: contrato.fecha_entrega,
        items: cotizacion.items,
        total: contrato.valor_total,
        descuento: cotizacion.descuento,
        ciudad: pdfCiudad,
        propietario: pdfPropietario || cliente.nombre,
        parrafo: pdfParrafo,
        condicionesPago: pdfCondicionesPago,
        tiempoEntrega: pdfTiempoEntrega,
        firmante: pdfFirmante,
      });
      const nombreArchivo = `Contrato_${(contrato.proyecto_nombre || cliente.nombre || 'proyecto').replace(/\s+/g, '_')}.pdf`;

      Alert.alert('PDF generado', '¿Qué deseas hacer con el documento?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar',
          onPress: async () => {
            try {
              await descargarPdfDocumento(uriPdf, nombreArchivo);
              Alert.alert('¡Listo!', 'El PDF se guardó en tu celular.');
            } catch (error) {
              console.error('Error descargando PDF:', error);
              Alert.alert('No se guardó', error?.message || 'No se pudo guardar el PDF.');
            }
          },
        },
        {
          text: 'Compartir',
          onPress: async () => {
            try {
              await compartirPdfDocumento(uriPdf, nombreArchivo);
            } catch (error) {
              console.error('Error compartiendo PDF:', error);
              Alert.alert('Error', error?.message || 'No se pudo compartir el PDF.');
            }
          },
        },
      ]);
    } catch (error) {
      console.error('Error generando PDF del contrato:', error);
      Alert.alert('Error', 'No se pudo generar el PDF del contrato.');
    } finally {
      setGenerandoPdf(false);
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
                {contrato.proyecto_id && (
                  <TouchableOpacity style={styles.botonMenu} onPress={() => abrirMenu(contrato)}>
                    <Text style={styles.botonMenuTexto}>⋮</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!menuContrato} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitulo}>{menuContrato?.proyecto_nombre}</Text>
            {menuContrato?.proyecto_estado === 'finalizado' ? (
              <TouchableOpacity style={styles.menuOpcion} onPress={reactivarProyecto}>
                <Text style={styles.menuOpcionTexto}>↩️  Reactivar proyecto</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuOpcion} onPress={finalizarProyecto}>
                <Text style={styles.menuOpcionTexto}>✅  Marcar como finalizado</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={abrirModalPdf} disabled={generandoPdf}>
              <Text style={styles.menuOpcionTexto}>{generandoPdf ? 'Generando PDF...' : '📄  Generar PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Datos para el PDF (carta, condiciones de pago, firma) */}
      <Modal visible={modalPdfVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Datos para el PDF</Text>
            <Text style={styles.notaTexto}>Estos datos se usan solo para armar el documento; puedes dejarlos en blanco si no aplican.</Text>

            <Text style={styles.label}>Ciudad (opcional)</Text>
            <TextInput style={styles.input} value={pdfCiudad} onChangeText={setPdfCiudad} placeholder="Ej: Girardota" placeholderTextColor="#999" />

            <Text style={styles.label}>Dirigido a (propietario)</Text>
            <TextInput style={styles.input} value={pdfPropietario} onChangeText={setPdfPropietario} placeholder="Ej: Propietario Llano Azul" placeholderTextColor="#999" />

            <Text style={styles.label}>Párrafo de contexto (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={pdfParrafo}
              onChangeText={setPdfParrafo}
              placeholder="Ej: Por solicitud efectuada paso a cotizar los precios de..."
              placeholderTextColor="#999"
              multiline
            />

            <Text style={styles.label}>Condiciones de pago (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
              value={pdfCondicionesPago}
              onChangeText={setPdfCondicionesPago}
              placeholder={'Ej: 25% a la firma del contrato\n25% a la 3-4 semanas con avance\n25% a la entrega de obra blanca\n25% a la entrega final'}
              placeholderTextColor="#999"
              multiline
            />

            <Text style={styles.label}>Tiempo de entrega (opcional)</Text>
            <TextInput style={styles.input} value={pdfTiempoEntrega} onChangeText={setPdfTiempoEntrega} placeholder="Ej: 12 - 14 semanas" placeholderTextColor="#999" />

            <Text style={styles.label}>Firma (nombre de quien envía)</Text>
            <TextInput style={styles.input} value={pdfFirmante} onChangeText={setPdfFirmante} placeholder="Ej: Juliana María Villa Flórez" placeholderTextColor="#999" />

            <TouchableOpacity style={styles.botonGuardar} onPress={generarYCompartirPdf} disabled={generandoPdf}>
              {generandoPdf ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GENERAR PDF</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalPdfVisible(false)}>
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
