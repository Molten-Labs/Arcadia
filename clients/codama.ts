import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const idlPath = join(__dirname, "..", "idl", "kiln_program.json");
const anchorIdl = JSON.parse(readFileSync(idlPath, "utf-8"));

const codama = createFromRoot(rootNodeFromAnchor(anchorIdl));
await codama.accept(
  renderVisitor(join(__dirname, "src", "generated"))
);

console.log("Client SDK generated at src/generated/");