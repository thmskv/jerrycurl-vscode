// Prints every token and its scopes:  bun run tokens path/to/file.cssql
import fs from 'node:fs';
import { tokenize, scopeForFile } from './tokenizer.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: bun run tokens <file.cssql|file.orm>');
  process.exit(1);
}
for (const t of tokenize(fs.readFileSync(file, 'utf8'), scopeForFile(file))) {
  if (t.text.trim()) console.log(`${String(t.line + 1).padStart(3)}  ${JSON.stringify(t.text).padEnd(32)} ${t.scopes.join(' ')}`);
}
