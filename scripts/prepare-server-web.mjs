import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const distDir = path.join(rootDir, "dist");
const targetDir = path.join(rootDir, "crates", "trace-server", "web-dist");

if (!existsSync(path.join(distDir, "index.html"))) {
  throw new Error("dist/index.html no existe. Ejecuta npm run build primero.");
}

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await cp(distDir, targetDir, { recursive: true });
await writeFile(path.join(targetDir, ".gitkeep"), "");

console.log(`Trace web assets preparados en ${targetDir}`);
