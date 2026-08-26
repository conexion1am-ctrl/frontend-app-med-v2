import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InputCelular, { detectarPaisPorDispositivo, PAISES } from '../components/InputCelular';
import InputContraseña from '../components/InputContraseña';
import { registrarNotificacionesPush } from '../utils/notificacionesPush';
import api from '../utils/apiClient';

export default function IngresarScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [contraseña, setContraseña] = useState('');
  const [confirmarContraseña, setConfirmarContraseña] = useState('');
  const [requiereContraseña, setRequiereContraseña] = useState(false);
  const [debeCrearContraseña, setDebeCrearContraseña] = useState(false);
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
      const response = await api.post('/auth/verificar', { celular: celularCompleto });
      setRequiereContraseña(response.data.requiere_contraseña);
      setDebeCrearContraseña(!!response.data.debe_crear_contraseña);
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

  const intentarLogin = async () => {
    if (debeCrearContraseña) {
      if (!contraseña || contraseña.length < 6) {
        Alert.alert('Contraseña requerida', 'Crea una contraseña de al menos 6 caracteres.');
        return;
      }
      if (contraseña !== confirmarContraseña) {
        Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
        return;
      }
    }
    await hacerLogin();
  };

  const hacerLogin = async (contraseñaValor) => {
    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await api.post('/auth/login', {
        celular: celularCompleto,
        contraseña: contraseñaValor || contraseña || undefined,
      });

      // Guardamos el token de sesión (Paso 2 de la migración a autenticación real, 2026-08-25)
      // junto con usuario/empresas: el interceptor de apiClient.js lo lee de aquí en cada request.
      const sesion = {
        usuario: response.data.usuario,
        empresas: response.data.empresas,
        token: response.data.token,
      };
      await AsyncStorage.setItem('sesion', JSON.stringify(sesion));
      registrarNotificacionesPush(response.data.usuario.id);

      // Siempre pasa por Seleccionar Empresa (incluso con una sola), para que ahí tenga
      // disponible el menú de editar/eliminar. Usamos reset (no replace) para vaciar el
      // historial: si no, el botón físico "atrás" volvería a esta pantalla de login pidiendo
      // celular y contraseña otra vez, aunque la sesión ya quedó guardada.
      navigation.reset({
        index: 0,
        routes: [{
          name: 'SeleccionarEmpresa',
          params: { empresas: response.data.empresas, usuario: response.data.usuario },
        }],
      });
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
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
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
            <Text style={styles.label}>{debeCrearContraseña ? 'Crea tu contraseña' : 'Contraseña'}</Text>
            {debeCrearContraseña && (
              <Text style={styles.notaTexto}>
                Es la primera vez que ingresas con contraseña. Crea una de al menos 6 caracteres.
              </Text>
            )}
            <InputContraseña
              value={contraseña}
              onChangeText={setContraseña}
              placeholder={debeCrearContraseña ? 'Crea tu contraseña (mínimo 6 caracteres)' : 'Tu contraseña'}
            />
            {debeCrearContraseña && (
              <InputContraseña
                value={confirmarContraseña}
                onChangeText={setConfirmarContraseña}
                placeholder="Confirma tu contraseña"
              />
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.boton}
          onPress={verificado && requiereContraseña ? () => intentarLogin() : verificarCelular}
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
  notaTexto: { fontSize: 12, color: '#888', marginBottom: 8 },
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