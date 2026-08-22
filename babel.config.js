module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo YA detecta react-native-worklets instalado y agrega su plugin
    // automáticamente — NO hay que declararlo aquí a mano. Se probó agregarlo manualmente
    // (plugins: ['react-native-worklets/plugin']) pensando que hacía falta, pero eso hizo
    // que el plugin se aplicara DOS VECES sobre el mismo código (una vez por el preset, otra
    // por esta línea manual), generando el código de gestos corrupto que causaba el crash
    // "Property 'WorkletsError' doesn't exist" al tocar la pantalla del Visor 3D. Confirmado
    // revisando el código fuente de babel-preset-expo (node_modules/babel-preset-expo/build/
    // index.js), que inyecta require('react-native-worklets/plugin') por su cuenta si
    // detecta el paquete en node_modules.
    presets: ['babel-preset-expo'],
  };
};
