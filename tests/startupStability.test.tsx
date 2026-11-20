import React from 'react';
import { transferableAbortController } from 'node:util';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isTrustedHubMessage,
  internalNavigationPath,
} from '../src/utils/hubMessages';
import { describeRouteError } from '../src/utils/routeErrors';
import { withRouteBoundaries } from '../src/routes/routeBoundaries';
import { sanitizedContent, objectToBase64 } from '../src/qortal/content';
import { persistThemePreference, EnumTheme } from '../src/state/global/system';
import { readBoundedAudio } from '../src/services/boundedFile';
import { downloadQdnAudioResource } from '../src/utils/download';
const mocks = vi.hoisted(() => ({ properties: vi.fn() }));
vi.mock('../src/services/qdn', () => ({
  getQdnResourceProperties: mocks.properties,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('Hub message provenance', () => {
  it('accepts the native self/own-origin/UI contract, and rejects other senders, origins and missing markers', () => {
    const message = (extra = {}) =>
      new MessageEvent('message', {
        source: window,
        origin: window.location.origin,
        data: { action: 'THEME_CHANGED', requestedHandler: 'UI' },
        ...extra,
      });
    expect(isTrustedHubMessage(message())).toBe(true);
    expect(isTrustedHubMessage(message({ source: null }))).toBe(false);
    expect(
      isTrustedHubMessage(message({ origin: 'https://other.example' }))
    ).toBe(false);
    expect(
      isTrustedHubMessage(
        message({ data: { action: 'NAVIGATE_TO_PATH', path: '/songs' } })
      )
    ).toBe(false);
    expect(isTrustedHubMessage(message({ data: null }))).toBe(false);
  });
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil',
    '/a/../songs',
    '/%2e%2e/songs',
    '/%252e%252e/songs',
    '/%2fexample',
    '/a\nb',
    '/%0aevil',
    { pathname: '//evil' },
  ])('rejects external, malformed or escaping navigation (%s)', (path) => {
    expect(internalNavigationPath(path)).toBeNull();
  });
  it('keeps valid internal paths, encoded publisher names, query and fragments', () => {
    expect(
      internalNavigationPath('/songs/Name%20With%20Spaces/id?q=a#time')
    ).toBe('/songs/Name%20With%20Spaces/id?q=a#time');
    expect(internalNavigationPath('/')).toBe('/');
  });
});
describe('route recovery and blocked storage', () => {
  it('does not claim a new version exists for an ordinary runtime or network failure', () => {
    expect(describeRouteError(new Error('Cannot read properties')).title).toBe(
      'This page could not be opened'
    );
    expect(
      describeRouteError(
        new Error('Failed to fetch dynamically imported module')
      ).title
    ).toBe('Page files could not be loaded');
    expect(describeRouteError(new Error('Anything'), false).title).toBe(
      'Connection unavailable'
    );
  });
  it('keeps the surrounding player/shell alive when a child page fails, and navigates back without a reload', async () => {
    // Node fetch Request requires Node's signal; jsdom supplies a different realm.
    vi.stubGlobal(
      'AbortController',
      class {
        constructor() {
          return transferableAbortController();
        }
      }
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Shell = () => (
      <>
        <div>Player alive</div>
        <Outlet />
      </>
    );
    const Broken = () => {
      throw new Error('Page failed');
    };
    const router = createMemoryRouter(
      withRouteBoundaries([
        {
          path: '/',
          element: <Shell />,
          children: [
            { path: 'broken', element: <Broken /> },
            { path: 'songs', element: <div>Songs ready</div> },
          ],
        },
      ]),
      { initialEntries: ['/broken'] }
    );
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByText('This page could not be opened')
    ).toBeTruthy();
    expect(screen.getByText('Player alive')).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Back to music' }));
    expect(await screen.findByText('Songs ready')).toBeTruthy();
    expect(screen.getByText('Player alive')).toBeTruthy();
    router.dispose();
  });
  it('allows theme changes to remain in memory when persistent storage is denied', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    expect(() => persistThemePreference(EnumTheme.LIGHT)).not.toThrow();
  });
  it('retains HTML sanitization after removing the monolithic runtime SDK and encodes Unicode correctly', async () => {
    const html = sanitizedContent(
      '<p>Hello <strong>world</strong></p><img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">x</a>'
    );
    expect(html).toContain('<strong>world</strong>');
    expect(html).not.toMatch(/<script|onerror|javascript:/);
    const encoded = await objectToBase64({ text: 'Tere õhtust 🎵' });
    expect(
      JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(atob(encoded), (x) => x.charCodeAt(0))
        )
      ).text
    ).toBe('Tere õhtust 🎵');
  });
});
describe('bounded file memory and native download handoff', () => {
  const response = (
    chunks: string[],
    headers: Record<string, string> = {},
    status = 200
  ) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks)
            controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
      { status, headers }
    );
  it('assembles only a complete small audio response and preserves MIME', async () => {
    const blob = await readBoundedAudio(
      response(['abc', 'def'], {
        'content-length': '6',
        'content-type': 'audio/mpeg',
      }),
      new AbortController().signal,
      10
    );
    expect(blob.size).toBe(6);
    expect(blob.type).toBe('audio/mpeg');
  });
  it('rejects a declared oversized file before accumulating bytes and cancels the stream', async () => {
    const res = response(['small'], { 'content-length': '100' });
    const cancel = vi.spyOn(res.body!, 'cancel');
    await expect(
      readBoundedAudio(res, new AbortController().signal, 10)
    ).rejects.toThrow('64 MiB');
    expect(cancel).toHaveBeenCalled();
  });
  it('enforces actual streamed bytes even without a content-length header', async () => {
    await expect(
      readBoundedAudio(
        response(['12345', '67890', 'x']),
        new AbortController().signal,
        10
      )
    ).rejects.toThrow('memory limit');
  });
  it.each([0, 206])(
    'rejects empty or partial audio rather than publishing an incomplete copy (%s)',
    async (status) => {
      const res =
        status === 206 ? response(['partial'], {}, 206) : response([]);
      await expect(
        readBoundedAudio(res, new AbortController().signal)
      ).rejects.toThrow();
    }
  );
  it('rejects a truncated response and stops cancelled reuse', async () => {
    await expect(
      readBoundedAudio(
        response(['abc'], { 'content-length': '6' }),
        new AbortController().signal
      )
    ).rejects.toThrow('incomplete');
    const controller = new AbortController();
    controller.abort();
    await expect(
      readBoundedAudio(response(['abc']), controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('hands downloads to the Core attachment URL without fetching or buffering the audio', async () => {
    mocks.properties.mockResolvedValue({
      filename: 'song.mp3',
      mimeType: 'audio/mpeg',
    });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        const url = new URL(this.href);
        expect(url.searchParams.get('attachment')).toBe('true');
        expect(url.searchParams.get('async')).toBeNull();
        expect(this.rel).toContain('noopener');
      });
    expect(
      await downloadQdnAudioResource({
        publisher: 'A',
        identifier: 'song',
        title: 'Song',
        resourceUrl: 'http://localhost/arbitrary/AUDIO/A/song?async=true',
      })
    ).toBe('song.mp3');
    expect(click).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never triggers an old page’s download handoff after cancellation or an unsafe URL', async () => {
    mocks.properties.mockResolvedValue(null);
    const controller = new AbortController();
    controller.abort();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    await expect(
      downloadQdnAudioResource({
        publisher: 'A',
        identifier: 'song',
        title: 'Song',
        resourceUrl: 'http://localhost/audio',
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(click).not.toHaveBeenCalled();
    await expect(
      downloadQdnAudioResource({
        publisher: 'A',
        identifier: 'song',
        title: 'Song',
        resourceUrl: 'javascript:alert(1)',
      })
    ).rejects.toThrow('invalid');
  });
});
