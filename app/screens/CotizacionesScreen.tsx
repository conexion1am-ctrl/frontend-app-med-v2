import api from '../utils/apiClient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EncabezadoLogo from '../components/EncabezadoLogo';
import InputMoneda from '../components/InputMoneda';
import { compartirPdfDocumento, descargarPdfDocumento, generarPdfDocumento } from '../utils/generarPdfCotizacion';
import { esGerencia } from '../utils/roles';

const formatearMoneda = (valor) => {
  const numero = parseFloat(valor) || 0;
  return numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
};

// Valores por defecto de los campos "estándar" de la carta: se precargan al crear una
// cotización nueva, pero se pueden editar libremente antes de guardar.
const PARRAFO_CONTEXTO_DEFECTO = 'Por solicitud efectuada paso a cotizar los precios del Kit de acabados completos para su casa';
const SALUDO_DEFECTO = 'Cordial Saludo:';
// 2026-08-25: a pedido del usuario, ya no trae un rango sugerido — nace en "00 - 00 Semanas"
// para que sea evidente que hay que llenarlo antes de generar el documento.
const TIEMPO_ENTREGA_DEFECTO = '00 - 00 Semanas';
const condicionesPagoDefecto = () => [
  { porcentaje: '25', descripcion: 'A la firma del contrato para el inicio de actividades' },
  { porcentaje: '25', descripcion: 'A las 3-4 semanas con avance' },
  { porcentaje: '25', descripcion: 'A la entrega de la obra blanca' },
  { porcentaje: '25', descripcion: 'A la entrega final de la obra, incluyendo carpintería' },
];
// Frase fija que antecede a los porcentajes de condiciones de pago (2026-08-26), tal como
// aparece en el documento real de la empresa. No es editable — solo cambian los porcentajes.
const PARRAFO_CONDICIONES_PAGO = 'El pago del costo total se plantea de la siguiente manera:';

