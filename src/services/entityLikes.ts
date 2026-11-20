import type { ReadOptions } from './qdnRequests';
import {
  legacyLikeId,
  likeId,
  sameTarget,
  prepareSocial,
  sendSocial,
  type Actor,
  type Target,
} from './engagement/shared';
import {
  mapSocial,
  readSocial,
  searchSocial,
  socialMetadata,
  socialReadBudget,
} from './engagement/read';
export interface LikesResult {
  authors: Record<string, boolean>;
  confirmed?: { identifier: string; revision: string }[];
  partial: boolean;
  warning: string;
}
const readLikes = async (
  target: Target,
  actor: Actor,
  options: ReadOptions = {}
): Promise<LikesResult> => {
  const confirmed: { identifier: string; revision: string }[] = [];
  const authors: Record<string, boolean> = {},
    current: Record<string, boolean> = {};
  let partial = false,
    unavailable = 0;
  const modern = likeId(target),
    legacy = legacyLikeId(target);
  // Modern likes carry a scoped identity and revision/state in their index.
  // Legacy payloads need validation because their identifiers omitted the owner.
  for (const [identifier, limit, v2] of [
    [legacy, 25, false],
    [modern, 200, true],
  ] as const) {
    const page = await searchSocial(identifier, limit, 0, options);
    if (page.length === limit) partial = true;
    await mapSocial(
      page.filter((entry) => entry.name && entry.identifier === identifier),
      async (entry) => {
        try {
          const metadata = v2 ? socialMetadata(entry, 'like') : null;
          let active: boolean;
          if (metadata) {
            active = metadata.active;
            if (entry.name!.toLowerCase() === actor.name.toLowerCase())
              confirmed.push({ identifier, revision: metadata.revision });
          } else {
            const data = await readSocial(entry, options);
            if (
              !data ||
              !sameTarget(
                {
                  ...data,
                  entityType: data.entityType || target.entityType,
                } as Partial<Target>,
                target
              )
            )
              return;
            active = data.deleted !== true;
          }
          const name = entry.name!.toLowerCase();
          authors[name] = active;
          if (v2) current[name] = active;
        } catch {
          unavailable++;
        }
      }
    );
  }
  // Fetch this account explicitly even if it falls outside a bounded count page.
  if (actor.name) {
    for (const [identifier, v2] of [
      [legacy, false],
      [modern, true],
    ] as const) {
      const page = await searchSocial(identifier, 10, 0, options, actor.name);
      const own = page.find(
        (entry) =>
          entry.identifier === identifier &&
          entry.name?.toLowerCase() === actor.name.toLowerCase()
      );
      if (!own) continue;
      const metadata = v2 ? socialMetadata(own, 'like') : null;
      if (metadata) {
        authors[actor.name.toLowerCase()] = metadata.active;
        current[actor.name.toLowerCase()] = metadata.active;
        confirmed.push({ identifier, revision: metadata.revision });
      } else {
        const data = await readSocial(own, options);
        if (
          data &&
          sameTarget(
            {
              ...data,
              entityType: data.entityType || target.entityType,
            } as Partial<Target>,
            target
          )
        )
          authors[actor.name.toLowerCase()] = data.deleted !== true;
      }
    }
  }
  Object.assign(authors, current);
  return {
    authors,
    confirmed,
    partial: partial || unavailable > 0,
    warning: unavailable
      ? 'Some older likes could not be read. The count may be incomplete.'
      : '',
  };
};
export const fetchLikes = (
  target: Target,
  actor: Actor,
  options: ReadOptions = {}
) => socialReadBudget(options, (bounded) => readLikes(target, actor, bounded));
export const setLike = (
  target: Target,
  actor: Actor,
  liked: boolean,
  isCurrent: () => boolean
) =>
  sendSocial(
    prepareSocial('like', actor, target, { deleted: !liked }),
    isCurrent
  );
