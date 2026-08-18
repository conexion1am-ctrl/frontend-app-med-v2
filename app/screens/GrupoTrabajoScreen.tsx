import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../firebaseConfig';
import EncabezadoLogo from '../components/EncabezadoLogo';
import InputCelular, { detectarPaisPorDispositivo, PAISES } from '../components/InputCelular';
import { esGerencia, permisosDe } from '../utils/roles';

// Quita mayúsculas y acentos para poder comparar/filtrar texto sin importar cómo se escribió
const textoNormalizado = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Convierte "2026-08-15" a "15-08-26" (formato de fecha estándar de la app)
const formatearFechaDdMmAa = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = String(d.getUTCFullYear()).slice(-2);
  return `${dia}-${mes}-${anio}`;
};

// Convierte texto escrito como "15-08-26" a formato ISO "2026-08-15" para el backend
const convertirADdMmAaAIso = (texto) => {
  const partes = texto.trim().split('-');
  if (partes.length !== 3) return null;
  let [dia, mes, anio] = partes;
  if (!dia || !mes || !anio) return null;
  if (anio.length === 2) anio = `20${anio}`;
  if (dia.length !== 2 || mes.length !== 2 || anio.length !== 4) return null;
  const diaNum = parseInt(dia, 10);
  const mesNum = parseInt(mes, 10);
  if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12) return null;
  return `${anio}-${mes}-${dia}`;
};

