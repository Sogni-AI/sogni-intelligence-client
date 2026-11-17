import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createAssetManifest, validateAssetReferences } from '../src/skills/asset_reference_management/index.js';

// Safari before 16.4 (iOS 15, iOS 16.0-16.3) cannot compile regex lookbehind. For that target esbuild
// turns a lookbehind regex literal into `new RegExp(...)`, and in November 2026 such a call in a
// module-level object threw while app.sogni.ai loaded. This test bundles every export subpath from src
// for safari15, as a consumer's Vite build does, then imports each bundle with a global RegExp that
// throws Safari's error on lookbehind syntax, however the pattern string was built.
const ROOT = join(__dirname, '..');
const NativeRegExp = RegExp;
const LOOKBEHIND = /\(\?<[=!]/;
const PROMPT = 'Use Image 1 and [Video 2], not @Image 3 or GPT Image 4.';

interface ExportEntry {
  subpath: string;
  entry: string;
  outfile: string;
}

function exportEntries(outdir: string): ExportEntry[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    exports: Record<string, { import?: string }>;
  };
  return Object.entries(pkg.exports)
    .filter(([, target]) => typeof target?.import === 'string')
    .map(([subpath, target]) => ({
      subpath,
      // "./dist-esm/contracts/index.js" is built from "src/contracts/index.ts".
      entry: join(ROOT, target.import!.replace(/^\.\/dist-esm\//, 'src/').replace(/\.js$/, '.ts')),
      outfile: join(outdir, `${subpath === '.' ? 'root' : subpath.slice(2).split('/').join('__')}.mjs`),
    }));
}

function scanWith(scanRegex: RegExp): { fallback: boolean; tokens: unknown[] } {
  return {
    fallback: Object.getPrototypeOf(scanRegex) !== NativeRegExp.prototype,
    tokens: [...PROMPT.matchAll(scanRegex)].map(match => [match.index, match[0]]),
  };
}

function withRegExpThatRejectsLookbehind<T>(run: () => Promise<T>): Promise<T> {
  const reject = (pattern: unknown): void => {
    const source = pattern instanceof NativeRegExp ? pattern.source : String(pattern ?? '');
    if (LOOKBEHIND.test(source)) throw new SyntaxError('Invalid regular expression: invalid group specifier name');
  };
  const SafariRegExp = new Proxy(NativeRegExp, {
    construct(target, args, newTarget) {
      reject(args[0]);
      return Reflect.construct(target, args, newTarget === SafariRegExp ? target : newTarget);
    },
    apply(target, thisArg, args) {
      reject(args[0]);
      return Reflect.apply(target, thisArg, args);
    },
  });
  globalThis.RegExp = SafariRegExp;
  return run().finally(() => {
    globalThis.RegExp = NativeRegExp;
  });
}

test('every export subpath loads where regex lookbehind does not compile (Safari before 16.4)', async () => {
  const outdir = mkdtempSync(join(tmpdir(), 'sogni-ic-lookbehind-'));
  try {
    const entries = exportEntries(outdir);
    assert.ok(entries.length > 0);
    for (const { entry } of entries) assert.ok(existsSync(entry), `missing source entry ${entry}`);
    for (const { entry, outfile } of entries) {
      await build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'safari15',
        logLevel: 'silent',
        // Bundled CommonJS dependencies still require Node built-ins.
        banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
      });
    }

    const failures: string[] = [];
    const scans: Record<string, unknown> = {};
    const validations: Record<string, unknown> = {};
    await withRegExpThatRejectsLookbehind(async () => {
      for (const { subpath, outfile } of entries) {
        try {
          const loaded = await import(pathToFileURL(outfile).href);
          if (typeof loaded.getModelRefFormat === 'function') {
            scans[subpath] = scanWith(loaded.getModelRefFormat('gpt-image-2').scanRegex);
          }
          if (typeof loaded.getModelRefFormatEntries === 'function') {
            const entry = loaded.getModelRefFormatEntries().find((e: { model_id: string }) => e.model_id === 'gpt-image-2');
            scans[`${subpath} entries copy`] = scanWith(entry.format.scanRegex);
          }
          if (typeof loaded.validateAssetReferences === 'function') {
            // Validation also scans with copies of the GPT Image regex (getModelRefFormatEntries).
            validations[subpath] = ['gpt-image-2', 'seedance', 'wan3'].map(model =>
              loaded.validateAssetReferences(loaded.createAssetManifest(), model, PROMPT));
          }
        } catch (error) {
          failures.push(`${subpath}: ${String(error)}`);
        }
      }
    });

    assert.deepEqual(failures, []);
    const expected = { fallback: true, tokens: [[4, 'Image 1'], [16, '[Video 2]']] };
    assert.deepEqual(scans, {
      './public-skill-runtime': expected,
      './skills/asset_reference_management': expected,
      './skills/asset_reference_management entries copy': expected,
    });
    // The same calls on this engine, where the original pattern compiles.
    assert.deepEqual(validations, {
      './skills/asset_reference_management': ['gpt-image-2', 'seedance', 'wan3'].map(model =>
        validateAssetReferences(createAssetManifest(), model, PROMPT)),
    });
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
});
