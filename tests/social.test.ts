import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSocial } from '../src/services/engagement/read';
import { fetchLikes, setLike } from '../src/services/entityLikes';
import {
  fetchComments,
  publishComment,
  changeComment,
  commentFromPayload,
} from '../src/services/entityComments';
import {
  commentPrefix,
  confirmSocial,
  legacyCommentPrefix,
  legacyLikeId,
  likeId,
  pendingSocial,
  prepareSocial,
  sendSocial,
  targetHash,
  type Target,
} from '../src/services/engagement/shared';
const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  fetch: vi.fn(),
  publish: vi.fn(),
}));
vi.mock('../src/qortal', () => ({ objectToBase64: vi.fn() }));
vi.mock('../src/services/qdn', () => ({
  searchQdnResources: mocks.search,
  fetchQdnResource: mocks.fetch,
}));
vi.mock('../src/services/publishing/engine', () => ({
  publishAuxiliary: mocks.publish,
}));
const target: Target = {
  entityType: 'song',
  entityPublisher: 'Artist',
  entityId: 'shared-id',
};
const actor = { name: 'Alice', address: 'Wallet-A' };
const payload = (extra = {}) => ({
  ...target,
  schema: 1,
  author: 'Alice',
  revision: 'a'.repeat(32),
  deleted: false,
  message: 'Comment',
  created: 1000,
  updated: 1000,
  ...extra,
});
const metadata = (
  kind: string,
  active: boolean,
  revision = 'a'.repeat(32)
) => ({ description: `qm-social:1:${kind}:${active ? 1 : 0}:${revision}` });
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.search.mockResolvedValue([]);
  mocks.fetch.mockResolvedValue(null);
  mocks.publish.mockImplementation(async (_r, before) => {
    await before();
    return [{ signature: 'signed' }];
  });
  vi.stubGlobal(
    'qortalRequestWithTimeout',
    vi.fn(async () => ({ address: actor.address }))
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('targeted social identities and reads', () => {
  it('separates equal IDs owned by different publishers and stays within Core identifier byte limits', () => {
    const other = { ...target, entityPublisher: 'Other' };
    expect(likeId(target)).not.toBe(likeId(other));
    expect(targetHash(target)).not.toBe(
      targetHash({ ...target, entityType: 'playlist' })
    );
    expect(likeId(target).length).toBeLessThanOrEqual(64);
    expect(
      prepareSocial('comment', actor, target, { message: 'Hello' }).identifier
        .length
    ).toBeLessThanOrEqual(64);
    expect(likeId({ ...target, entityPublisher: 'ARTIST' })).toBe(
      likeId(target)
    );
  });
  it('rejects a legacy like for another resource owner and never counts identifier substrings', async () => {
    mocks.search.mockImplementation(async (p) =>
      p.identifier === legacyLikeId(target) && !p.name
        ? [
            { name: 'Bob', identifier: legacyLikeId(target) },
            { name: 'Mallory', identifier: legacyLikeId(target) + '_fake' },
          ]
        : []
    );
    mocks.fetch.mockResolvedValue({
      entityId: target.entityId,
      entityPublisher: 'Another owner',
    });
    expect(
      Object.values((await fetchLikes(target, actor)).authors).filter(Boolean)
    ).toHaveLength(0);
  });
  it('lets a scoped unlike override the same author’s old like and deduplicates names case-insensitively', async () => {
    mocks.search.mockImplementation(async (p) =>
      p.identifier === legacyLikeId(target)
        ? [{ name: 'Alice', identifier: p.identifier }]
        : [
            {
              name: 'ALICE',
              identifier: p.identifier,
              metadata: metadata('like', false),
            },
          ]
    );
    mocks.fetch.mockResolvedValue({
      entityId: target.entityId,
      entityPublisher: target.entityPublisher,
    });
    const result = await fetchLikes(target, actor);
    expect(result.authors.alice).toBe(false);
    expect(Object.keys(result.authors)).toHaveLength(1);
  });
  it('uses a scoped metadata state without downloading modern like documents', async () => {
    mocks.search.mockImplementation(async (p) =>
      p.identifier === likeId(target)
        ? [
            {
              name: 'Alice',
              identifier: p.identifier,
              metadata: metadata('like', true),
            },
          ]
        : []
    );
    const result = await fetchLikes(target, actor);
    expect(result.authors.alice).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(
      mocks.search.mock.calls.every(
        ([, options]) => options.fresh && options.priority === 'background'
      )
    ).toBe(true);
  });
  it('marks a capped count incomplete instead of reporting it as an exact total', async () => {
    mocks.search.mockImplementation(async (p) =>
      !p.name && p.identifier === likeId(target)
        ? Array.from({ length: 200 }, (_, i) => ({
            name: 'User' + i,
            identifier: p.identifier,
            metadata: metadata('like', true),
          }))
        : []
    );
    const result = await fetchLikes(target, actor);
    expect(result.partial).toBe(true);
    expect(Object.keys(result.authors)).toHaveLength(200);
  });
  it('queries only this target’s modern and legacy comment prefixes and advances raw offsets', async () => {
    mocks.search.mockImplementation(async (p) =>
      p.identifier === commentPrefix(target)
        ? Array.from({ length: 10 }, (_, i) => ({
            name: 'Alice',
            identifier: p.identifier + String(i).padStart(12, '0'),
          }))
        : []
    );
    mocks.fetch.mockResolvedValue(
      payload({ entityPublisher: 'Another owner' })
    );
    const result = await fetchComments(target, actor);
    expect(result.comments).toEqual([]);
    expect(result.cursor.modern).toBe(10);
    expect(result.hasMore).toBe(true);
    expect(mocks.search.mock.calls.map(([p]) => p.identifier)).toEqual([
      commentPrefix(target),
      legacyCommentPrefix(target),
    ]);
    expect(
      mocks.search.mock.calls.every(([p]) => !p.query && p.prefix === true)
    ).toBe(true);
  });
  it('trusts the resource owner as author, rejects spoofing, and separates same-ID comments from two authors', () => {
    expect(commentFromPayload('Bob', 'same', payload(), target)).toBeNull();
    const a = commentFromPayload('Alice', 'same', payload(), target)!;
    const b = commentFromPayload(
      'Bob',
      'same',
      payload({ author: 'Bob' }),
      target
    )!;
    expect(a.id).not.toBe(b.id);
    expect(a.resourceId).toBe('same');
  });
  it('retains unreadable comment entries for retry while returning successfully loaded comments', async () => {
    mocks.search.mockImplementation(async (p) =>
      p.identifier === commentPrefix(target)
        ? [
            { name: 'Alice', identifier: p.identifier + '000000000001' },
            { name: 'Alice', identifier: p.identifier + '000000000002' },
          ]
        : []
    );
    mocks.fetch.mockImplementation(async (p) => {
      if (p.identifier.endsWith('1')) throw new Error('Unavailable');
      return payload();
    });
    const result = await fetchComments(target, actor);
    expect(result.comments).toHaveLength(1);
    expect(result.cursor.retry).toHaveLength(1);
    expect(result.warning).toBeTruthy();
    expect(result.hasMore).toBe(true);
  });
  it('does not display an old comment body against a newer indexed revision', async () => {
    mocks.search.mockImplementation(async (p) =>
      p.identifier === commentPrefix(target)
        ? [
            {
              name: 'Alice',
              identifier: p.identifier + '000000000001',
              metadata: metadata('comment', true, 'b'.repeat(32)),
            },
          ]
        : []
    );
    mocks.fetch.mockResolvedValue(payload());
    const result = await fetchComments(target, actor);
    expect(result.comments).toEqual([]);
    expect(result.cursor.retry).toHaveLength(1);
  });
  it('limits comment payload reads to two at a time', async () => {
    let active = 0,
      peak = 0;
    mocks.search.mockImplementation(async (p) =>
      p.identifier === commentPrefix(target)
        ? Array.from({ length: 6 }, (_, i) => ({
            name: 'Alice',
            identifier: p.identifier + String(i).padStart(12, '0'),
          }))
        : []
    );
    mocks.fetch.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return payload();
    });
    await fetchComments(target, actor);
    expect(peak).toBe(2);
  });
});
describe('receipt-based writes and durable uncertain actions', () => {
  it('saves the exact action before Hub and publishes only supported DOCUMENT resources', async () => {
    mocks.publish.mockImplementation(async (resources, before, timeout) => {
      expect(pendingSocial(actor, target)).toHaveLength(1);
      await before();
      expect(resources[0]).toMatchObject({
        service: 'DOCUMENT',
        identifier: likeId(target),
      });
      expect(resources[0].description.length).toBeLessThan(240);
      expect(timeout).toBe(300000);
      return [{ signature: 'signed' }];
    });
    const result = await setLike(target, actor, true, () => true);
    expect(result.state).toBe('sent');
    expect(pendingSocial(actor, target)[0].signature).toBe('signed');
  });
  it('implements unlike as a scoped tombstone, preserving the target identity', async () => {
    const op = await setLike(target, actor, false, () => true);
    expect(op.payload.deleted).toBe(true);
    expect(op.identifier).toBe(likeId(target));
    expect(op.payload.entityPublisher).toBe('Artist');
  });
  it('marks a timeout uncertain, blocks automatic retry, and explicitly retries the same saved ID and bytes', async () => {
    mocks.publish.mockImplementationOnce(async (_r, before) => {
      await before();
      throw new Error('Timeout');
    });
    await expect(
      publishComment(target, actor, 'Saved draft', undefined, () => true)
    ).rejects.toThrow('may still complete');
    const saved = pendingSocial(actor, target)[0];
    expect(saved.state).toBe('uncertain');
    expect(() =>
      prepareSocial('comment', actor, target, { message: 'Saved draft' })
    ).toThrow('uncertain');
    const result = await sendSocial(saved, () => true, true);
    expect(result.identifier).toBe(saved.identifier);
    expect(result.payload).toEqual(saved.payload);
    expect(mocks.publish.mock.calls[0][0][0].data64).toBe(
      mocks.publish.mock.calls[1][0][0].data64
    );
  });
  it('does not republish a duplicate comment still awaiting propagation', async () => {
    const first = await publishComment(
      target,
      actor,
      'One comment',
      undefined,
      () => true
    );
    const second = await publishComment(
      target,
      actor,
      'One comment',
      undefined,
      () => true
    );
    expect(first.identifier).toBe(second.identifier);
    expect(mocks.publish).toHaveBeenCalledOnce();
  });
  it('settles a declined approval without falsely marking the action sent', async () => {
    mocks.publish.mockImplementation(async (_r, before) => {
      await before();
      throw new Error('User declined request');
    });
    await expect(setLike(target, actor, true, () => true)).rejects.toThrow(
      'declined'
    );
    expect(pendingSocial(actor, target)).toEqual([]);
  });
  it('blocks the send when the actual wallet or active page changes while queued', async () => {
    vi.stubGlobal(
      'qortalRequestWithTimeout',
      vi.fn(async () => ({ address: 'Other wallet' }))
    );
    await expect(setLike(target, actor, true, () => true)).rejects.toThrow(
      'wallet changed'
    );
    expect(pendingSocial(actor, target)).toEqual([]);
    await expect(setLike(target, actor, true, () => false)).rejects.toThrow(
      'page changed'
    );
  });
  it('blocks any publish when local persistence fails and preserves the old storage bytes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    await expect(
      publishComment(target, actor, 'Draft', undefined, () => true)
    ).rejects.toThrow();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('publishes a legacy comment removal under its original identity with a tombstone body', async () => {
    const id = legacyCommentPrefix(target) + 'abc12345';
    const comment = commentFromPayload(actor.name, id, payload(), target)!;
    const result = await changeComment(
      target,
      actor,
      comment,
      '',
      true,
      () => true
    );
    expect(result.identifier).toBe(id);
    expect(result.payload).toMatchObject({
      deleted: true,
      message: '',
      created: 1000,
    });
  });
  it('prevents edits of another author, another owner, or an unrelated document identifier', async () => {
    const comment = commentFromPayload(
      actor.name,
      legacyCommentPrefix(target) + 'abc12345',
      payload(),
      target
    )!;
    expect(() =>
      changeComment(
        target,
        { name: 'Bob', address: 'B' },
        comment,
        'text',
        false,
        () => true
      )
    ).toThrow('author');
    expect(() =>
      changeComment(
        { ...target, entityPublisher: 'Other' },
        actor,
        comment,
        'text',
        false,
        () => true
      )
    ).toThrow('original page');
    await expect(
      changeComment(
        target,
        actor,
        { ...comment, resourceId: 'enjoymusic_library_state' },
        'text',
        false,
        () => true
      )
    ).rejects.toThrow('identifier');
  });
  it('rejects empty or overlong comments before requesting any transaction', () => {
    expect(() =>
      prepareSocial('comment', actor, target, { message: '  ' })
    ).toThrow('empty');
    expect(() =>
      prepareSocial('comment', actor, target, { message: 'é'.repeat(5000) })
    ).toThrow('8 KiB');
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it('clears a pending like only after the matching indexed revision is observed', async () => {
    const result = await setLike(target, actor, true, () => true);
    mocks.search.mockImplementation(async (p) =>
      p.identifier === likeId(target)
        ? [
            {
              name: actor.name,
              identifier: p.identifier,
              metadata: metadata('like', true),
            },
          ]
        : []
    );
    await fetchLikes(target, actor);
    expect(pendingSocial(actor, target)).toHaveLength(1);
    mocks.search.mockImplementation(async (p) =>
      p.identifier === likeId(target)
        ? [
            {
              name: actor.name,
              identifier: p.identifier,
              metadata: metadata('like', true, result.payload.revision),
            },
          ]
        : []
    );
    const confirmed = await fetchLikes(target, actor);
    for (const entry of confirmed.confirmed || [])
      confirmSocial(actor, target, entry.identifier, entry.revision);
    expect(pendingSocial(actor, target)).toEqual([]);
  });
  it('bounds an individual unreadable payload and leaves the native result classified as a read error', async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementation(() => new Promise(() => {}));
    const request = readSocial({ name: 'Alice', identifier: 'slow' }, {});
    const checked = expect(request).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.advanceTimersByTimeAsync(8001);
    await checked;
  });
  it('restores an interrupted stored send as uncertain with the original ID and payload', async () => {
    const result = await publishComment(
      target,
      actor,
      'Keep identity',
      undefined,
      () => true
    );
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith('qmusic20.social.v1.')
    )!;
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw[0].state = 'sending';
    localStorage.setItem(key, JSON.stringify(raw));
    const restored = pendingSocial(actor, target)[0];
    expect(restored.state).toBe('uncertain');
    expect(restored.identifier).toBe(result.identifier);
    expect(restored.payload).toEqual(result.payload);
  });
});
