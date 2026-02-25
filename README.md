# WorkFlowy API

This is a [WorkFlowy](https://workflowy.com) client for Deno and Node. The goal
of this library is to enable WorkFlowy power users to access WorkFlowy lists
programatically and perhaps create some new automations and integrations.

## Features

- Reading and updating WorkFlowy lists
- Export of lists to JSON or formatted plain text
- Basic search of items in lists
- Support for live copies (mirrors)
- Downloading file attachments (images and other files)

## Basic usage

### Authentication

In order to access WorkFlowy content, you need to provide your WorkFlowy
username and password. Authentication via one-time code or two-factor
authentication are not supported because of technical limitations of WorkFlowy
API.

### Fetching a WorkFlowy document

```typescript
import { WorkFlowy } from "workflowy";

// Log in with your username and password
const workflowy = new WorkFlowy("your@email.com", "your-password");
// Load WorkFlowy outline into an interactive document structure
const document = await workflowy.getDocument();
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
myList.file; // file attachment metadata (if present)
myList.hasFile; // true if a file is attached
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

### Working with file attachments

WorkFlowy supports attaching files and images to lists. The `file` property
provides metadata about attached files:

```typescript
// Check if a list has a file attachment
if (myList.hasFile) {
  console.log(myList.file.fileName);    // Original filename
  console.log(myList.file.fileType);    // MIME type (e.g., "image/png")
  
  // For images, dimensions are available
  console.log(myList.file.imageOriginalWidth);
  console.log(myList.file.imageOriginalHeight);
}
```

### Downloading file attachments

To download a file attachment, use the `getFileUrl()` or `getPreviewUrl()` methods on the list:

```typescript
const workflowy = new WorkFlowy("your@email.com", "your-password");
const document = await workflowy.getDocument();

// Find a list with a file attachment
const listWithFile = document.findOne(/some pattern/);

if (listWithFile?.hasFile) {
  // Get a signed URL for the original file
  const url = await listWithFile.getFileUrl();
  
  // Or get a signed URL for a preview (resized image)
  // Parameters: maxWidth, maxHeight (default: 800x800)
  const previewUrl = await listWithFile.getPreviewUrl(800, 800);
  
  // Download the file
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  
  // Save or process the file
  console.log(`Downloaded ${buffer.byteLength} bytes`);
}
```

**Note:** 
- `getFileUrl()` returns a URL to download the original file
- `getPreviewUrl(maxWidth, maxHeight)` returns a URL to a resized preview (for images)

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
