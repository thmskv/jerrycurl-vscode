// Loads the extension's grammars (plus the C#/JSON grammars VS Code ships) into vscode-textmate.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

const require = createRequire(import.meta.url);
export const root = path.resolve(import.meta.dir, '..');

const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
await oniguruma.loadWASM(wasm.buffer);

const grammarFiles = {
  'source.cssql': path.join(root, 'syntaxes/cssql.tmLanguage.json'),
  'source.json.orm': path.join(root, 'syntaxes/orm.tmLanguage.json'),
  'source.cs': require.resolve('tm-grammars/grammars/csharp.json'),
  'source.json': require.resolve('tm-grammars/grammars/json.json'),
};

const registry = new vsctm.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (s) => new oniguruma.OnigScanner(s),
    createOnigString: (s) => new oniguruma.OnigString(s),
  }),
  loadGrammar: async (scope) => {
    const file = grammarFiles[scope];
    return file ? vsctm.parseRawGrammar(fs.readFileSync(file, 'utf8'), file) : null;
  },
});

const grammars = {
  'source.cssql': await registry.loadGrammar('source.cssql'),
  'source.json.orm': await registry.loadGrammar('source.json.orm'),
};

export const scopeForFile = (file) => (file.endsWith('.orm') ? 'source.json.orm' : 'source.cssql');

export function tokenize(text, scope = 'source.cssql') {
  const grammar = grammars[scope];
  const out = [];
  let state = vsctm.INITIAL;
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((line, lineNo) => {
    const r = grammar.tokenizeLine(line, state);
    for (const t of r.tokens) {
      out.push({ line: lineNo, text: line.substring(t.startIndex, t.endIndex), scopes: t.scopes.slice(1) });
    }
    state = r.ruleStack;
  });
  out.endState = state;
  return out;
}