export default function GrupoTrabajoScreen({ route }) {
  const { empresa, usuario } = route.params;
  const insets = useSafeAreaInsets();
  const permisos = permisosDe(empresa);
  const puedeGestionarGerencia = esGerencia(empresa);
  const [personal, setPersonal] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [paisCelular, setPaisCelular] = useState(detectarPaisPorDispositivo());
  const [areasSeleccionadas, setAreasSeleccionadas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [modalLinkVisible, setModalLinkVisible] = useState(false);
  const [linkInvitacion, setLinkInvitacion] = useState('');
  const [nombreInvitado, setNombreInvitado] = useState('');

  const [modalPendienteVisible, setModalPendienteVisible] = useState(false);
  const [personaPendiente, setPersonaPendiente] = useState(null);
  const [linkPendiente, setLinkPendiente] = useState('');
  const [cargandoLinkPendiente, setCargandoLinkPendiente] = useState(false);

  const [modalContactosVisible, setModalContactosVisible] = useState(false);
  const [contactosDisponibles, setContactosDisponibles] = useState([]);
  const [busquedaContacto, setBusquedaContacto] = useState('');

  const [archivoArlUri, setArchivoArlUri] = useState(null);
  const [archivoArlNombre, setArchivoArlNombre] = useState(null);
  const [arlVencimiento, setArlVencimiento] = useState('');
  const [subiendoArl, setSubiendoArl] = useState(false);

  const [menuPersona, setMenuPersona] = useState(null);

  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editCelular, setEditCelular] = useState('');
  const [editPaisCelular, setEditPaisCelular] = useState(detectarPaisPorDispositivo());
  const [editAreasSeleccionadas, setEditAreasSeleccionadas] = useState([]);
  const [editandoPersona, setEditandoPersona] = useState(null);

  // Separa un celular guardado ("+57 3002100000") en { pais, numero }
  const separarCelular = (celularCompleto) => {
    const encontrado = PAISES.find((p) => celularCompleto.startsWith(p.prefijo));
    if (encontrado) {
      const numero = celularCompleto.replace(encontrado.prefijo, '').trim();
      return { pais: encontrado, numero };
    }
    return { pais: detectarPaisPorDispositivo(), numero: celularCompleto };
  };

  const [modalProyectosVisible, setModalProyectosVisible] = useState(false);
  const [proyectosAsignados, setProyectosAsignados] = useState([]);
  const [cargandoProyectos, setCargandoProyectos] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resPersonal, resAreas] = await Promise.all([
        axios.get(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/${empresa.id}`),
        axios.get('https://backend-app-mediterraneo.onrender.com/api/areas'),
      ]);
      setPersonal(resPersonal.data.personal);
      setAreas(resAreas.data.areas);
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudo cargar el grupo de trabajo.');
    } finally {
      setCargando(false);
    }
  };

  const toggleArea = (areaId) => {
    setAreasSeleccionadas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const toggleEditArea = (areaId) => {
    setEditAreasSeleccionadas((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const limpiarFormulario = () => {
    setNombre('');
    setCelular('');
    setPaisCelular(detectarPaisPorDispositivo());
    setAreasSeleccionadas([]);
  };

  // Interpreta un número tal como viene del directorio del celular (puede traer espacios,
  // guiones, paréntesis y/o el símbolo "+" con el código de país). Devuelve { pais, numero }
  // en el mismo formato que usa InputCelular, para autocompletar el formulario.
  const interpretarNumeroContacto = (numeroCrudo) => {
    const limpio = (numeroCrudo || '').replace(/[^0-9+]/g, '');
    if (limpio.startsWith('+')) {
      const encontrado = PAISES.find((p) => limpio.startsWith(p.prefijo));
      if (encontrado) {
        return { pais: encontrado, numero: limpio.replace(encontrado.prefijo, '') };
      }
    }
    // Sin prefijo reconocible: asumimos el país detectado del dispositivo y dejamos solo dígitos.
    return { pais: detectarPaisPorDispositivo(), numero: limpio.replace(/\+/g, '') };
  };

  // Abre el directorio de contactos del celular; al elegir uno, autocompleta nombre y celular
  // en el formulario de "Agregar Personal" (sigue siendo una invitación normal después).
  const elegirDesdeContactos = async () => {
    const permiso = await Contacts.requestPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus contactos para elegir uno.');
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });
    const conTelefono = data.filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0);
    if (conTelefono.length === 0) {
      Alert.alert('Sin contactos', 'No encontramos contactos con número de celular en tu directorio.');
      return;
    }

    setContactosDisponibles(conTelefono);
    setBusquedaContacto('');
    setModalContactosVisible(true);
  };

  const elegirContacto = (contacto, numero) => {
    const { pais, numero: numeroLimpio } = interpretarNumeroContacto(numero);
    setNombre(contacto.name || '');
    setPaisCelular(pais);
    setCelular(numeroLimpio);
    setModalContactosVisible(false);
    setBusquedaContacto('');
  };

  const busquedaContactoNormalizada = textoNormalizado(busquedaContacto);
  const contactosFiltrados = busquedaContactoNormalizada
    ? contactosDisponibles.filter((c) => textoNormalizado(c.name).includes(busquedaContactoNormalizada))
    : contactosDisponibles;

  const enviarInvitaciones = async () => {
    setGuardando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      let ultimoLink = null;
      for (const areaId of areasSeleccionadas) {
        const respuesta = await axios.post('https://backend-app-mediterraneo.onrender.com/api/invitaciones/generar', {
          empresa_id: empresa.id,
          area_id: areaId,
          nombre_invitado: nombre,
          celular_invitado: celularCompleto,
        });
        ultimoLink = respuesta.data.link_whatsapp;
      }
      setModalVisible(false);
      limpiarFormulario();
      cargarDatos();

      // Mostramos el enlace generado para que lo copie o lo comparta directo por WhatsApp.
      if (ultimoLink) {
        setLinkInvitacion(ultimoLink);
        setNombreInvitado(nombre);
        setModalLinkVisible(true);
      } else {
        Alert.alert('¡Listo!', `Invitación generada para ${nombre}.`);
      }
    } catch (error) {
      console.error('Error agregando personal:', error);
      Alert.alert('Error', 'No se pudo agregar el personal. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const compartirLinkInvitacion = async () => {
    try {
      await Share.share({
        message: `¡Hola ${nombreInvitado}! Te invito a unirte a nuestro equipo en C&D Manager.\n\n${linkInvitacion}\n\n(Si el enlace no abre al tocarlo, mantenlo presionado y elige "Abrir", o cópialo y pégalo en el navegador de tu celular. Necesitas tener la app C&D Manager ya instalada).`,
      });
    } catch (error) {
      console.error('Error compartiendo invitación:', error);
    }
  };

  const llamarPersona = (celular) => {
    if (!celular) return;
    Linking.openURL(`tel:${celular.replace(/\s/g, '')}`);
  };

  const agregarPersonal = async () => {
    if (!nombre.trim() || !celular.trim() || areasSeleccionadas.length === 0) {
      Alert.alert('Campos incompletos', 'Nombre, celular y al menos un área son obligatorios.');
      return;
    }

    setGuardando(true);
    try {
      const celularCompleto = `${paisCelular.prefijo} ${celular}`;
      const verificacion = await axios.get(
        `https://backend-app-mediterraneo.onrender.com/api/areas/verificar-celular/${empresa.id}/${encodeURIComponent(celularCompleto)}`
      );

      if (verificacion.data.existe) {
        setGuardando(false);
        const estadoTexto = verificacion.data.estado === 'activo' ? 'ya está en el equipo (activo)' : 'tiene una invitación pendiente sin aceptar';
        Alert.alert(
          'Este número ya existe',
          `El celular ${celularCompleto} pertenece a "${verificacion.data.nombre}", quien ${estadoTexto} en el área de ${verificacion.data.areas.join(', ')}.\n\n¿Deseas continuar y agregarlo a una nueva área de todas formas?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: () => enviarInvitaciones() },
          ]
        );
        return;
      }

      await enviarInvitaciones();
    } catch (error) {
      setGuardando(false);
      console.error('Error verificando celular:', error);
      Alert.alert('Error', 'No se pudo verificar el celular. Intenta de nuevo.');
    }
  };

  const abrirMenu = (persona) => {
    setMenuPersona(persona);
  };

  const cerrarMenu = () => {
    setMenuPersona(null);
  };

  const verFichaPendiente = async (persona) => {
    setPersonaPendiente(persona);
    setLinkPendiente('');
    setModalPendienteVisible(true);
    setCargandoLinkPendiente(true);
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/invitaciones/id/${persona.rol_id}/link`);
      setLinkPendiente(res.data.link_whatsapp);
    } catch (error) {
      console.error('Error obteniendo link de invitación:', error);
      Alert.alert('Error', 'No se pudo obtener el enlace de invitación.');
    } finally {
      setCargandoLinkPendiente(false);
    }
  };

  const compartirLinkPendiente = async () => {
    try {
      await Share.share({
        message: `¡Hola ${personaPendiente?.nombre}! Te invito a unirte a nuestro equipo en C&D Manager.\n\n${linkPendiente}\n\n(Si el enlace no abre al tocarlo, mantenlo presionado y elige "Abrir", o cópialo y pégalo en el navegador de tu celular. Necesitas tener la app C&D Manager ya instalada).`,
      });
    } catch (error) {
      console.error('Error compartiendo invitación:', error);
    }
  };

  const verProyectosAsignados = async (persona) => {
    if (persona.estado !== 'vinculado') {
      verFichaPendiente(persona);
      return;
    }
    setModalProyectosVisible(true);
    setCargandoProyectos(true);
    try {
      const res = await axios.get(`https://backend-app-mediterraneo.onrender.com/api/proyectos/asignaciones/${persona.usuario_id}`);
      setProyectosAsignados(res.data.asignaciones);
    } catch (error) {
      console.error('Error obteniendo proyectos asignados:', error);
      Alert.alert('Error', 'No se pudieron cargar los proyectos asignados.');
    } finally {
      setCargandoProyectos(false);
    }
  };

  const abrirEditar = (persona) => {
    cerrarMenu();
    setEditandoPersona(persona);
    setEditNombre(persona.nombre);
    const { pais, numero } = separarCelular(persona.celular);
    setEditCelular(numero);
    setEditPaisCelular(pais);
    const areasDeEstaPersona = personal
      .filter((p) => p.nombre === persona.nombre && p.celular === persona.celular && p.estado === persona.estado)
      .map((p) => p.area_id);
    setEditAreasSeleccionadas(areasDeEstaPersona);
    setArchivoArlUri(null);
    setArchivoArlNombre(null);
    setArlVencimiento(persona.arl_vencimiento ? formatearFechaDdMmAa(persona.arl_vencimiento) : '');
    setModalEditarVisible(true);
  };

  // Calcula si el documento ARL está vencido, por vencer (30 días) o vigente
  const estadoArl = (fechaVencimientoIso) => {
    if (!fechaVencimientoIso) return null;
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimientoIso);
    const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (diasRestantes < 0) return 'vencido';
    if (diasRestantes <= 5) return 'por_vencer';
    return 'vigente';
  };

  const elegirArchivoArl = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (resultado.canceled) return;
      const archivo = resultado.assets[0];
      setArchivoArlUri(archivo.uri);
      setArchivoArlNombre(archivo.name);
    } catch (error) {
      console.error('Error eligiendo archivo ARL:', error);
      Alert.alert('Error', 'No se pudo abrir el selector de archivos.');
    }
  };

  const subirArchivoArlAFirebase = async (uri, nombreArchivoOriginal) => {
    const respuesta = await fetch(uri);
    const blob = await respuesta.blob();
    const extension = nombreArchivoOriginal?.split('.').pop() || 'pdf';
    const nombreArchivo = `arl/${editandoPersona.usuario_id}_${Date.now()}.${extension}`;
    const storageRef = ref(storage, nombreArchivo);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const guardarDocumentoArl = async () => {
    if (!archivoArlUri && !arlVencimiento) {
      Alert.alert('Nada que guardar', 'Selecciona un documento o escribe una fecha de vencimiento.');
      return;
    }
    let fechaIso = null;
    if (arlVencimiento) {
      fechaIso = convertirADdMmAaAIso(arlVencimiento);
      if (!fechaIso) {
        Alert.alert('Fecha inválida', 'Escribe la fecha de vencimiento en formato DD-MM-AA, por ejemplo: 15-08-27');
        return;
      }
    }

    setSubiendoArl(true);
    try {
      let urlDocumento = editandoPersona.arl_documento_url || null;
      if (archivoArlUri) {
        urlDocumento = await subirArchivoArlAFirebase(archivoArlUri, archivoArlNombre);
      }

      if (!urlDocumento) {
        Alert.alert('Falta el documento', 'Debes seleccionar el archivo del documento ARL.');
        return;
      }

      await axios.put(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${editandoPersona.usuario_id}/arl`, {
        arl_documento_url: urlDocumento,
        arl_vencimiento: fechaIso,
      });

      Alert.alert('¡Listo!', 'Documento ARL guardado exitosamente.');
      setArchivoArlUri(null);
      setArchivoArlNombre(null);
      cargarDatos();
    } catch (error) {
      console.error('Error guardando documento ARL:', error);
      const mensaje = error.response?.data?.error || 'No se pudo guardar el documento ARL.';
      Alert.alert('Error', mensaje);
    } finally {
      setSubiendoArl(false);
    }
  };

  const eliminarDocumentoArl = () => {
    Alert.alert('Eliminar documento ARL', '¿Seguro que quieres eliminar este documento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${editandoPersona.usuario_id}/arl`);
            setArlVencimiento('');
            cargarDatos();
          } catch (error) {
            console.error('Error eliminando documento ARL:', error);
            Alert.alert('Error', 'No se pudo eliminar el documento ARL.');
          }
        },
      },
    ]);
  };

  const abrirDocumentoArl = (url) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir el documento.');
    });
  };

  const guardarEdicion = async () => {
    if (!editNombre.trim() || !editCelular.trim() || editAreasSeleccionadas.length === 0) {
      Alert.alert('Campos incompletos', 'Nombre, celular y al menos un área son obligatorios.');
      return;
    }

    setGuardando(true);
    try {
      if (editandoPersona.estado === 'pendiente') {
        const nuevaArea = editAreasSeleccionadas[0];
        await axios.put(`https://backend-app-mediterraneo.onrender.com/api/invitaciones/${editandoPersona.rol_id}`, {
          nombre_invitado: editNombre,
          celular_invitado: `${editPaisCelular.prefijo} ${editCelular}`,
          area_id: nuevaArea,
        });
      } else {
        await axios.put(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${editandoPersona.usuario_id}/nombre`, {
          nombre: editNombre,
          empresa_id: empresa.id,
          solicitante_id: usuario.id,
        });

        const areasActuales = personal
          .filter((p) => p.usuario_id === editandoPersona.usuario_id && p.estado === 'vinculado')
          .map((p) => ({ area_id: p.area_id, rol_id: p.rol_id }));

        const idsActuales = areasActuales.map((a) => a.area_id);
        const nuevasAreas = editAreasSeleccionadas.filter((id) => !idsActuales.includes(id));
        const areasQuitadas = areasActuales.filter((a) => !editAreasSeleccionadas.includes(a.area_id));

        for (const areaId of nuevasAreas) {
          await axios.post(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${editandoPersona.usuario_id}/areas`, {
            empresa_id: empresa.id,
            area_id: areaId,
            solicitante_id: usuario.id,
          });
        }

        for (const areaQuitada of areasQuitadas) {
          await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${areaQuitada.rol_id}`, {
            data: { solicitante_id: usuario.id },
          });
        }
      }

      Alert.alert('¡Listo!', 'Cambios guardados exitosamente.');
      setModalEditarVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error guardando edición:', error);
      const mensajeError = error.response?.data?.error || 'No se pudieron guardar los cambios.';
      Alert.alert('Error', mensajeError);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = (persona) => {
    cerrarMenu();
    const mensaje =
      persona.estado === 'pendiente'
        ? `¿Eliminar la invitación de ${persona.nombre}? Ya no podrá ingresar con el link enviado.`
        : `¿Eliminar a ${persona.nombre} del equipo? Ya no podrá ingresar a la app con su número, pero se conservará su historial en proyectos anteriores.`;

    Alert.alert('Eliminar persona', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminarPersona(persona) },
    ]);
  };

  const eliminarPersona = async (persona) => {
    try {
      if (persona.estado === 'pendiente') {
        await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/invitaciones/${persona.rol_id}`);
      } else {
        await axios.delete(`https://backend-app-mediterraneo.onrender.com/api/areas/personal/vinculado/${persona.rol_id}?todas=true`, {
          data: { solicitante_id: usuario.id },
        });
      }
      cargarDatos();
    } catch (error) {
      console.error('Error eliminando persona:', error);
      Alert.alert('Error', 'No se pudo eliminar a esta persona.');
    }
  };

  const busquedaNormalizada = textoNormalizado(busqueda);
  const personalFiltrado = busquedaNormalizada
    ? personal.filter((p) => textoNormalizado(p.nombre).includes(busquedaNormalizada))
    : personal;

  const personalPorArea = personalFiltrado.reduce((grupos, persona) => {
    const area = persona.area_nombre;
    if (!grupos[area]) grupos[area] = [];
    grupos[area].push(persona);
    return grupos;
  }, {});

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: empresa.color_hex || '#1E90FF' }]}>
      <EncabezadoLogo empresa={empresa} />
      <View style={styles.buscadorContainer}>
        <TextInput
          style={styles.buscadorInput}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="🔍 Buscar por nombre..."
          placeholderTextColor="#999"
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {Object.keys(personalPorArea).length === 0 ? (
          <Text style={styles.vacioTexto}>
            {personal.length === 0 ? 'Aún no hay personal agregado. Toca "Agregar Personal" para empezar.' : 'No se encontró personal con ese nombre.'}
          </Text>
        ) : (
          Object.keys(personalPorArea).map((area) => (
            <View key={area} style={styles.grupoArea}>
              <Text style={styles.areaTitulo}>{area}</Text>
              {personalPorArea[area].map((persona) => (
                <TouchableOpacity
                  key={`${persona.estado}-${persona.rol_id}`}
                  style={styles.personaCard}
                  onPress={() => verProyectosAsignados(persona)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaNombre}>{persona.nombre}</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        llamarPersona(persona.celular);
                      }}
                    >
                      <Text style={styles.personaCelularLlamar}>📞 {persona.celular}</Text>
                    </TouchableOpacity>
                    {persona.estado === 'vinculado' && estadoArl(persona.arl_vencimiento) && (
                      <View
                        style={[
                          styles.etiquetaArl,
                          estadoArl(persona.arl_vencimiento) === 'vencido' && styles.etiquetaArlVencido,
                          estadoArl(persona.arl_vencimiento) === 'por_vencer' && styles.etiquetaArlPorVencer,
                          estadoArl(persona.arl_vencimiento) === 'vigente' && styles.etiquetaArlVigente,
                        ]}
                      >
                        <Text style={styles.etiquetaArlTexto}>
                          {estadoArl(persona.arl_vencimiento) === 'vencido' && '⚠️ ARL vencida'}
                          {estadoArl(persona.arl_vencimiento) === 'por_vencer' && '⏳ ARL por vencer'}
                          {estadoArl(persona.arl_vencimiento) === 'vigente' && '✅ ARL vigente'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      styles.etiquetaEstado,
                      persona.estado === 'vinculado' ? styles.etiquetaVinculado : styles.etiquetaPendiente,
                    ]}
                  >
                    <Text style={styles.etiquetaTexto}>
                      {persona.estado === 'vinculado' ? 'Vinculado' : 'Pendiente'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.botonMenu} onPress={() => abrirMenu(persona)}>
                    <Text style={styles.botonMenuTexto}>⋮</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.botonAgregar, { bottom: Math.max(insets.bottom, 20) }]} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonAgregarTexto}>AGREGAR PERSONAL</Text>
      </TouchableOpacity>

      <Modal visible={!!menuPersona} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitulo}>{menuPersona?.nombre}</Text>
            {menuPersona?.area_nombre === 'GERENCIA' && !puedeGestionarGerencia ? (
              <Text style={styles.notaLinkTexto}>Solo Gerencia puede editar o eliminar a alguien de Gerencia.</Text>
            ) : (
              <>
                <TouchableOpacity style={styles.menuOpcion} onPress={() => abrirEditar(menuPersona)}>
                  <Text style={styles.menuOpcionTexto}>✏️  Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuOpcion} onPress={() => confirmarEliminar(menuPersona)}>
                  <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Agregar Personal</Text>

            <TouchableOpacity style={styles.botonContactos} onPress={elegirDesdeContactos}>
              <Text style={styles.botonContactosTexto}>📇  Elegir desde mis contactos</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre completo" placeholderTextColor="#999" />

            <Text style={styles.label}>Número de celular *</Text>
            <InputCelular
              numero={celular}
              onChangeNumero={setCelular}
              pais={paisCelular}
              onChangePais={setPaisCelular}
            />

            <Text style={styles.label}>Área(s) *</Text>
            <View style={styles.areasLista}>
              {areas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.areaOpcion,
                    areasSeleccionadas.includes(area.id) && styles.areaOpcionSeleccionada,
                  ]}
                  onPress={() => toggleArea(area.id)}
                >
                  <Text
                    style={[
                      styles.areaOpcionTexto,
                      areasSeleccionadas.includes(area.id) && styles.areaOpcionTextoSeleccionado,
                    ]}
                  >
                    {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.botonGuardar} onPress={agregarPersonal} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GENERAR INVITACIÓN</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botonCancelar}
              onPress={() => {
                setModalVisible(false);
                limpiarFormulario();
              }}
            >
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalEditarVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <Text style={styles.modalTitulo}>Editar Persona</Text>

            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={editNombre} onChangeText={setEditNombre} placeholderTextColor="#999" />

            <Text style={styles.label}>Número de celular *</Text>
            <InputCelular
              numero={editCelular}
              onChangeNumero={setEditCelular}
              pais={editPaisCelular}
              onChangePais={setEditPaisCelular}
              disabled={editandoPersona?.estado === 'vinculado'}
            />
            {editandoPersona?.estado === 'vinculado' && (
              <Text style={styles.notaTexto}>El celular de una persona ya vinculada no se puede cambiar aquí.</Text>
            )}

            <Text style={styles.label}>Área(s) *</Text>
            <View style={styles.areasLista}>
              {areas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.areaOpcion,
                    editAreasSeleccionadas.includes(area.id) && styles.areaOpcionSeleccionada,
                  ]}
                  onPress={() => toggleEditArea(area.id)}
                >
                  <Text
                    style={[
                      styles.areaOpcionTexto,
                      editAreasSeleccionadas.includes(area.id) && styles.areaOpcionTextoSeleccionado,
                    ]}
                  >
                    {area.categoria_padre ? `${area.categoria_padre} · ${area.nombre}` : area.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarEdicion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>

            {editandoPersona?.estado === 'vinculado' && permisos.gestionarGrupoTrabajo && (
              <View style={styles.arlSeccion}>
                <Text style={styles.arlTitulo}>Documento ARL (Riesgos Profesionales)</Text>
                <Text style={styles.notaTexto}>
                  Sube el certificado de afiliación a riesgos profesionales de esta persona. Cualquier persona del área administrativa podrá consultarlo en caso de un accidente laboral.
                </Text>

                {editandoPersona?.arl_documento_url && (
                  <TouchableOpacity style={styles.arlDocumentoActual} onPress={() => abrirDocumentoArl(editandoPersona.arl_documento_url)}>
                    <Text style={styles.arlDocumentoActualTexto}>📄 Ver documento actual</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.arlBotonSeleccionar} onPress={elegirArchivoArl}>
                  <Text style={styles.arlBotonSeleccionarTexto}>
                    {archivoArlNombre ? `📎 ${archivoArlNombre}` : '📎 Seleccionar documento (PDF o imagen)'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.label}>Fecha de vencimiento (DD-MM-AA)</Text>
                <TextInput
                  style={styles.input}
                  value={arlVencimiento}
                  onChangeText={setArlVencimiento}
                  placeholder="Ej: 15-08-27"
                  placeholderTextColor="#999"
                  keyboardType="numbers-and-punctuation"
                />

                <TouchableOpacity style={styles.botonGuardar} onPress={guardarDocumentoArl} disabled={subiendoArl}>
                  {subiendoArl ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR DOCUMENTO ARL</Text>}
                </TouchableOpacity>

                {editandoPersona?.arl_documento_url && (
                  <TouchableOpacity style={styles.arlBotonEliminar} onPress={eliminarDocumentoArl}>
                    <Text style={styles.arlBotonEliminarTexto}>🗑️ Eliminar documento ARL</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalEditarVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalProyectosVisible} animationType="slide" transparent>
        <View style={styles.proyectosOverlay}>
          <View style={styles.proyectosBox}>
            <Text style={styles.modalTitulo}>Proyectos asignados</Text>
            {cargandoProyectos ? (
              <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginVertical: 20 }} />
            ) : proyectosAsignados.length === 0 ? (
              <Text style={styles.vacioTexto}>No está asignada a ningún proyecto en este momento.</Text>
            ) : (
              proyectosAsignados.map((asig, index) => (
                <View key={index} style={styles.proyectoAsignadoCard}>
                  <Text style={styles.proyectoAsignadoNombre}>{asig.proyecto_nombre}</Text>
                  <Text style={styles.proyectoAsignadoArea}>{asig.area_nombre}</Text>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalProyectosVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Enlace de invitación generado */}
      <Modal visible={modalLinkVisible} animationType="fade" transparent>
        <View style={styles.linkOverlay}>
          <View style={styles.linkBox}>
            <Text style={styles.linkTitulo}>¡Invitación creada!</Text>
            <Text style={styles.linkSubtitulo}>Envíale este enlace a {nombreInvitado} para que se una al equipo:</Text>
            <View style={styles.linkTextoContainer}>
              <Text style={styles.linkTexto} selectable>{linkInvitacion}</Text>
            </View>
            <Text style={styles.notaLinkTexto}>Si al invitado no le aparece como enlace tocable en WhatsApp, dile que lo mantenga presionado y elija "Abrir", o que lo copie y pegue en el navegador de su celular. Necesita tener la app ya instalada.</Text>
            <TouchableOpacity style={styles.botonGuardar} onPress={compartirLinkInvitacion}>
              <Text style={styles.botonAgregarTexto}>📤 Enviar por WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalLinkVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Ficha de persona pendiente (info + reenviar invitación) */}
      <Modal visible={modalPendienteVisible} animationType="fade" transparent>
        <View style={styles.linkOverlay}>
          <View style={styles.linkBox}>
            <Text style={styles.linkTitulo}>{personaPendiente?.nombre}</Text>
            <Text style={styles.linkSubtitulo}>
              {personaPendiente?.celular}{'\n'}
              Área: {personaPendiente?.area_nombre}{'\n'}
              Estado: pendiente de aceptar la invitación
            </Text>
            {cargandoLinkPendiente ? (
              <ActivityIndicator size="large" color={empresa.color_hex || '#1E90FF'} style={{ marginVertical: 20 }} />
            ) : linkPendiente ? (
              <>
                <Text style={styles.linkSubtitulo}>Enlace de invitación para reenviar:</Text>
                <View style={styles.linkTextoContainer}>
                  <Text style={styles.linkTexto} selectable>{linkPendiente}</Text>
                </View>
                <Text style={styles.notaLinkTexto}>Si al invitado no le aparece como enlace tocable en WhatsApp, dile que lo mantenga presionado y elija "Abrir", o que lo copie y pegue en el navegador de su celular. Necesita tener la app ya instalada.</Text>
                <TouchableOpacity style={styles.botonGuardar} onPress={compartirLinkPendiente}>
                  <Text style={styles.botonAgregarTexto}>📤 Reenviar por WhatsApp</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalPendienteVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: elegir contacto (y número, si tiene varios) del directorio del celular */}
      <Modal visible={modalContactosVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitulo}>Elige un contacto</Text>
          <TextInput
            style={styles.buscadorContactoInput}
            value={busquedaContacto}
            onChangeText={setBusquedaContacto}
            placeholder="Buscar contacto..."
            placeholderTextColor="#999"
          />
          <ScrollView>
            {contactosFiltrados.length === 0 ? (
              <Text style={styles.notaTexto}>No se encontraron contactos con ese nombre.</Text>
            ) : (
              contactosFiltrados.map((contacto) => (
                <View key={contacto.id} style={styles.contactoGrupo}>
                  <Text style={styles.contactoNombre}>{contacto.name}</Text>
                  {contacto.phoneNumbers.map((tel, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.contactoNumeroOpcion}
                      onPress={() => elegirContacto(contacto, tel.number)}
                    >
                      <Text style={styles.contactoNumeroTexto}>{tel.number}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalContactosVisible(false)}>
            <Text style={styles.botonCancelarTexto}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  buscadorContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  buscadorInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buscadorContactoInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#222',
    marginBottom: 12,
  },
  vacioTexto: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  grupoArea: { marginBottom: 20 },
  areaTitulo: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 8, textTransform: 'uppercase' },
  personaCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personaNombre: { fontSize: 15, fontWeight: '600', color: '#222' },
  personaCelularLlamar: { fontSize: 13, color: '#1E90FF', marginTop: 2, fontWeight: '600' },
  etiquetaEstado: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginLeft: 8 },
  etiquetaVinculado: { backgroundColor: '#c8e6c9' },
  etiquetaPendiente: { backgroundColor: '#ffe0b2' },
  etiquetaTexto: { fontSize: 11, fontWeight: 'bold', color: '#333' },
  botonMenu: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
  botonMenuTexto: { fontSize: 20, color: '#999', fontWeight: 'bold' },
  botonAgregar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  botonAgregarTexto: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#222',
  },
  inputDeshabilitado: { backgroundColor: '#eee', color: '#999' },
  notaTexto: { fontSize: 12, color: '#999', marginTop: 4 },
  areasLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  areaOpcion: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  areaOpcionSeleccionada: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  areaOpcionTexto: { fontSize: 13, color: '#555' },
  areaOpcionTextoSeleccionado: { color: '#fff', fontWeight: '600' },
  botonGuardar: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
  botonContactos: { backgroundColor: '#f0f6ff', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  botonContactosTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
  contactoGrupo: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  contactoNombre: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 4 },
  contactoNumeroOpcion: { backgroundColor: '#f5f5f5', borderRadius: 6, padding: 10, marginTop: 4 },
  contactoNumeroTexto: { fontSize: 14, color: '#333' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#888', marginBottom: 12, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#222', textAlign: 'center' },
  proyectosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  proyectosBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '70%' },
  proyectoAsignadoCard: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 8 },
  proyectoAsignadoNombre: { fontSize: 15, fontWeight: '600', color: '#222' },
  proyectoAsignadoArea: { fontSize: 13, color: '#777', marginTop: 2 },
  linkOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  linkBox: { backgroundColor: '#fff', borderRadius: 12, padding: 22 },
  linkTitulo: { fontSize: 19, fontWeight: 'bold', color: '#222', marginBottom: 8, textAlign: 'center' },
  linkSubtitulo: { fontSize: 14, color: '#666', marginBottom: 14, textAlign: 'center' },
  notaLinkTexto: { fontSize: 12, color: '#999', marginBottom: 14, textAlign: 'center', fontStyle: 'italic' },
  linkTextoContainer: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#ddd' },
  linkTexto: { fontSize: 13, color: '#1E90FF' },
  etiquetaArl: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8, marginTop: 4 },
  etiquetaArlVencido: { backgroundColor: '#ffcdd2' },
  etiquetaArlPorVencer: { backgroundColor: '#ffe0b2' },
  etiquetaArlVigente: { backgroundColor: '#c8e6c9' },
  etiquetaArlTexto: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  arlSeccion: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  arlTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  arlDocumentoActual: { backgroundColor: '#e3f2fd', borderRadius: 8, padding: 12, marginTop: 12 },
  arlDocumentoActualTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  arlBotonSeleccionar: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed' },
  arlBotonSeleccionarTexto: { fontSize: 13, color: '#555', textAlign: 'center' },
  arlBotonEliminar: { alignItems: 'center', marginTop: 12, padding: 10 },
  arlBotonEliminarTexto: { color: '#DC143C', fontSize: 13, fontWeight: '600' },
});