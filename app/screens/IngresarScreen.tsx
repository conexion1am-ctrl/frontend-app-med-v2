import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import InputCelular, { detectarPaisPorDispositivo, PAISES } from '../components/InputCelular';

export default function IngresarScreen({ navigation }) {
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [contraseña, setContraseña] = useState('');
  const [requiereContraseña, setRequiereContraseña] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Si el celular ya inició sesión antes en este dispositivo, prellenamos su número
  // para que solo tenga que confirmar (no volver a escribirlo desde cero).
  useEffect(() => {
    precargarUltimoCelular();
  }, []);

  const precargarUltimoCelular = async () => {
    try {
      const sesionGuardada = await AsyncStorage.getItem('sesion');
      if (!sesionGuardada) return;
      const sesion = JSON.parse(sesionGuardada);
      const celularCompleto = sesion?.usuario?.celular;
      if (!celularCompleto) return;

      const paisEncontrado = PAISES.find((p) => celularCompleto.startsWith(p.prefijo));
      if (paisEncontrado) {
        setPaisCelular(paisEncontrado);
        setCelular(celularCompleto.replace(paisEncontrado.prefijo, '').trim());
      }
    } catch (error) {
      console.error('Error precargando último celular:', error);
    }
  };

  const verificarCelular = async () => {
    if (!celular.trim()) {
      Alert.alert('Campo requerido', 'Escribe tu número de celular.');
      return;
    }

    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await axios.post('https://backend-app-mediterraneo.onrender.com/api/auth/verificar', { celular: celularCompleto });
      setRequiereContraseña(response.data.requiere_contraseña);
      setVerificado(true);
      if (!response.data.requiere_contraseña) {
        await hacerLogin();
      }
    } catch (error) {
      console.error('Error verificando:', error);
      const mensaje = error.response?.data?.error || 'No se pudo verificar el celular.';
      Alert.alert('Aviso', mensaje);
    } finally {
      setCargando(false);
    }
  };

  const hacerLogin = async (contraseñaValor) => {
    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await axios.post('https://backend-app-mediterraneo.onrender.com/api/auth/login', {
        celular: celularCompleto,
        contraseña: contraseñaValor || contraseña || undefined,
      });

      const sesion = {
        usuario: response.data.usuario,
        empresas: response.data.empresas,
      };
      await AsyncStorage.setItem('sesion', JSON.stringify(sesion));

      if (response.data.empresas.length > 1) {
        // Pertenece a varias empresas: que elija con cuál entrar
        navigation.replace('SeleccionarEmpresa', {
          empresas: response.data.empresas,
          usuario: response.data.usuario,
        });
      } else {
        // Solo tiene una empresa, entramos directo a Inicio
        const primeraEmpresa = response.data.empresas[0];
        navigation.replace('Inicio', {
          empresa: {
            id: primeraEmpresa.empresa_id,
            nombre: primeraEmpresa.empresa_nombre,
            logo_url: primeraEmpresa.logo_url,
            color_hex: primeraEmpresa.color_hex,
            sitio_web: primeraEmpresa.sitio_web,
          },
          usuario: response.data.usuario,
        });
      }
    } catch (error) {
      console.error('Error en login:', error);
      const mensaje = error.response?.data?.error || 'No se pudo iniciar sesión.';
      Alert.alert('Error', mensaje);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <Text style={styles.titulo}>Ingresar</Text>
        <Text style={styles.subtitulo}>Escribe tu número de celular para continuar</Text>

        <Text style={styles.label}>Número de celular</Text>
        <InputCelular
          numero={celular}
          onChangeNumero={(texto) => {
            setCelular(texto);
            setVerificado(false);
          }}
          pais={paisCelular}
          onChangePais={(p) => {
            setPaisCelular(p);
            setVerificado(false);
          }}
          disabled={cargando}
        />

        {verificado && requiereContraseña && (
          <>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={contraseña}
              onChangeText={setContraseña}
              placeholder="Tu contraseña"
              placeholderTextColor="#999"
              secureTextEntry
            />
          </>
        )}

        <TouchableOpacity
          style={styles.boton}
          onPress={verificado && requiereContraseña ? () => hacerLogin() : verificarCelular}
          disabled={cargando}
        >
          {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>INGRESAR</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonSecundario} onPress={() => navigation.replace('PerfilEmpresa')}>
          <Text style={styles.botonSecundarioTexto}>¿Nuevo aquí? Crear perfil de empresa</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 26, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: '#666', marginBottom: 30, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  boton: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  botonSecundario: { alignItems: 'center', marginTop: 20, padding: 10 },
  botonSecundarioTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
});