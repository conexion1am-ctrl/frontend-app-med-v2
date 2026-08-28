// Sistema de permisos por área. Cada área de areas_catalogo tiene un nombre exacto
// (GERENCIA, AREA ADMINISTRATIVA, AREA DE LOGISTICA, AREA COMERCIAL, AREA DE PROVEEDORES,
// AREA DE CLIENTES, y las 15 áreas de tipo "oficio": Electricidad, Pintura, etc.).
//
// En vez de un simple "administrativo sí/no", cada área tiene su propio conjunto de permisos,
// porque por ejemplo Comercial y Logística son ambas de tipo "administrativa" en la base de
// datos pero necesitan accesos muy distintos entre sí.
//
// Todo lo que NO es GERENCIA, AREA ADMINISTRATIVA, AREA DE LOGISTICA o AREA COMERCIAL
// (es decir: oficio y "especial" - Proveedores/Clientes) usa el permiso reducido por defecto:
// solo su perfil y los proyectos donde está asignado.

const PERMISOS_POR_AREA = {
  GERENCIA: {
    verProyectos: 'todos',
    gestionarProyectos: true,
    asignarPersonal: true,
    gestionarPlanos3d: true,
    verCotizaciones: true,
    verContratos: true,
    verClientes: true,
    eliminarClientes: true,
    verEstadisticas: true,
    verGrupoTrabajo: true,
    gestionarGrupoTrabajo: true,
    editarPerfilEmpresa: true,
  },
  'AREA ADMINISTRATIVA': {
    verProyectos: 'todos',
    gestionarProyectos: true,
    asignarPersonal: true,
    gestionarPlanos3d: true,
    verCotizaciones: true,
    verContratos: true,
    verClientes: true,
    eliminarClientes: true,
    verEstadisticas: true,
    verGrupoTrabajo: true,
    gestionarGrupoTrabajo: true,
    editarPerfilEmpresa: false, // solo Gerencia edita logo/color/nombre/sitio web de la empresa
  },
  'AREA DE LOGISTICA': {
    verProyectos: 'todos',
    gestionarProyectos: true,
    asignarPersonal: true,
    gestionarPlanos3d: true,
    verCotizaciones: false,
    verContratos: false,
    verClientes: false,
    eliminarClientes: false,
    verEstadisticas: false,
    verGrupoTrabajo: true,
    gestionarGrupoTrabajo: true,
    editarPerfilEmpresa: false,
  },
  'AREA COMERCIAL': {
    verProyectos: 'todos', // solo lectura: ve todo pero no gestiona (ver gestionarProyectos)
    gestionarProyectos: false,
    asignarPersonal: false,
    gestionarPlanos3d: false,
    verCotizaciones: false,
    verContratos: false,
    verClientes: true,
    eliminarClientes: false, // puede ver, llamar y agregar clientes, pero no eliminarlos
    verEstadisticas: false,
    verGrupoTrabajo: false,
    gestionarGrupoTrabajo: false,
    editarPerfilEmpresa: false,
  },
};

// Permisos por defecto: mano de obra (oficio) y áreas especiales (Proveedores/Clientes).
// Solo ven su perfil y los proyectos donde están asignados.
const PERMISOS_REDUCIDOS = {
  verProyectos: 'asignados',
  gestionarProyectos: false,
  asignarPersonal: false,
  gestionarPlanos3d: false,
  verCotizaciones: false,
  verContratos: false,
  verClientes: false,
  eliminarClientes: false,
  verEstadisticas: false,
  verGrupoTrabajo: false,
  gestionarGrupoTrabajo: false,
  editarPerfilEmpresa: false,
};

// Devuelve el objeto de permisos completo para la empresa/área actual del usuario.
export function permisosDe(empresa) {
  const nombre = empresa?.area_nombre;
  return PERMISOS_POR_AREA[nombre] || PERMISOS_REDUCIDOS;
}

