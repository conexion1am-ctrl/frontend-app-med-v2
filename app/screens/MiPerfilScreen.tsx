import api from '../utils/apiClient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';
import InputContraseña from '../components/InputContraseña';
import { temaDesdeColor } from '../utils/temas';

// Convierte "2026-08-15" a "15-08-26" (formato de fecha estándar de la app)
const formatearFechaDdMmAa = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = String(d.getUTCFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
};

const estadoArl = (fechaVencimientoIso) => {
  if (!fechaVencimientoIso) return null;
  const hoy = new Date();
  const vencimiento = new Date(fechaVencimientoIso);
  const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= 5) return 'por_vencer';
  return 'vigente';
};

// Pantalla de perfil reducida para mano de obra y áreas especiales (proveedores/clientes):
// solo puede ver su nombre y su documento ARL, y cambiar su propia contraseña. No tiene
// acceso a los datos de la empresa (logo, color, nombre) como sí lo tiene EditarPerfilScreen.
export default function MiPerfilScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const colorEmpresa = empresa.color_hex || '#1E90FF';
  const tema = temaDesdeColor(colorEmpresa);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [contraseñaActual, setContraseñaActual] = useState('');
  const [contraseñaNueva, setContraseñaNueva] = useState('');
  const [confirmarContraseñaNueva, setConfirmarContraseñaNueva] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const res = await api.get(`/auth/usuario/${usuario.id}`);
      setDatos(res.data);
    } catch (error) {
      console.error('Error cargando perfil:', error);
      Alert.alert('Error', 'No se pudieron cargar tus datos.');
    } finally {
      setCargando(false);
    }
  };

  const cambiarContraseña = async () => {
    if (!contraseñaNueva || contraseñaNueva.length < 6) {
      Alert.alert('Contraseña muy corta', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (contraseñaNueva !== confirmarContraseñaNueva) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas nuevas sean iguales.');
      return;
    }

    setGuardando(true);
    try {
      await api.put(`/auth/usuario/${usuario.id}`, {
        nombre: datos.nombre,
        contraseña_actual: contraseñaActual || undefined,
        contraseña_nueva: contraseñaNueva,
      });
      Alert.alert('¡Listo!', 'Tu contraseña fue actualizada.');
      setContraseñaActual('');
      setContraseñaNueva('');
      setConfirmarContraseñaNueva('');
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      const mensaje = error.response?.data?.error || 'No se pudo cambiar la contraseña.';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando || !datos) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} />
      </View>
    );
  }

  const estado = estadoArl(datos.arl_vencimiento);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tema.claro }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <EncabezadoLogo empresa={empresa} />
      <ScrollView style={{ backgroundColor: tema.claro }} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.seccionTitulo}>Mis datos</Text>
        <View style={styles.tarjeta}>
          <Text style={styles.label}>Nombre</Text>
          <Text style={styles.valor}>{datos.nombre}</Text>
          <Text style={styles.label}>Celular</Text>
          <Text style={styles.valor}>{datos.celular}</Text>
          <Text style={styles.label}>Área</Text>
          <Text style={styles.valor}>{empresa.area_nombre}</Text>
        </View>

        <Text style={styles.seccionTitulo}>Documento ARL</Text>
        <View style={styles.tarjeta}>
          {datos.arl_documento_url ? (
            <>
              <Text style={styles.label}>Vencimiento</Text>
              <Text style={styles.valor}>{formatearFechaDdMmAa(datos.arl_vencimiento)}</Text>
              {estado && (
                <View
                  style={[
                    styles.etiquetaArl,
                    estado === 'vencido' && styles.etiquetaArlVencido,
                    estado === 'por_vencer' && styles.etiquetaArlPorVencer,
                    estado === 'vigente' && styles.etiquetaArlVigente,
                  ]}
                >
                  <Text style={styles.etiquetaArlTexto}>
                    {estado === 'vencido' && '⚠️ ARL vencida'}
                    {estado === 'por_vencer' && '⏳ ARL por vencer'}
                    {estado === 'vigente' && '✅ ARL vigente'}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.vacioTexto}>Aún no tienes un documento ARL cargado. Pídele a un administrativo que lo suba desde Grupo de Trabajo.</Text>
          )}
        </View>

        <Text style={styles.seccionTitulo}>Cambiar contraseña</Text>
        <View style={styles.tarjeta}>
          <Text style={styles.label}>Contraseña actual</Text>
          <InputContraseña value={contraseñaActual} onChangeText={setContraseñaActual} placeholder="Tu contraseña actual" />

          <Text style={[styles.label, { marginTop: 12 }]}>Nueva contraseña</Text>
          <InputContraseña value={contraseñaNueva} onChangeText={setContraseñaNueva} placeholder="Mínimo 6 caracteres" />

          <Text style={[styles.label, { marginTop: 12 }]}>Confirmar nueva contraseña</Text>
          <InputContraseña value={confirmarContraseñaNueva} onChangeText={setConfirmarContraseñaNueva} placeholder="Repite la nueva contraseña" />

          <TouchableOpacity style={styles.botonGuardar} onPress={cambiarContraseña} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonGuardarTexto}>GUARDAR CONTRASEÑA</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.botonVolver} onPress={() => navigation.goBack()}>
          <Text style={styles.botonVolverTexto}>Volver</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  seccionTitulo: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },
  tarjeta: { backgroundColor: '#fff', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#eee' },
  label: { fontSize: 12, color: '#888', marginTop: 8 },
  valor: { fontSize: 15, color: '#222', fontWeight: '500', marginTop: 2 },
  vacioTexto: { fontSize: 13, color: '#888' },
  etiquetaArl: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10, marginTop: 10 },
  etiquetaArlVencido: { backgroundColor: '#ffcdd2' },
  etiquetaArlPorVencer: { backgroundColor: '#ffe0b2' },
  etiquetaArlVigente: { backgroundColor: '#c8e6c9' },
  etiquetaArlTexto: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  botonGuardar: { backgroundColor: '#1E90FF', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  botonGuardarTexto: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  botonVolver: { alignItems: 'center', marginTop: 20, padding: 10 },
  botonVolverTexto: { color: '#888', fontSize: 14 },
});
