export const NO_GROUP = -1;
export const TIDY_COMMAND = 'tidy-all';

export type GroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

export interface TabLite {
  id: number;
  windowId: number;
  index: number;
  url: string;
  title: string;
  pinned: boolean;
  active: boolean;
  audible: boolean;
  discarded: boolean;
  groupId: number;
  lastAccessed?: number;
}

export interface Cluster {
  key: string;
  label: string;
  tabIds: number[];
}

// A learned rule: tabs whose app or site is `from` go in the group of `to`.
export interface Rule {
  from: string;
  to: string;
}

// A model answer: put the tab at this index in the group with this name.
export interface Move {
  tab: number;
  group: string;
}

export interface GroupState {
  id: number;
  title: string;
  color: GroupColor;
  collapsed: boolean;
}

export interface WindowSnapshot {
  windowId: number;
  tabs: { id: number; index: number; groupId: number }[];
  groups: GroupState[];
  closed: { url: string; index: number; groupId: number }[];
}

export interface UndoSnapshot {
  kind: 'tidy' | 'sleep';
  runId: string;
  windows: WindowSnapshot[];
  slept: number[];
}

export type AiState = 'off' | 'pending' | 'done' | 'failed';

export interface RunStatus {
  runId: string;
  kind: 'tidy' | 'sleep';
  windowCount: number;
  tabCount: number;
  groupCount: number;
  closedCount: number;
  sleptCount: number;
  groupedMs: number;
  ai: AiState;
  aiMs?: number;
  aiMoved?: number;
  error?: string;
  undone?: boolean;
}

export interface SavedTab {
  url: string;
  title: string;
  pinned: boolean;
  group: number;
}

export interface SavedSession {
  id: string;
  name: string;
  savedAt: number;
  tabs: SavedTab[];
  groups: Omit<GroupState, 'id'>[];
}

export type Request =
  | { type: 'tidy'; focusedWindowId?: number }
  | { type: 'sleep' }
  | { type: 'undo' }
  | { type: 'save-session'; windowId: number; name: string }
  | { type: 'restore-session'; id: string }
  | { type: 'delete-session'; id: string }
  | { type: 'put-session'; session: SavedSession };

export type Response<T = unknown> = { ok: true; value: T } | { ok: false; error: string };
