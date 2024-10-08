import mockInitializationData from "./mocks/get_initialization_data.json" with {
  type: "json",
};
import mockTreeData from "./mocks/get_tree_data.json" with { type: "json" };

import { assertEquals, assertObjectMatch } from "./test_deps.ts";

import { Document } from "../src/document.ts";
import type { Client } from "../src/client.ts";
import { InitializationDataSchema, TreeDataSchema } from "../src/schema.ts";
import { PermissionLevel } from "../src/share.ts";

const mockClient = () => ({} as unknown as Client);
const mockTree = () => TreeDataSchema.parse(mockTreeData);
const mockInitialization = () =>
  InitializationDataSchema.parse(mockInitializationData);

const mockDocument = () =>
  new Document(mockClient(), mockTree(), mockInitialization());

Deno.test("WorkFlowy Document / Load tree", () => {
  const document = mockDocument();

  const home = document.root;
  assertEquals(home.id, "None");
  assertEquals(home.items.length, 7);

  assertEquals(home.items[0].name, "List with sublist");
  assertEquals(home.items[0].items[0].name, "One");
  assertEquals(home.items[0].items[0].name, "One");

  assertEquals(home.items[1].name, "List with description");
  assertEquals(home.items[1].note, "Two Description");

  assertEquals(home.items[2].name, "List completed");
  assertEquals(home.items[2].isCompleted, true);
  assertEquals(home.items[2].isSharedViaUrl, false);
  assertEquals(home.items[2].isSharedViaEmail, false);
  assertEquals(home.items[2].sharedUrl, undefined);
  assertEquals(home.items[2].sharedUrlPermissionLevel, PermissionLevel.None);

  assertEquals(home.items[3].name, "List mirrored");
  assertEquals(home.items[3].isMirror, false);
  assertEquals(home.items[3].items[0].name, "Sublist in mirror");

  assertEquals(home.items[4].name, "List mirrored");
  assertEquals(home.items[4].isMirror, true);
  assertEquals(home.items[4].items[0].name, "Sublist in mirror");

  assertEquals(home.items[5].name, "List shared via email");
  assertEquals(home.items[5].isSharedViaEmail, true);
  assertEquals(home.items[5].isSharedViaUrl, false);
  assertEquals(home.items[5].sharedUrl, undefined);
  assertEquals(home.items[5].sharedUrlPermissionLevel, PermissionLevel.None);
  assertEquals(home.items[5].isCompleted, false);

  assertEquals(home.items[6].name, "List shared via URL");
  assertEquals(home.items[6].isSharedViaEmail, false);
  assertEquals(home.items[6].isSharedViaUrl, true);
  assertEquals(
    home.items[6].sharedUrl,
    "https://workflowy.com/s/plUzlWcMHcwbR3wZ",
  );
  assertEquals(home.items[6].sharedUrlPermissionLevel, PermissionLevel.View);
  assertEquals(home.items[6].isCompleted, false);
});

Deno.test("WorkFlowy Document / Create list", () => {
  const document = mockDocument();

  const list = document.root.createList(1);

  assertEquals(list.parent.id, "None");
  assertEquals(list.priority, 1);
  assertEquals(document.root.itemIds.length, 8);

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

  assertEquals(document.root.items.length, 7);
  assertEquals(document.root.items[1].name, "List with description");

  list.delete();

  assertEquals(document.root.items.length, 6);
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

Deno.test("WorkFlowy Document / Sharing / Share unshared list via URL", () => {
  const document = mockDocument();

  const list = document.root.items[0];

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, false);
  assertEquals(list.sharedUrl, undefined);
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.None);

  const url = list.shareViaUrl(PermissionLevel.EditAndComment);

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, true);
  assertEquals(list.sharedUrl, url);
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.EditAndComment);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 2);
  assertObjectMatch(ops[0], {
    type: "share",
    data: {
      projectid: list.id,
    },
    undo_data: {},
  });
  assertObjectMatch(ops[1], {
    type: "add_shared_url",
    data: {
      projectid: list.id,
      access_token: list.sharedUrl?.split("/").pop(),
      permission_level: PermissionLevel.EditAndComment,
    },
    undo_data: {},
  });
});

Deno.test("WorkFlowy Document / Sharing / Share shared list via URL", () => {
  const document = mockDocument();

  const list = document.root.items[6];

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, true);
  assertEquals(list.sharedUrl, "https://workflowy.com/s/plUzlWcMHcwbR3wZ");
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.View);

  list.shareViaUrl(PermissionLevel.EditAndComment);

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, true);
  assertEquals(list.sharedUrl, "https://workflowy.com/s/plUzlWcMHcwbR3wZ");
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.EditAndComment);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "add_shared_url",
    data: {
      projectid: list.id,
      access_token: list.sharedUrl?.split("/").pop(),
      permission_level: PermissionLevel.EditAndComment,
    },
    undo_data: {},
  });
});

Deno.test("WorkFlowy Document / Sharing / Unshare URL of unshared list", () => {
  const document = mockDocument();

  const list = document.root.items[0];

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, false);
  assertEquals(list.sharedUrl, undefined);
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.None);

  list.unshareViaUrl();

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, false);
  assertEquals(list.sharedUrl, undefined);
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.None);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 0);
});

Deno.test("WorkFlowy Document / Sharing / Unshare URL of list shared via URL", () => {
  const document = mockDocument();

  const list = document.root.items[6];

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, true);
  assertEquals(list.sharedUrl, "https://workflowy.com/s/plUzlWcMHcwbR3wZ");
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.View);

  list.unshareViaUrl();

  assertEquals(list.isSharedViaEmail, false);
  assertEquals(list.isSharedViaUrl, false);
  assertEquals(list.sharedUrl, undefined);
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.None);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 2);
  assertObjectMatch(ops[0], {
    type: "remove_shared_url",
    data: {
      projectid: list.id,
    },
    undo_data: {},
  });
  assertObjectMatch(ops[1], {
    type: "unshare",
    data: {
      projectid: list.id,
    },
    undo_data: {},
  });
});

Deno.test("WorkFlowy Document / Sharing / Unshare URL of list shared via email and URL", () => {
  const document = mockDocument();

  const list = document.root.items[5];

  assertEquals(list.isSharedViaEmail, true);
  assertEquals(list.isSharedViaUrl, false);
  assertEquals(list.sharedUrl, undefined);
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.None);

  const url = list.shareViaUrl(PermissionLevel.FullAccess);
  list.unshareViaUrl();

  assertEquals(list.isSharedViaEmail, true);
  assertEquals(list.isSharedViaUrl, false);
  assertEquals(list.sharedUrl, undefined);
  assertEquals(list.sharedUrlPermissionLevel, PermissionLevel.None);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 2);
  assertObjectMatch(ops[0], {
    type: "add_shared_url",
    data: {
      projectid: list.id,
      access_token: url.split("/").pop(),
      permission_level: PermissionLevel.FullAccess,
    },
    undo_data: {},
  });
  assertObjectMatch(ops[1], {
    type: "remove_shared_url",
    data: {
      projectid: list.id,
    },
    undo_data: {},
  });
});
