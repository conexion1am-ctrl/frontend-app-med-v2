import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import InputContraseña from '../components/InputContraseña';
import { registrarNotificacionesPush } from '../utils/notificacionesPush';

// Pantalla que se abre cuando alguien toca el link de invitación que le mandaron por WhatsApp.
export default function AceptarInvitacionScreen({ route, navigation }) {
  const { token } = route.params;

  const [cargandoInvitacion, setCargandoInvitacion] = useState(true);
  const [invitacion, setInvitacion] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');

  const [contraseña, setContraseña] = useState('');
  const [confirmarContraseña, setConfirmarContraseña] = useState('');
  const [aceptando, setAceptando] = useState(false);

  useEffect(() => {
    cargarInvitacion();
  }, []);

  const cargarInvitacion = async () => {
    setCargandoInvitacion(true);
    try {
      const response = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/invitaciones/${token}`);
      setInvitacion(response.data);
    } catch (error) {
      console.error('Error cargando invitación:', error);
      const mensaje = error.response?.data?.error || 'No se pudo cargar esta invitación. Puede que ya no sea válida.';
      setErrorCarga(mensaje);
    } finally {
      setCargandoInvitacion(false);
    }
  };

  const aceptarInvitacion = async () => {
    if (!contraseña || contraseña.length < 6) {
      Alert.alert('Contraseña requerida', 'Crea una contraseña de al menos 6 caracteres para poder ingresar desde cualquier dispositivo.');
      return;
    }
    if (contraseña !== confirmarContraseña) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
      return;
    }

    setAceptando(true);
    try {
      const response = await axios.post(`https://backend-app-mediterraneo.onrender.com/api/invitaciones/aceptar/${token}`, {
        contraseña,
      });

      const { usuario, empresas } = response.data;

      // Guardamos la sesión de una vez y entramos directo a la app, sin pasar por la pantalla
      // de Ingresar: la persona ya escribió su contraseña acá mismo, no tiene sentido pedirle
      // que la vuelva a escribir. Si quedó en varias áreas/empresas, que elija con cuál entrar;
      // si es solo una, directo a Inicio con sus proyectos asignados.
      const sesion = { usuario, empresas };
      await AsyncStorage.setItem('sesion', JSON.stringify(sesion));
      registrarNotificacionesPush(usuario.id);

      if (empresas && empresas.length > 1) {
        navigation.replace('SeleccionarEmpresa', { empresas, usuario });
      } else {
        const primeraEmpresa = empresas?.[0];
        navigation.replace('Inicio', {
          empresa: primeraEmpresa
            ? {
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
              }
            : { id: invitacion.empresa_id, nombre: invitacion.empresa_nombre, color_hex: invitacion.color_hex },
          usuario,
        });
      }
    } catch (error) {
      console.error('Error aceptando invitación:', error);
      const mensaje = error.response?.data?.error || 'No se pudo aceptar la invitación. Intenta de nuevo.';
      Alert.alert('Error', mensaje);
    } finally {
      setAceptando(false);
    }
  };

  if (cargandoInvitacion) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E90FF" />
      </View>
    );
  }

  if (errorCarga) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTexto}>{errorCarga}</Text>
      </View>
    );
  }

  if (invitacion.usado) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTexto}>Esta invitación ya fue utilizada anteriormente.</Text>
        <TouchableOpacity style={styles.botonSecundario} onPress={() => navigation.replace('SeleccionarModo')}>
          <Text style={styles.botonSecundarioTexto}>Ir a Ingresar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: invitacion.color_hex || '#1E90FF' }]}>
        <Text style={styles.titulo}>Te invitaron a</Text>
        <Text style={styles.empresaNombre}>{invitacion.empresa_nombre}</Text>
        <Text style={styles.areaTexto}>Área: {invitacion.area_nombre}</Text>
        <Text style={styles.nombreTexto}>{invitacion.nombre_invitado}</Text>

        <View style={styles.formulario}>
          <Text style={styles.label}>Crea tu contraseña</Text>
          <Text style={styles.notaTexto}>
            Así podrás ingresar desde tu celular u otro dispositivo con tu número y esta contraseña.
          </Text>

          <InputContraseña
            value={contraseña}
            onChangeText={setContraseña}
            placeholder="Crea tu contraseña (mínimo 6 caracteres)"
            style={styles.input}
          />
          <InputContraseña
            value={confirmarContraseña}
            onChangeText={setConfirmarContraseña}
            placeholder="Confirma tu contraseña"
            style={styles.input}
          />
        </View>

        <TouchableOpacity style={styles.boton} onPress={aceptarInvitacion} disabled={aceptando}>
          {aceptando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>ACEPTAR Y UNIRME</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f5f5f5' },
  errorTexto: { fontSize: 15, color: '#DC143C', textAlign: 'center' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  empresaNombre: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginTop: 4 },
  areaTexto: { fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 12 },
  nombreTexto: { fontSize: 18, fontWeight: '600', color: '#fff', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  formulario: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, marginTop: 10 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  notaTexto: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  boton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  botonTexto: { color: '#222', fontSize: 16, fontWeight: 'bold' },
  botonSecundario: { marginTop: 20, padding: 10 },
  botonSecundarioTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
});
