export const formatPlaylistTrackCount = (
  songCount?: number | null,
  options?: { isLoading?: boolean }
) => {
  if (options?.isLoading) {
    return 'Tracks loading...';
  }

  return typeof songCount === 'number'
    ? `${songCount} tracks`
    : 'Open playlist for tracks';
};

export const formatPlaylistCardMetadata = (params: {
  title: string;
  publisher: string;
  description?: string;
  publishedDate?: string;
  songCount?: number | null;
  isTrackCountLoading?: boolean;
}) => {
  const lines = [
    params.publishedDate?.trim()
      ? `PUBLISHED @ ${params.publisher} • ${params.publishedDate.trim()}`
      : `PUBLISHED @ ${params.publisher}`,
    `TITLE: ${params.title}`,
  ];

  if (params.isTrackCountLoading) {
    lines.push('TRACKS: Loading...');
  } else if (typeof params.songCount === 'number' && params.songCount > 0) {
    lines.push(`TRACKS: ${params.songCount}`);
  }

  if (params.description?.trim()) {
    lines.push(`DESCRIPTION: ${params.description.trim()}`);
  }

  return lines.join('\n');
};
