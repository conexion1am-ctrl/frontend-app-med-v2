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

// Filtro de con quién puede chatear/ver en la pestaña Equipo de un proyecto, según el área
// del usuario logueado. Devuelve null si no hay restricción (ve/habla con todo el equipo,
// como hoy). AREA DE PROVEEDORES y AREA DE CLIENTES tienen visibilidad reducida.
const CONTACTOS_VISIBLES_POR_AREA = {
  'AREA DE PROVEEDORES': ['GERENCIA', 'AREA ADMINISTRATIVA', 'AREA DE LOGISTICA'],
  'AREA DE CLIENTES': ['GERENCIA', 'AREA ADMINISTRATIVA'],
};

export function areasVisiblesEnEquipo(empresa) {
  return CONTACTOS_VISIBLES_POR_AREA[empresa?.area_nombre] || null;
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
