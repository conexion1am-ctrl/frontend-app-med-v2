// Guarda una referencia al objeto "navigation" de la pantalla de Inicio, para poder navegar
// desde fuera de una pantalla (por ejemplo, al tocar una notificación push mientras la app
// está en segundo plano). InicioScreen se monta siempre que hay una sesión activa, así que
// su "navigation" sirve como punto de entrada confiable para navegar a cualquier otra pantalla
// del mismo Stack.Navigator.
let navigationActual = null;

export function setNavigationGlobal(navigation) {
  navigationActual = navigation;
}

export function getNavigationGlobal() {
  return navigationActual;
}
