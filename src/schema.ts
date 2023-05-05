import { z } from "../deps.ts";

export const InitializationDataSchema = z.object({
  projectTreeData: z.object({
    mainProjectTreeInfo: z.object({
      dateJoinedTimestampInSeconds: z.number(),
      initialMostRecentOperationTransactionId: z.string(),
      ownerId: z.number(),
    }),
  }),
}).transform((x) => x.projectTreeData.mainProjectTreeInfo);

export type InitializationData = z.infer<typeof InitializationDataSchema>;

export const TreeDataSchema = z.object({
  most_recent_operation_transaction_id: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      nm: z.string(),
      no: z.string().optional(),
      prnt: z.string().or(z.null()),
      pr: z.number(),
      cp: z.number().optional(),
      lm: z.number(),
      metadata: z.object({
        mirror: z.object({
          originalId: z.string().optional(),
          isMirrorRoot: z.boolean().optional(),
        }).optional(),
      }),
    }).transform((i) => ({
      id: i.id,
      name: i.nm,
      description: i.no,
      parentId: i.prnt !== null ? i.prnt : "home",
      priority: i.pr,
      completed: i.cp,
      lastModified: i.lm,
      originalId: i.metadata?.mirror?.originalId,
      isMirrorRoot: i.metadata?.mirror?.isMirrorRoot === true,
    })),
  ),
});

export type TreeData = z.infer<typeof TreeDataSchema>;

export type TreeItem = TreeData["items"][number] & {
  children: string[];
};

export const OperationSchema = z.object({
  type: z.string(),
  data: z.object({
    projectid: z.string(),
    parentid: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    priority: z.number().optional(),
    starting_priority: z.number().optional(),
  }),
  client_timestamp: z.number().optional(),
  undo_data: z.object({
    previous_last_modified: z.number().optional(),
    previous_last_modified_by: z.any().optional(),
    previous_name: z.string().optional(),
    previous_description: z.string().optional(),
    previous_completed: z.number().or(z.boolean()).optional(),
    previous_parentid: z.string().optional(),
    previous_priority: z.number().optional(),
    parentid: z.string().optional(),
    priority: z.number().optional(),
  }),
});

export type Operation = z.infer<typeof OperationSchema>;

export const OperationResultSchema = z.object({
  results: z.array(z.object({
    error_encountered_in_remote_operations: z.boolean(),
    new_most_recent_operation_transaction_id: z.string(),
  })),
}).transform((data) => data.results[0]);
