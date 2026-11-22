import { request } from '../qortal/store';

// Core treats all lists with this prefix as followed names. A separate list
// lets Q-Music remove only its own follow rules, never another app's choices.
export const MUSIC_MIRROR_LIST = 'followedNames_qmusic';
export const MAX_MIRROR_PUBLISHERS = 20;
const key = (name: string) => name.trim().toLowerCase();
export const mirrorPublisherNames = (names: string[]) => {
  const unique = new Map<string, string>();
  for (const name of names) {
    if (typeof name === 'string' && name.trim() && !unique.has(key(name)))
      unique.set(key(name), name.trim());
  }
  return [...unique.values()];
};
const assertOwnNode = async () => {
  const publicNode = await request({ action: 'IS_USING_PUBLIC_NODE' });
  if (publicNode === true)
    throw new Error(
      'Mirroring needs your own node. Public nodes cannot be managed from Q-Music.'
    );
  if (publicNode !== false)
    throw new Error(
      'The selected node could not be checked. No follow rules were changed.'
    );
};
let reading: Promise<string[]> | undefined;
export const readMirrorFollowing = (): Promise<string[]> => {
  if (reading) return reading;
  reading = (async () => {
    await assertOwnNode();
    const value = await request(
      { action: 'GET_LIST_ITEMS', list_name: MUSIC_MIRROR_LIST },
      120_000
    );
    if (!Array.isArray(value) || value.some((name) => typeof name !== 'string'))
      throw new Error(
        'The node returned an invalid follow list. Please refresh status.'
      );
    return mirrorPublisherNames(value);
  })().finally(() => {
    reading = undefined;
  });
  return reading;
};
export const updateMirrorFollowing = async (
  action: 'follow' | 'unfollow',
  names: string[]
) => {
  const selected = mirrorPublisherNames(names);
  if (
    !selected.length ||
    selected.length > MAX_MIRROR_PUBLISHERS ||
    selected.some((name) => name.length > 512)
  )
    throw new Error(
      `Choose between 1 and ${MAX_MIRROR_PUBLISHERS} publisher names.`
    );
  await assertOwnNode();
  // One native confirmation for the selected group, never one per song. Native
  // writes cannot be cancelled; no automatic retries after an uncertain result.
  const result = await request(
    {
      action: action === 'follow' ? 'ADD_LIST_ITEMS' : 'DELETE_LIST_ITEM',
      list_name: MUSIC_MIRROR_LIST,
      items: selected,
    },
    240_000
  );
  if (result !== true && result !== 'true')
    throw new Error(
      'The node did not confirm the change. Refresh status before trying again.'
    );
  const following = await readMirrorFollowing();
  const saved = new Set(following.map(key));
  if (selected.some((name) => saved.has(key(name)) !== (action === 'follow')))
    throw new Error(
      'The saved follow list does not match the requested change. Refresh status before trying again.'
    );
  return following;
};
