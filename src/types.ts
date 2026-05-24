export type OrigamiStyle = 'auto' | 'task' | 'work-life' | 'triage';

export interface ClassificationResult {
  groupName: string;
  tabIds: (number | undefined)[];
}

export interface TabInfo {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
}
