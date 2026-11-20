import type { PublishJob } from './types';
let opened: Promise<IDBDatabase> | undefined;
const database = () => {
  if (!opened)
    opened = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('qmusic-publish-jobs', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('jobs', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        opened = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        opened = undefined;
        reject(
          new Error('Close other Q-Music tabs to open saved publishing jobs.')
        );
      };
    });
  return opened;
};
export const savePublishJob = async (job: PublishJob) => {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite');
    tx.objectStore('jobs').put(job);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(
        new Error(
          'The publishing job could not be saved on this device. Free storage before continuing; already sent transactions may still complete.'
        )
      );
  });
};
export const loadPublishJobs = async (
  publisher: string
): Promise<PublishJob[]> => {
  const db = await database();
  const jobs = await new Promise<PublishJob[]>((resolve, reject) => {
    const tx = db.transaction('jobs', 'readonly');
    const request = tx.objectStore('jobs').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return jobs
    .filter((job) => job.publisher.toLowerCase() === publisher.toLowerCase())
    .map((job) => ({
      ...job,
      items: job.items.map((item) => ({
        ...item,
        file: item.file
          ? new File([item.file], item.filename || item.file.name || 'audio', {
              type: item.file.type,
            })
          : undefined,
        state: item.state === 'sending' ? 'uncertain' : item.state,
        error:
          item.state === 'sending'
            ? 'The previous send was interrupted. Check availability before continuing.'
            : item.error,
      })),
    }))
    .sort((a, b) => b.created - a.created);
};
