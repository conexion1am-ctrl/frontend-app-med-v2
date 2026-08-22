module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 movió el motor de "worklets" (el código que corre los gestos táctiles
    // en un hilo nativo aparte) a su propio paquete, react-native-worklets. Sin este plugin
    // explícito, el código de gestos se compila mal: no revienta al compilar ni al abrir
    // la app, pero SÍ en cuanto el usuario dispara un gesto real (tocar/arrastrar la
    // pantalla), con el crash "Property 'WorkletsError' doesn't exist" — visto en el
    // Visor 3D al intentar rotar/mover/hacer zoom. Debe ir último en la lista de plugins.
    plugins: ['react-native-worklets/plugin'],
  };
};
