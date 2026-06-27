import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const idlPath = join(__dirname, "..", "arcadia_vault", "target", "idl", "arcadia_vault.json");
const anchorIdl = JSON.parse(readFileSync(idlPath, "utf-8"));

const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));
await codama.accept(
  renderVisitor(join(__dirname, "src", "generated"))
);

console.log("Arcadia Vault client SDK generated at src/generated/");
