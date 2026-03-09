export const formatPlaylistCardMetadata = (params: {
  title: string;
  publisher: string;
  description?: string;
  publishedDate?: string;
  songCount?: number;
}) => {
  const lines = [
    params.publishedDate?.trim()
      ? `PUBLISHED @ ${params.publisher} • ${params.publishedDate.trim()}`
      : `PUBLISHED @ ${params.publisher}`,
    `TITLE: ${params.title}`,
  ];

  if (typeof params.songCount === 'number' && params.songCount > 0) {
    lines.push(`TRACKS: ${params.songCount}`);
  }

  if (params.description?.trim()) {
    lines.push(`DESCRIPTION: ${params.description.trim()}`);
  }

  return lines.join('\n');
};