// true si el área NO está en la lista de áreas con permisos definidos (oficio o especial):
// solo ve su perfil reducido y sus proyectos asignados. Se mantiene por compatibilidad con
// las pantallas que ya usaban esta función (MiPerfil vs EditarPerfil, ProyectosScreen, etc).
export function esAccesoReducido(empresa) {
  return !PERMISOS_POR_AREA[empresa?.area_nombre];
}

// true solo para GERENCIA: es la única área con acceso absolutamente sin restricciones.
export function esGerencia(empresa) {
  return empresa?.area_nombre === 'GERENCIA';
}

// true solo para GERENCIA y AREA ADMINISTRATIVA — usado para mostrar el nombre del cliente
// debajo del nombre del proyecto en la lista de Proyectos. Es una restricción más estricta que
// el permiso general verClientes (que también incluye a AREA COMERCIAL, porque esa área sí
// necesita ver/llamar/agregar clientes desde su propia pantalla de Clientes) — a pedido
// explícito del usuario, el dato del cliente asociado a cada proyecto solo debe verse desde
// Proyectos si el área es Gerencia o Administrativa, nadie más.
// true para GERENCIA y AREA ADMINISTRATIVA (2026-08-28, a pedido del usuario): antes solo
// Gerencia podía eliminar proyectos (ver esGerencia arriba); Administrativa pidió la misma
// facultad. Se creó esta función aparte en vez de ampliar esGerencia porque esa función se usa
// en otros puntos de la app con el sentido estricto de "solo Gerencia, nadie más" (por ejemplo
// permisos de Editar Perfil de empresa), y no se debía tocar ese comportamiento.
export function puedeEliminarProyectos(empresa) {
  return empresa?.area_nombre === 'GERENCIA' || empresa?.area_nombre === 'AREA ADMINISTRATIVA';
}

export function puedeVerClienteEnProyectos(empresa) {
  return empresa?.area_nombre === 'GERENCIA' || empresa?.area_nombre === 'AREA ADMINISTRATIVA';
}

// Rediseño 2026-08-24: "Actividades" (las fichas de área dentro de un proyecto: GERENCIA,
// AREA ADMINISTRATIVA, AREA DE LOGISTICA, Carpintería, etc.) ahora se muestran TODAS siempre,
// para cualquier persona — pero cada ficha solo es tocable ("con acceso") según el área del
// usuario logueado. Antes, algunas áreas (Proveedores, Clientes, oficio) "arrastraban" contenido
// de otras áreas DENTRO de su propia ficha (ej. un carpintero veía a un gerente colado dentro de
// la ficha de Carpintería) — esto causaba que, sin querer, gente de un área totalmente distinta
// apareciera donde no debía (bug reportado: un Administrativo veía a otro Administrativo colado
// dentro de la ficha de Logística/Carpintería, sin haberlo asignado ahí). Ahora cada ficha
// muestra EXCLUSIVAMENTE a quien está asignado a esa área exacta (ver AreaProyectoScreen.tsx,
// cargarEquipo) — lo único que varía por área del usuario logueado es cuáles fichas puede ABRIR.

// Qué fichas de área puede ABRIR (tocar) cada área del usuario logueado, dentro de un proyecto.
// GERENCIA, AREA ADMINISTRATIVA y AREA DE LOGISTICA tienen acceso a TODAS las fichas del
// proyecto sin excepción (ver función de abajo). El resto de áreas (oficio, Proveedores,
// Clientes) solo tienen acceso fijo a Administrativa y Logística, más su propia ficha — la
// ficha de GERENCIA es un caso aparte: no está fija aquí, se activa dinámicamente solo cuando
// ESE gerente en particular ya le escribió primero a esta persona (ver "le_ha_escrito" que
// calcula el backend, aplicado en AreaProyectoScreen.tsx).
const ACCESO_FIJO_RESTRINGIDO = ['AREA ADMINISTRATIVA', 'AREA DE LOGISTICA'];

// Áreas que, además del acceso fijo de arriba, SIEMPRE tienen acceso a su propia ficha (aunque
// nadie más esté asignado ahí todavía) — esto es válido para toda área que no sea una de las 3
// con acceso total. Se calcula dinámicamente por nombre de área, no hace falta listarlas.

