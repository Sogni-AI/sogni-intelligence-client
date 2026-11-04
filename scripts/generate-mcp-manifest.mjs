import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const source = process.argv.slice(2).find(arg => arg !== '--check')
  ?? require.resolve('@sogni-ai/sogni-protocol/manifests/mcp-tools.json');
const manifest = JSON.parse(readFileSync(source, 'utf8'));
const target = new URL('../src/mcp/manifest.generated.ts', import.meta.url);
const output = '// Generated from sogni-protocol/manifests/mcp-tools.json.\nexport const mcpManifest = '
  + JSON.stringify(manifest) + ';\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('MCP manifest differs from its protocol source');
} else writeFileSync(target, output);
