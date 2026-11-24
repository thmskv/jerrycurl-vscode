import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect } from 'bun:test';
import { tokenize, scopeForFile, root } from './tokenizer.mjs';

// [source, token text, expected scope (substring of any scope on the token; null = unscoped)]
const T = 'keyword.control.razor.transition.cssql';
const D = 'keyword.control.razor.directive.cssql';

const cases = [
  // SQL
  ['SELECT * FROM Foo', 'SELECT', 'keyword.other.sql'],
  ['select * from Foo', 'from', 'keyword.other.sql'],
  ['SELECT Selection FROM t', 'Selection', null],
  ["WHERE x = 'it''s @v'", "''", 'constant.character.escape.sql'],
  ["WHERE x = 'a @R.Col() b'", 'Col', 'entity.name.function.cs'],
  ["WHERE x = 'a @R.Col() b'", "'", 'string.quoted.single.sql'],
  ['-- comment @R.Tbl()', 'Tbl', 'entity.name.function.cs'],
  ['/* block */ SELECT', 'SELECT', 'keyword.other.sql'],
  ['LIMIT 10', '10', 'constant.numeric.sql'],

  // Escapes
  ['SELECT @@IDENTITY', '@@', 'constant.character.escape.razor.cssql'],
  ['SELECT @@IDENTITY', 'IDENTITY', 'keyword.other.sql'],
  ['x {{ y }}', '{{', 'constant.character.escape.razor.cssql'],

  // Comments
  ['@* a comment SELECT *@ SELECT', 'SELECT', 'keyword.other.sql'],
  ['@* a comment SELECT *@ SELECT', ' a comment SELECT ', 'comment.block.razor.cssql'],

  // Directives
  ['@result Jerrycurl.Views.DatabaseView', '@', T],
  ['@result Jerrycurl.Views.DatabaseView', 'result', D],
  ['@result Jerrycurl.Views.DatabaseView', 'DatabaseView', 'entity.name.type.cs'],
  ['@model List<Movie>', 'model', D],
  ['@model List<Movie>', 'Movie', 'entity.name.type.cs'],
  ['@import Jerrycurl.Mvc.Sql.Oracle', 'import', D],
  ['@import Jerrycurl.Mvc.Sql.Oracle', 'Oracle', 'entity.name.type.namespace.cs'],
  ['@project MovieCast c', 'project', D],
  ['@project MovieCast c', 'MovieCast', 'entity.name.type.cs'],
  ['@project MovieCast c', 'c', 'entity.name.variable.property.cs'],
  ['@inject IFoo<Bar> foo', 'Bar', 'entity.name.type.cs'],
  ['@modelx', 'modelx', 'variable.other.object.cs'],
  ['@query\nSELECT 1', 'query', D],
  ['@query\nSELECT 1', 'SELECT', 'keyword.other.sql'],
  ['@command\nDELETE FROM t', 'command', D],
  ['@command\nDELETE FROM t', 'DELETE', 'keyword.other.sql'],
  ['@query Foo', 'Foo', 'invalid.illegal.argument.cssql'],
  ['@queryable', 'queryable', 'variable.other.object.cs'],
  ['@visibility internal', 'visibility', D],
  ['@visibility internal', 'internal', 'storage.modifier.internal.cs'],
  ['@visibility private', 'private', 'invalid.illegal.argument.cssql'],
  ['@input int Id, string Title = "Default title"\nSELECT', 'input', D],
  ['@input int Id, string Title = "Default title"\nSELECT', 'int', 'keyword.type.int.cs'],
  ['@input int Id, string Title = "Default title"\nSELECT', 'Id', 'entity.name.variable.parameter.cs'],
  ['@input int Id, string Title = "Default title"\nSELECT', 'Title', 'entity.name.variable.parameter.cs'],
  ['@input int Id, string Title = "Default title"\nSELECT', '=', 'keyword.operator.assignment.cs'],
  ['@input int Id, string Title = "Default title"\nSELECT', 'Default title', 'string.quoted.double.cs'],
  ['@input int Id, string Title = "Default title"\nSELECT', 'SELECT', 'keyword.other.sql'],
  ['@output List<Movie> Movies, int Count = 0\nSELECT', 'output', D],
  ['@output List<Movie> Movies, int Count = 0\nSELECT', 'Movie', 'entity.name.type.cs'],
  ['@output List<Movie> Movies, int Count = 0\nSELECT', 'Count', 'entity.name.variable.parameter.cs'],
  ['@output List<Movie> Movies, int Count = 0\nSELECT', 'SELECT', 'keyword.other.sql'],

  // Statement / expression blocks
  ['@{\n    var c = this.R.Open(m => m.Cast);\n}\nSELECT', 'var', 'meta.embedded.block.cs'],
  ['@{\n    var c = this.R.Open(m => m.Cast);\n}\nSELECT', 'Open', 'entity.name.function.cs'],
  ['@{\n    var c = this.R.Open(m => m.Cast);\n}\nSELECT', 'SELECT', 'keyword.other.sql'],
  ['@{ if (x) { y(); } } SELECT', 'SELECT', 'keyword.other.sql'],
  ['@(1 + (2 * 3)) AS x', 'AS', 'keyword.other.sql'],
  ['@(1 + (2 * 3)) AS x', '3', 'constant.numeric.decimal.cs'],

  // Implicit expressions
  ['FROM @R.Tbl() AS t', 'R', 'variable.other.object.cs'],
  ['FROM @R.Tbl() AS t', 'Tbl', 'entity.name.function.cs'],
  ['FROM @R.Tbl() AS t', 'AS', 'keyword.other.sql'],
  ['@R.Map(m => m.Details), x', 'Details', 'meta.embedded.line.cs'],
  ['@R.Map(m => m.Details), x', ',', 'punctuation.separator.comma.sql'],
  ['@v.In().ColNames().Eq().Pars();', 'Pars', 'entity.name.function.cs'],
  ['@v.In().ColNames().Eq().Pars();', ';', 'punctuation.terminator.statement.sql'],
  ['@this.M.Vals()', 'this', 'variable.language.this.cs'],
  ['@P.Prop[0].Col() = 1', 'Col', 'entity.name.function.cs'],
  ['@R.Map<Foo>() AS x', 'Foo', 'entity.name.type.cs'],
  ['@R.Map<Foo>() AS x', 'AS', 'keyword.other.sql'],
  ['WHERE @x.Id = 1', 'Id', 'variable.other.object.property.cs'],
  ['WHERE @x. AND', 'AND', 'keyword.other.sql'],

  // Keyword blocks
  ['@foreach (var v in this.M.Vals())\n{\n    INSERT INTO @v.TblName()\n}', 'foreach', 'keyword.control.loop.foreach.cs'],
  ['@foreach (var v in this.M.Vals())\n{\n    INSERT INTO @v.TblName()\n}', 'in', 'keyword.control.loop.in.cs'],
  ['@foreach (var v in this.M.Vals())\n{\n    INSERT INTO @v.TblName()\n}', '{', T],
  ['@foreach (var v in this.M.Vals())\n{\n    INSERT INTO @v.TblName()\n}', 'INSERT', 'keyword.other.sql'],
  ['@foreach (var v in this.M.Vals())\n{\n    INSERT INTO @v.TblName()\n}', '}', T],
  ['@for (int i = 0; i < 3; i++) { SELECT }', 'int', 'keyword.type.int.cs'],
  ['@for (int i = 0; i < 3; i++) { SELECT }', 'SELECT', 'keyword.other.sql'],
  ['@if (v.Id() != null) { WHERE }', 'if', 'keyword.control.conditional.if.cs'],
  ['@if (v.Id() != null) { WHERE }', 'null', 'constant.language.null.cs'],
  ['@if (v.Id() != null) { WHERE }', 'WHERE', 'keyword.other.sql'],
  ['} @else if (x) { AND }', 'else', 'keyword.control.conditional.else.cs'],
  ['} @else if (x) { AND }', 'if', 'keyword.control.conditional.if.cs'],
  ['} @else { AND }', 'else', 'keyword.control.conditional.else.cs'],
  ['} @else { AND }', 'AND', 'keyword.other.sql'],
  ['@while (x) { SELECT }', 'while', 'keyword.control.loop.while.cs'],
];

