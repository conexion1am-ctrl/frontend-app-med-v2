import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/apiClient';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../firebaseConfig';
import InputCelular, { detectarPaisPorDispositivo } from '../components/InputCelular';
import InputContraseña from '../components/InputContraseña';

const COLORES = ['#1E90FF', '#FF6347', '#32CD32', '#FFD700', '#8A2BE2', '#FF69B4', '#20B2AA', '#DC143C', '#A8C69F', '#C9B79C', '#9CAF88', '#D4B896', '#87A96B', '#000000', '#808080', '#FFFFFF'];

export default function PerfilEmpresaScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [sitioWeb, setSitioWeb] = useState('');
  const [colorSeleccionado, setColorSeleccionado] = useState(COLORES[0]);
  const [contraseña, setContraseña] = useState('');
  const [confirmarContraseña, setConfirmarContraseña] = useState('');
  const [cargando, setCargando] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
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

  const crearPerfil = async () => {
    if (!nombreEmpresa.trim() || !nombreUsuario.trim() || !celular.trim() || !contraseña.trim()) {
      Alert.alert('Campos incompletos', 'Nombre de la empresa, nombre de usuario, celular y contraseña son obligatorios.');
      return;
    }

    if (contraseña.length < 6) {
      Alert.alert('Contraseña muy corta', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (contraseña !== confirmarContraseña) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
      return;
    }

    setCargando(true);
    try {
      let logoUrlFinal: string | null = null;

      if (logoUri) {
        setSubiendoLogo(true);
        logoUrlFinal = await subirLogoAFirebase(logoUri);
        setSubiendoLogo(false);
      }

      const response = await api.post('/empresas/crear-perfil', {
        nombre_empresa: nombreEmpresa,
        nombre_usuario: nombreUsuario,
        celular: `${paisCelular.prefijo} ${celular}`,
        sitio_web: sitioWeb || null,
        color_hex: colorSeleccionado,
        logo_url: logoUrlFinal,
        contraseña: contraseña,
      });

      // Guardar sesión en el dispositivo para que persista entre recargas
      const sesion = {
        usuario: response.data.usuario,
        empresas: [
          {
            empresa_id: response.data.empresa.id,
            empresa_nombre: response.data.empresa.nombre,
            logo_url: response.data.empresa.logo_url,
            color_hex: response.data.empresa.color_hex,
            sitio_web: response.data.empresa.sitio_web,
            area_id: response.data.rol.area_id,
            area_nombre: 'GERENCIA',
          },
        ],
      };
      await AsyncStorage.setItem('sesion', JSON.stringify(sesion));

      navigation.replace('Bienvenida', { empresa: response.data.empresa, usuario: response.data.usuario });
    } catch (error) {
      console.error('Error:', error);
      const mensajeError = error.response?.data?.error || 'No se pudo crear el perfil. Verifica los datos e intenta de nuevo.';
      Alert.alert('Error', mensajeError);
    } finally {
      setCargando(false);
      setSubiendoLogo(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 20) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titulo}>Perfil de la Empresa</Text>
        <Text style={styles.subtitulo}>Crea el perfil de tu empresa para comenzar</Text>

        <Text style={styles.label}>Logo de la empresa (opcional)</Text>
        <View style={styles.logoContainer}>
          <TouchableOpacity style={styles.logoCirculo} onPress={elegirLogo}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImagen} />
            ) : (
              <Text style={styles.logoPlaceholder}>+{'\n'}Logo</Text>
            )}
          </TouchableOpacity>
          {logoUri && (
            <TouchableOpacity onPress={elegirLogo}>
              <Text style={styles.logoCambiar}>Cambiar imagen</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>Nombre de la empresa o contratista *</Text>
        <TextInput
          style={styles.input}
          value={nombreEmpresa}
          onChangeText={setNombreEmpresa}
          placeholder="Ej: Mediterráneo Construcción y Diseño"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>URL de la empresa (opcional)</Text>
        <TextInput
          style={styles.input}
          value={sitioWeb}
          onChangeText={setSitioWeb}
          placeholder="Ej: www.miempresa.com"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Color distintivo de la empresa</Text>
        <View style={styles.coloresContainer}>
          {COLORES.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorCirculo,
                { backgroundColor: color },
                colorSeleccionado === color && styles.colorSeleccionado,
              ]}
              onPress={() => setColorSeleccionado(color)}
            />
          ))}
        </View>

        <Text style={styles.label}>Nombre de Usuario (Gerente) *</Text>
        <TextInput
          style={styles.input}
          value={nombreUsuario}
          onChangeText={setNombreUsuario}
          placeholder="Tu nombre completo"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Área Designada</Text>
        <View style={styles.areaFija}>
          <Text style={styles.areaFijaTexto}>GERENCIA</Text>
        </View>

        <Text style={styles.label}>Número de celular *</Text>
        <InputCelular
          numero={celular}
          onChangeNumero={setCelular}
          pais={paisCelular}
          onChangePais={setPaisCelular}
        />

        <Text style={styles.label}>Contraseña *</Text>
        <InputContraseña
          value={contraseña}
          onChangeText={setContraseña}
          placeholder="Mínimo 6 caracteres"
        />

        <Text style={styles.label}>Confirmar contraseña *</Text>
        <InputContraseña
          value={confirmarContraseña}
          onChangeText={setConfirmarContraseña}
          placeholder="Repite tu contraseña"
        />

        <TouchableOpacity style={styles.boton} onPress={crearPerfil} disabled={cargando}>
          {cargando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>
              {subiendoLogo ? 'SUBIENDO LOGO...' : 'CREAR PERFIL'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitulo: { fontSize: 14, color: '#666', marginBottom: 24 },
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
  areaFija: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  areaFijaTexto: { fontSize: 15, fontWeight: 'bold', color: '#555' },
  boton: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});