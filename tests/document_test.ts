import mockInitializationData from "./mocks/get_initialization_data.json" with {
  type: "json",
};
import mockTreeData from "./mocks/get_tree_data.json" with { type: "json" };

import { assertEquals, assertObjectMatch } from "./test_deps.ts";

import { Document } from "../src/document.ts";
import type { Client } from "../src/client.ts";
import {
  InitializationDataSchema,
  ROOT,
  TreeDataSchema,
} from "../src/schema.ts";
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
  assertEquals(home.id, ROOT);
  assertEquals(home.items.length, 8);

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

  assertEquals(home.items[7].name, "List with file attachment");
  assertEquals(home.items[7].hasFile, true);
  assertEquals(home.items[7].file?.fileName, "screenshot.png");
  assertEquals(home.items[7].file?.fileType, "image/png");
  assertEquals(home.items[7].file?.imageOriginalWidth, 1920);
  assertEquals(home.items[7].file?.imageOriginalHeight, 1080);
});

Deno.test("WorkFlowy Document / Get list by short ID", () => {
  const document = mockDocument();

  const list = document.getList("7dd448dc49ac");

  assertEquals(list.id, "12f62eec-754c-b677-b683-7dd448dc49ac");
});

Deno.test("WorkFlowy Document / Create list", () => {
  const document = mockDocument();

  const list = document.root.createList(1);

  assertEquals(list.parent.id, ROOT);
  assertEquals(list.priority, 1);
  assertEquals(document.root.itemIds.length, 9);

  const ops = document.getPendingOperations()[ROOT];
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

  const ops = document.getPendingOperations()[ROOT];
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

  const ops = document.getPendingOperations()[ROOT];
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

Deno.test("WorkFlowy Document / Complete list", () => {
  const document = mockDocument();

  const list = document.root.items[1];

  list.setCompleted().setCompleted();

  assertEquals(document.root.items[1].isCompleted, true);

  const ops = document.getPendingOperations()[ROOT];
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "complete",
    data: {
      projectid: list.id,
    },
    undo_data: {
      previous_completed: false,
    },
  });
});

