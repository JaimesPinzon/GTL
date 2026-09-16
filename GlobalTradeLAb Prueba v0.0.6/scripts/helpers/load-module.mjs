import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { transformSync } from '@babel/core';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));

// Load application modules with their real relative imports and explicit service mocks.
export function createModuleLoader(replacements = {}, globals = {}) {
  const cache = new Map();
  function load(path) {
    let filename = resolve(root, path);
    if (!existsSync(filename) || statSync(filename).isDirectory()) filename += existsSync(`${filename}.js`) ? '.js' : '.jsx';
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const { code } = transformSync(readFileSync(filename, 'utf8'), {
      filename, babelrc: false, configFile: false,
      plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
    });
    runInNewContext(code, {
      module, exports: module.exports, console, URL, URLSearchParams, setTimeout, clearTimeout,
      ...globals,
      require: (name) => {
        if (name in replacements) return replacements[name];
        if (name.startsWith('@/')) return load(`src/${name.slice(2)}`);
        if (name.startsWith('.')) return load(resolve(dirname(filename), name));
        return require(name);
      },
    }, { filename });
    cache.set(filename, module.exports);
    return module.exports;
  }
  return load;
}
