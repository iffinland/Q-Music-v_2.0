export const mediaKey = (
  service: string,
  publisher: string,
  identifier: string
) =>
  `${service}:${encodeURIComponent(publisher.toLowerCase())}:${encodeURIComponent(identifier)}`;

export const mergeMedia = <T extends { id: string }>(
  current: T[],
  incoming: T[]
): T[] => {
  const result = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => result.set(item.id, item));
  return [...result.values()];
};
