import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EncabezadoLogo from '../components/EncabezadoLogo';

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
          contratos.map((contrato) => (
            <TouchableOpacity
              key={contrato.id}
              style={styles.contratoCard}
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
              <Text style={styles.contratoProyecto}>{contrato.proyecto_nombre || 'Sin proyecto asociado'}</Text>
              <Text style={styles.contratoValor}>{formatearMoneda(contrato.valor_total)}</Text>
              {contrato.fecha_entrega ? (
                <Text style={styles.contratoFecha}>Entrega: {formatearFecha(contrato.fecha_entrega)}</Text>
              ) : (
                <Text style={styles.contratoFecha}>Sin fecha de entrega definida</Text>
              )}
              {contrato.proyecto_id && <Text style={styles.contratoVerMas}>Ver estadísticas del proyecto ›</Text>}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  },
  contratoProyecto: { fontSize: 16, fontWeight: '600', color: '#222' },
  contratoValor: { fontSize: 17, fontWeight: 'bold', color: '#1E90FF', marginTop: 4 },
  contratoFecha: { fontSize: 13, color: '#777', marginTop: 4 },
  contratoVerMas: { fontSize: 12, color: '#1E90FF', marginTop: 8, fontWeight: '600' },
});
