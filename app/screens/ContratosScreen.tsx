import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const puedeEliminarContratos = esGerencia(empresa);
  const [contratos, setContratos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [menuContrato, setMenuContrato] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [creandoProyecto, setCreandoProyecto] = useState(false);

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

  // Crea el proyecto de este contrato (si todavía no lo tiene, ya sea porque nunca se creó o
  // porque se eliminó desde la pantalla de Proyectos). Usa el snapshot guardado en el contrato.
  const crearProyecto = async () => {
    const contrato = menuContrato;
    cerrarMenu();
    setCreandoProyecto(true);
    try {
      await axios.post(`https://backend-app-mediterraneo.onrender.com/api/cotizaciones/contratos/${contrato.id}/crear-proyecto`);
      Alert.alert('¡Listo!', 'Proyecto creado exitosamente.');
      cargarContratos();
    } catch (error) {
      console.error('Error creando proyecto:', error);
      const mensaje = error.response?.data?.error || 'No se pudo crear el proyecto. Intenta de nuevo.';
      Alert.alert('Error', mensaje);
    } finally {
      setCreandoProyecto(false);
    }
  };

  // Antes: se abría el PDF directamente si ya existía, o se regeneraba en silencio con los datos
  // ya guardados. Ahora (2026-08-25) siempre se pasa primero por "Revisar y editar documento",
  // donde el usuario puede tocar cualquier parte del texto (incluidas las cláusulas legales)
  // antes de generar el PDF final — ver RevisarContratoScreen.tsx.
  const revisarContrato = () => {
    const contrato = menuContrato;
    cerrarMenu();
    navigation.navigate('RevisarContrato', { empresa, contratoId: contrato.id });
  };

  // Eliminar contrato: solo Gerencia. Borra el contrato y la cotización que lo originó, pero
  // el proyecto NO se borra (queda blindado con su propia copia de datos) y sigue viéndose
  // normal en la pantalla de Proyectos.
  const confirmarEliminarContrato = () => {
    const contrato = menuContrato;
    cerrarMenu();
    Alert.alert(
      'Eliminar contrato',
      `¿Eliminar el contrato de "${contrato.proyecto_nombre || 'este proyecto'}"? Esto borra el contrato y la cotización que lo originó. El proyecto (fotos, planos 3D, chat, equipo asignado) se conserva intacto. Esta acción no se puede deshacer.`,
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

  const textoNormalizado = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const busquedaNormalizada = textoNormalizado(busqueda);
  const contratosFiltrados = busquedaNormalizada
    ? contratos.filter((c) => textoNormalizado(c.proyecto_nombre).includes(busquedaNormalizada))
    : contratos;

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
          placeholder="🔍 Buscar por proyecto..."
          placeholderTextColor="#999"
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {contratosFiltrados.length === 0 ? (
          <Text style={styles.vacioTexto}>
            {contratos.length === 0
              ? 'Aún no hay contratos. Los contratos se generan automáticamente al aceptar una cotización.'
              : 'No se encontraron contratos con ese texto.'}
          </Text>
        ) : (
          contratosFiltrados.map((contrato) => {
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
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>{menuContrato?.proyecto_nombre || 'Contrato'}</Text>
            {menuContrato?.proyecto_id ? (
              menuContrato?.proyecto_estado === 'finalizado' ? (
                <TouchableOpacity style={styles.menuOpcion} onPress={reactivarProyecto}>
                  <Text style={styles.menuOpcionTexto}>↩️  Reactivar proyecto</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.menuOpcion} onPress={finalizarProyecto}>
                  <Text style={styles.menuOpcionTexto}>✅  Marcar como finalizado</Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity style={styles.menuOpcion} onPress={crearProyecto} disabled={creandoProyecto}>
                <Text style={[styles.menuOpcionTexto, { color: '#1E90FF', fontWeight: 'bold' }]}>
                  {creandoProyecto ? 'Creando proyecto...' : '🏗️  Crear Proyecto'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={revisarContrato}>
              <Text style={styles.menuOpcionTexto}>📄  Revisar y generar PDF</Text>
            </TouchableOpacity>
            {menuContrato?.pdf_url && (
              <TouchableOpacity style={styles.menuOpcion} onPress={() => { Linking.openURL(menuContrato.pdf_url); cerrarMenu(); }}>
                <Text style={styles.menuOpcionTexto}>👁️  Ver último PDF generado</Text>
              </TouchableOpacity>
            )}
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