Deno.test("WorkFlowy Document / Uncomplete list", () => {
  const document = mockDocument();

  const list = document.root.items[2];

  list.setCompleted(false).setCompleted(false);

  assertEquals(document.root.items[2].isCompleted, false);

  const ops = document.getPendingOperations()[ROOT];
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "uncomplete",
    data: {
      projectid: list.id,
    },
    undo_data: {
      previous_completed: 199,
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

  const ops = document.getPendingOperations()[ROOT];
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

  assertEquals(document.root.items.length, 8);
  assertEquals(document.root.items[1].name, "List with description");

  list.delete();

  assertEquals(document.root.items.length, 7);
  assertEquals(document.root.items[1].name, "List completed");

  const ops = document.getPendingOperations()[ROOT];
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

  const ops = document.getPendingOperations()[ROOT];
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

  const ops = document.getPendingOperations()[ROOT];
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

  const ops = document.getPendingOperations()[ROOT];
  assertEquals(ops, undefined);
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

  const ops = document.getPendingOperations()[ROOT];
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

  const ops = document.getPendingOperations()[ROOT];
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

Deno.test("WorkFlowy Document / Expand list", () => {
  const document = mockDocument();

  const list = document.getList("12f62eec-754c-b677-b683-7dd448dc49ac");

  assertEquals(list.isExpanded, false);

  list.expand();

  assertEquals(list.isExpanded, true);

  const expandedDeltas = document.getPendingExpansionsDelta();
  assertEquals(expandedDeltas.size, 1);
  assertEquals(expandedDeltas.has("12f62eec"), true);
  assertEquals(expandedDeltas.get("12f62eec"), true);
});

Deno.test("WorkFlowy Document / Collapse list", () => {
  const document = mockDocument();

  const list = document.getList("de843e0e-2d25-a812-1415-6ed31ae618f4");

  assertEquals(list.isExpanded, true);

  list.collapse();

  assertEquals(list.isExpanded, false);

  const expandedDeltas = document.getPendingExpansionsDelta();
  assertEquals(expandedDeltas.size, 1);
  assertEquals(expandedDeltas.has("de843e0e"), true);
  assertEquals(expandedDeltas.get("de843e0e"), false);
});

Deno.test("WorkFlowy Document / file attachment", () => {
  const document = mockDocument();

  const list = document.getList("b1c2d3e4-f5a6-7890-abcd-ef1234567890");

  assertEquals(list.name, "List with file attachment");
  assertEquals(list.hasFile, true);
  assertEquals(list.file?.fileName, "screenshot.png");
  assertEquals(list.file?.fileType, "image/png");
  assertEquals(list.file?.objectFolder, "ab/cd/ef");
  assertEquals(list.file?.isAnimatedGIF, false);
  assertEquals(list.file?.imageOriginalWidth, 1920);
  assertEquals(list.file?.imageOriginalHeight, 1080);
  assertEquals(list.file?.imageOriginalPixels, 2073600);
});

Deno.test("WorkFlowy Document / file attachment missing", () => {
  const document = mockDocument();

  const list = document.root.items[0];

  assertEquals(list.hasFile, false);
  assertEquals(list.file, undefined);
});

Deno.test("WorkFlowy Document / getPreviewUrl calls client correctly", async () => {
  let calledWith: { userId: number; nodeId: string; maxWidth: number; maxHeight: number } | undefined;
  
  const mockClientWithFileMethods = () => ({
    getFilePreviewUrl: (userId: number | string, nodeId: string, maxWidth: number, maxHeight: number) => {
      calledWith = { userId: userId as number, nodeId, maxWidth, maxHeight };
      return Promise.resolve("https://workflowy.com/preview-url");
    },
    getOriginalFileUrl: () => Promise.resolve("https://workflowy.com/original-url"),
  } as unknown as Client);
  
  const document = new Document(
    mockClientWithFileMethods(),
    mockTree(),
    mockInitialization(),
  );
  
  const listWithFile = document.getList("b1c2d3e4-f5a6-7890-abcd-ef1234567890");
  const url = await listWithFile.getPreviewUrl(1024, 768);
  
  assertEquals(url, "https://workflowy.com/preview-url");
  assertEquals(calledWith, {
    userId: 0, // from mock initialization data
    nodeId: "b1c2d3e4-f5a6-7890-abcd-ef1234567890",
    maxWidth: 1024,
    maxHeight: 768,
  });
});

Deno.test("WorkFlowy Document / getFileUrl calls client correctly", async () => {
  let calledWith: { userId: number; nodeId: string } | undefined;
  
  const mockClientWithFileMethods = () => ({
    getFilePreviewUrl: () => Promise.resolve(""),
    getOriginalFileUrl: (userId: number | string, nodeId: string) => {
      calledWith = { userId: userId as number, nodeId };
      return Promise.resolve("https://workflowy.com/original-url");
    },
  } as unknown as Client);
  
  const document = new Document(
    mockClientWithFileMethods(),
    mockTree(),
    mockInitialization(),
  );
  
  const listWithFile = document.getList("b1c2d3e4-f5a6-7890-abcd-ef1234567890");
  const url = await listWithFile.getFileUrl();
  
  assertEquals(url, "https://workflowy.com/original-url");
  assertEquals(calledWith, {
    userId: 0, // from mock initialization data
    nodeId: "b1c2d3e4-f5a6-7890-abcd-ef1234567890",
  });
});

Deno.test("WorkFlowy Document / getPreviewUrl uses default dimensions", async () => {
  let calledWith: { maxWidth: number; maxHeight: number } | undefined;
  
  const mockClientWithFileMethods = () => ({
    getFilePreviewUrl: (_userId: number | string, _nodeId: string, maxWidth: number, maxHeight: number) => {
      calledWith = { maxWidth, maxHeight };
      return Promise.resolve("https://workflowy.com/preview-url");
    },
    getOriginalFileUrl: () => Promise.resolve(""),
  } as unknown as Client);
  
  const document = new Document(
    mockClientWithFileMethods(),
    mockTree(),
    mockInitialization(),
  );
  
  const listWithFile = document.getList("b1c2d3e4-f5a6-7890-abcd-ef1234567890");
  await listWithFile.getPreviewUrl(); // no arguments
  
  assertEquals(calledWith, {
    maxWidth: 800,
    maxHeight: 800,
  });
});
