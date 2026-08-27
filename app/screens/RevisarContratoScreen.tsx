import api from '../utils/apiClient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import EncabezadoLogo from '../components/EncabezadoLogo';

// Pantalla "Revisar y editar documento" del contrato (2026-08-25, a pedido del usuario): antes el
// PDF del contrato se generaba automático y en silencio al aceptar la cotización, con TODO el
// texto legal fijo en el código del servidor — nadie podía tocar ni una palabra de las cláusulas
// sin pedir un cambio de código. Ahora, antes de generar el PDF final, el usuario ve aquí el
// contrato completo dividido en bloques editables: párrafo introductorio, cada una de las 12
// cláusulas legales, condiciones de pago, tiempo de entrega, ciudad, firmante y número — todo
// precargado con lo estándar/guardado, pero editable libremente, incluidas las cláusulas legales.
// Solo al presionar "Generar PDF" se congela ese texto en el documento final.
export default function RevisarContratoScreen({ route, navigation }) {
  const { empresa, contratoId } = route.params;
  const insets = useSafeAreaInsets();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);

  const [ciudad, setCiudad] = useState('');
  const [numero, setNumero] = useState('');
  const [firmante, setFirmante] = useState('');
  const [parrafoIntroductorio, setParrafoIntroductorio] = useState('');
  const [tiempoEntrega, setTiempoEntrega] = useState('');
  // Condiciones de pago: se editan como texto libre en pantalla ("25% — descripción" por línea,
  // mismo patrón ya usado en el modal de PDF de Cotizaciones) y se convierten a la lista
  // estructurada { porcentaje, descripcion } solo al guardar/generar.
  const [condicionesPagoTexto, setCondicionesPagoTexto] = useState('');
  const [clausulas, setClausulas] = useState([]); // [{ titulo, texto }]

  useEffect(() => {
    cargarContrato();
  }, []);

  const condicionesATexto = (condiciones) => {
    if (!Array.isArray(condiciones)) return '';
    return condiciones.map((c) => `${c.porcentaje}% — ${c.descripcion}`).join('\n');
  };

  const textoACondiciones = (texto) => {
    return (texto || '')
      .split('\n')
      .map((linea) => linea.trim())
      .filter(Boolean)
      .map((linea) => {
        const match = linea.match(/^(\d+(?:\.\d+)?)\s*%\s*[—-]\s*(.*)$/);
        if (match) return { porcentaje: match[1], descripcion: match[2] };
        return { porcentaje: '', descripcion: linea };
      });
  };

  const cargarContrato = async () => {
    setCargando(true);
    try {
      const res = await api.get(`/cotizaciones/contratos/${contratoId}`);
      const c = res.data;
      setCiudad(c.ciudad || '');
      setNumero(c.numero || '');
      setFirmante(c.firmante || '');
      setParrafoIntroductorio(c.parrafo_introductorio || '');
      setTiempoEntrega(c.tiempo_entrega || '00 - 00 Semanas');
      setCondicionesPagoTexto(condicionesATexto(c.condiciones_pago));
      setClausulas(Array.isArray(c.clausulas) ? c.clausulas : []);
    } catch (error) {
      console.error('Error cargando contrato:', error);
      Alert.alert('Error', 'No se pudo cargar el contrato.');
    } finally {
      setCargando(false);
    }
  };

  const actualizarClausula = (indice, campo, valor) => {
    setClausulas((prev) => prev.map((c, i) => (i === indice ? { ...c, [campo]: valor } : c)));
  };

  const cuerpoParaGuardar = () => ({
    ciudad: ciudad || null,
    numero: numero || null,
    firmante: firmante || null,
    parrafo_introductorio: parrafoIntroductorio || null,
    tiempo_entrega: tiempoEntrega || null,
    condiciones_pago: textoACondiciones(condicionesPagoTexto),
    clausulas,
  });

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      await api.put(`/cotizaciones/contratos/${contratoId}/texto`, cuerpoParaGuardar());
      Alert.alert('¡Listo!', 'Los cambios se guardaron.');
    } catch (error) {
      console.error('Error guardando texto del contrato:', error);
      Alert.alert('Error', 'No se pudieron guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  };

  // Descarga el PDF (ya generado y subido a Storage por el servidor) a un archivo local antes de
  // poder compartirlo — expo-sharing no puede compartir directamente una URL remota (https://...),
  // necesita un archivo en el dispositivo. Mismo patrón que generarPdfCotizacion.js.
  const descargarPdfLocal = async (url, nombreArchivo) => {
    const destino = `${FileSystem.cacheDirectory}${nombreArchivo}`;
    const { uri } = await FileSystem.downloadAsync(url, destino);
    return uri;
  };

  // Genera el PDF final del contrato (2026-08-26: antes solo lo abría con Linking.openURL, sin
  // dar la opción de compartirlo por WhatsApp/correo/etc. al cliente — a pedido del usuario, ahora
  // ofrece Descargar o Compartir, igual que ya funciona en Cotizaciones).
  const generarPdf = async () => {
    setGenerando(true);
    try {
      const res = await api.post(
        `/cotizaciones/contratos/${contratoId}/generar-pdf`,
        cuerpoParaGuardar()
      );
      const url = res.data?.contrato?.pdf_url;
      if (!url) {
        Alert.alert('Listo', 'El PDF se generó, pero no se pudo abrir automáticamente.');
        navigation.goBack();
        return;
      }
      const nombreArchivo = `Contrato_${numero || contratoId}.pdf`;
      const uriLocal = await descargarPdfLocal(url, nombreArchivo);
      Alert.alert('¡PDF generado!', '¿Qué quieres hacer con el documento?', [
        {
          text: 'Compartir',
          onPress: async () => {
            const disponible = await Sharing.isAvailableAsync();
            if (disponible) {
              await Sharing.shareAsync(uriLocal, { mimeType: 'application/pdf', dialogTitle: nombreArchivo });
            } else {
              Alert.alert('No disponible', 'Compartir no está disponible en este dispositivo.');
            }
            navigation.goBack();
          },
        },
        {
          text: 'Descargar',
          onPress: async () => {
            try {
              const permiso = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
              if (permiso.granted) {
                const contenidoBase64 = await FileSystem.readAsStringAsync(uriLocal, { encoding: FileSystem.EncodingType.Base64 });
                const nuevoUri = await FileSystem.StorageAccessFramework.createFileAsync(
                  permiso.directoryUri,
                  nombreArchivo.replace(/\.pdf$/i, ''),
                  'application/pdf'
                );
                await FileSystem.writeAsStringAsync(nuevoUri, contenidoBase64, { encoding: FileSystem.EncodingType.Base64 });
              }
            } catch (error) {
              console.error('Error descargando PDF del contrato:', error);
            }
            navigation.goBack();
          },
        },
        { text: 'Cerrar', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error generando PDF del contrato:', error);
      Alert.alert('Error', 'No se pudo generar el PDF. Intenta de nuevo en unos minutos.');
    } finally {
      setGenerando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={empresa?.color_hex || '#1E90FF'} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <EncabezadoLogo empresa={empresa} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.titulo}>Revisar y editar documento</Text>
        <Text style={styles.subtitulo}>
          Todo el texto es editable, incluidas las cláusulas legales. Los cambios solo quedan en el PDF cuando lo generes.
        </Text>

        <Text style={styles.seccionTitulo}>Datos generales</Text>

        <Text style={styles.label}>Ciudad</Text>
        <TextInput style={styles.input} value={ciudad} onChangeText={setCiudad} placeholderTextColor="#999" />

        <Text style={styles.label}>Número de contrato (opcional)</Text>
        <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholderTextColor="#999" />

        <Text style={styles.label}>Firmante (representante de la empresa)</Text>
        <TextInput style={styles.input} value={firmante} onChangeText={setFirmante} placeholderTextColor="#999" />

        <Text style={styles.label}>Tiempo de entrega</Text>
        <TextInput style={styles.input} value={tiempoEntrega} onChangeText={setTiempoEntrega} placeholderTextColor="#999" />

        <Text style={styles.label}>Condiciones de pago (una por línea, ej: 25% — A la firma del contrato)</Text>
        <TextInput
          style={[styles.input, styles.inputMultilinea]}
          value={condicionesPagoTexto}
          onChangeText={setCondicionesPagoTexto}
          multiline
          placeholderTextColor="#999"
        />

        <Text style={styles.seccionTitulo}>Párrafo introductorio</Text>
        <Text style={styles.notaTexto}>
          Los datos del cliente y la empresa se llenan solos donde corresponda; puedes editar el texto de alrededor.
        </Text>
        <TextInput
          style={[styles.input, styles.inputMultilinea]}
          value={parrafoIntroductorio}
          onChangeText={setParrafoIntroductorio}
          multiline
          placeholderTextColor="#999"
        />

        <Text style={styles.seccionTitulo}>Cláusulas del contrato</Text>
        {clausulas.map((clausula, indice) => (
          <View key={indice} style={styles.clausulaBloque}>
            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={clausula.titulo}
              onChangeText={(valor) => actualizarClausula(indice, 'titulo', valor)}
              placeholderTextColor="#999"
            />
            <Text style={styles.label}>Texto</Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea, styles.inputClausula]}
              value={clausula.texto}
              onChangeText={(valor) => actualizarClausula(indice, 'texto', valor)}
              multiline
              placeholderTextColor="#999"
            />
          </View>
        ))}

        <View style={[styles.botonesFooter, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.botonGuardar} onPress={guardarCambios} disabled={guardando || generando}>
            {guardando ? <ActivityIndicator color="#1E90FF" /> : <Text style={styles.botonGuardarTexto}>GUARDAR CAMBIOS</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonGenerar} onPress={generarPdf} disabled={guardando || generando}>
            {generando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonGenerarTexto}>GENERAR PDF</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  subtitulo: { fontSize: 13, color: '#777', marginBottom: 20 },
  seccionTitulo: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 22, marginBottom: 8 },
  notaTexto: { fontSize: 12, color: '#999', marginBottom: 8, fontStyle: 'italic' },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#222',
  },
  inputMultilinea: { minHeight: 70, textAlignVertical: 'top' },
  inputClausula: { minHeight: 100 },
  clausulaBloque: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  botonesFooter: { marginTop: 30, gap: 10 },
  botonGuardar: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E90FF',
  },
  botonGuardarTexto: { color: '#1E90FF', fontSize: 15, fontWeight: 'bold' },
  botonGenerar: { backgroundColor: '#1E90FF', borderRadius: 8, padding: 16, alignItems: 'center' },
  botonGenerarTexto: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