export function esAreaConAccesoTotal(empresa) {
  const nombre = empresa?.area_nombre;
  return nombre === 'GERENCIA' || nombre === 'AREA ADMINISTRATIVA' || nombre === 'AREA DE LOGISTICA';
}

// true si el usuario logueado puede ABRIR la ficha de "area" (la actividad que se está evaluando
// dentro de la lista de Actividades del proyecto). "area" es la fila de proyecto_actividades/
// areas_catalogo (tiene .nombre); "leHaEscritoEseGerente" es un booleano ya resuelto por el
// llamador para el caso puntual de la ficha GERENCIA (requiere saber si ALGÚN gerente le ha
// escrito a este usuario en este proyecto — ver AreaProyectoScreen.tsx).
export function tieneAccesoAFicha(empresa, areaFicha, leHaEscritoAlgunGerente) {
  const nombre = empresa?.area_nombre;
  if (!nombre || !areaFicha?.nombre) return false;

  // Gerencia, Administrativa y Logística: acceso total, a cualquier ficha del proyecto.
  if (esAreaConAccesoTotal(empresa)) return true;

  // Cualquier otra área (oficio, Proveedores, Clientes) siempre tiene acceso a Administrativa
  // y Logística, y a su propia ficha exacta.
  if (ACCESO_FIJO_RESTRINGIDO.includes(areaFicha.nombre)) return true;
  if (areaFicha.nombre === nombre) return true;

  // La ficha de GERENCIA es un caso aparte: solo se activa si algún gerente ya le escribió
  // primero a este usuario en este proyecto (nunca por iniciativa propia del trabajador).
  if (areaFicha.nombre === 'GERENCIA') return !!leHaEscritoAlgunGerente;

  // Cualquier otra ficha (la actividad de OTRO oficio, ej. un carpintero mirando la ficha de
  // Electricidad) no es accesible.
  return false;
}

// true si, para el área del usuario logueado, las filas de GERENCIA en su roster de Equipo
// deben filtrarse por "¿ese gerente ya me escribió?" (oficio, Proveedores, Clientes) en vez de
// mostrarse siempre. Administrativa y Logística NO tienen esta restricción (ven a Gerencia
// libremente) — y Gerencia mirándose a sí misma no aplica (nunca se ve a sí misma en su roster).
export function gerenciaRequiereContactoPrevio(empresa) {
  const nombre = empresa?.area_nombre;
  return nombre !== 'GERENCIA' && nombre !== 'AREA ADMINISTRATIVA' && nombre !== 'AREA DE LOGISTICA';
}

// Pestañas visibles dentro de AreaProyectoScreen, según el área del usuario logueado.
// Por defecto (Gerencia, Administrativa, Logística, Comercial, oficio): Equipo + Fotos + Planos 3D.
// AREA DE PROVEEDORES: solo Equipo (sin Fotos, sin Planos 3D).
// AREA DE CLIENTES: solo Equipo + Contrato (sin Fotos, sin Planos 3D).
const PESTANAS_POR_AREA = {
  'AREA DE PROVEEDORES': ['equipo'],
  'AREA DE CLIENTES': ['equipo', 'contrato'],
};

export function pestanasAreaProyecto(empresa) {
  return PESTANAS_POR_AREA[empresa?.area_nombre] || ['equipo', 'fotos', 'planos3d'];
}

// Solo GERENCIA y AREA ADMINISTRATIVA usan la pantalla completa "Editar Perfil" (con su
// propio nombre editable). Todas las demás áreas (Comercial, Logística, Proveedores,
// Clientes, oficio) usan la pantalla reducida "Mi Perfil" (nombre de solo lectura, ARL,
// cambiar contraseña).
export function usaPerfilCompleto(empresa) {
  return empresa?.area_nombre === 'GERENCIA' || empresa?.area_nombre === 'AREA ADMINISTRATIVA';
}
