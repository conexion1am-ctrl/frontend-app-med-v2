// Utilidades para mostrar/escribir montos en pesos con puntos de miles (2.200.000), sin
// decimales, mientras el usuario escribe. El valor guardado en el estado sigue siendo un
// string de solo dígitos (sin puntos), listo para enviar al backend como número.

// "2200000" -> "2.200.000". Ignora todo lo que no sea dígito.
export function formatearConPuntosDeMiles(valor) {
  const soloDigitos = String(valor ?? '').replace(/[^0-9]/g, '');
  if (!soloDigitos) return '';
  return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// "2.200.000" -> "2200000". Lo que se guarda en el estado y se envía al backend.
export function quitarPuntosDeMiles(textoFormateado) {
  return String(textoFormateado ?? '').replace(/[^0-9]/g, '');
}
