import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import InputCelular, { detectarPaisPorDispositivo } from '../components/InputCelular';
import InputContraseña from '../components/InputContraseña';
import { registrarNotificacionesPush } from '../utils/notificacionesPush';

// Pantalla para quien fue asignado a un proyecto por otro negocio (trabajador, contratista, etc.),
// sin necesidad de un link de invitación: el vínculo ya existe en el servidor desde el momento en
// que el gerente lo asignó (tabla invitaciones, por celular). Aquí solo confirma su número.
export default function IngresarInvitadoScreen({ navigation }) {
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [contraseña, setContraseña] = useState('');
  const [confirmarContraseña, setConfirmarContraseña] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verificado, setVerificado] = useState(false);

  // Resultado de la verificación: 'pendiente' (tiene invitación, debe crear contraseña),
  // 'existente' (ya tiene cuenta y contraseña, inicia sesión normal), 'crear_contraseña_legacy'
  // (ya tiene cuenta pero nunca creó contraseña, sin invitación nueva pendiente - usuario antiguo)
  // o 'sin_asignar' (nadie lo agregó aún).
  const [estado, setEstado] = useState(null);
  const [empresaNombre, setEmpresaNombre] = useState('');

  const verificarCelular = async () => {
    if (!celular.trim()) {
      Alert.alert('Campo requerido', 'Escribe tu número de celular.');
      return;
    }

    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await axios.get(
        `https://backend-app-mediterraneo.onrender.com/api/invitaciones/verificar-celular/${encodeURIComponent(celularCompleto)}`
      );

      if (response.data.tiene_invitacion_pendiente) {
        setEstado('pendiente');
        setEmpresaNombre(response.data.empresa_nombre || '');
      } else if (response.data.ya_tiene_cuenta && response.data.debe_crear_contraseña) {
        setEstado('crear_contraseña_legacy');
      } else if (response.data.ya_tiene_cuenta) {
        setEstado('existente');
      } else {
        setEstado('sin_asignar');
      }
      setVerificado(true);
    } catch (error) {
      console.error('Error verificando celular de invitado:', error);
      const mensaje = error.response?.data?.error || 'No se pudo verificar el celular.';
      Alert.alert('Aviso', mensaje);
    } finally {
      setCargando(false);
    }
  };

  const iniciarSesionExistente = async () => {
    if (estado === 'crear_contraseña_legacy') {
      // Primera vez que este usuario antiguo crea contraseña: exigimos el mismo mínimo y
      // confirmación que en cualquier otro flujo de "crear contraseña" de la app.
      if (!contraseña || contraseña.length < 6) {
        Alert.alert('Contraseña requerida', 'Crea una contraseña de al menos 6 caracteres.');
        return;
      }
      if (contraseña !== confirmarContraseña) {
        Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
        return;
      }
    } else if (!contraseña) {
      Alert.alert('Contraseña requerida', 'Escribe tu contraseña.');
      return;
    }

    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await axios.post('https://backend-app-mediterraneo.onrender.com/api/auth/login', {
        celular: celularCompleto,
        contraseña,
      });
      await guardarSesionYEntrar(response.data.usuario, response.data.empresas);
    } catch (error) {
      console.error('Error en login de invitado:', error);
      const mensaje = error.response?.data?.error || 'No se pudo iniciar sesión.';
      Alert.alert('Error', mensaje);
    } finally {
      setCargando(false);
    }
  };

  const crearContraseñaYEntrar = async () => {
    if (!contraseña || contraseña.length < 6) {
      Alert.alert('Contraseña requerida', 'Crea una contraseña de al menos 6 caracteres.');
      return;
    }
    if (contraseña !== confirmarContraseña) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
      return;
    }

    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await axios.post('https://backend-app-mediterraneo.onrender.com/api/invitaciones/aceptar-por-celular', {
        celular: celularCompleto,
        contraseña,
      });
      await guardarSesionYEntrar(response.data.usuario, response.data.empresas);
    } catch (error) {
      console.error('Error aceptando invitación por celular:', error);
      const mensaje = error.response?.data?.error || 'No se pudo completar el ingreso.';
      Alert.alert('Error', mensaje);
    } finally {
      setCargando(false);
    }
  };

  const guardarSesionYEntrar = async (usuario, empresas) => {
    const sesion = { usuario, empresas };
    await AsyncStorage.setItem('sesion', JSON.stringify(sesion));
    registrarNotificacionesPush(usuario.id);

    if (empresas.length > 1) {
      navigation.replace('SeleccionarEmpresa', { empresas, usuario });
    } else {
      const primeraEmpresa = empresas[0];
      navigation.replace('Inicio', {
        empresa: {
          id: primeraEmpresa.empresa_id,
          nombre: primeraEmpresa.empresa_nombre,
          logo_url: primeraEmpresa.logo_url,
          color_hex: primeraEmpresa.color_hex,
          sitio_web: primeraEmpresa.sitio_web,
          area_id: primeraEmpresa.area_id,
          area_nombre: primeraEmpresa.area_nombre,
          area_tipo: primeraEmpresa.area_tipo,
          nit: primeraEmpresa.nit,
          cedula_representante: primeraEmpresa.cedula_representante,
          banco_nombre: primeraEmpresa.banco_nombre,
          banco_tipo_cuenta: primeraEmpresa.banco_tipo_cuenta,
          banco_numero: primeraEmpresa.banco_numero,
          banco_titular: primeraEmpresa.banco_titular,
        },
        usuario,
      });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <Text style={styles.titulo}>Ingresar como trabajador</Text>
        <Text style={styles.subtitulo}>Escribe tu número de celular para continuar</Text>

        <Text style={styles.label}>Número de celular</Text>
        <InputCelular
          numero={celular}
          onChangeNumero={(texto) => {
            setCelular(texto);
            setVerificado(false);
            setEstado(null);
            setContraseña('');
            setConfirmarContraseña('');
          }}
          pais={paisCelular}
          onChangePais={(p) => {
            setPaisCelular(p);
            setVerificado(false);
            setEstado(null);
            setContraseña('');
            setConfirmarContraseña('');
          }}
          disabled={cargando}
        />

        {verificado && estado === 'pendiente' && (
          <>
            <View style={styles.avisoOk}>
              <Text style={styles.avisoOkTexto}>
                {empresaNombre ? `${empresaNombre} te asignó. Crea tu contraseña.` : 'Tienes una asignación pendiente. Crea tu contraseña.'}
              </Text>
            </View>

            <Text style={styles.label}>Crea tu contraseña</Text>
            <InputContraseña
              value={contraseña}
              onChangeText={setContraseña}
              placeholder="Crea tu contraseña (mínimo 6 caracteres)"
            />
            <InputContraseña
              value={confirmarContraseña}
              onChangeText={setConfirmarContraseña}
              placeholder="Confirma tu contraseña"
            />
          </>
        )}

        {verificado && estado === 'existente' && (
          <>
            <Text style={styles.label}>Contraseña</Text>
            <InputContraseña
              value={contraseña}
              onChangeText={setContraseña}
              placeholder="Tu contraseña"
            />
          </>
        )}

        {verificado && estado === 'crear_contraseña_legacy' && (
          <>
            <View style={styles.avisoOk}>
              <Text style={styles.avisoOkTexto}>Ya perteneces a una empresa. Crea tu contraseña para entrar.</Text>
            </View>

            <Text style={styles.label}>Crea tu contraseña</Text>
            <InputContraseña
              value={contraseña}
              onChangeText={setContraseña}
              placeholder="Crea tu contraseña (mínimo 6 caracteres)"
            />
            <InputContraseña
              value={confirmarContraseña}
              onChangeText={setConfirmarContraseña}
              placeholder="Confirma tu contraseña"
            />
          </>
        )}

        {verificado && estado === 'sin_asignar' && (
          <View style={styles.avisoAlerta}>
            <Text style={styles.avisoAlertaTexto}>
              Ningún negocio te ha asignado todavía. Pídele a tu empleador que te agregue con este número.
            </Text>
          </View>
        )}

        {(!verificado || estado === 'sin_asignar') && (
          <TouchableOpacity style={styles.boton} onPress={verificarCelular} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>CONTINUAR</Text>}
          </TouchableOpacity>
        )}

        {verificado && estado === 'pendiente' && (
          <TouchableOpacity style={styles.boton} onPress={crearContraseñaYEntrar} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>INGRESAR</Text>}
          </TouchableOpacity>
        )}

        {verificado && (estado === 'existente' || estado === 'crear_contraseña_legacy') && (
          <TouchableOpacity style={styles.boton} onPress={iniciarSesionExistente} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>INGRESAR</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.botonSecundario} onPress={() => navigation.goBack()}>
          <Text style={styles.botonSecundarioTexto}>Volver</Text>
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
  avisoOk: { backgroundColor: '#E6F7EE', borderRadius: 8, padding: 12, marginTop: 16 },
  avisoOkTexto: { fontSize: 12, color: '#1E7E45' },
  avisoAlerta: { backgroundColor: '#FFF6E5', borderRadius: 8, padding: 12, marginTop: 16 },
  avisoAlertaTexto: { fontSize: 12, color: '#9A6700', lineHeight: 18 },
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
