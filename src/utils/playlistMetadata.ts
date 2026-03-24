export const formatPlaylistTrackCount = (
  songCount?: number,
  options?: { isLoading?: boolean }
) => {
  if (options?.isLoading) {
    return 'Tracks loading...';
  }

  return `${songCount ?? 0} tracks`;
};

export const formatPlaylistCardMetadata = (params: {
  title: string;
  publisher: string;
  description?: string;
  publishedDate?: string;
  songCount?: number;
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
