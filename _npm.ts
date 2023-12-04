/**
 * This script builds the NPM package from Deno source
 */
import { build, emptyDir } from "https://deno.land/x/dnt@0.39.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
    undici: true,
    crypto: true,
  },
  package: {
    // package.json properties
    name: "workflowy",
    version: Deno.args[0],
    description: "WorkFlowy client for reading and updating of lists",
    author: "Karel Klima <karelklima@gmail.com> (https://karelklima.com)",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/karelklima/workflowy.git",
    },
    bugs: {
      url: "https://github.com/karelklima/workflowy/issues",
    }
  },
  mappings: {
    "https://deno.land/x/zod@v3.22.4/mod.ts": {
      name: "zod",
      version: "^3.22.4",
    }
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
