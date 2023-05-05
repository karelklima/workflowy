import mockInitializationData from "./mocks/get_initialization_data.json" assert {
  type: "json",
};
import mockTreeData from "./mocks/get_tree_data.json" assert { type: "json" };

import { assertEquals, assertObjectMatch } from "../dev_deps.ts";

import { Document } from "../src/document.ts";
import { type Client } from "../src/client.ts";
import { InitializationDataSchema, TreeDataSchema } from "../src/schema.ts";

const mockClient = () => ({} as unknown as Client);
const mockTree = () => TreeDataSchema.parse(mockTreeData);
const mockInitialization = () =>
  InitializationDataSchema.parse(mockInitializationData);

const mockDocument = () =>
  new Document(mockClient(), mockTree(), mockInitialization());

Deno.test("WorkFlowy Document / Load tree", () => {
  const document = mockDocument();

  const home = document.home;
  assertEquals(home.id, "home");
  assertEquals(home.projects.length, 5);

  assertEquals(home.projects[0].name, "List with sublist");
  assertEquals(home.projects[0].projects[0].name, "One");
  assertEquals(home.projects[0].projects[0].name, "One");

  assertEquals(home.projects[1].name, "List with description");
  assertEquals(home.projects[1].description, "Two Description");

  assertEquals(home.projects[2].name, "List completed");
  assertEquals(home.projects[2].isComplete(), true);

  assertEquals(home.projects[3].name, "List mirrored");
  assertEquals(home.projects[3].isMirrorRoot(), false);
  assertEquals(home.projects[3].projects[0].name, "Sublist in mirror");

  assertEquals(home.projects[4].name, "List mirrored");
  assertEquals(home.projects[4].isMirrorRoot(), true);
  assertEquals(home.projects[4].projects[0].name, "Sublist in mirror");
});

Deno.test("WorkFlowy Document / To string", () => {
  const document = mockDocument();

  const text = document.home.toString(true);
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

  const json = document.home.toJson();

  const expected = {
    id: "home",
    name: undefined,
    projects: [
      {
        name: "List with sublist",
        projects: [
          { name: "One" },
          { name: "One" },
        ],
      },
      {
        name: "List with description",
        description: "Two Description",
      },
      {
        name: "List completed",
        complete: 1,
      },
      {
        name: "List mirrored",
        projects: [{
          name: "Sublist in mirror",
        }],
      },
      {
        name: "List mirrored",
        projects: [{
          name: "Sublist in mirror",
        }],
      },
    ],
  };

  assertObjectMatch(json, expected);
});

Deno.test("WorkFlowy Document / Create project", () => {
  const document = mockDocument();

  const project = document.home.createProject(1);

  assertEquals(project.parent.id, "home");
  assertEquals(project.priority, 1);
  assertEquals(document.home.projectIds.length, 6);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "create",
    data: {
      projectid: project.id,
      parentid: "None",
      priority: 1,
    },
  });
});

Deno.test("WorkFlowy Document / Edit project", () => {
  const document = mockDocument();

  const project = document.home.projects[1];

  project.setName("New name").setDescription("New description");

  assertEquals(document.home.projects[1].name, "New name");
  assertEquals(document.home.projects[1].description, "New description");

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 2);
  assertObjectMatch(ops[0], {
    type: "edit",
    data: {
      projectid: project.id,
      name: "New name",
    },
    undo_data: {
      previous_name: "List with description",
    },
  });
  assertObjectMatch(ops[1], {
    type: "edit",
    data: {
      projectid: project.id,
      description: "New description",
    },
    undo_data: {
      previous_description: "Two Description",
    },
  });
});

Deno.test("WorkFlowy Document / Edit mirror", () => {
  const document = mockDocument();

  const project = document.home.projects[4];

  project.setName("New name");

  assertEquals(document.home.projects[4].name, "New name");
  assertEquals(document.home.projects[3].name, "New name");

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "edit",
    data: {
      projectid: project.getOriginalId(),
      name: "New name",
    },
    undo_data: {
      previous_name: "List mirrored",
    },
  });
});

Deno.test("WorkFlowy Document / Move project", () => {
  const document = mockDocument();

  const originalParent = document.home.projects[0];
  const project = originalParent.projects[1];
  const target = document.home.projects[3];

  assertEquals(originalParent.projects.length, 2);
  assertEquals(target.projects.length, 1);

  project.move(target, 0);

  assertEquals(originalParent.projects.length, 1);
  assertEquals(project.parent.id, target.id);
  assertEquals(target.projectIds[0], project.id);
  assertEquals(target.projects.length, 2);

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "move",
    data: {
      projectid: project.id,
      parentid: target.id,
      priority: 0,
    },
    undo_data: {
      previous_parentid: originalParent.id,
      previous_priority: 1,
    },
  });
});

Deno.test("WorkFlowy Document / Delete project", () => {
  const document = mockDocument();

  const project = document.home.projects[1];

  assertEquals(document.home.projects.length, 5);
  assertEquals(document.home.projects[1].name, "List with description");

  project.delete();

  assertEquals(document.home.projects.length, 4);
  assertEquals(document.home.projects[1].name, "List completed");

  const ops = document.getPendingOperations();
  assertEquals(ops.length, 1);
  assertObjectMatch(ops[0], {
    type: "delete",
    data: {
      projectid: project.id,
    },
    undo_data: {},
  });
});
