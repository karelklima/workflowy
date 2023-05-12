import { WorkFlowy } from "workflowy";

const wf = new WorkFlowy("karelklima+test@gmail.com", "testtest");

const doc = await wf.getDocument();

console.log(String(doc.root));
