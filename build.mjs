import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');
const OUT_DIR = path.resolve('dist');

const MODULE_ORDER = [
  'pixel.js',
  'assets_data.js',
  'assets.js',
  'characters.js',
  'engine.js',
  'ai.js',
  'audio.js',
  'stages.js',
  'sprites.js',
  'hud.js',
  'main.js',
];

function transformEsmToCjs(code) {
  let out = code.replace(
    /^import\s+\{([^}]+)\}\s+from\s+['"]\.\/([^'"]+)['"];?/gm,
    (_, specs, target) => `const {${specs}} = __req('./${target}');`
  );

  const exportedNames = [];
  out = out.replace(/^export\s+function\s+([a-zA-Z0-9_$]+)\s*\(/gm, (_, name) => {
    exportedNames.push(name);
    return `function ${name}(`;
  });
  out = out.replace(/^export\s+const\s+([a-zA-Z0-9_$]+)\s*=/gm, (_, name) => {
    exportedNames.push(name);
    return `const ${name} =`;
  });

  if (exportedNames.length > 0) {
    out += '\n' + exportedNames.map((n) => `__exp.${n} = ${n};`).join('\n');
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const moduleFactories = MODULE_ORDER.map((file) => {
  const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
  const body = transformEsmToCjs(raw);
  return `'./${file}': function(__exp, __req) {\n${body}\n}`;
}).join(',\n');

const bundle = `(function() {
  const __mods = {\n${moduleFactories}\n  };
  const __cache = {};
  function __req(id) {
    if (__cache[id]) return __cache[id];
    const exp = {};
    __cache[id] = exp;
    __mods[id](exp, __req);
    return exp;
  }
  __req('./main.js');
})();\n`;

fs.writeFileSync(path.join(OUT_DIR, 'bundle.js'), bundle, 'utf8');
console.log(`Built dist/bundle.js (${bundle.length} bytes)`);
