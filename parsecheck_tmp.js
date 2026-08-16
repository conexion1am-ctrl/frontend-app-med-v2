const babel = require('@babel/core');
const fs = require('fs');
const files = [
  'app/components/Visor3D.tsx',
  'app/screens/AreaProyectoScreen.tsx'
];
for (const f of files) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    babel.parse(code, {
      presets: [
        ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
        '@babel/preset-react'
      ],
      filename: f,
    });
    console.log('OK:', f);
  } catch (e) {
    console.log('FAIL:', f, e.message);
  }
}
