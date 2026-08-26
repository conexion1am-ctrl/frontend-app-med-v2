import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InputCelular, { detectarPaisPorDispositivo } from '../components/InputCelular';
import InputContraseña from '../components/InputContraseña';
import { registrarNotificacionesPush } from '../utils/notificacionesPush';
import api from '../utils/apiClient';

// Pantalla para quien fue asignado a un proyecto por otro negocio (trabajador, contratista,
// cliente, etc.), sin necesidad de ningún link de invitación: el vínculo ya existe en el
// servidor desde el momento en que gerencia lo asignó (tabla invitaciones, por celular). Aquí
// solo confirma su número y la app descubre automáticamente a qué empresas/proyectos pertenece.
export default function IngresarInvitadoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [contraseña, setContraseña] = useState('');
  const [confirmarContraseña, setConfirmarContraseña] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verificado, setVerificado] = useState(false);

  // Flujo de "Olvidé mi contraseña": pide el nombre exacto registrado para validar identidad
  // (sin SMS ni servicios externos) y deja crear una contraseña nueva.
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [nombreRecuperar, setNombreRecuperar] = useState('');
  const [nuevaContraseñaRecuperar, setNuevaContraseñaRecuperar] = useState('');
  const [confirmarNuevaContraseñaRecuperar, setConfirmarNuevaContraseñaRecuperar] = useState('');

  // Resultado de la verificación: 'pendiente' (tiene invitación, debe crear contraseña),
  // 'existente' (ya tiene cuenta y contraseña, inicia sesión normal), 'crear_contraseña_legacy'
  // (ya tiene cuenta pero nunca creó contraseña, sin invitación nueva pendiente - usuario antiguo)
  // o 'sin_asignar' (nadie lo agregó aún).
  const [estado, setEstado] = useState(null);
  const [empresaNombre, setEmpresaNombre] = useState('');
  // Cuando estado === 'pendiente', distingue si la persona es nueva en la app (debe CREAR su
  // contraseña de verdad) o si ya tiene cuenta de otra empresa y solo está aceptando una
  // invitación nueva (debe escribir su contraseña ACTUAL, no inventar una — el backend la valida
  // contra la que ya tiene y rechaza si no coincide).
  const [invitadoYaTieneCuenta, setInvitadoYaTieneCuenta] = useState(false);

  const verificarCelular = async () => {
    if (!celular.trim()) {
      Alert.alert('Campo requerido', 'Escribe tu número de celular.');
      return;
    }

    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await api.get(
        `/invitaciones/verificar-celular/${encodeURIComponent(celularCompleto)}`
      );

      if (response.data.tiene_invitacion_pendiente) {
        setEstado('pendiente');
        setEmpresaNombre(response.data.empresa_nombre || '');
        setInvitadoYaTieneCuenta(!!response.data.ya_tiene_cuenta);
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
      const response = await api.post('/auth/login', {
        celular: celularCompleto,
        contraseña,
      });
      await guardarSesionYEntrar(response.data.usuario, response.data.empresas, response.data.token);
    } catch (error) {
      console.error('Error en login de invitado:', error);
      const mensaje = error.response?.data?.error || 'No se pudo iniciar sesión.';
      Alert.alert('Error', mensaje);
    } finally {
      setCargando(false);
    }
  };

  const crearContraseñaYEntrar = async () => {
    if (invitadoYaTieneCuenta) {
      // Ya tiene cuenta de otra empresa: solo escribe su contraseña actual, no hay nada que
      // "confirmar" (el backend valida que coincida con la que ya tiene).
      if (!contraseña) {
        Alert.alert('Contraseña requerida', 'Escribe tu contraseña.');
        return;
      }
    } else {
      if (!contraseña || contraseña.length < 6) {
        Alert.alert('Contraseña requerida', 'Crea una contraseña de al menos 6 caracteres.');
        return;
      }
      if (contraseña !== confirmarContraseña) {
        Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
        return;
      }
    }

    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const response = await api.post('/invitaciones/aceptar-por-celular', {
        celular: celularCompleto,
        contraseña,
      });
      await guardarSesionYEntrar(response.data.usuario, response.data.empresas, response.data.token);
    } catch (error) {
      console.error('Error aceptando invitación por celular:', error);
      const mensaje = error.response?.data?.error || 'No se pudo completar el ingreso.';
      Alert.alert('Error', mensaje);
    } finally {
      setCargando(false);
    }
  };

  const enviarRecuperarContraseña = async () => {
    if (!nombreRecuperar.trim()) {
      Alert.alert('Campo requerido', 'Escribe tu nombre completo tal como está registrado.');
      return;
    }
    if (!nuevaContraseñaRecuperar || nuevaContraseñaRecuperar.length < 6) {
      Alert.alert('Contraseña requerida', 'Crea una contraseña de al menos 6 caracteres.');
      return;
    }
    if (nuevaContraseñaRecuperar !== confirmarNuevaContraseñaRecuperar) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
      return;
    }

    setCargando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      await api.post('/invitaciones/recuperar-contraseña', {
        celular: celularCompleto,
        nombre: nombreRecuperar,
        contraseña_nueva: nuevaContraseñaRecuperar,
      });
      Alert.alert('¡Listo!', 'Tu contraseña fue actualizada. Ya puedes ingresar con tu contraseña nueva.');
      setModoRecuperar(false);
      setNombreRecuperar('');
      setNuevaContraseñaRecuperar('');
      setConfirmarNuevaContraseñaRecuperar('');
      setContraseña('');
    } catch (error) {
      console.error('Error recuperando contraseña:', error);
      const mensaje = error.response?.data?.error || 'No se pudo actualizar la contraseña.';
      Alert.alert('Error', mensaje);
    } finally {
      setCargando(false);
    }
  };

  const guardarSesionYEntrar = async (usuario, empresas, token) => {
    // Token de sesión (Paso 2 de la migración a autenticación real, 2026-08-25): se guarda junto
    // con usuario/empresas — el interceptor de apiClient.js lo toma de aquí en cada request.
    const sesion = { usuario, empresas, token };
    await AsyncStorage.setItem('sesion', JSON.stringify(sesion));
    registrarNotificacionesPush(usuario.id);

    // Siempre pasa por Seleccionar Empresa (incluso con una sola), para que ahí tenga
    // disponible el menú de editar/eliminar. Usamos reset (no replace) para vaciar el
    // historial: si no, el botón físico "atrás" volvería a esta pantalla pidiendo el
    // celular otra vez, aunque la sesión ya quedó guardada.
    navigation.reset({
      index: 0,
      routes: [{ name: 'SeleccionarEmpresa', params: { empresas, usuario } }],
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.titulo}>Ingresar como invitado</Text>
        <Text style={styles.subtitulo}>
          {modoRecuperar
            ? 'Recupera tu contraseña'
            : 'Escribe tu número de celular para continuar. Sirve tanto si trabajas ahí como si eres cliente de un proyecto.'}
        </Text>

        <Text style={styles.label}>Número de celular</Text>
        <InputCelular
          numero={celular}
          onChangeNumero={(texto) => {
            setCelular(texto);
            setVerificado(false);
            setEstado(null);
            setInvitadoYaTieneCuenta(false);
            setContraseña('');
            setConfirmarContraseña('');
            setModoRecuperar(false);
          }}
          pais={paisCelular}
          onChangePais={(p) => {
            setPaisCelular(p);
            setVerificado(false);
            setEstado(null);
            setInvitadoYaTieneCuenta(false);
            setContraseña('');
            setConfirmarContraseña('');
            setModoRecuperar(false);
          }}
          disabled={cargando}
        />

        {verificado && estado === 'pendiente' && (
          <>
            <View style={styles.avisoOk}>
              <Text style={styles.avisoOkTexto}>
                {invitadoYaTieneCuenta
                  ? `${empresaNombre ? `${empresaNombre} te asignó a un proyecto` : 'Tienes una asignación pendiente'}. Como ya tienes cuenta en otra empresa, escribe tu contraseña actual para aceptar.`
                  : `${empresaNombre ? `${empresaNombre} te asignó` : 'Tienes una asignación pendiente'}. Crea tu contraseña.`}
              </Text>
            </View>

            {invitadoYaTieneCuenta ? (
              <>
                <Text style={styles.label}>Tu contraseña</Text>
                <InputContraseña
                  value={contraseña}
                  onChangeText={setContraseña}
                  placeholder="Tu contraseña actual"
                />
              </>
            ) : (
              <>
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
          </>
        )}

        {verificado && estado === 'existente' && !modoRecuperar && (
          <>
            <Text style={styles.label}>Contraseña</Text>
            <InputContraseña
              value={contraseña}
              onChangeText={setContraseña}
              placeholder="Tu contraseña"
            />
            <TouchableOpacity onPress={() => setModoRecuperar(true)}>
              <Text style={styles.enlaceOlvide}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </>
        )}

        {verificado && estado === 'existente' && modoRecuperar && (
          <>
            <View style={styles.avisoOk}>
              <Text style={styles.avisoOkTexto}>
                Para verificar que eres tú, escribe tu nombre completo tal como está registrado (el mismo que aparece en Grupo de Trabajo de tu empresa).
              </Text>
            </View>

            <Text style={styles.label}>Tu nombre completo</Text>
            <TextInput
              style={styles.input}
              value={nombreRecuperar}
              onChangeText={setNombreRecuperar}
              placeholder="Nombre completo registrado"
              placeholderTextColor="#999"
              editable={!cargando}
            />

            <Text style={styles.label}>Nueva contraseña</Text>
            <InputContraseña
              value={nuevaContraseñaRecuperar}
              onChangeText={setNuevaContraseñaRecuperar}
              placeholder="Crea una contraseña (mínimo 6 caracteres)"
            />
            <InputContraseña
              value={confirmarNuevaContraseñaRecuperar}
              onChangeText={setConfirmarNuevaContraseñaRecuperar}
              placeholder="Confirma tu nueva contraseña"
            />

            <TouchableOpacity onPress={() => setModoRecuperar(false)}>
              <Text style={styles.enlaceOlvide}>Volver a escribir mi contraseña actual</Text>
            </TouchableOpacity>
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

        {verificado && estado === 'existente' && !modoRecuperar && (
          <TouchableOpacity style={styles.boton} onPress={iniciarSesionExistente} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>INGRESAR</Text>}
          </TouchableOpacity>
        )}

        {verificado && estado === 'existente' && modoRecuperar && (
          <TouchableOpacity style={styles.boton} onPress={enviarRecuperarContraseña} disabled={cargando}>
            {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>ACTUALIZAR CONTRASEÑA</Text>}
          </TouchableOpacity>
        )}

        {verificado && estado === 'crear_contraseña_legacy' && (
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#222',
  },
  enlaceOlvide: { color: '#1E90FF', fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'right' },
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
