import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { storage } from '../../firebaseConfig';
import InputContraseña from '../components/InputContraseña';
import { permisosDe } from '../utils/roles';

const COLORES = ['#1E90FF', '#FF6347', '#32CD32', '#FFD700', '#8A2BE2', '#FF69B4', '#20B2AA', '#DC143C', '#A8C69F', '#C9B79C', '#9CAF88', '#D4B896', '#87A96B', '#000000', '#808080', '#FFFFFF'];

export default function EditarPerfilScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const puedeEditarEmpresa = permisosDe(empresa).editarPerfilEmpresa;

  // Datos de empresa
  const [nombreEmpresa, setNombreEmpresa] = useState(empresa.nombre || '');
  const [sitioWeb, setSitioWeb] = useState(empresa.sitio_web || '');
  const [colorSeleccionado, setColorSeleccionado] = useState(empresa.color_hex || COLORES[0]);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoUrlActual, setLogoUrlActual] = useState(empresa.logo_url || null);
  const [cedulaRepresentante, setCedulaRepresentante] = useState(empresa.cedula_representante || '');
  const [nit, setNit] = useState(empresa.nit || '');
  const [bancoNombre, setBancoNombre] = useState(empresa.banco_nombre || '');
  const [bancoTipoCuenta, setBancoTipoCuenta] = useState(empresa.banco_tipo_cuenta || '');
  const [bancoNumero, setBancoNumero] = useState(empresa.banco_numero || '');
  const [bancoTitular, setBancoTitular] = useState(empresa.banco_titular || '');

  // Datos de usuario
  const [nombreUsuario, setNombreUsuario] = useState(usuario.nombre || '');
  const [contraseñaActual, setContraseñaActual] = useState('');
  const [contraseñaNueva, setContraseñaNueva] = useState('');
  const [confirmarContraseñaNueva, setConfirmarContraseñaNueva] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  const elegirLogo = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para elegir el logo.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!resultado.canceled) {
      setLogoUri(resultado.assets[0].uri);
    }
  };

  const subirLogoAFirebase = async (uri: string): Promise<string> => {
    const respuesta = await fetch(uri);
    const blob = await respuesta.blob();
    const nombreArchivo = `logos/${Date.now()}.jpg`;
    const storageRef = ref(storage, nombreArchivo);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    return url;
  };

  const guardarCambios = async () => {
    if (puedeEditarEmpresa && !nombreEmpresa.trim()) {
      Alert.alert('Campo obligatorio', 'El nombre de la empresa es obligatorio.');
      return;
    }
    if (!nombreUsuario.trim()) {
      Alert.alert('Campo obligatorio', 'Tu nombre es obligatorio.');
      return;
    }
    if (contraseñaNueva && contraseñaNueva.length < 6) {
      Alert.alert('Contraseña muy corta', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (contraseñaNueva && contraseñaNueva !== confirmarContraseñaNueva) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas nuevas sean iguales.');
      return;
    }

    setGuardando(true);
    try {
      // 1. Si eligió un logo nuevo, subirlo primero (solo si puede editar datos de empresa)
      let logoUrlFinal = logoUrlActual;
      if (puedeEditarEmpresa && logoUri) {
        setSubiendoLogo(true);
        logoUrlFinal = await subirLogoAFirebase(logoUri);
        setSubiendoLogo(false);
      }

      // 2. Actualizar datos de la empresa: solo Gerencia puede (logo/color/nombre/sitio web).
      // Áreas administrativas sin este permiso solo actualizan su propio usuario.
      let empresaFinal = empresa;
      if (puedeEditarEmpresa) {
        const respuestaEmpresa = await axios.put(`https://backend-app-mediterraneo.onrender.com/api/empresas/${empresa.id}`, {
          nombre_empresa: nombreEmpresa,
          logo_url: logoUrlFinal,
          sitio_web: sitioWeb || null,
          color_hex: colorSeleccionado,
          solicitante_id: usuario.id,
          cedula_representante: cedulaRepresentante || null,
          nit: nit || null,
          banco_nombre: bancoNombre || null,
          banco_tipo_cuenta: bancoTipoCuenta || null,
          banco_numero: bancoNumero || null,
          banco_titular: bancoTitular || null,
        });
        empresaFinal = { ...empresa, ...respuestaEmpresa.data.empresa };
      }

      // 3. Actualizar datos del usuario
      const respuestaUsuario = await axios.put(`https://backend-app-mediterraneo.onrender.com/api/auth/usuario/${usuario.id}`, {
        nombre: nombreUsuario,
        contraseña_actual: contraseñaActual || undefined,
        contraseña_nueva: contraseñaNueva || undefined,
      });

      // 4. Actualizar la sesión guardada en el dispositivo con los datos nuevos. Sin este paso,
      // los cambios (logo, nombre, color, etc.) solo se ven mientras la app sigue abierta: al
      // cerrarla y reabrirla, la pantalla de Inicio se arma con la sesión vieja guardada en el
      // celular (que no pide contraseña de nuevo) y muestra otra vez los datos anteriores.
      try {
        const sesionGuardada = await AsyncStorage.getItem('sesion');
        if (sesionGuardada) {
          const sesion = JSON.parse(sesionGuardada);
          sesion.usuario = respuestaUsuario.data.usuario;
          if (Array.isArray(sesion.empresas)) {
            sesion.empresas = sesion.empresas.map((e) =>
              e.empresa_id === empresaFinal.id
                ? {
                    ...e,
                    empresa_nombre: empresaFinal.nombre,
                    logo_url: empresaFinal.logo_url,
                    color_hex: empresaFinal.color_hex,
                    sitio_web: empresaFinal.sitio_web,
                  }
                : e
            );
          }
          await AsyncStorage.setItem('sesion', JSON.stringify(sesion));
        }
      } catch (errorSesion) {
        console.error('Error actualizando sesión guardada:', errorSesion);
      }

      Alert.alert('¡Listo!', 'Perfil actualizado exitosamente.', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('Inicio', {
              empresa: empresaFinal,
              usuario: respuestaUsuario.data.usuario,
            });
          },
        },
      ]);
    } catch (error) {
      console.error('Error guardando cambios:', error);
      const mensajeError = error.response?.data?.error || 'No se pudieron guardar los cambios. Intenta de nuevo.';
      Alert.alert('Error', mensajeError);
    } finally {
      setGuardando(false);
      setSubiendoLogo(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView style={[styles.container, { backgroundColor: empresa.color_hex || '#1E90FF' }]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo}>Editar Perfil</Text>

        {/* SECCIÓN EMPRESA: solo Gerencia puede editar logo/nombre/sitio web/color */}
        {puedeEditarEmpresa && (
          <>
            <Text style={styles.seccionTitulo}>Datos de la Empresa</Text>

            <Text style={styles.label}>Logo de la empresa</Text>
            <View style={styles.logoContainer}>
              <TouchableOpacity style={styles.logoCirculo} onPress={elegirLogo}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImagen} />
                ) : logoUrlActual ? (
                  <Image source={{ uri: logoUrlActual }} style={styles.logoImagen} />
                ) : (
                  <Text style={styles.logoPlaceholder}>+{'\n'}Logo</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={elegirLogo}>
                <Text style={styles.logoCambiar}>Cambiar imagen</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Nombre de la empresa *</Text>
            <TextInput style={styles.input} value={nombreEmpresa} onChangeText={setNombreEmpresa} placeholderTextColor="#999" />

            <Text style={styles.label}>URL de la empresa</Text>
            <TextInput style={styles.input} value={sitioWeb} onChangeText={setSitioWeb} placeholder="Ej: www.miempresa.com" placeholderTextColor="#999" />

            <Text style={styles.label}>Color distintivo</Text>
            <View style={styles.coloresContainer}>
              {COLORES.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorCirculo, { backgroundColor: color }, colorSeleccionado === color && styles.colorSeleccionado]}
                  onPress={() => setColorSeleccionado(color)}
                />
              ))}
            </View>

            <Text style={styles.seccionTitulo2}>Datos para contratos</Text>
            <Text style={styles.ayudaTexto}>Estos datos aparecen automáticamente en los contratos que genera la app.</Text>

            <Text style={styles.label}>Cédula del representante legal</Text>
            <TextInput style={styles.input} value={cedulaRepresentante} onChangeText={setCedulaRepresentante} placeholder="Ej: 1.152.442.156" placeholderTextColor="#999" keyboardType="number-pad" />

            <Text style={styles.label}>NIT de la empresa</Text>
            <TextInput style={styles.input} value={nit} onChangeText={setNit} placeholder="Ej: 900990917-1" placeholderTextColor="#999" />

            <Text style={styles.label}>Banco</Text>
            <TextInput style={styles.input} value={bancoNombre} onChangeText={setBancoNombre} placeholder="Ej: Bancolombia" placeholderTextColor="#999" />

            <Text style={styles.label}>Tipo de cuenta</Text>
            <TextInput style={styles.input} value={bancoTipoCuenta} onChangeText={setBancoTipoCuenta} placeholder="Ej: Ahorros" placeholderTextColor="#999" />

            <Text style={styles.label}>Número de cuenta</Text>
            <TextInput style={styles.input} value={bancoNumero} onChangeText={setBancoNumero} placeholder="Ej: 93363300004" placeholderTextColor="#999" keyboardType="number-pad" />

            <Text style={styles.label}>Titular de la cuenta</Text>
            <TextInput style={styles.input} value={bancoTitular} onChangeText={setBancoTitular} placeholder="Ej: Inversiones Obra Blanca S.A.S" placeholderTextColor="#999" />
          </>
        )}

        {/* SECCIÓN USUARIO */}
        <Text style={[styles.seccionTitulo, { marginTop: 32 }]}>Datos de tu Usuario</Text>

        <Text style={styles.label}>Tu nombre *</Text>
        <TextInput style={styles.input} value={nombreUsuario} onChangeText={setNombreUsuario} placeholderTextColor="#999" />

        <Text style={styles.label}>Contraseña actual</Text>
        <InputContraseña
          value={contraseñaActual}
          onChangeText={setContraseñaActual}
          placeholder="Solo si vas a cambiar tu contraseña"
        />

        <Text style={styles.label}>Contraseña nueva (opcional)</Text>
        <InputContraseña
          value={contraseñaNueva}
          onChangeText={setContraseñaNueva}
          placeholder="Déjalo vacío si no quieres cambiarla"
        />

        <Text style={styles.label}>Confirmar contraseña nueva</Text>
        <InputContraseña
          value={confirmarContraseñaNueva}
          onChangeText={setConfirmarContraseñaNueva}
          placeholder="Repite la contraseña nueva"
        />

        <TouchableOpacity style={styles.boton} onPress={guardarCambios} disabled={guardando}>
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>{subiendoLogo ? 'SUBIENDO LOGO...' : 'GUARDAR CAMBIOS'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonCancelar} onPress={() => navigation.goBack()}>
          <Text style={styles.botonCancelarTexto}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  seccionTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1E90FF', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  seccionTitulo2: { fontSize: 14, fontWeight: 'bold', color: '#1E90FF', marginTop: 28, marginBottom: 4, textTransform: 'uppercase' },
  ayudaTexto: { fontSize: 12, color: '#888', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoContainer: { alignItems: 'center', marginTop: 4 },
  logoCirculo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e8e8e8',
    borderWidth: 2,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImagen: { width: 100, height: 100, borderRadius: 50 },
  logoPlaceholder: { textAlign: 'center', color: '#888', fontSize: 13, fontWeight: '600' },
  logoCambiar: { color: '#1E90FF', fontSize: 13, fontWeight: '600', marginTop: 8 },
  coloresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  colorCirculo: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#ccc' },
  colorSeleccionado: { borderColor: '#000' },
  boton: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  botonCancelar: { alignItems: 'center', marginTop: 14, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
});