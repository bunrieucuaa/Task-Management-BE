import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createMatchPath, loadConfig } from "tsconfig-paths";

/**
 * ESM loader to support TS path aliases (e.g. "@/...") and extensionless /
 * directory relative imports (e.g. "./auth.route", "../controllers/auth.controller",
 * "./routes") when running Node with `--loader ts-node/esm`.
 */

const projectRoot = process.cwd();
// Order matters: prefer .ts over .js so we always pick the source file in dev.
const extensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"];

let matchPath = null;
try {
  const cfg = loadConfig(projectRoot);
  if (cfg.resultType === "success") {
    matchPath = createMatchPath(cfg.absoluteBaseUrl, cfg.paths);
  }
} catch {
  // If something goes wrong, fall back to Node's default resolver.
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Try to resolve a path that may be:
 *  - an existing file (returned as-is)
 *  - an extensionless file (try common extensions)
 *  - a directory (try `<dir>/index.<ext>`)
 */
function resolveExistingFile(p) {
  if (isFile(p)) return p;

  if (!path.extname(p)) {
    for (const ext of extensions) {
      const candidate = `${p}${ext}`;
      if (isFile(candidate)) return candidate;
    }
  }

  if (isDirectory(p)) {
    for (const ext of extensions) {
      const candidate = path.join(p, `index${ext}`);
      if (isFile(candidate)) return candidate;
    }
  }

  return null;
}

function isRelativeSpecifier(specifier) {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

export async function resolve(specifier, context, defaultResolve) {
  // 1) tsconfig path aliases like "@/..."
  if (matchPath && typeof specifier === "string" && specifier.startsWith("@/")) {
    const matched = matchPath(specifier, undefined, undefined, extensions);

    if (matched) {
      const abs = path.isAbsolute(matched) ? matched : path.resolve(projectRoot, matched);
      const file = resolveExistingFile(abs);
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }

  // 2) Relative imports without an extension (or pointing to a directory).
  if (
    typeof specifier === "string" &&
    isRelativeSpecifier(specifier) &&
    context &&
    typeof context.parentURL === "string"
  ) {
    try {
      const parentPath = fileURLToPath(context.parentURL);
      const baseDir = path.dirname(parentPath);
      const abs = path.resolve(baseDir, specifier);
      const file = resolveExistingFile(abs);
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    } catch {
      // ignore and fall back to default resolver
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
