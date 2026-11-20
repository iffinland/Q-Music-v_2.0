export interface MediaComment {
  id: string;
  resourceId?: string;
  deleted?: boolean;
  revision?: string;
  pending?: boolean;
  entityType: 'song' | 'playlist';
  entityId: string;
  entityPublisher: string;
  author: string;
  message: string;
  created: number;
  updated?: number;
  parentId?: string;
}
