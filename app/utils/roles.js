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
export function puedeVerClienteEnProyectos(empresa) {
  return empresa?.area_nombre === 'GERENCIA' || empresa?.area_nombre === 'AREA ADMINISTRATIVA';
}

// Filtro de con quién puede chatear/ver en la pestaña Equipo de un proyecto, según el área
// del usuario logueado. Devuelve null si no hay restricción (ve/habla con todo el equipo de
// su propia área exacta, como antes). AREA DE PROVEEDORES y AREA DE CLIENTES tienen
// visibilidad ampliada fija hacia áreas administrativas específicas.
const CONTACTOS_VISIBLES_POR_AREA = {
  'AREA DE PROVEEDORES': ['GERENCIA', 'AREA ADMINISTRATIVA', 'AREA DE LOGISTICA'],
  'AREA DE CLIENTES': ['GERENCIA', 'AREA ADMINISTRATIVA'],
};

// Las áreas de "oficio" (Carpintería, Electricidad, Estuco, etc. — las ~15 que no están en
// PERMISOS_POR_AREA ni tienen entrada propia arriba) antes solo veían en su pestaña Equipo a
// compañeros de su misma área exacta. Como Gerencia/Administrativa/Logística no comparten esa
// área, un trabajador de oficio nunca tenía a nadie de la empresa como contacto — su única fila
// visible terminaba siendo él mismo, lo que producía un "chat consigo mismo" con el nombre
// equivocado en el título (bug reportado: Juliana veía su propio nombre en vez del de Alejandro).
// Ahora, igual que Proveedores/Clientes, todo oficio ve también a Gerencia/Administrativa/
// Logística como filas de contacto separadas (un chat 1-a-1 independiente con cada persona).
const CONTACTOS_VISIBLES_OFICIO = ['GERENCIA', 'AREA ADMINISTRATIVA', 'AREA DE LOGISTICA'];

export function areasVisiblesEnEquipo(empresa) {
  const nombre = empresa?.area_nombre;
  // Sin nombre de área válido (dato faltante/malformado), por seguridad no ampliamos
  // visibilidad: mejor pecar de restrictivo (solo su propia área) que exponer de más.
  if (!nombre) return null;
  if (CONTACTOS_VISIBLES_POR_AREA[nombre]) return CONTACTOS_VISIBLES_POR_AREA[nombre];
  // Áreas con permisos propios definidos (Gerencia, Administrativa, Logística, Comercial) no
  // reciben visibilidad ampliada aquí — solo aplica a "oficio" (todo lo que no tiene permisos
  // propios ni entrada en el mapa de arriba, es decir esAccesoReducido === true, EXCLUYENDO
  // Proveedores/Clientes que ya se resolvieron en el if anterior).
  if (!PERMISOS_POR_AREA[nombre] && nombre !== 'AREA DE PROVEEDORES' && nombre !== 'AREA DE CLIENTES') {
    return CONTACTOS_VISIBLES_OFICIO;
  }
  return null;
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
