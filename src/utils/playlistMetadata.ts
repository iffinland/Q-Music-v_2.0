export const formatPlaylistCardMetadata = (params: {
  title: string;
  publisher: string;
  description?: string;
  songCount?: number;
}) => {
  const lines = [`PUBLISHED @ ${params.publisher}`, `TITLE: ${params.title}`];

  if (typeof params.songCount === 'number') {
    lines.push(`TRACKS: ${params.songCount}`);
  }

  if (params.description?.trim()) {
    lines.push(`DESCRIPTION: ${params.description.trim()}`);
  }

  return lines.join('\n');
};
