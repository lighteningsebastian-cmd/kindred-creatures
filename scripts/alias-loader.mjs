/**
 * Lets a plain `node scripts/*.ts` import modules out of src/.
 *
 * THREE THINGS NODE WILL NOT DO ON ITS OWN, all of which src/ relies on because
 * Next and Vitest both do them: resolve the "@/" alias from tsconfig.json,
 * resolve a specifier with no file extension, and prefer a package's "module"
 * entry over its CJS "main". Without this hook, importing lib/print/plate.ts
 * from a script dies on its first line.
 *
 * No dependency, which is the point. See the headers of the other scripts.
 *
 * USAGE
 *
 *   node --import ./scripts/alias-loader.mjs scripts/build-catalogue-plate.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire, register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const require = createRequire(import.meta.url);

/** ts before tsx before a directory index, matching how bundlers guess. */
function firstThatExists(base) {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) return candidate;
  }
  return null;
}

/**
 * The ESM entry of a package that only advertises one to bundlers.
 *
 * opentype.js is the case that forces this. It ships "main": a UMD bundle whose
 * named exports Node's CJS lexer cannot see, and "module": real ESM that
 * exports `parse` properly. Node's ESM resolver ignores "module" entirely, so
 * `import { parse } from "opentype.js"` throws "does not provide an export
 * named 'parse'" here while working perfectly in Next and in Vitest, which both
 * read that field. The font loader is not wrong; the resolver is poorer.
 *
 * Deliberately narrow. A package that declares "exports" has said exactly what
 * it wants resolved and is left alone, and a subpath import is not what
 * "module" names, so both fall straight through to Node.
 */
function bundlerEntry(specifier) {
  if (/^[./]/.test(specifier) || specifier.startsWith("node:")) return null;
  const scoped = specifier.startsWith("@");
  const segments = specifier.split("/").length;
  if (segments > (scoped ? 2 : 1)) return null;

  let manifestPath;
  try {
    manifestPath = require.resolve(`${specifier}/package.json`);
  } catch {
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.exports || !manifest.module) return null;

  const entry = join(dirname(manifestPath), manifest.module);
  return existsSync(entry) ? entry : null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const found = firstThatExists(join(SRC, specifier.slice(2)));
    if (found) return next(pathToFileURL(found).href, context);
  }
  // A relative specifier with no extension, e.g. "./text-to-path".
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const from = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : SRC;
    const found = firstThatExists(resolvePath(from, specifier));
    if (found) return next(pathToFileURL(found).href, context);
  }
  const esm = bundlerEntry(specifier);
  if (esm) return next(pathToFileURL(esm).href, context);
  return next(specifier, context);
}

// Registering from inside the same file it hooks means one --import flag and
// one file, rather than a loader plus a registrar.
if (!process.env.ALIAS_LOADER_REGISTERED) {
  process.env.ALIAS_LOADER_REGISTERED = "1";
  register(import.meta.url, import.meta.url);
}
