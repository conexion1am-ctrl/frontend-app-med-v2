const babel = require('@babel/core');
const path = require('path');

const files = [
  'app/utils/roles.js',
  'app/screens/DetalleProyectoScreen.tsx',
  'app/screens/AreaProyectoScreen.tsx',
];

let allOk = true;
for (const f of files) {
  try {
    babel.transformFileSync(path.resolve(f), {
      presets: [
        ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
      filename: f,
      babelrc: false,
      configFile: false,
    });
    console.log('OK  ', f);
  } catch (e) {
    allOk = false;
    console.log('FAIL', f);
    console.log(e.message);
  }
}
process.exit(allOk ? 0 : 1);
