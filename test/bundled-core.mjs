// The rules engine in src/core bundled by esbuild the way the page bundles it, run in a plain JavaScript context with
// no browser or Node globals. Tests compare its results with the modules they import directly.
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';

export function bundledCore() {
  const {outputFiles} = buildSync({
    absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    stdin: {
      contents: ['version', 'questionnaire', 'compiler']
        .map(name => `export * from './src/core/${name}.mjs';`)
        .join('\n'),
      resolveDir: fileURLToPath(new URL('..', import.meta.url))
    },
    bundle: true,
    format: 'iife',
    globalName: 'core',
    charset: 'utf8',
    write: false,
    logLevel: 'silent'
  });
  const ctx = vm.createContext({});
  vm.runInContext(outputFiles[0].text, ctx);
  return vm.runInContext('core', ctx);
}
