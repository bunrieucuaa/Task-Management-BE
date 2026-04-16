import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createMatchPath, loadConfig } from "tsconfig-paths";

/**
 * ESM loader to support TS path aliases (e.g. "@/...")
 * when running Node with `--loader ts-node/esm`.
 */

const projectRoot = process.cwd();
const extensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"];

let matchPath = null;
try {
  const cfg = loadConfig(projectRoot);
  if (cfg.resultType === "success") {
    matchPath = createMatchPath(cfg.absoluteBaseUrl, cfg.paths);
  }
} catch {
  // If something goes wrong, we fall back to Node's default resolver.
}

function resolveExistingFile(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  // If it's extensionless, try common extensions.
  if (!path.extname(p)) {
    for (const ext of extensions) {
      const candidate = `${p}${ext}`;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (matchPath && typeof specifier === "string" && specifier.startsWith("@/")) {
    const matched = matchPath(
      specifier,
      undefined,
      undefined,
      extensions,
    );

    if (matched) {
      const abs = path.isAbsolute(matched) ? matched : path.resolve(projectRoot, matched);
      const file = resolveExistingFile(abs);
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}

