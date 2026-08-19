/**
 * FlowOps - Issue Module Index
 */

export * from './types';
export { generateHumanId, parseHumanId, generateBranchName, titleToSlug } from './humanId';
export { validateStatusTransition, type StatusTransitionResult } from './status';
export {
  canMergeDuplicate,
  validateDuplicateMergeTransition,
  generateDuplicateMergeSummary,
  type DuplicateMergeContext,
  type DuplicateMergeResult,
} from './duplicate';
