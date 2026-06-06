export type OrigamiStyle = 'auto' | 'task' | 'work-life' | 'triage';
export type OrigamiStatus = 'idle' | 'analyzing' | 'preview' | 'executing';
export type OrigamiLanguage = 'ja' | 'en';

export interface ClassificationResult {
  groupName: string;
  action?: 'keep' | 'close';
  tabIds: (number | undefined)[];
  color?: chrome.tabGroups.Color;
}

export interface TabInfo {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
}

export interface TabHistoryItem {
  id: string;
  createdAt: number;
  snapshot: TabSnapshot;
}

export interface TabSnapshot {
  tabs: {
    id?: number;
    index: number;
    groupId: number;
    pinned: boolean;
    url?: string;
  }[];
  groups: {
    id: number;
    title?: string;
    color?: chrome.tabGroups.Color;
    collapsed: boolean;
  }[];
}

export interface AppState {
  status: OrigamiStatus;
  style?: OrigamiStyle;
  previewGroups: ClassificationResult[];
  error?: string;
  language: OrigamiLanguage;
  progress?: {
    current: number;
    total: number;
    message: string;
  };
}
