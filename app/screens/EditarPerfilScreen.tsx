import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { storage } from '../../firebaseConfig';
import InputContraseña from '../components/InputContraseña';

const COLORES = ['#1E90FF', '#FF6347', '#32CD32', '#FFD700', '#8A2BE2', '#FF69B4', '#20B2AA', '#DC143C', '#A8C69F', '#C9B79C', '#9CAF88', '#D4B896', '#87A96B', '#000000', '#808080', '#FFFFFF'];

export default function EditarPerfilScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;

  // Datos de empresa
  const [nombreEmpresa, setNombreEmpresa] = useState(empresa.nombre || '');
  const [sitioWeb, setSitioWeb] = useState(empresa.sitio_web || '');
  const [colorSeleccionado, setColorSeleccionado] = useState(empresa.color_hex || COLORES[0]);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoUrlActual, setLogoUrlActual] = useState(empresa.logo_url || null);

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
    if (!nombreEmpresa.trim()) {
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
      // 1. Si eligió un logo nuevo, subirlo primero
      let logoUrlFinal = logoUrlActual;
      if (logoUri) {
        setSubiendoLogo(true);
        logoUrlFinal = await subirLogoAFirebase(logoUri);
        setSubiendoLogo(false);
      }

      // 2. Actualizar datos de la empresa
      const respuestaEmpresa = await axios.put(`https://backend-app-mediterraneo.onrender.com/api/empresas/${empresa.id}`, {
        nombre_empresa: nombreEmpresa,
        logo_url: logoUrlFinal,
        sitio_web: sitioWeb || null,
        color_hex: colorSeleccionado,
      });

      // 3. Actualizar datos del usuario
      const respuestaUsuario = await axios.put(`https://backend-app-mediterraneo.onrender.com/api/auth/usuario/${usuario.id}`, {
        nombre: nombreUsuario,
        contraseña_actual: contraseñaActual || undefined,
        contraseña_nueva: contraseñaNueva || undefined,
      });

      Alert.alert('¡Listo!', 'Perfil actualizado exitosamente.', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('Inicio', {
              empresa: respuestaEmpresa.data.empresa,
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

        {/* SECCIÓN EMPRESA */}
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