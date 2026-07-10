const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolve.call(this, path.join(process.cwd(), 'src', request.slice(2)), parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = function registerTs(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    module._compile(output, filename);
  };
}

const { getRecordISODate } = require('../src/lib/backtest.ts');

const d = require('./open-sutta-records-cache.json');
const markets = Object.keys(d);

// Find the latest ISO date per market
for (const market of markets) {
  const recs = d[market];
  const dated = recs
    .map(r => ({ record: r, isoDate: getRecordISODate(r) }))
    .filter(r => r.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  const last5 = dated.slice(-5);
  console.log(`\n${market}: ${dated.length} dated records`);
  console.log(`  Latest 5 dates:`);
  for (const item of last5) {
    const r = item.record;
    console.log(`    ${item.isoDate} (${r.day}) open=${r.openSutta} close=${r.closeSutta}`);
  }
}
