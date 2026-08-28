import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/apiClient';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../firebaseConfig';
import InputContraseña from '../components/InputContraseña';
import { permisosDe } from '../utils/roles';

// TEMAS (2026-08-27, a pedido del usuario): antes eran 16 colores sueltos elegidos al azar sin
// relación entre sí ("demasiados colores"). Ahora son 8 paletas de tema, cada una con 4 tonos
// coordinados (claro/medio/base/oscuro) ya probados para que el texto nunca choque con el fondo.
// Por ahora seguimos guardando SOLO el tono "base" en empresa.color_hex — exactamente el mismo
// campo y formato de siempre — para no tocar ninguna de las ~18 pantallas, PDFs, ni las sombras
// de texto que ya dependen de ese único valor hexadecimal. Los tonos claro/medio/oscuro quedan
// listos para una futura fase que aplique fondos no-blancos por tema.
const TEMAS = [
  { nombre: 'Gris pizarra', base: '#5F5E5A', claro: '#F1EFE8', medio: '#B4B2A9', oscuro: '#2C2C2A' },
  { nombre: 'Azul acero', base: '#185FA5', claro: '#E6F1FB', medio: '#85B7EB', oscuro: '#042C53' },
  { nombre: 'Ocre tierra', base: '#854F0B', claro: '#FAEEDA', medio: '#EF9F27', oscuro: '#412402' },
  { nombre: 'Verde bosque', base: '#3B6D11', claro: '#EAF3DE', medio: '#97C459', oscuro: '#173404' },
  { nombre: 'Rojo ladrillo', base: '#993C1D', claro: '#FAECE7', medio: '#F0997B', oscuro: '#4A1B0C' },
  { nombre: 'Amarillo quemado', base: '#A66A00', claro: '#FCF3DC', medio: '#E3A424', oscuro: '#4D3200' },
  { nombre: 'Rosa pastel', base: '#C46E90', claro: '#FBEFF3', medio: '#E3A9C0', oscuro: '#5E2C3E' },
  { nombre: 'Morado pastel', base: '#8B7BB8', claro: '#F2EFFA', medio: '#C0B4E0', oscuro: '#3C3260' },
];

