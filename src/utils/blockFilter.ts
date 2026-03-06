/**
 * Filters out items belonging to blocked users.
 */
export function filterBlockedContent<T>(
  items: T[],
  blockedSet: Set<string>,
  getUserId: (item: T) => string,
): T[] {
  if (blockedSet.size === 0) return items;
  return items.filter((item) => !blockedSet.has(getUserId(item)));
}

/**
 * Thread-aware comment filtering for blocked users.
 * - If a blocked user authored a top-level comment, the entire thread (comment + all replies) is hidden.
 * - If a blocked user authored a reply, only that reply is hidden.
 */
export function filterBlockedComments<T extends { id: string; parentId: string | null }>(
  comments: T[],
  blockedSet: Set<string>,
  getUserId: (item: T) => string,
): T[] {
  if (blockedSet.size === 0) return comments;

  // Find top-level comments by blocked users — their entire threads should be removed
  const blockedTopLevelIds = new Set(
    comments
      .filter((c) => !c.parentId && blockedSet.has(getUserId(c)))
      .map((c) => c.id),
  );

  // Build a map to walk parentId chains up to root
  const commentById = new Map(comments.map((c) => [c.id, c]));

  return comments.filter((c) => {
    // Remove individual blocked user's comments
    if (blockedSet.has(getUserId(c))) return false;

    // Remove replies that belong to a blocked user's top-level thread
    if (c.parentId) {
      let rootId = c.parentId;
      const seen = new Set<string>();
      while (rootId && !seen.has(rootId)) {
        if (blockedTopLevelIds.has(rootId)) return false;
        seen.add(rootId);
        const parent = commentById.get(rootId);
        if (parent?.parentId) rootId = parent.parentId;
        else break;
      }
    }

    return true;
  });
}
