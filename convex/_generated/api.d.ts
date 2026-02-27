/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actionQueue from "../actionQueue.js";
import type * as admin from "../admin.js";
import type * as apiKeyRegistry from "../apiKeyRegistry.js";
import type * as cmsPages from "../cmsPages.js";
import type * as costActions from "../costActions.js";
import type * as costs from "../costs.js";
import type * as crons from "../crons.js";
import type * as deployJobs from "../deployJobs.js";
import type * as deployments from "../deployments.js";
import type * as http from "../http.js";
import type * as inboxScans from "../inboxScans.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeActions from "../knowledgeActions.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_embeddings from "../lib/embeddings.js";
import type * as media from "../media.js";
import type * as mediaActions from "../mediaActions.js";
import type * as navLinks from "../navLinks.js";
import type * as pluginConfigs from "../pluginConfigs.js";
import type * as pricingPlans from "../pricingPlans.js";
import type * as privacyRequests from "../privacyRequests.js";
import type * as privacyViolations from "../privacyViolations.js";
import type * as skillConfigs from "../skillConfigs.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actionQueue: typeof actionQueue;
  admin: typeof admin;
  apiKeyRegistry: typeof apiKeyRegistry;
  cmsPages: typeof cmsPages;
  costActions: typeof costActions;
  costs: typeof costs;
  crons: typeof crons;
  deployJobs: typeof deployJobs;
  deployments: typeof deployments;
  http: typeof http;
  inboxScans: typeof inboxScans;
  knowledge: typeof knowledge;
  knowledgeActions: typeof knowledgeActions;
  "lib/auth": typeof lib_auth;
  "lib/embeddings": typeof lib_embeddings;
  media: typeof media;
  mediaActions: typeof mediaActions;
  navLinks: typeof navLinks;
  pluginConfigs: typeof pluginConfigs;
  pricingPlans: typeof pricingPlans;
  privacyRequests: typeof privacyRequests;
  privacyViolations: typeof privacyViolations;
  skillConfigs: typeof skillConfigs;
  subscriptions: typeof subscriptions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
