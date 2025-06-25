/**
 * This script builds the NPM package from Deno source
 */
import { build, emptyDir } from "jsr:@deno/dnt@^0.42.1";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    deno: "dev",
    weakRef: "dev",
    undici: true,
    crypto: true,
  },
  compilerOptions: {
    lib: ["ES2023"],
    target: "ES2022",
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
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");

    const testMocks = [
      "export_string_all.txt",
      "export_string_partial.txt",
      "export_plaintext_all.txt",
      "export_plaintext_partial.txt",
      "export_json_all.json",
      "export_json_partial.json",
      "export_opml_all.xml",
      "export_opml_partial.xml",
    ];

    for (const mock of testMocks) {
      Deno.copyFileSync(
        `tests/mocks/${mock}`,
        `npm/script/tests/mocks/${mock}`,
      );
      Deno.copyFileSync(
        `tests/mocks/${mock}`,
        `npm/esm/tests/mocks/${mock}`,
      );
    }
  },
});
