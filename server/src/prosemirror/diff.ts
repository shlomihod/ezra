import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

/**
 * Compute diffs between old and new strings.
 * Returns array of [operation, text] tuples.
 * operation: -1 = delete, 0 = equal, 1 = insert
 */
export function computeDiffs(oldStr: string, newStr: string): [number, string][] {
  const diffs = dmp.diff_main(oldStr, newStr);
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}
