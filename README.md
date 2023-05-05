# WorkFlowy API

This is an unofficial WorkFlowy API for Deno. It is experimental and may change
significantly in the future.

Node.JS version is comming in the very near future.

## Usage

```typescript
import { WorkFlowy } from "https://deno.land/x/workflowy@0.0.1/mod.ts";

const workflowy = new WorkFlowy("your@email.com", "your-password");
const document = await workflowy.getDocument();
// this is the root of the WorkFlowy outline
const homeNode = document.getHome();

const myProject = homeNode.projects[0];
console.log(myProject.name);

myProject.setName("Some new name of the node");

// saves all the changes in the document
await document.save();
```

## License

MIT
