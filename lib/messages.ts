import { browser } from 'wxt/browser';
import type { Request, Response } from './types';

export const send = async <T>(request: Request): Promise<T> => {
  const response: Response<T> = await browser.runtime.sendMessage(request);
  if (!response.ok) throw new Error(response.error);
  return response.value;
};
