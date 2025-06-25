import mockInitializationData from "./mocks/get_initialization_data_shared.json" with {
  type: "json",
};
import mockTreeDataMain from "./mocks/get_tree_data_shared_main.json" with {
  type: "json",
};
import mockTreeDataFirst from "./mocks/get_tree_data_shared_first.json" with {
  type: "json",
};
import mockTreeDataSecond from "./mocks/get_tree_data_shared_second.json" with {
  type: "json",
};

import mockTreeDataThird from "./mocks/get_tree_data_shared_third.json" with {
  type: "json",
};

import { assertEquals } from "./test_deps.ts";

import { Document } from "../src/document.ts";
import type { Client } from "../src/client.ts";
import {
  InitializationDataSchema,
  ROOT,
  TreeDataSchema,
} from "../src/schema.ts";

const mockClient = () => ({} as unknown as Client);
const mockTree = () => TreeDataSchema.parse(mockTreeDataMain);
const mockInitialization = () =>
  InitializationDataSchema.parse(mockInitializationData);
const mockSharedTrees = () => {
  const first =
    mockTreeDataFirst.shared_projects["aaba6df4-cde1-3322-96cd-957fc76123e8"]
      .share_id;
  const second =
    mockTreeDataSecond.shared_projects["8960ce1b-e5b5-4aff-3303-50577f20e76b"]
      .share_id;
  const third =
    mockTreeDataThird.shared_projects["daba6df4-cde1-3322-96cd-957fc76123e8"]
      .share_id;
  return {
    [first]: TreeDataSchema.parse(mockTreeDataFirst),
    [second]: TreeDataSchema.parse(mockTreeDataSecond),
    [third]: TreeDataSchema.parse(mockTreeDataThird),
  };
};

const mockDocument = () =>
  new Document(
    mockClient(),
    mockTree(),
    mockInitialization(),
    mockSharedTrees(),
  );

Deno.test("WorkFlowy Shared / Read", () => {
  const document = mockDocument();

  const firstShared = document.items[1];

  assertEquals(firstShared.name, "List shared via URL");
  assertEquals(firstShared.isSharedViaUrl, true);
  assertEquals(
    firstShared.sharedUrl,
    "https://workflowy.com/s/plUzlWcMHcwbR3wZ",
  );

  assertEquals(firstShared.items.length, 2);
  assertEquals(firstShared.items[0].name, "Normal list");

  const secondShared = firstShared.items[1];

  assertEquals(secondShared.name, "List shared via email");
  assertEquals(secondShared.items.length, 2);
  assertEquals(secondShared.items[0].name, "Normal second list");

  const thirdShared = secondShared.items[1];

  assertEquals(thirdShared.name, "List shared via URL without access token");
  assertEquals(thirdShared.isSharedViaUrl, true);
  assertEquals(
    thirdShared.sharedUrl,
    "https://workflowy.com/s/NnjJ.lybhWrZBRA",
  );
});

Deno.test("WorkFlowy Shared / Write", () => {
  const document = mockDocument();

  const firstShared = document.items[1];
  const secondShared = firstShared.items[1];

  const firstNewSharedList = firstShared.createList(0);
  firstNewSharedList.setName("New first shared list");

  const secondNewSharedList = secondShared.createList(0);
  secondNewSharedList.setName("New second shared list");

  const ops = document.getPendingOperations();
  assertEquals(Object.keys(ops).length, 2);
  assertEquals(ops[ROOT], undefined);
});
