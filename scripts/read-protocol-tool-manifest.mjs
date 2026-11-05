import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

export async function readProtocolToolManifest(path) {
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  if (basename(path) === 'generation-tools.json') {
    // Alpha.59's tool schema has GIF guidance that its manifest snapshot lacks.
    // Use the canonical field description for both inline and copied manifests.
    const schemaPath = resolve(dirname(path), '../schemas/tools/generate_image.schema.json');
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    const imageTool = manifest.tools.find(tool => tool.function.name === 'generate_image');
    imageTool.function.parameters.properties.outputFormat.description = schema.properties.outputFormat.description;
  }
  return manifest;
}
