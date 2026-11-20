import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { File as NodeFile } from 'node:buffer';
import type { PublishResource } from '../src/services/publishing/types';
const mocks = vi.hoisted(() => ({
  exact: vi.fn(),
  status: vi.fn(),
  url: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('../src/services/qdn', () => ({
  findExactQdnResource: mocks.exact,
  getQdnResourceStatus: mocks.status,
  getQdnResourceUrl: mocks.url,
  invalidateQdnCache: vi.fn(),
}));
vi.mock('../src/utils/mediaEvents', () => ({
  emitMediaRefresh: mocks.refresh,
}));
const resource = (
  identifier: string,
  service = 'AUDIO',
  stage = 0
): PublishResource => ({
  name: 'Alice',
  identifier,
  service,
  stage,
  data64: btoa(identifier),
});
let engine: typeof import('../src/services/publishing/engine');
const send = vi.fn();
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('File', NodeFile);
  vi.stubGlobal('qortalRequest', vi.fn().mockResolvedValue(false));
  vi.stubGlobal('qortalRequestWithTimeout', send);
  send
    .mockReset()
    .mockImplementation(async (payload) =>
      payload.resources.map(() => ({ signature: 'transaction-signature' }))
    );
  mocks.exact.mockReset().mockResolvedValue(null);
  mocks.status.mockReset().mockResolvedValue({ status: 'READY' });
  mocks.url.mockReset().mockResolvedValue('http://node/resource');
  mocks.refresh.mockReset();
  engine = await import('../src/services/publishing/engine');
  await engine.activatePublishAccount('Alice');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('durable, receipt-based publishing', () => {
  it('runs the auxiliary preflight inside the shared lock and never sends after a guard failure', async () => {
    await expect(
      engine.publishAuxiliary([resource('library', 'DOCUMENT')], async () => {
        throw new Error('Active wallet changed');
      })
    ).rejects.toThrow('Active wallet changed');
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps publishing usable when the host denies Web Locks before work starts', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: vi
          .fn()
          .mockRejectedValue(new DOMException('Denied', 'SecurityError')),
      },
    });
    const work = vi.fn().mockResolvedValue('done');
    expect(await engine.withPublishLock(work)).toBe('done');
    expect(work).toHaveBeenCalledTimes(1);
  });
  it('never repeats work after a failure inside an acquired Web Lock', async () => {
    vi.stubGlobal('navigator', {
      locks: { request: vi.fn(async (_name, work) => work()) },
    });
    const work = vi
      .fn()
      .mockRejectedValue(new DOMException('Denied', 'SecurityError'));
    await expect(engine.withPublishLock(work)).rejects.toMatchObject({
      name: 'SecurityError',
    });
    expect(work).toHaveBeenCalledTimes(1);
  });
  it('saves identities/content before the first wallet action and executes ordered stages', async () => {
    send.mockImplementation(async (payload) => {
      const storage = await import('../src/services/publishing/storage');
      const saved = await storage.loadPublishJobs('Alice');
      expect(
        saved[0].items.some(
          (item) => item.identifier === payload.resources[0].identifier
        )
      ).toBe(true);
      return payload.resources.map(() => ({ signature: 'signed' }));
    });
    const job = await engine.createPublishJob('Song', [
      resource('cover', 'THUMBNAIL', 2),
      resource('audio'),
      resource('meta', 'DOCUMENT', 1),
    ]);
    const result = await engine.runPublishJob(job.id);
    expect(send.mock.calls.map(([p]) => p.resources[0].identifier)).toEqual([
      'audio',
      'meta',
      'cover',
    ]);
    expect(result).toMatchObject({
      complete: true,
      verified: false,
      submitted: 3,
    });
    expect(result.message).not.toMatch(/now live|verified on this node/);
  });
  it('ends a declined request instead of leaving the caller pending', async () => {
    send.mockRejectedValue(new Error('User declined request'));
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    expect(await engine.runPublishJob(job.id)).toMatchObject({
      complete: false,
      submitted: 0,
    });
    expect(engine.getPublishSnapshot().activeJobId).toBeNull();
    expect(engine.getPublishSnapshot().jobs[0].items[0].state).toBe('failed');
  });
  it('does not treat a plain error object or missing receipts as success', async () => {
    send.mockResolvedValue({ error: 'Node unavailable' });
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    expect(await engine.runPublishJob(job.id)).toMatchObject({
      complete: false,
    });
    expect(engine.getPublishSnapshot().jobs[0].items[0].state).toBe(
      'uncertain'
    );
  });
  it('does not infer success for omitted entries in a partial Hub response', async () => {
    send.mockRejectedValue({
      error: {
        unsuccessfulPublishes: [
          {
            name: 'Alice',
            service: 'AUDIO',
            identifier: 'second',
            reason: 'Disk full',
          },
        ],
      },
    });
    const job = await engine.createPublishJob('Album', [
      resource('first'),
      resource('second'),
      resource('cover', 'THUMBNAIL', 2),
    ]);
    const result = await engine.runPublishJob(job.id);
    expect(result.complete).toBe(false);
    expect(
      engine.getPublishSnapshot().jobs[0].items.map((item) => item.state)
    ).toEqual(['uncertain', 'failed', 'prepared']);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('verifies partial success, then resends only the unfinished original IDs', async () => {
    send.mockRejectedValueOnce({
      error: {
        unsuccessfulPublishes: [
          {
            name: 'Alice',
            service: 'AUDIO',
            identifier: 'second',
            reason: 'Disk full',
          },
        ],
      },
    });
    const job = await engine.createPublishJob('Album', [
      resource('first'),
      resource('second'),
      resource('cover', 'THUMBNAIL', 2),
    ]);
    await engine.runPublishJob(job.id);
    mocks.exact.mockImplementation(async (_service, _name, id) =>
      id === 'first' ? { identifier: id, name: 'Alice', metadata: {} } : null
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('first')));
    const result = await engine.continuePublishJob(job.id);
    expect(result.complete).toBe(true);
    expect(
      send.mock.calls.map(([p]) =>
        p.resources.map((r: PublishResource) => r.identifier)
      )
    ).toEqual([['first', 'second'], ['second'], ['cover']]);
    expect(engine.getPublishSnapshot().jobs[0].items[0].state).toBe('verified');
  });
  it('requires explicit authorization before resending an uncertain result', async () => {
    send.mockRejectedValueOnce(new Error('The request timed out'));
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    await engine.runPublishJob(job.id);
    await expect(engine.continuePublishJob(job.id)).rejects.toThrow(
      'uncertain'
    );
    expect(send).toHaveBeenCalledTimes(1);
    await engine.authorizePublishResend(job.id);
    expect((await engine.runPublishJob(job.id)).complete).toBe(true);
    expect(send.mock.calls[1][0].resources[0].identifier).toBe('audio');
  });
  it('checks READY plus exact size/hash and never verifies old bytes by existence alone', async () => {
    const job = await engine.createPublishJob('Song', [resource('new')]);
    await engine.runPublishJob(job.id);
    mocks.exact.mockResolvedValue({
      name: 'Alice',
      identifier: 'new',
      metadata: {},
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('old')));
    const result = await engine.checkPublishJob(job.id);
    expect(result.verified).toBe(false);
    expect(engine.getPublishSnapshot().jobs[0].items[0].state).toBe(
      'submitted'
    );
    expect(mocks.exact.mock.calls[0][3].fresh).toBe(true);
  });
  it('requires matching indexed metadata as well as the same audio bytes', async () => {
    const job = await engine.createPublishJob('Edit', [
      { ...resource('same-bytes'), title: 'New title' },
    ]);
    await engine.runPublishJob(job.id);
    mocks.exact.mockResolvedValue({
      name: 'Alice',
      identifier: 'same-bytes',
      metadata: { title: 'Old title' },
    });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await engine.checkPublishJob(job.id)).verified).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('clears local file copies only after the whole job is verified', async () => {
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    await engine.runPublishJob(job.id);
    mocks.exact.mockResolvedValue({
      name: 'Alice',
      identifier: 'audio',
      metadata: {},
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('audio')));
    expect((await engine.checkPublishJob(job.id)).verified).toBe(true);
    const saved = (
      await (
        await import('../src/services/publishing/storage')
      ).loadPublishJobs('Alice')
    )[0];
    expect(saved.items[0].data64).toBeUndefined();
    expect(saved.items[0].sha256).toHaveLength(64);
  });
  it('restores a saved interrupted send as uncertain with the same ID and file bytes', async () => {
    const file = new File(['file bytes'], 'song.mp3', { type: 'audio/mpeg' });
    const job = await engine.createPublishJob('Song', [
      { ...resource('audio'), file, data64: undefined, filename: 'song.mp3' },
    ]);
    job.items[0].state = 'sending';
    await (
      await import('../src/services/publishing/storage')
    ).savePublishJob(job);
    vi.resetModules();
    engine = await import('../src/services/publishing/engine');
    await engine.activatePublishAccount('Alice');
    const restored = engine.getPublishSnapshot().jobs[0];
    expect(restored.id).toBe(job.id);
    expect(restored.items[0].state).toBe('uncertain');
    expect(restored.items[0].identifier).toBe('audio');
    expect(await restored.items[0].file?.text()).toBe('file bytes');
  });
  it('does not create another publication while the previous job is unfinished', async () => {
    await engine.createPublishJob('Song', [resource('audio')]);
    await expect(
      engine.createPublishJob('Duplicate', [resource('new-id')])
    ).rejects.toThrow('unfinished');
    expect(send).not.toHaveBeenCalled();
  });
  it('pauses on account changes and does not send another account’s resources', async () => {
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    await engine.activatePublishAccount('Bob');
    await expect(engine.runPublishJob(job.id)).rejects.toThrow(
      'account changed'
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('serializes Library and audio publishing without shared modal resolvers', async () => {
    let release!: (value: unknown) => void;
    send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const library = engine.publishAuxiliary([resource('library', 'DOCUMENT')]);
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    const audio = engine.runPublishJob(job.id);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    release([{ signature: 'library-tx' }]);
    await library;
    await audio;
    expect(send.mock.calls.map(([p]) => p.resources[0].identifier)).toEqual([
      'library',
      'audio',
    ]);
  });
  it('does not let a progress message stand in for a transaction receipt', async () => {
    let release!: (value: unknown) => void;
    send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    const pending = engine.runPublishJob(job.id);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    engine.recordPublishProgress({
      publishLocation: { name: 'Alice', service: 'AUDIO', identifier: 'audio' },
      chunks: 10,
      totalChunks: 10,
      processed: true,
    });
    expect(engine.getPublishSnapshot().jobs[0].items[0].state).toBe('sending');
    release([{ signature: 'tx' }]);
    await pending;
  });
  it('leaves no busy preparation state when saving fails before the first send', async () => {
    const storage = await import('../src/services/publishing/storage');
    vi.spyOn(storage, 'savePublishJob').mockRejectedValueOnce(
      new Error('Quota exceeded')
    );
    await expect(
      engine.createPublishJob('Song', [resource('audio')])
    ).rejects.toThrow('Quota');
    expect(engine.getPublishSnapshot().activity).toBe('');
    expect(send).not.toHaveBeenCalled();
  });
  it('coalesces duplicate send clicks for a queued job', async () => {
    let release!: (value: unknown) => void;
    send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    const first = engine.runPublishJob(job.id);
    const second = engine.runPublishJob(job.id);
    expect(first).toBe(second);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    release([{ signature: 'receipt' }]);
    await Promise.all([first, second]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(engine.getPublishSnapshot().waitingJobIds).toEqual([]);
  });
  it('keeps transaction receipt history when an unverified resource is explicitly resent', async () => {
    send
      .mockResolvedValueOnce([{ signature: 'first-receipt' }])
      .mockResolvedValueOnce([{ signature: 'second-receipt' }]);
    const job = await engine.createPublishJob('Song', [resource('audio')]);
    await engine.runPublishJob(job.id);
    await engine.authorizePublishResend(job.id);
    await engine.runPublishJob(job.id);
    expect(engine.getPublishSnapshot().jobs[0].items[0].receipts).toEqual([
      'first-receipt',
      'second-receipt',
    ]);
    expect(send.mock.calls[1][0].resources[0].identifier).toBe('audio');
  });
  it('cannot start a new publication before saved jobs are restored', async () => {
    const storage = await import('../src/services/publishing/storage');
    let restore!: (value: unknown[]) => void;
    vi.spyOn(storage, 'loadPublishJobs').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          restore = resolve;
        })
    );
    const pending = engine.activatePublishAccount('Bob');
    expect(() => engine.assertCanStartJob('Bob')).toThrow('still loading');
    restore([]);
    await pending;
    expect(() => engine.assertCanStartJob('Bob')).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
