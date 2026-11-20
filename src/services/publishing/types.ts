export interface PublishResource {
  name: string;
  service: string;
  identifier: string;
  title?: string;
  description?: string;
  filename?: string;
  file?: File;
  data64?: string;
  stage?: number;
}
export type PublishItemState =
  | 'prepared'
  | 'sending'
  | 'submitted'
  | 'verified'
  | 'failed'
  | 'uncertain';
export interface PublishItem extends PublishResource {
  sha256: string;
  bytes: number;
  state: PublishItemState;
  signature?: string;
  receipts?: string[];
  error?: string;
  chunks?: number;
  totalChunks?: number;
}
export interface PublishJob {
  id: string;
  publisher: string;
  title: string;
  created: number;
  updated: number;
  items: PublishItem[];
  archived?: boolean;
}
export interface PublishResult {
  jobId: string;
  complete: boolean;
  verified: boolean;
  submitted: number;
  total: number;
  message: string;
}
export const publishItemKey = (
  item: Pick<PublishResource, 'name' | 'service' | 'identifier'>
) => `${item.service}:${item.name.toLowerCase()}:${item.identifier}`;