export default function EditarPerfilScreen({ route, navigation }) {
  const { empresa, usuario } = route.params;
  const insets = useSafeAreaInsets();
  const puedeEditarEmpresa = permisosDe(empresa).editarPerfilEmpresa;

  // Datos de empresa
  const [nombreEmpresa, setNombreEmpresa] = useState(empresa.nombre || '');
  const [sitioWeb, setSitioWeb] = useState(empresa.sitio_web || '');
  const [colorSeleccionado, setColorSeleccionado] = useState(empresa.color_hex || TEMAS[0].base);
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

  // REDISEÑO VISUAL (2026-08-28, a pedido del usuario): pantalla organizada en 3 secciones
  // colapsables (acordeón, estilo Ajustes de Android/Samsung) en vez de todos los campos sueltos
  // uno tras otro. `seccionAbierta` guarda cuál de las 3 está desplegada — solo una a la vez, y
  // todas empiezan cerradas. Esto es puramente visual: no cambia ningún estado de datos, validación
  // ni llamada a la API, todo lo demás de esta pantalla sigue exactamente igual.
  const [seccionAbierta, setSeccionAbierta] = useState<'empresa' | 'contratos' | 'seguridad' | null>(null);
  const alternarSeccion = (seccion: 'empresa' | 'contratos' | 'seguridad') => {
    setSeccionAbierta((actual) => (actual === seccion ? null : seccion));
  };

  // Vista previa en vivo del tema: al tocar un tema en la lista, el fondo de ESTA pantalla cambia
  // al momento para que Gerencia vea cómo se vería antes de decidir. Si sale sin guardar, este
  // valor se pierde junto con la pantalla y nunca se aplicó a la empresa real (empresa.color_hex
  // en el resto de la app no cambia hasta que se presiona "Guardar Cambios", que sigue mandando
  // colorSeleccionado exactamente como antes). colorSeleccionado sigue siendo el valor real que se
  // guarda; fondoVistaPrevia solo decide qué color se pinta en pantalla mientras se edita.
  const fondoVistaPrevia = colorSeleccionado || empresa.color_hex || '#1E90FF';

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
        const respuestaEmpresa = await api.put(`/empresas/${empresa.id}`, {
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
      const respuestaUsuario = await api.put(`/auth/usuario/${usuario.id}`, {
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
            // Antes esta actualización no incluía nit/cedula_representante/datos bancarios: se
            // guardaban bien en el servidor, pero la sesión guardada en el celular (la que se usa
            // para entrar sin pedir contraseña de nuevo) se quedaba con los valores viejos —
            // por eso "desaparecían" al cerrar sesión y volver a entrar.
            sesion.empresas = sesion.empresas.map((e) =>
              e.empresa_id === empresaFinal.id
                ? {
                    ...e,
                    empresa_nombre: empresaFinal.nombre,
                    logo_url: empresaFinal.logo_url,
                    color_hex: empresaFinal.color_hex,
                    sitio_web: empresaFinal.sitio_web,
                    nit: empresaFinal.nit,
                    cedula_representante: empresaFinal.cedula_representante,
                    banco_nombre: empresaFinal.banco_nombre,
                    banco_tipo_cuenta: empresaFinal.banco_tipo_cuenta,
                    banco_numero: empresaFinal.banco_numero,
                    banco_titular: empresaFinal.banco_titular,
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
      <ScrollView
        style={[styles.container, { backgroundColor: fondoVistaPrevia }]}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 20) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titulo}>Editar Perfil</Text>

        {/* SECCIÓN EMPRESA: solo Gerencia puede editar logo/nombre/sitio web/color. Organizada como
            acordeón (estilo Ajustes de Android/Samsung, a pedido del usuario): el encabezado
            siempre visible, y el contenido se despliega solo al tocarlo. */}
        {puedeEditarEmpresa && (
          <>
            <TouchableOpacity style={styles.accordionHeader} onPress={() => alternarSeccion('empresa')} activeOpacity={0.7}>
              <Text style={styles.accordionHeaderTexto}>🏢  Datos de la Empresa</Text>
              <Text style={styles.accordionFlecha}>{seccionAbierta === 'empresa' ? '⌄' : '›'}</Text>
            </TouchableOpacity>

            {seccionAbierta === 'empresa' && (
              <View style={styles.accordionContenido}>
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

                <Text style={styles.label}>Tema de la empresa</Text>
                <Text style={styles.ayudaTexto}>Toca un tema para ver cómo se vería en el fondo de esta pantalla. Se aplica a toda la app solo cuando guardas.</Text>
                <View style={styles.temasContainer}>
                  {TEMAS.map((tema) => (
                    <TouchableOpacity
                      key={tema.nombre}
                      style={[styles.temaCard, colorSeleccionado === tema.base && styles.temaCardSeleccionada]}
                      onPress={() => setColorSeleccionado(tema.base)}
                    >
                      <View style={styles.temaFranjas}>
                        <View style={[styles.temaFranja, { backgroundColor: tema.claro }]} />
                        <View style={[styles.temaFranja, { backgroundColor: tema.medio }]} />
                        <View style={[styles.temaFranja, { backgroundColor: tema.base }]} />
                        <View style={[styles.temaFranja, { backgroundColor: tema.oscuro }]} />
                      </View>
                      <Text style={styles.temaNombre}>{tema.nombre}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.accordionHeader} onPress={() => alternarSeccion('contratos')} activeOpacity={0.7}>
              <Text style={styles.accordionHeaderTexto}>📄  Datos para Contratos</Text>
              <Text style={styles.accordionFlecha}>{seccionAbierta === 'contratos' ? '⌄' : '›'}</Text>
            </TouchableOpacity>

            {seccionAbierta === 'contratos' && (
              <View style={styles.accordionContenido}>
                <Text style={styles.ayudaTexto}>Estos datos aparecen automáticamente en los contratos que genera la app.</Text>

                <Text style={styles.label}>Cédula del representante legal</Text>
                <TextInput style={styles.input} value={cedulaRepresentante} onChangeText={setCedulaRepresentante} placeholder="Ej: 1.234.567.891" placeholderTextColor="#999" keyboardType="number-pad" />

                <Text style={styles.label}>NIT de la empresa</Text>
                <TextInput style={styles.input} value={nit} onChangeText={setNit} placeholder="Ej: 900123456-1" placeholderTextColor="#999" />

                <Text style={styles.label}>Banco</Text>
                <TextInput style={styles.input} value={bancoNombre} onChangeText={setBancoNombre} placeholder="Ej: Nombre de tu banco" placeholderTextColor="#999" />

                <Text style={styles.label}>Tipo de cuenta</Text>
                <TextInput style={styles.input} value={bancoTipoCuenta} onChangeText={setBancoTipoCuenta} placeholder="Ej: Ahorros" placeholderTextColor="#999" />

                <Text style={styles.label}>Número de cuenta</Text>
                <TextInput style={styles.input} value={bancoNumero} onChangeText={setBancoNumero} placeholder="Ej: 00000000000" placeholderTextColor="#999" keyboardType="number-pad" />

                <Text style={styles.label}>Titular de la cuenta</Text>
                <TextInput style={styles.input} value={bancoTitular} onChangeText={setBancoTitular} placeholder="Ej: Empresa Ejemplo S.A.S" placeholderTextColor="#999" />
              </View>
            )}
          </>
        )}

        {/* SECCIÓN SEGURIDAD: nombre de usuario + contraseña, agrupados aparte del resto porque son
            datos personales de la cuenta (no de la empresa) — visible para todas las áreas. */}
        <TouchableOpacity style={[styles.accordionHeader, { marginTop: 18 }]} onPress={() => alternarSeccion('seguridad')} activeOpacity={0.7}>
          <Text style={styles.accordionHeaderTexto}>🔒  Seguridad y Usuario</Text>
          <Text style={styles.accordionFlecha}>{seccionAbierta === 'seguridad' ? '⌄' : '›'}</Text>
        </TouchableOpacity>

        {seccionAbierta === 'seguridad' && (
          <View style={styles.accordionContenido}>
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
          </View>
        )}

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
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, color: '#fff', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  seccionTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1E90FF', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  seccionTitulo2: { fontSize: 14, fontWeight: 'bold', color: '#1E90FF', marginTop: 28, marginBottom: 4, textTransform: 'uppercase' },
  ayudaTexto: { fontSize: 12, color: '#888', marginBottom: 4 },
  // ACORDEÓN (2026-08-28, a pedido del usuario): encabezados tipo Ajustes de Android/Samsung —
  // tarjeta blanca siempre visible con título + flecha, que se rota/cambia al abrir. El contenido
  // (accordionContenido) es una tarjeta blanca aparte, debajo, que solo se renderiza si esa
  // sección está abierta (ver seccionAbierta en el componente).
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  accordionHeaderTexto: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  accordionFlecha: { fontSize: 20, color: '#999', fontWeight: '600' },
  accordionContenido: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginTop: 2,
  },
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
  temasContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  temaCard: { width: '30%', padding: 8, borderRadius: 10, borderWidth: 2, borderColor: '#ddd', backgroundColor: '#fff' },
  temaCardSeleccionada: { borderColor: '#000' },
  temaFranjas: { flexDirection: 'row', gap: 3, height: 22 },
  temaFranja: { flex: 1, borderRadius: 3 },
  temaNombre: { fontSize: 11, fontWeight: '600', color: '#333', marginTop: 6, textAlign: 'center' },
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