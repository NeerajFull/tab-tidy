import { storage } from 'wxt/utils/storage';
import type { Rule, RunStatus, SavedSession, UndoSnapshot } from './types';

export const apiKeyItem = storage.defineItem<string>('local:apiKey', { fallback: '' });
export const idleMinutesItem = storage.defineItem<number>('local:idleMinutes', { fallback: 30 });
export const rulesItem = storage.defineItem<Rule[]>('local:rules', { fallback: [] });
export const sessionsItem = storage.defineItem<SavedSession[]>('local:sessions', { fallback: [] });
export const undoItem = storage.defineItem<UndoSnapshot | null>('session:undo', { fallback: null });
export const lastRunItem = storage.defineItem<RunStatus | null>('session:lastRun', { fallback: null });
