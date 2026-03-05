/**
 * Tests for buildReplyMap utility (src/utils/comments.ts).
 * Duplicated here because the app project doesn't have Jest configured.
 */

// Inline the function to test it without cross-project imports
function buildReplyMap<T extends { id: string; parentId: string | null }>(
  comments: T[],
): { topLevel: T[]; replyMap: Map<string, T[]> } {
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const topLevel = comments.filter((c) => !c.parentId);
  const topLevelIds = new Set(topLevel.map((c) => c.id));
  const replies = comments.filter((c) => !!c.parentId);
  const replyMap = new Map<string, T[]>();

  for (const r of replies) {
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

interface TestComment {
  id: string;
  parentId: string | null;
  text: string;
}

const makeComment = (id: string, parentId: string | null, text = ''): TestComment => ({
  id,
  parentId,
  text,
});

describe('buildReplyMap', () => {
  it('separates top-level comments from replies', () => {
    const comments = [
      makeComment('a', null, 'top'),
      makeComment('b', 'a', 'reply to a'),
    ];
    const { topLevel, replyMap } = buildReplyMap(comments);

    expect(topLevel).toHaveLength(1);
    expect(topLevel[0].id).toBe('a');
    expect(replyMap.get('a')).toHaveLength(1);
    expect(replyMap.get('a')![0].id).toBe('b');
  });

  it('groups nested replies under root top-level comment', () => {
    const comments = [
      makeComment('root', null, 'top-level'),
      makeComment('reply1', 'root', 'reply to root'),
      makeComment('nested', 'reply1', 'reply to reply1'),
    ];
    const { topLevel, replyMap } = buildReplyMap(comments);

    expect(topLevel).toHaveLength(1);
    expect(topLevel[0].id).toBe('root');
    const replies = replyMap.get('root')!;
    expect(replies).toHaveLength(2);
    expect(replies.map((r) => r.id)).toEqual(['reply1', 'nested']);
  });

  it('handles 3-level deep nesting', () => {
    const comments = [
      makeComment('a', null),
      makeComment('b', 'a'),
      makeComment('c', 'b'),
      makeComment('d', 'c'),
    ];
    const { topLevel, replyMap } = buildReplyMap(comments);

    expect(topLevel).toHaveLength(1);
    const replies = replyMap.get('a')!;
    expect(replies).toHaveLength(3);
    expect(replies.map((r) => r.id)).toEqual(['b', 'c', 'd']);
  });

  it('handles multiple top-level comments with their own reply trees', () => {
    const comments = [
      makeComment('top1', null),
      makeComment('top2', null),
      makeComment('r1', 'top1'),
      makeComment('r2', 'top2'),
      makeComment('nested1', 'r1'),
      makeComment('nested2', 'r2'),
    ];
    const { topLevel, replyMap } = buildReplyMap(comments);

    expect(topLevel).toHaveLength(2);
    expect(replyMap.get('top1')!.map((r) => r.id)).toEqual(['r1', 'nested1']);
    expect(replyMap.get('top2')!.map((r) => r.id)).toEqual(['r2', 'nested2']);
  });

  it('returns empty replyMap when there are no replies', () => {
    const comments = [
      makeComment('a', null),
      makeComment('b', null),
    ];
    const { topLevel, replyMap } = buildReplyMap(comments);

    expect(topLevel).toHaveLength(2);
    expect(replyMap.size).toBe(0);
  });

  it('returns empty arrays when there are no comments', () => {
    const { topLevel, replyMap } = buildReplyMap([]);

    expect(topLevel).toHaveLength(0);
    expect(replyMap.size).toBe(0);
  });

  it('handles orphaned replies gracefully', () => {
    const comments = [
      makeComment('a', null),
      makeComment('orphan', 'missing-parent'),
    ];
    const { topLevel, replyMap } = buildReplyMap(comments);

    expect(topLevel).toHaveLength(1);
    expect(replyMap.get('missing-parent')).toHaveLength(1);
    expect(replyMap.get('a')).toBeUndefined();
  });

  it('handles circular parentId chains without infinite loop', () => {
    const comments = [
      makeComment('a', null),
      makeComment('b', 'c'),
      makeComment('c', 'b'),
    ];
    const { topLevel, replyMap } = buildReplyMap(comments);

    expect(topLevel).toHaveLength(1);
    expect(replyMap.size).toBeGreaterThanOrEqual(1);
  });
});
