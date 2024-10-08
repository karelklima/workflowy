import mockInitializationData from "./mocks/get_initialization_data.json" with {
  type: "json",
};
import mockTreeData from "./mocks/get_tree_data_extended.json" with {
  type: "json",
};

import { assertEquals, assertObjectMatch } from "./test_deps.ts";

import { Document } from "../src/document.ts";
import type { Client } from "../src/client.ts";
import { InitializationDataSchema, TreeDataSchema } from "../src/schema.ts";

const mockClient = () => ({} as unknown as Client);
const mockTree = () => TreeDataSchema.parse(mockTreeData);
const mockInitialization = () =>
  InitializationDataSchema.parse(mockInitializationData);

const mockDocument = () =>
  new Document(mockClient(), mockTree(), mockInitialization());

const readFile = (fileName: string) =>
  Deno.readTextFileSync(new URL(import.meta.resolve(fileName)));

Deno.test("WorkFlowy Export / To string all", () => {
  const document = mockDocument();

  const text = document.root.toString();
  const expected = readFile("./mocks/export_string_all.txt").replaceAll(
    "\r\n",
    "\n",
  ).trimEnd();

  assertEquals(text, expected);
});

Deno.test("WorkFlowy Export / To string partial", () => {
  const document = mockDocument();

  const text = document.root.items[0].toString();
  const expected = readFile("./mocks/export_string_partial.txt").replaceAll(
    "\r\n",
    "\n",
  ).trimEnd();

  assertEquals(text, expected);
});

Deno.test("WorkFlowy Export / To Plain Text all", () => {
  const document = mockDocument();

  const text = document.root.toPlainText();
  const expected = readFile("./mocks/export_plaintext_all.txt").replaceAll(
    "\r\n",
    "\n",
  ).trimEnd();

  assertEquals(text, expected);
});

Deno.test("WorkFlowy Export / To Plain Text partial", () => {
  const document = mockDocument();

  const text = document.root.items[0].toPlainText();
  const expected = readFile("./mocks/export_plaintext_partial.txt").replaceAll(
    "\r\n",
    "\n",
  ).trimEnd();

  assertEquals(text, expected);
});

Deno.test("WorkFlowy Export / To JSON all", () => {
  const document = mockDocument();

  const json = document.root.toJson();
  const expected = JSON.parse(readFile("./mocks/export_json_all.json"));

  assertObjectMatch(json, expected);
});

Deno.test("WorkFlowy Export / To JSON partial", () => {
  const document = mockDocument();

  const json = document.root.items[0].toJson();
  const expected = JSON.parse(readFile("./mocks/export_json_partial.json"));

  assertObjectMatch(json, expected);
});

Deno.test("WorkFlowy Export / To OPML all", () => {
  const document = mockDocument();

  const opml = document.root.toOpml();
  const expected = readFile("./mocks/export_opml_all.xml")
    .replace(/>\s+</g, "><")
    .trimEnd();

  assertEquals(opml, expected);
});

Deno.test("WorkFlowy Export / To OPML partial", () => {
  const document = mockDocument();

  const opml = document.root.items[0].toOpml();
  const expected = readFile("./mocks/export_opml_partial.xml")
    .replace(/>\s+</g, "><")
    .trimEnd();

  assertEquals(opml, expected);
});
