import * as Localization from 'expo-localization';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Lista de países más relevantes para Latinoamérica + algunos globales, con su prefijo telefónico.
export const PAISES = [
  { nombre: 'Colombia', codigo: 'CO', prefijo: '+57' },
  { nombre: 'México', codigo: 'MX', prefijo: '+52' },
  { nombre: 'Argentina', codigo: 'AR', prefijo: '+54' },
  { nombre: 'Chile', codigo: 'CL', prefijo: '+56' },
  { nombre: 'Perú', codigo: 'PE', prefijo: '+51' },
  { nombre: 'Ecuador', codigo: 'EC', prefijo: '+593' },
  { nombre: 'Venezuela', codigo: 'VE', prefijo: '+58' },
  { nombre: 'Bolivia', codigo: 'BO', prefijo: '+591' },
  { nombre: 'Paraguay', codigo: 'PY', prefijo: '+595' },
  { nombre: 'Uruguay', codigo: 'UY', prefijo: '+598' },
  { nombre: 'Panamá', codigo: 'PA', prefijo: '+507' },
  { nombre: 'Costa Rica', codigo: 'CR', prefijo: '+506' },
  { nombre: 'Guatemala', codigo: 'GT', prefijo: '+502' },
  { nombre: 'Honduras', codigo: 'HN', prefijo: '+504' },
  { nombre: 'El Salvador', codigo: 'SV', prefijo: '+503' },
  { nombre: 'Nicaragua', codigo: 'NI', prefijo: '+505' },
  { nombre: 'República Dominicana', codigo: 'DO', prefijo: '+1' },
  { nombre: 'Cuba', codigo: 'CU', prefijo: '+53' },
  { nombre: 'España', codigo: 'ES', prefijo: '+34' },
  { nombre: 'Estados Unidos', codigo: 'US', prefijo: '+1' },
];

// Detecta el país del dispositivo (según configuración regional) y devuelve su prefijo.
// Si no lo reconoce, usa Colombia como valor por defecto.
export function detectarPaisPorDispositivo() {
  try {
    const regiones = Localization.getLocales();
    const regionCode = regiones?.[0]?.regionCode;
    const encontrado = PAISES.find((p) => p.codigo === regionCode);
    return encontrado || PAISES[0];
  } catch (error) {
    return PAISES[0];
  }
}

interface InputCelularProps {
  numero: string;
  onChangeNumero: (valor: string) => void;
  pais: typeof PAISES[0];
  onChangePais: (pais: typeof PAISES[0]) => void;
  disabled?: boolean;
}

// Componente reutilizable: selector de país (prefijo) + campo de número, sin prefijo.
export default function InputCelular({ numero, onChangeNumero, pais, onChangePais, disabled }: InputCelularProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View>
      <View style={[styles.fila, disabled && styles.filaDeshabilitada]}>
        <TouchableOpacity
          style={styles.botonPrefijo}
          onPress={() => !disabled && setModalVisible(true)}
          disabled={disabled}
        >
          <Text style={styles.textoPrefijo}>{pais.prefijo}</Text>
          {!disabled && <Text style={styles.flechita}>▾</Text>}
        </TouchableOpacity>
        <TextInput
          style={styles.inputNumero}
          value={numero}
          onChangeText={(texto) => onChangeNumero(texto.replace(/[^0-9]/g, ''))}
          placeholder="300 210 00 00"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          editable={!disabled}
        />
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Selecciona el país</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {PAISES.map((p) => (
                <TouchableOpacity
                  key={p.codigo}
                  style={styles.opcionPais}
                  onPress={() => {
                    onChangePais(p);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.opcionPaisTexto}>{p.nombre}</Text>
                  <Text style={styles.opcionPaisPrefijo}>{p.prefijo}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  filaDeshabilitada: { backgroundColor: '#eee' },
  botonPrefijo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  textoPrefijo: { fontSize: 15, fontWeight: '600', color: '#333' },
  flechita: { fontSize: 10, color: '#888', marginLeft: 4 },
  inputNumero: { flex: 1, padding: 12, fontSize: 15, color: '#222' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36 },
  modalTitulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  opcionPais: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  opcionPaisTexto: { fontSize: 15, color: '#222' },
  opcionPaisPrefijo: { fontSize: 15, color: '#888', fontWeight: '600' },
});
