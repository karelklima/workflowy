import { z } from "../deps.ts";

export const ROOT = "Root";

export const LoginResultSchema = z.object({
  success: z.boolean().optional(),
  errors: z.object({
    __all__: z.array(z.string()),
  }).optional(),
}).transform((i) => ({
  success: i.success === true,
  errors: i.errors?.__all__ || [],
}));

export type LoginResult = z.infer<typeof LoginResultSchema>;

const TreeInfoSchema = z.object({
  dateJoinedTimestampInSeconds: z.number(),
  initialMostRecentOperationTransactionId: z.string(),
  ownerId: z.number(),
  shareId: z.string().default(ROOT),
});

export const InitializationDataSchema = z.object({
  projectTreeData: z.object({
    auxiliaryProjectTreeInfos: z.array(TreeInfoSchema),
    mainProjectTreeInfo: TreeInfoSchema,
  }),
}).transform((i) => i.projectTreeData);

export type InitializationData = z.infer<typeof InitializationDataSchema>;

const TreeItemShareInfoSchema = z.object({
  share_id: z.string(),
  url_shared_info: z.object({
    access_token: z.string().optional(),
    permission_level: z.number(),
  }).optional(),
  email_shared_info: z.object({
    emails: z.array(z.object({
      email: z.string(),
      access_token: z.string(),
      permission_level: z.number(),
    })),
  }).optional(),
}).transform((i) => ({
  shareId: i.share_id,
  isSharedViaUrl: i.url_shared_info !== undefined,
  urlAccessToken: i.url_shared_info?.access_token,
  urlPermissionLevel: i.url_shared_info?.permission_level,
  isSharedViaEmail: i.email_shared_info !== undefined,
}));

export type TreeItemShareInfo = z.infer<typeof TreeItemShareInfoSchema>;

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
      as: z.string().optional(),
    }).transform((i) => ({
      id: i.id,
      name: i.nm,
      note: i.no,
      parentId: i.prnt !== null ? i.prnt : ROOT,
      priority: i.pr,
      completed: i.cp,
      lastModified: i.lm,
      originalId: i.metadata?.mirror?.originalId,
      isMirrorRoot: i.metadata?.mirror?.isMirrorRoot === true,
      shareId: i.as,
    })),
  ),
  shared_projects: z.record(TreeItemShareInfoSchema),
  server_expanded_projects_list: z.array(z.string()).default([]),
});

export type TreeData = z.infer<typeof TreeDataSchema>;

export type TreeItem = TreeData["items"][number];

export type TreeItemWithChildren = TreeItem & {
  children: string[];
  treeId: string;
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
    permission_level: z.number().optional(),
    access_token: z.string().optional(),
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
    permission_level: z.number().optional(),
    previous_permission_level: z.number().optional(),
  }),
});

export type Operation = z.infer<typeof OperationSchema>;

export const OperationResultSchema = z.object({
  results: z.array(z.object({
    concurrent_remote_operation_transactions: z.array(z.string()),
    error_encountered_in_remote_operations: z.boolean(),
    new_most_recent_operation_transaction_id: z.string(),
    new_polling_interval_in_ms: z.number(),
    share_id: z.string().default(ROOT),
  })),
}).transform((data) => data.results);

export type OperationResult = z.infer<typeof OperationResultSchema>;
