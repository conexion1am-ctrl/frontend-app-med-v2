// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Necesario para que @react-three/drei (useGLTF) reconozca los modelos 3D como assets,
// aunque en nuestro caso los .glb se descargan por URL remota (Firebase Storage) y no con
// require() local — se agrega igual porque el pipeline interno de drei/expo-asset lo espera.
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf', 'bin'];

module.exports = config;
