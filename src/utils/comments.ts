/**
 * Groups replies under their root top-level comment.
 * Handles nested replies (reply-to-reply) by walking the parentId chain
 * up to the root, so all replies in a thread appear together.
 */
export function buildReplyMap<T extends { id: string; parentId: string | null }>(
  comments: T[],
): { topLevel: T[]; replyMap: Map<string, T[]> } {
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const topLevel = comments.filter((c) => !c.parentId);
  const topLevelIds = new Set(topLevel.map((c) => c.id));
  const replies = comments.filter((c) => !!c.parentId);
  const replyMap = new Map<string, T[]>();

  for (const r of replies) {
    // Walk up the parentId chain to find the root top-level comment
    let rootId = r.parentId!;
    const seen = new Set<string>();
    while (rootId && !topLevelIds.has(rootId) && !seen.has(rootId)) {
      seen.add(rootId);
      const parent = commentById.get(rootId);
      if (parent?.parentId) rootId = parent.parentId;
      else break;
    }
    const arr = replyMap.get(rootId) || [];
    arr.push(r);
    replyMap.set(rootId, arr);
  }

  return { topLevel, replyMap };
}
