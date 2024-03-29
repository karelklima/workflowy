import mockInitializationData from "./mocks/get_initialization_data.json" assert {
  type: "json",
};
import mockTreeData from "./mocks/get_tree_data.json" assert { type: "json" };

import { assertEquals, assertObjectMatch } from "./test_deps.ts";

import { Document } from "../src/document.ts";
import { type Client } from "../src/client.ts";
import { InitializationDataSchema, TreeDataSchema } from "../src/schema.ts";

const mockClient = () => ({} as unknown as Client);
const mockTree = () => TreeDataSchema.parse(mockTreeData);
const mockInitialization = () =>
  InitializationDataSchema.parse(mockInitializationData);

const mockDocument = () =>
  new Document(mockClient(), mockTree().items, mockInitialization());

Deno.test("WorkFlowy Document / Load tree", () => {
  const document = mockDocument();

  const home = document.root;
  assertEquals(home.id, "None");
  assertEquals(home.items.length, 5);

  assertEquals(home.items[0].name, "List with sublist");
  assertEquals(home.items[0].items[0].name, "One");
  assertEquals(home.items[0].items[0].name, "One");

  assertEquals(home.items[1].name, "List with description");
  assertEquals(home.items[1].note, "Two Description");

  assertEquals(home.items[2].name, "List completed");
  assertEquals(home.items[2].isCompleted, true);

  assertEquals(home.items[3].name, "List mirrored");
  assertEquals(home.items[3].isMirror, false);
  assertEquals(home.items[3].items[0].name, "Sublist in mirror");

  assertEquals(home.items[4].name, "List mirrored");
  assertEquals(home.items[4].isMirror, true);
  assertEquals(home.items[4].items[0].name, "Sublist in mirror");
});

Deno.test("WorkFlowy Document / To string", () => {
  const document = mockDocument();

  const text = document.root.toString(true);
  const expected = `- List with sublist
    - One
    - One
- List with description
  Two Description
- List completed
- List mirrored
    - Sublist in mirror
- List mirrored
    - Sublist in mirror`;

  assertEquals(text, expected);
});

Deno.test("WorkFlowy Document / To JSON", () => {
  const document = mockDocument();

  const json = document.root.toJson();

  const expected = {
    id: "None",
    name: "Home",
    items: [
      {
        name: "List with sublist",
        items: [
          { name: "One" },
          { name: "One" },
        ],
      },
      {
        name: "List with description",
        note: "Two Description",
      },
      {
        name: "List completed",
        isCompleted: true,
      },
      {
        name: "List mirrored",
        items: [{
          name: "Sublist in mirror",
        }],
      },
      {
        name: "List mirrored",
        items: [{
          name: "Sublist in mirror",
        }],
      },
    ],
  };

  assertObjectMatch(json, expected);
});

Deno.test("WorkFlowy Document / To OPML", () => {
  const document = mockDocument();

  const opml = document.root.toOpml();

  const expected = '<?xml version="1.0"?><opml version="2.0"><body><outline text="Home"><outline text="List with sublist"><outline text="One"></outline><outline text="One"></outline></outline><outline text="List with description" _note="Two Description"></outline><outline _complete="true" text="List completed"></outline><outline text="List mirrored"><outline text="Sublist in mirror"></outline></outline><outline text="List mirrored"><outline text="Sublist in mirror"></outline></outline></outline></body></opml>';

  assertEquals(opml, expected);
});

Deno.test("WorkFlowy Document / Create list", () => {
  const document = mockDocument();

  const list = document.root.createList(1);

  assertEquals(list.parent.id, "None");
  assertEquals(list.priority, 1);
  assertEquals(document.root.itemIds.length, 6);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "create",
    data: {
      projectid: list.id,
      parentid: "None",
      priority: 1,
    },
  });
});

Deno.test("WorkFlowy Document / Edit list", () => {
  const document = mockDocument();

  const list = document.root.items[1];

  list.setName("New name").setNote("New description");

  assertEquals(document.root.items[1].name, "New name");
  assertEquals(document.root.items[1].note, "New description");

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 2);
  assertObjectMatch(ops[0], {
    type: "edit",
    data: {
      projectid: list.id,
      name: "New name",
    },
    undo_data: {
      previous_name: "List with description",
    },
  });
  assertObjectMatch(ops[1], {
    type: "edit",
    data: {
      projectid: list.id,
      description: "New description",
    },
    undo_data: {
      previous_description: "Two Description",
    },
  });
});

Deno.test("WorkFlowy Document / Edit mirror", () => {
  const document = mockDocument();

  const list = document.root.items[4];

  list.setName("New name");

  assertEquals(document.root.items[4].name, "New name");
  assertEquals(document.root.items[3].name, "New name");

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "edit",
    data: {
      projectid: list.originalId,
      name: "New name",
    },
    undo_data: {
      previous_name: "List mirrored",
    },
  });
});

Deno.test("WorkFlowy Document / Move list", () => {
  const document = mockDocument();

  const originalParent = document.root.items[0];
  const list = originalParent.items[1];
  const target = document.root.items[3];

  assertEquals(originalParent.items.length, 2);
  assertEquals(target.items.length, 1);

  list.move(target, 0);

  assertEquals(originalParent.items.length, 1);
  assertEquals(list.parent.id, target.id);
  assertEquals(target.itemIds[0], list.id);
  assertEquals(target.items.length, 2);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "move",
    data: {
      projectid: list.id,
      parentid: target.id,
      priority: 0,
    },
    undo_data: {
      previous_parentid: originalParent.id,
      previous_priority: 1,
    },
  });
});

Deno.test("WorkFlowy Document / Delete list", () => {
  const document = mockDocument();

  const list = document.root.items[1];

  assertEquals(document.root.items.length, 5);
  assertEquals(document.root.items[1].name, "List with description");

  list.delete();

  assertEquals(document.root.items.length, 4);
  assertEquals(document.root.items[1].name, "List completed");

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "delete",
    data: {
      projectid: list.id,
    },
    undo_data: {},
  });
});
