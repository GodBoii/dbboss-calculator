// Minimal TypeScript loader so research scripts can require production src/*.ts
// files directly (same code path as the app, no build step).
const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const SRC = path.resolve(__dirname, '../../src')

const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) {
    request = path.join(SRC, request.slice(2))
  }
  return originalResolve.call(this, request, parent, ...rest)
}

require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText
  module._compile(output, filename)
}

// Allow extensionless requires of .ts files.
const originalExts = Module._extensions
if (!originalExts['.ts']) originalExts['.ts'] = require.extensions['.ts']
