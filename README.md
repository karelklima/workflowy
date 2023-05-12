# WorkFlowy API

This is a [WorkFlowy](https://workflowy.com) client for Deno and Node. The goal
of this library is to enable WorkFlowy power users to access WorkFlowy lists
programatically and perhaps create some new automations and integrations.

## Features

- Reading and updating WorkFlowy lists
- Export of lists to JSON or formatted plain text
- Basic search of items in lists
- Support for live copies (mirrors)

## Basic usage

### Fetching a WorkFlowy document

```typescript
import { WorkFlowy } from "https://deno.land/x/workflowy@0.0.4/mod.ts";

const workflowy = new WorkFlowy("your@email.com", "your-password");
// Loads WorkFlowy outline into an interactive document structure
const document = await workflowy.getDocument();

// Returns the the very first list in your WorkFlowy home
const myList = document.items[0];
// Prints information about the list
console.log(myList.name);
console.log(myList.note);

myList.setName("Some new name of the node");

// saves all the changes in the document
await document.save();
```

### Finding lists in a document

```typescript
const rootList = document.root;
const topLevelLists = document.items; // array of lists in the root
const myList = topLevelLists[0];

myList.findOne(/^Needle/); // Finds a sublist using a RegExp
myList.findAll(/^Needle/); // Finds all sublists using a RegExp
```

### Accessing basic list properties

```typescript
const rootList = document.root;
const myList = document.items[0];

myList.name; // name of the list
myList.note; // note of the list
myList.isCompleted; // whether or not the list or item is completed
myList.items; // items and sublists
```

### Editing lists

```typescript
myList.setName("New name").setNote("New note"); // sets a name and a note
const sublist = myList.createList(); // Creates a sublist
const subitem = myList.createItem(); // Alias for createList

myList.move(targetList); // moves a list or item to a different list
myList.delete(); // deletes the list
```

### Saving the changes to WorkFlowy

```typescript
if (document.isDirty()) {
  // Saves the changes if there are any
  await document.save();
}
```

## Installation

### From `npm` (Node/Bun)

```
npm install workflowy    # npm
yarn add workflowy       # yarn
bun add workflowy        # bun
pnpm add workflowy       # pnpm
```

### From `deno.land/x` (Deno)

Unlike Node, Deno relies on direct URL imports instead of a package manager like
NPM. The latest Deno version can be imported like so:

```typescript
import { WorkFlowy } from "https://deno.land/x/workflowy/mod.ts";
```

## Acknowledgements

Big thanks to [Mike Robertson](https://github.com/mikerobe) for providing the
`workflowy` NPM package name!

## License

MIT
