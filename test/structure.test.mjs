import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {bundleApp} from '../scripts/build.mjs';

// What each module imports, from esbuild's metafile, which lists every module in the page bundle.
const {inputs} = bundleApp().metafile;
const graph = new Map(Object.entries(inputs).map(([path, input]) => [path, input.imports.map(i => i.path)]));

// Code only calls downward: each layer imports from its own layer or the layers below it.
function layer(path) {
  if (path.startsWith('src/core/')) return 0;
  if (path.startsWith('src/app/lib/')) return 1;
  if (path.startsWith('src/app/store/')) return 2;
  if (/^src\/app\/(page|worksheet|review|tool-settings|export)\//.test(path)) return 3;
  if (path === 'src/app/render.mjs' || path === 'src/app/router.mjs') return 4;
  if (path === 'src/app/main.mjs') return 5;
  return null;
}

const appFiles = dir =>
  readdirSync(new URL(`../${dir}`, import.meta.url), {withFileTypes: true}).flatMap(entry =>
    entry.isDirectory() ? appFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
  );

test('every page module belongs to a layer, and the bundle uses every file in src/app', () => {
  for (const path of graph.keys()) assert.notEqual(layer(path), null, `${path} is outside the known layers`);
  for (const path of appFiles('src/app')) assert(graph.has(path), `${path} is not imported by anything`);
});

test('page modules import only from their own layer or the layers below', () => {
  for (const [path, imports] of graph)
    for (const target of imports)
      assert(layer(target) <= layer(path), `${path} (layer ${layer(path)}) imports ${target} (layer ${layer(target)})`);
  for (const imports of graph.values()) assert(!imports.includes('src/app/main.mjs'), 'nothing imports main.mjs');
});

test('page modules have no import cycles', () => {
  const done = new Set();
  const visit = (path, stack) => {
    const at = stack.indexOf(path);
    assert.equal(at, -1, `import cycle: ${[...stack.slice(at), path].join(' -> ')}`);
    if (done.has(path)) return;
    for (const target of graph.get(path)) visit(target, [...stack, path]);
    done.add(path);
  };
  for (const path of graph.keys()) visit(path, []);
});
