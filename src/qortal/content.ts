import { jsonBase64 } from '../services/publishing/content';
export const objectToBase64 = async (value: unknown) => jsonBase64(value);
