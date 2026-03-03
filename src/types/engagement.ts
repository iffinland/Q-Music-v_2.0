export interface MediaComment {
  id: string;
  entityType: 'song' | 'playlist';
  entityId: string;
  entityPublisher: string;
  author: string;
  message: string;
  created: number;
  updated?: number;
  parentId?: string;
}

export interface MediaModerationState {
  entityType: 'song' | 'playlist';
  entityId: string;
  entityPublisher: string;
  hiddenCommentIds: string[];
  updated: number;
}