const ormCases = [
  ['{ "vendor": "sqlserver" }', 'vendor', 'support.type.property-name.json'],
  ['{ "vendor": "sqlserver" }', 'sqlserver', 'string.quoted.double.json'],
];

function scopesOf(src, text, grammar) {
  const tokens = tokenize(src, grammar).filter((t) => t.text === text || t.text.trim() === text);
  expect(tokens.length).toBeGreaterThan(0);
  return tokens;
}

const check = (grammar) => ([src, text, scope]) => {
  const tokens = scopesOf(src, text, grammar);
  const ok = tokens.some((t) => (scope === null ? t.scopes.length === 0 : t.scopes.some((s) => s.includes(scope))));
  if (!ok) expect(tokens.map((t) => t.scopes.join(' '))).toContain(scope ?? '<no scope>');
};

describe('cssql', () => {
  test.each(cases)('%j: %j is %s', (...c) => check('source.cssql')(c));
});

describe('orm', () => {
  test.each(ormCases)('%j: %j is %s', (...c) => check('source.json.orm')(c));
});

// Every sample file in the framework repos must tokenize and end in the root state.
const samples = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') walk(p);
    else if (/\.(cssql|orm)$/.test(e.name)) samples.push(p);
  }
};
['libs/jerrycurl', 'test/fixtures'].forEach((d) => walk(path.join(root, d)));

describe('sample files', () => {
  test.each(samples.map((f) => path.relative(root, f)))('%s ends in the root state', (rel) => {
    const file = path.join(root, rel);
    const { endState } = tokenize(fs.readFileSync(file, 'utf8'), scopeForFile(file));
    expect(endState.depth).toBe(1);
  });
});
