/**
 * FlowOps - Issue Module Index
 */

export * from './types';
export { generateHumanId, parseHumanId, generateBranchName, titleToSlug } from './humanId';
export {
  canMergeDuplicate,
  validateDuplicateMergeTransition,
  generateDuplicateMergeSummary,
  type DuplicateMergeContext,
  type DuplicateMergeResult,
} from './duplicate';
