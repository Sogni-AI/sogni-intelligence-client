// Copies the canonical OpenAI tool manifests from @sogni-ai/sogni-protocol
// (the language-neutral protocol package) into both the CJS dist
// (./dist/openai-tools/) and ESM dist (./dist-esm/openai-tools/) so the
// package's `./openai-tools/*.json` subpath export resolves to the same
// artifacts every Sogni SDK reads.
//
// The set of manifests copied (generation-tools.json, composition-tools.json,
// app-tools.json) is intentionally narrower than what sogni-protocol/manifests/
// ships — `openai-tools.json` is the sogni-client surface and is not
// re-exported from intelligence-client.
// Reconcile generation output-format guidance with the canonical tool schema;
// preserve every other manifest's original bytes.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readProtocolToolManifest } from './read-protocol-tool-manifest.mjs';

const require = createRequire(import.meta.url);
const protocolPkg = require.resolve('@sogni-ai/sogni-protocol/package.json');
const protocolManifestsDir = join(dirname(protocolPkg), 'manifests');

const manifestFiles = ['generation-tools.json', 'composition-tools.json', 'app-tools.json'];

for (const outRoot of ['dist', 'dist-esm']) {
  const targetDir = join(process.cwd(), outRoot, 'openai-tools');
  await mkdir(targetDir, { recursive: true });
  for (const file of manifestFiles) {
    if (file === 'generation-tools.json') {
      const manifest = await readProtocolToolManifest(join(protocolManifestsDir, file));
      await writeFile(join(targetDir, file), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    } else {
      await copyFile(join(protocolManifestsDir, file), join(targetDir, file));
    }
  }
}