export default function CotizacionesScreen({ route }) {
  const { empresa, usuario } = route.params;
  const puedeEliminarCotizaciones = esGerencia(empresa);
  const insets = useSafeAreaInsets();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  // Buscador de clientes dentro del modal de Nueva Cotización (2026-08-26): reemplaza la lista
  // de chips de TODOS los clientes, que se volvía inmanejable con muchos clientes registrados.
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [items, setItems] = useState([{ descripcion: '', cantidad: '', valor: '', seccion: '' }]);
  const [descuento, setDescuento] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Campos de la carta, en el MISMO ORDEN en que aparecen en el documento real de la empresa
  // (2026-08-26, a pedido del usuario): ciudad, propietario, nombre de proyecto, saludo, párrafo.
  // El número de cotización YA NO se llena aquí — lo asigna el backend automáticamente (1001, 1002...).
  const [propietario, setPropietario] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [nombreProyecto, setNombreProyecto] = useState('');
  const [saludo, setSaludo] = useState(SALUDO_DEFECTO);
  const [parrafoContexto, setParrafoContexto] = useState(PARRAFO_CONTEXTO_DEFECTO);
  const [condicionesPago, setCondicionesPago] = useState(condicionesPagoDefecto());
  const [tiempoEntrega, setTiempoEntrega] = useState(TIEMPO_ENTREGA_DEFECTO);
  const [firmante, setFirmante] = useState('');

  // Plantillas reutilizables (2026-08-26): precargan items/textos ya definidos para no reescribir
  // cotizaciones muy parecidas cada vez. Se eligen ANTES que todo lo demás, pero cada campo sigue
  // siendo editable después de aplicarla.
  const [plantillas, setPlantillas] = useState([]);
  const [modalPlantillasVisible, setModalPlantillasVisible] = useState(false);
  const [modalGuardarPlantillaVisible, setModalGuardarPlantillaVisible] = useState(false);
  const [nombreNuevaPlantilla, setNombreNuevaPlantilla] = useState('');
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  const [menuCotizacion, setMenuCotizacion] = useState(null);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [editandoCotizacion, setEditandoCotizacion] = useState(null);
  // editNumero eliminado (2026-08-26): el número es automático y permanente, ya no se edita.
  const [editItems, setEditItems] = useState([{ descripcion: '', cantidad: '', valor: '', seccion: '' }]);
  const [editDescuento, setEditDescuento] = useState('');
  const [editPropietario, setEditPropietario] = useState('');
  const [editCiudad, setEditCiudad] = useState('');
  const [editNombreProyecto, setEditNombreProyecto] = useState('');
  const [editSaludo, setEditSaludo] = useState(SALUDO_DEFECTO);
  const [editParrafoContexto, setEditParrafoContexto] = useState(PARRAFO_CONTEXTO_DEFECTO);
  const [editCondicionesPago, setEditCondicionesPago] = useState(condicionesPagoDefecto());
  const [editTiempoEntrega, setEditTiempoEntrega] = useState(TIEMPO_ENTREGA_DEFECTO);
  const [editFirmante, setEditFirmante] = useState('');

  // Modal "Datos para el PDF" eliminado por completo (2026-08-26, a pedido del usuario): pedía de
  // nuevo toda la información que ya se había guardado al crear la cotización. Generar PDF ahora
  // usa directamente los datos guardados, sin volver a preguntar nada (mismo criterio ya aplicado
  // en Contratos, ver tarea histórica #95).
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resCotizaciones, resClientes, resPlantillas] = await Promise.all([
        api.get(`/cotizaciones/listar/${empresa.id}`),
        api.get(`/clientes/listar/${empresa.id}`),
        api.get(`/cotizaciones/plantillas/listar/${empresa.id}`),
      ]);
      setCotizaciones(resCotizaciones.data.cotizaciones);
      setClientes(resClientes.data.clientes);
      setPlantillas(resPlantillas.data.plantillas);
    } catch (error) {
      console.error('Error cargando cotizaciones:', error);
      Alert.alert('Error', 'No se pudieron cargar las cotizaciones.');
    } finally {
      setCargando(false);
    }
  };

  const limpiarFormulario = () => {
    setClienteSeleccionado(null);
    setBusquedaCliente('');
    setItems([{ descripcion: '', cantidad: '', valor: '', seccion: '' }]);
    setDescuento('');
    setPropietario('');
    setCiudad('');
    setNombreProyecto('');
    setSaludo(SALUDO_DEFECTO);
    setParrafoContexto(PARRAFO_CONTEXTO_DEFECTO);
    setCondicionesPago(condicionesPagoDefecto());
    setTiempoEntrega(TIEMPO_ENTREGA_DEFECTO);
    setFirmante('');
  };

  // Al elegir un cliente en el buscador: autocompleta propietario, ciudad si el cliente la trae,
  // nombre del proyecto y, si tiene m2 registrados, los agrega al final del párrafo de contexto
  // (2026-08-26, a pedido del usuario) — todo queda editable después de autocompletarse.
  const seleccionarCliente = (cliente) => {
    setClienteSeleccionado(cliente.id);
    setPropietario(cliente.nombre);
    setNombreProyecto(cliente.nombre_proyecto || '');
    if (cliente.mts2) {
      setParrafoContexto(`${PARRAFO_CONTEXTO_DEFECTO} de ${cliente.mts2} m2.`);
    } else {
      setParrafoContexto(PARRAFO_CONTEXTO_DEFECTO);
    }
  };

  // Aplica una plantilla guardada: precarga ítems, saludo, párrafo, condiciones de pago y
  // descuento, dejando cliente/ciudad/propietario/proyecto intactos si ya se habían elegido.
  const aplicarPlantilla = (plantilla) => {
    setItems(plantilla.items.map((i) => ({ ...i, cantidad: i.cantidad != null ? String(i.cantidad) : '', valor: String(i.valor) })));
    setDescuento(plantilla.descuento ? String(plantilla.descuento) : '');
    setSaludo(plantilla.saludo || SALUDO_DEFECTO);
    setParrafoContexto(plantilla.parrafo_contexto || PARRAFO_CONTEXTO_DEFECTO);
    setCondicionesPago(
      plantilla.condiciones_pago && plantilla.condiciones_pago.length
        ? plantilla.condiciones_pago.map((c) => ({ porcentaje: String(c.porcentaje ?? ''), descripcion: c.descripcion || '' }))
        : condicionesPagoDefecto()
    );
    setTiempoEntrega(plantilla.tiempo_entrega || TIEMPO_ENTREGA_DEFECTO);
    setModalPlantillasVisible(false);
  };

  const guardarComoPlantilla = async () => {
    if (!nombreNuevaPlantilla.trim()) {
      Alert.alert('Campo obligatorio', 'Ponle un nombre a la plantilla.');
      return;
    }
    const itemsValidos = items.filter((i) => i.descripcion.trim() && i.valor);
    if (itemsValidos.length === 0) {
      Alert.alert('Campos incompletos', 'Agrega al menos un ítem antes de guardar la plantilla.');
      return;
    }
    setGuardandoPlantilla(true);
    try {
      await api.post('/cotizaciones/plantillas/crear', {
        empresa_id: empresa.id,
        nombre: nombreNuevaPlantilla,
        saludo,
        parrafo_contexto: parrafoContexto,
        condiciones_pago: condicionesPago.filter((c) => c.porcentaje || c.descripcion),
        tiempo_entrega: tiempoEntrega,
        items: itemsValidos,
        descuento: descuento || 0,
      });
      Alert.alert('¡Listo!', 'Plantilla guardada. Ya está disponible para futuras cotizaciones.');
      setModalGuardarPlantillaVisible(false);
      setNombreNuevaPlantilla('');
      cargarDatos();
    } catch (error) {
      console.error('Error guardando plantilla:', error);
      Alert.alert('Error', 'No se pudo guardar la plantilla.');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const eliminarPlantilla = (plantilla) => {
    Alert.alert('Eliminar plantilla', `¿Eliminar la plantilla "${plantilla.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/cotizaciones/plantillas/${plantilla.id}`);
            cargarDatos();
          } catch (error) {
            console.error('Error eliminando plantilla:', error);
            Alert.alert('Error', 'No se pudo eliminar la plantilla.');
          }
        },
      },
    ]);
  };

  // Filtra clientes por nombre o nombre de proyecto para el buscador del modal de Nueva
  // Cotización (2026-08-26): reemplaza la lista completa de chips, inmanejable con muchos clientes.
  const textoNormalizadoCliente = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const busquedaClienteNormalizada = textoNormalizadoCliente(busquedaCliente);
  const clientesFiltrados = busquedaClienteNormalizada
    ? clientes.filter((c) =>
        textoNormalizadoCliente(c.nombre).includes(busquedaClienteNormalizada) ||
        textoNormalizadoCliente(c.nombre_proyecto).includes(busquedaClienteNormalizada)
      )
    : clientes;

  const actualizarCondicionPago = (index, campo, valor) => {
    const nuevas = [...condicionesPago];
    nuevas[index][campo] = valor;
    setCondicionesPago(nuevas);
  };
  const agregarCondicionPago = () => setCondicionesPago([...condicionesPago, { porcentaje: '', descripcion: '' }]);
  const quitarCondicionPago = (index) => {
    if (condicionesPago.length === 1) return;
    setCondicionesPago(condicionesPago.filter((_, i) => i !== index));
  };

  const actualizarEditCondicionPago = (index, campo, valor) => {
    const nuevas = [...editCondicionesPago];
    nuevas[index][campo] = valor;
    setEditCondicionesPago(nuevas);
  };
  const agregarEditCondicionPago = () => setEditCondicionesPago([...editCondicionesPago, { porcentaje: '', descripcion: '' }]);
  const quitarEditCondicionPago = (index) => {
    if (editCondicionesPago.length === 1) return;
    setEditCondicionesPago(editCondicionesPago.filter((_, i) => i !== index));
  };

  const actualizarItem = (index, campo, valor) => {
    const nuevosItems = [...items];
    nuevosItems[index][campo] = valor;
    setItems(nuevosItems);
  };

  const agregarItem = () => {
    setItems([...items, { descripcion: '', cantidad: '', valor: '', seccion: '' }]);
  };

  const quitarItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotalCotizacion = items.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);
  const totalCotizacion = subtotalCotizacion - (parseFloat(descuento) || 0);
  const subtotalEditCotizacion = editItems.reduce((sum, item) => sum + (parseFloat(item.valor) || 0), 0);
  const totalEditCotizacion = subtotalEditCotizacion - (parseFloat(editDescuento) || 0);

  const crearCotizacion = async () => {
    if (!clienteSeleccionado) {
      Alert.alert('Campo obligatorio', 'Selecciona un cliente.');
      return;
    }
    const itemsValidos = items.filter((i) => i.descripcion.trim() && i.valor);
    if (itemsValidos.length === 0) {
      Alert.alert('Campos incompletos', 'Agrega al menos un ítem con descripción y valor.');
      return;
    }

    setGuardando(true);
    try {
      await api.post('/cotizaciones/crear', {
        empresa_id: empresa.id,
        cliente_id: clienteSeleccionado,
        items: itemsValidos,
        descuento: descuento || 0,
        propietario: propietario || null,
        ciudad: ciudad || null,
        nombre_proyecto: nombreProyecto || null,
        saludo: saludo || null,
        parrafo_contexto: parrafoContexto || null,
        condiciones_pago: condicionesPago.filter((c) => c.porcentaje || c.descripcion),
        tiempo_entrega: tiempoEntrega || null,
        firmante: firmante || null,
      });
      Alert.alert('¡Listo!', 'Cotización creada exitosamente.');
      setModalVisible(false);
      limpiarFormulario();
      cargarDatos();
    } catch (error) {
      console.error('Error creando cotización:', error);
      Alert.alert('Error', 'No se pudo crear la cotización.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirMenu = (cot) => setMenuCotizacion(cot);
  const cerrarMenu = () => setMenuCotizacion(null);

  const abrirEditar = async (cot) => {
    cerrarMenu();
    try {
      const res = await api.get(`/cotizaciones/${cot.id}`);
      setEditandoCotizacion(cot);
      setEditItems(res.data.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad != null ? String(i.cantidad) : '', valor: String(i.valor), seccion: i.seccion || '', adicional: i.adicional })));
      setEditDescuento(cot.descuento ? String(cot.descuento) : '');
      setEditPropietario(res.data.propietario || '');
      setEditCiudad(res.data.ciudad || '');
      setEditNombreProyecto(res.data.nombre_proyecto || '');
      setEditSaludo(res.data.saludo || SALUDO_DEFECTO);
      setEditParrafoContexto(res.data.parrafo_contexto || PARRAFO_CONTEXTO_DEFECTO);
      // Mismo fix que en generarYCompartirPdf (2026-08-27): condiciones_pago puede llegar como
      // array ya parseado o como string JSON sin parsear, según cómo haya quedado esa columna en
      // la base real. Sin esto, .length/.map() sobre un string rompían la carga del editor.
      let editCondicionesPagoArray = res.data.condiciones_pago;
      if (typeof editCondicionesPagoArray === 'string') {
        try {
          editCondicionesPagoArray = JSON.parse(editCondicionesPagoArray);
        } catch (e) {
          editCondicionesPagoArray = null;
        }
      }
      setEditCondicionesPago(
        Array.isArray(editCondicionesPagoArray) && editCondicionesPagoArray.length
          ? editCondicionesPagoArray.map((c) => ({ porcentaje: String(c.porcentaje ?? ''), descripcion: c.descripcion || '' }))
          : condicionesPagoDefecto()
      );
      setEditTiempoEntrega(res.data.tiempo_entrega || TIEMPO_ENTREGA_DEFECTO);
      setEditFirmante(res.data.firmante || '');
      setModalEditarVisible(true);
    } catch (error) {
      console.error('Error cargando cotización:', error);
      Alert.alert('Error', 'No se pudo cargar la cotización para editar.');
    }
  };

  const actualizarEditItem = (index, campo, valor) => {
    const nuevos = [...editItems];
    nuevos[index][campo] = valor;
    setEditItems(nuevos);
  };

  const agregarEditItem = () => setEditItems([...editItems, { descripcion: '', cantidad: '', valor: '', seccion: '' }]);

  const quitarEditItem = (index) => {
    if (editItems.length === 1) return;
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const guardarEdicion = async () => {
    const itemsValidos = editItems.filter((i) => i.descripcion.trim() && i.valor);
    if (itemsValidos.length === 0) {
      Alert.alert('Campos incompletos', 'Agrega al menos un ítem con descripción y valor.');
      return;
    }
    setGuardando(true);
    try {
      if (editandoCotizacion.aceptada) {
        // Cotización ya aceptada: usamos el endpoint que actualiza también el contrato.
        await api.put(`/cotizaciones/${editandoCotizacion.id}/items-aceptada`, {
          items: itemsValidos,
          descuento: editDescuento || 0,
          propietario: editPropietario || null,
          ciudad: editCiudad || null,
          nombre_proyecto: editNombreProyecto || null,
          saludo: editSaludo || null,
          parrafo_contexto: editParrafoContexto || null,
          condiciones_pago: editCondicionesPago.filter((c) => c.porcentaje || c.descripcion),
          tiempo_entrega: editTiempoEntrega || null,
          firmante: editFirmante || null,
        });
        Alert.alert('¡Listo!', 'La cotización y el contrato se actualizaron correctamente.');
      } else {
        await api.put(`/cotizaciones/${editandoCotizacion.id}`, {
          items: itemsValidos,
          descuento: editDescuento || 0,
          propietario: editPropietario || null,
          ciudad: editCiudad || null,
          nombre_proyecto: editNombreProyecto || null,
          saludo: editSaludo || null,
          parrafo_contexto: editParrafoContexto || null,
          condiciones_pago: editCondicionesPago.filter((c) => c.porcentaje || c.descripcion),
          tiempo_entrega: editTiempoEntrega || null,
          firmante: editFirmante || null,
        });
      }
      setModalEditarVisible(false);
      cargarDatos();
    } catch (error) {
      console.error('Error editando cotización:', error);
      const mensaje = error.response?.data?.error || 'No se pudo editar la cotización.';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  // Generar PDF ya NO abre un modal a preguntar datos otra vez (2026-08-26, a pedido del
  // usuario): usa directamente lo que ya está guardado en la cotización desde que se creó/editó.
  const generarYCompartirPdf = async (cot) => {
    cerrarMenu();
    setGenerandoPdf(true);
    try {
      const res = await api.get(`/cotizaciones/${cot.id}`);
      const cliente = clientes.find((c) => c.id === cot.cliente_id) || { nombre: cot.cliente_nombre };
      // condiciones_pago puede llegar como array ya parseado (columna JSONB) o como string JSON
      // sin parsear, según cómo haya quedado esa columna en la base real — se normaliza a array
      // antes de usar .map() para no reventar la generación del PDF si viene en cualquiera de las
      // dos formas (2026-08-27, bug reportado: "no se puede generar el PDF de la cotización").
      let condicionesPagoArray = res.data.condiciones_pago;
      if (typeof condicionesPagoArray === 'string') {
        try {
          condicionesPagoArray = JSON.parse(condicionesPagoArray);
        } catch (e) {
          condicionesPagoArray = null;
        }
      }
      const condicionesPagoTexto = (Array.isArray(condicionesPagoArray) && condicionesPagoArray.length ? condicionesPagoArray : condicionesPagoDefecto())
        .map((c) => `${c.porcentaje}% — ${c.descripcion}`)
        .join('\n');
      const uriPdf = await generarPdfDocumento({
        tipoDocumento: 'cotizacion',
        empresa,
        cliente: { ...cliente, nombre_proyecto: res.data.nombre_proyecto || cliente.nombre_proyecto },
        numero: cot.numero,
        fecha: cot.created_at,
        items: res.data.items,
        total: cot.total,
        descuento: cot.descuento,
        ciudad: res.data.ciudad || '',
        propietario: res.data.propietario || cliente.nombre || '',
        saludo: res.data.saludo || SALUDO_DEFECTO,
        parrafo: res.data.parrafo_contexto || PARRAFO_CONTEXTO_DEFECTO,
        condicionesPago: condicionesPagoTexto,
        tiempoEntrega: res.data.tiempo_entrega || TIEMPO_ENTREGA_DEFECTO,
        firmante: res.data.firmante || '',
      });
      const nombreArchivo = `Cotizacion_${(cot.cliente_nombre || 'cliente').replace(/\s+/g, '_')}.pdf`;

      Alert.alert('PDF generado', '¿Qué deseas hacer con el documento?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar',
          onPress: async () => {
            try {
              await descargarPdfDocumento(uriPdf, nombreArchivo);
              Alert.alert('¡Listo!', 'El PDF se guardó en tu celular.');
            } catch (error) {
              console.error('Error descargando PDF:', error);
              Alert.alert('No se guardó', error?.message || 'No se pudo guardar el PDF.');
            }
          },
        },
        {
          text: 'Compartir',
          onPress: async () => {
            try {
              await compartirPdfDocumento(uriPdf, nombreArchivo);
            } catch (error) {
              console.error('Error compartiendo PDF:', error);
              Alert.alert('Error', error?.message || 'No se pudo compartir el PDF.');
            }
          },
        },
      ]);
    } catch (error) {
      console.error('Error generando PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF de la cotización.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  const confirmarEliminar = (cot) => {
    cerrarMenu();
    // Si ya fue aceptada, el backend elimina también el contrato y el proyecto asociado
    // (con todo lo que tenga: fotos, planos, chat, equipo, estadísticas) en la misma operación.
    const mensaje = cot.aceptada
      ? `Esta cotización ya fue aceptada y generó un contrato. Al eliminarla se borrará también el contrato y el proyecto completo asociado (fotos, planos 3D, chat, equipo asignado). ¿Eliminar la cotización de ${cot.cliente_nombre}?`
      : `¿Eliminar la cotización de ${cot.cliente_nombre}?`;
    Alert.alert('Eliminar cotización', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/cotizaciones/${cot.id}`, {
              data: { solicitante_id: usuario?.id },
            });
            cargarDatos();
          } catch (error) {
            console.error('Error eliminando cotización:', error);
            const mensajeError = error.response?.data?.error || 'No se pudo eliminar la cotización.';
            Alert.alert('Error', mensajeError);
          }
        },
      },
    ]);
  };

  const aceptarCotizacion = (cotizacion) => {
    Alert.alert(
      'Aceptar cotización',
      `¿Confirmas que ${cotizacion.cliente_nombre} aceptó la cotización de ${empresa.nombre}? Esto generará un contrato automáticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            try {
              await api.post(`/cotizaciones/${cotizacion.id}/aceptar`, {});
              Alert.alert('¡Listo!', 'Contrato generado exitosamente.');
              cargarDatos();
            } catch (error) {
              console.error('Error aceptando cotización:', error);
              const mensaje = error.response?.data?.error || 'No se pudo aceptar la cotización.';
              Alert.alert('Error', mensaje);
            }
          },
        },
      ]
    );
  };

  // Filtra por nombre del proyecto, nombre del cliente o número de cotización.
  const textoNormalizado = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const busquedaNormalizada = textoNormalizado(busqueda);
  const cotizacionesFiltradas = busquedaNormalizada
    ? cotizaciones.filter((c) =>
        textoNormalizado(c.nombre_proyecto).includes(busquedaNormalizada) ||
        textoNormalizado(c.cliente_nombre).includes(busquedaNormalizada) ||
        textoNormalizado(c.numero).includes(busquedaNormalizada)
      )
    : cotizaciones;

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
          placeholder="🔍 Buscar por proyecto, cliente o N°..."
          placeholderTextColor="#999"
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cotizacionesFiltradas.length === 0 ? (
          <Text style={styles.vacioTexto}>
            {cotizaciones.length === 0 ? 'Aún no hay cotizaciones. Toca "Nueva Cotización" para empezar.' : 'No se encontraron cotizaciones con ese texto.'}
          </Text>
        ) : (
          cotizacionesFiltradas.map((cot) => (
            <View key={cot.id} style={styles.cotizacionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cotizacionProyecto}>{cot.nombre_proyecto || 'Sin nombre de proyecto'}</Text>
                <Text style={styles.cotizacionCliente}>{cot.cliente_nombre}</Text>
                {cot.mts2 ? <Text style={styles.cotizacionMts2}>📐 {cot.mts2} m²</Text> : null}
                {cot.numero ? <Text style={styles.cotizacionNumero}>N° {cot.numero}</Text> : null}
                <Text style={styles.cotizacionTotal}>{formatearMoneda(cot.total)}</Text>
                <View
                  style={[
                    styles.etiquetaEstado,
                    cot.aceptada ? styles.etiquetaAceptada : styles.etiquetaPendiente,
                  ]}
                >
                  <Text style={styles.etiquetaTexto}>{cot.aceptada ? 'Aceptada' : 'Pendiente'}</Text>
                </View>
              </View>
              {!cot.aceptada && (
                <TouchableOpacity style={styles.botonAceptar} onPress={() => aceptarCotizacion(cot)}>
                  <Text style={styles.botonAceptarTexto}>Aceptar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.botonMenu} onPress={() => abrirMenu(cot)}>
                <Text style={styles.botonMenuTexto}>⋮</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.botonAgregar, { bottom: Math.max(insets.bottom, 20) }]} onPress={() => setModalVisible(true)}>
        <Text style={styles.botonAgregarTexto}>NUEVA COTIZACIÓN</Text>
      </TouchableOpacity>

      {/* MENÚ 3 PUNTOS */}
      <Modal visible={!!menuCotizacion} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={cerrarMenu}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>{menuCotizacion?.cliente_nombre}</Text>
            {menuCotizacion?.aceptada ? (
              <>
                <Text style={styles.menuNotaTexto}>Ya fue aceptada. Puedes editarla por completo; el contrato se actualiza automáticamente.</Text>
                <TouchableOpacity style={styles.menuOpcion} onPress={() => abrirEditar(menuCotizacion)}>
                  <Text style={styles.menuOpcionTexto}>✏️  Editar</Text>
                </TouchableOpacity>
                {puedeEliminarCotizaciones && (
                  <TouchableOpacity style={styles.menuOpcion} onPress={() => confirmarEliminar(menuCotizacion)}>
                    <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.menuOpcion} onPress={() => abrirEditar(menuCotizacion)}>
                  <Text style={styles.menuOpcionTexto}>✏️  Editar</Text>
                </TouchableOpacity>
                {puedeEliminarCotizaciones && (
                  <TouchableOpacity style={styles.menuOpcion} onPress={() => confirmarEliminar(menuCotizacion)}>
                    <Text style={[styles.menuOpcionTexto, { color: '#DC143C' }]}>🗑️  Eliminar</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity style={styles.menuOpcion} onPress={() => generarYCompartirPdf(menuCotizacion)} disabled={generandoPdf}>
              <Text style={styles.menuOpcionTexto}>{generandoPdf ? 'Generando PDF...' : '📄  Generar PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={cerrarMenu}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* insets.top/bottom evitan que el contenido quede pegado a la barra de estado y a la barra de gestos en Android (edgeToEdgeEnabled) */}
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingTop: Math.max(insets.top, 20), paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 60) }}>
            <Text style={styles.modalTitulo}>Nueva Cotización</Text>

            {/* Orden de todo el formulario (2026-08-26, a pedido del usuario): sigue el MISMO
                orden en que aparece la información en el documento real de la empresa —
                plantilla (opcional) → cliente → ciudad → propietario → nombre del proyecto →
                saludo → párrafo de contexto → ítems → descuento/total → condiciones de pago →
                tiempo de entrega → firmante. El número de cotización ya no aparece aquí: lo
                asigna el backend automáticamente. */}
            {plantillas.length > 0 && (
              <TouchableOpacity style={styles.botonPlantilla} onPress={() => setModalPlantillasVisible(true)}>
                <Text style={styles.botonPlantillaTexto}>📋  Usar una plantilla guardada</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Cliente *</Text>
            {clientes.length === 0 ? (
              <Text style={styles.notaTexto}>No hay clientes creados. Ve primero a la pantalla de Clientes.</Text>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={busquedaCliente}
                  onChangeText={setBusquedaCliente}
                  placeholder="🔍 Buscar cliente por nombre o proyecto..."
                  placeholderTextColor="#999"
                />
                <View style={styles.opcionesLista}>
                  {clientesFiltrados.map((cliente) => (
                    <TouchableOpacity
                      key={cliente.id}
                      style={[styles.opcion, clienteSeleccionado === cliente.id && styles.opcionSeleccionada]}
                      onPress={() => seleccionarCliente(cliente)}
                    >
                      <Text style={[styles.opcionTexto, clienteSeleccionado === cliente.id && styles.opcionTextoSeleccionado]}>
                        {cliente.nombre}{cliente.nombre_proyecto ? ` — ${cliente.nombre_proyecto}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {clientesFiltrados.length === 0 && (
                    <Text style={styles.notaTexto}>No se encontró ningún cliente con ese texto.</Text>
                  )}
                </View>
              </>
            )}

            <Text style={styles.label}>Ciudad</Text>
            <TextInput style={styles.input} value={ciudad} onChangeText={setCiudad} placeholder="Ej: Medellín" placeholderTextColor="#999" />

            <Text style={styles.label}>Propietario (a quién va dirigido)</Text>
            <TextInput style={styles.input} value={propietario} onChangeText={setPropietario} placeholder="Nombre del propietario" placeholderTextColor="#999" />

            <Text style={styles.label}>Nombre del proyecto</Text>
            <TextInput style={styles.input} value={nombreProyecto} onChangeText={setNombreProyecto} placeholder="Ej: Llano Azul Casa 3464" placeholderTextColor="#999" />

            <Text style={styles.label}>Saludo</Text>
            <TextInput style={styles.input} value={saludo} onChangeText={setSaludo} placeholder="Ej: Cordial Saludo:" placeholderTextColor="#999" />

            <Text style={styles.label}>Párrafo de contexto</Text>
            <TextInput style={[styles.input, styles.inputMultilinea]} value={parrafoContexto} onChangeText={setParrafoContexto} multiline placeholderTextColor="#999" />

            <Text style={styles.label}>Ítems de la cotización *</Text>
            {items.map((item, index) => (
              <View key={index} style={styles.itemBloque}>
                <View style={styles.itemSeccionBotones}>
                  <TouchableOpacity
                    style={[styles.itemSeccionBoton, item.seccion === 'Obra blanca' && styles.itemSeccionBotonSeleccionado]}
                    onPress={() => actualizarItem(index, 'seccion', item.seccion === 'Obra blanca' ? '' : 'Obra blanca')}
                  >
                    <Text style={[styles.itemSeccionBotonTexto, item.seccion === 'Obra blanca' && styles.itemSeccionBotonTextoSeleccionado]}>Obra blanca</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.itemSeccionBoton, item.seccion === 'Carpintería' && styles.itemSeccionBotonSeleccionado]}
                    onPress={() => actualizarItem(index, 'seccion', item.seccion === 'Carpintería' ? '' : 'Carpintería')}
                  >
                    <Text style={[styles.itemSeccionBotonTexto, item.seccion === 'Carpintería' && styles.itemSeccionBotonTextoSeleccionado]}>Carpintería</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, styles.inputDescripcionItem]}
                  value={item.descripcion}
                  onChangeText={(texto) => actualizarItem(index, 'descripcion', texto)}
                  placeholder="Descripción"
                  placeholderTextColor="#999"
                  multiline
                />
                <View style={styles.itemFila}>
                  <TextInput
                    style={[styles.input, { flex: 0.7 }]}
                    value={item.cantidad}
                    onChangeText={(texto) => actualizarItem(index, 'cantidad', texto.replace(/[^0-9.]/g, ''))}
                    placeholder="Cant."
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                  <InputMoneda
                    style={[styles.input, styles.inputValorItem]}
                    value={item.valor}
                    onChangeValor={(texto) => actualizarItem(index, 'valor', texto)}
                    placeholder="Valor"
                  />
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => quitarItem(index)} style={styles.botonQuitarItem}>
                      <Text style={styles.botonQuitarItemTexto}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.botonAgregarItem} onPress={agregarItem}>
              <Text style={styles.botonAgregarItemTexto}>+ Agregar ítem</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Descuento (opcional)</Text>
            <InputMoneda
              style={styles.input}
              value={descuento}
              onChangeValor={(texto) => setDescuento(texto)}
              placeholder="Ej: 1680000"
            />

            <Text style={styles.totalTexto}>Total: {formatearMoneda(totalCotizacion)}</Text>

            <Text style={styles.label}>Condiciones de pago</Text>
            <Text style={styles.notaTexto}>{PARRAFO_CONDICIONES_PAGO}</Text>
            {condicionesPago.map((cond, index) => (
              <View key={index} style={styles.filaCondicionPago}>
                <TextInput
                  style={[styles.input, styles.inputPorcentaje]}
                  value={cond.porcentaje}
                  onChangeText={(texto) => actualizarCondicionPago(index, 'porcentaje', texto.replace(/[^0-9]/g, ''))}
                  placeholder="%"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.inputDescripcionCondicion]}
                  value={cond.descripcion}
                  onChangeText={(texto) => actualizarCondicionPago(index, 'descripcion', texto)}
                  placeholder="Descripción"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => quitarCondicionPago(index)}>
                  <Text style={styles.botonQuitarItem}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.botonAgregarItem} onPress={agregarCondicionPago}>
              <Text style={styles.botonAgregarItemTexto}>+ Agregar condición</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Tiempo de entrega</Text>
            <TextInput style={styles.input} value={tiempoEntrega} onChangeText={setTiempoEntrega} placeholderTextColor="#999" />

            <Text style={styles.label}>Firmante</Text>
            <TextInput style={styles.input} value={firmante} onChangeText={setFirmante} placeholder="Quién firma la carta" placeholderTextColor="#999" />

            <TouchableOpacity style={styles.botonGuardar} onPress={crearCotizacion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>CREAR COTIZACIÓN</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonGuardarPlantilla} onPress={() => setModalGuardarPlantillaVisible(true)}>
              <Text style={styles.botonGuardarPlantillaTexto}>💾  Guardar estos ítems como plantilla</Text>
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

      {/* MODAL: Seleccionar plantilla */}
      <Modal visible={modalPlantillasVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setModalPlantillasVisible(false)}>
          <View style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>Elige una plantilla</Text>
            {plantillas.map((plantilla) => (
              <TouchableOpacity
                key={plantilla.id}
                style={styles.menuOpcion}
                onPress={() => aplicarPlantilla(plantilla)}
                onLongPress={() => eliminarPlantilla(plantilla)}
              >
                <Text style={styles.menuOpcionTexto}>{plantilla.nombre}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.menuNotaTexto}>Mantén presionada una plantilla para eliminarla</Text>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => setModalPlantillasVisible(false)}>
              <Text style={[styles.menuOpcionTexto, { color: '#888' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Guardar como plantilla */}
      <Modal visible={modalGuardarPlantillaVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setModalGuardarPlantillaVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.menuBox, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
            <Text style={styles.menuTitulo}>Guardar como plantilla</Text>
            <TextInput
              style={styles.input}
              value={nombreNuevaPlantilla}
              onChangeText={setNombreNuevaPlantilla}
              placeholder="Ej: Kit de acabados estándar"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={[styles.botonGuardar, { marginTop: 16 }]} onPress={guardarComoPlantilla} disabled={guardandoPlantilla}>
              {guardandoPlantilla ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR PLANTILLA</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalGuardarPlantillaVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: Editar cotización */}
      <Modal visible={modalEditarVisible} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* insets.top/bottom evitan que el contenido quede pegado a la barra de estado y a la barra de gestos en Android (edgeToEdgeEnabled) */}
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingTop: Math.max(insets.top, 20), paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 60) }}>
            <Text style={styles.modalTitulo}>Editar Cotización</Text>
            <Text style={styles.notaTexto}>Cliente: {editandoCotizacion?.cliente_nombre}</Text>
            {editandoCotizacion?.aceptada && (
              <Text style={styles.notaTexto}>Esta cotización ya fue aceptada: al guardar, el contrato se actualizará con los cambios.</Text>
            )}

            <Text style={styles.label}>Ciudad</Text>
            <TextInput style={styles.input} value={editCiudad} onChangeText={setEditCiudad} placeholder="Ej: Medellín" placeholderTextColor="#999" />

            <Text style={styles.label}>Propietario (a quién va dirigido)</Text>
            <TextInput style={styles.input} value={editPropietario} onChangeText={setEditPropietario} placeholder="Nombre del propietario" placeholderTextColor="#999" />

            <Text style={styles.label}>Nombre del proyecto</Text>
            <TextInput style={styles.input} value={editNombreProyecto} onChangeText={setEditNombreProyecto} placeholder="Ej: Llano Azul Casa 3464" placeholderTextColor="#999" />

            <Text style={styles.label}>Saludo</Text>
            <TextInput style={styles.input} value={editSaludo} onChangeText={setEditSaludo} placeholder="Ej: Cordial Saludo:" placeholderTextColor="#999" />

            <Text style={styles.label}>Párrafo de contexto</Text>
            <TextInput style={[styles.input, styles.inputMultilinea]} value={editParrafoContexto} onChangeText={setEditParrafoContexto} multiline placeholderTextColor="#999" />

            <Text style={styles.label}>Ítems de la cotización *</Text>
            {editItems.map((item, index) => (
              <View key={index} style={styles.itemBloque}>
                <View style={styles.itemSeccionBotones}>
                  <TouchableOpacity
                    style={[styles.itemSeccionBoton, item.seccion === 'Obra blanca' && styles.itemSeccionBotonSeleccionado]}
                    onPress={() => actualizarEditItem(index, 'seccion', item.seccion === 'Obra blanca' ? '' : 'Obra blanca')}
                  >
                    <Text style={[styles.itemSeccionBotonTexto, item.seccion === 'Obra blanca' && styles.itemSeccionBotonTextoSeleccionado]}>Obra blanca</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.itemSeccionBoton, item.seccion === 'Carpintería' && styles.itemSeccionBotonSeleccionado]}
                    onPress={() => actualizarEditItem(index, 'seccion', item.seccion === 'Carpintería' ? '' : 'Carpintería')}
                  >
                    <Text style={[styles.itemSeccionBotonTexto, item.seccion === 'Carpintería' && styles.itemSeccionBotonTextoSeleccionado]}>Carpintería</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, styles.inputDescripcionItem]}
                  value={item.descripcion}
                  onChangeText={(texto) => actualizarEditItem(index, 'descripcion', texto)}
                  placeholder="Descripción"
                  placeholderTextColor="#999"
                  multiline
                />
                <View style={styles.itemFila}>
                  <TextInput
                    style={[styles.input, { flex: 0.7 }]}
                    value={item.cantidad}
                    onChangeText={(texto) => actualizarEditItem(index, 'cantidad', texto.replace(/[^0-9.]/g, ''))}
                    placeholder="Cant."
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                  <InputMoneda
                    style={[styles.input, styles.inputValorItem]}
                    value={item.valor}
                    onChangeValor={(texto) => actualizarEditItem(index, 'valor', texto)}
                    placeholder="Valor"
                  />
                  {editItems.length > 1 && (
                    <TouchableOpacity onPress={() => quitarEditItem(index)} style={styles.botonQuitarItem}>
                      <Text style={styles.botonQuitarItemTexto}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.botonAgregarItem} onPress={agregarEditItem}>
              <Text style={styles.botonAgregarItemTexto}>+ Agregar ítem</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Descuento (opcional)</Text>
            <InputMoneda
              style={styles.input}
              value={editDescuento}
              onChangeValor={(texto) => setEditDescuento(texto)}
              placeholder="Ej: 1680000"
            />

            <Text style={styles.totalTexto}>Total: {formatearMoneda(totalEditCotizacion)}</Text>

            <Text style={styles.label}>Condiciones de pago</Text>
            <Text style={styles.notaTexto}>{PARRAFO_CONDICIONES_PAGO}</Text>
            {editCondicionesPago.map((cond, index) => (
              <View key={index} style={styles.filaCondicionPago}>
                <TextInput
                  style={[styles.input, styles.inputPorcentaje]}
                  value={cond.porcentaje}
                  onChangeText={(texto) => actualizarEditCondicionPago(index, 'porcentaje', texto.replace(/[^0-9]/g, ''))}
                  placeholder="%"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.inputDescripcionCondicion]}
                  value={cond.descripcion}
                  onChangeText={(texto) => actualizarEditCondicionPago(index, 'descripcion', texto)}
                  placeholder="Descripción"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => quitarEditCondicionPago(index)}>
                  <Text style={styles.botonQuitarItem}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.botonAgregarItem} onPress={agregarEditCondicionPago}>
              <Text style={styles.botonAgregarItemTexto}>+ Agregar condición</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Tiempo de entrega</Text>
            <TextInput style={styles.input} value={editTiempoEntrega} onChangeText={setEditTiempoEntrega} placeholderTextColor="#999" />

            <Text style={styles.label}>Firmante</Text>
            <TextInput style={styles.input} value={editFirmante} onChangeText={setEditFirmante} placeholder="Quién firma la carta" placeholderTextColor="#999" />

            <TouchableOpacity style={styles.botonGuardar} onPress={guardarEdicion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonAgregarTexto}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalEditarVisible(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
  vacioTexto: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  cotizacionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cotizacionProyecto: { fontSize: 16, fontWeight: 'bold', color: '#1E90FF' },
  cotizacionCliente: { fontSize: 14, fontWeight: '600', color: '#222', marginTop: 2 },
  cotizacionMts2: { fontSize: 12, color: '#666', marginTop: 2 },
  cotizacionNumero: { fontSize: 12, color: '#999', marginTop: 2 },
  cotizacionTotal: { fontSize: 15, fontWeight: 'bold', color: '#1E90FF', marginTop: 4 },
  etiquetaEstado: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 6 },
  etiquetaAceptada: { backgroundColor: '#c8e6c9' },
  etiquetaPendiente: { backgroundColor: '#ffe0b2' },
  etiquetaTexto: { fontSize: 11, fontWeight: 'bold', color: '#333' },
  botonAceptar: { backgroundColor: '#1E90FF', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  botonAceptarTexto: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
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
  notaTexto: { fontSize: 13, color: '#999' },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  opcionesLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  opcion: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  opcionSeleccionada: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  opcionTexto: { fontSize: 13, color: '#555' },
  opcionTextoSeleccionado: { color: '#fff', fontWeight: '600' },
  itemBloque: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  itemFila: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  itemSeccionBotones: { flexDirection: 'row', gap: 8 },
  itemSeccionBoton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  itemSeccionBotonSeleccionado: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  itemSeccionBotonTexto: { fontSize: 14, color: '#555', fontWeight: '600' },
  itemSeccionBotonTextoSeleccionado: { color: '#fff' },
  inputDescripcionItem: { minHeight: 60, textAlignVertical: 'top', marginTop: 8 },
  inputValorItem: { flex: 1.6 },
  botonQuitarItem: { padding: 8 },
  botonQuitarItemTexto: { fontSize: 16, color: '#DC143C', fontWeight: 'bold' },
  botonAgregarItem: { marginTop: 10, padding: 8 },
  botonAgregarItemTexto: { color: '#1E90FF', fontSize: 14, fontWeight: '600' },
  totalTexto: { fontSize: 17, fontWeight: 'bold', color: '#222', marginTop: 20, textAlign: 'right' },
  seccionTitulo: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  inputMultilinea: { minHeight: 70, textAlignVertical: 'top' },
  filaCondicionPago: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  inputPorcentaje: { width: 55, textAlign: 'center' },
  inputDescripcionCondicion: { flex: 1 },
  botonGuardar: {
    backgroundColor: '#1E90FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  botonCancelar: { alignItems: 'center', marginTop: 12, padding: 10 },
  botonCancelarTexto: { color: '#888', fontSize: 14 },
  botonMenu: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 },
  botonMenuTexto: { fontSize: 22, color: '#888', fontWeight: 'bold' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  menuTitulo: { fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 14, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuOpcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
  menuNotaTexto: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 14 },
  botonPlantilla: { backgroundColor: '#eef4ff', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 18 },
  botonPlantillaTexto: { color: '#2255aa', fontWeight: 'bold', fontSize: 14 },
  botonGuardarPlantilla: { alignItems: 'center', marginTop: 14, padding: 10 },
  botonGuardarPlantillaTexto: { color: '#2255aa', fontSize: 14, fontWeight: '600' },
});
