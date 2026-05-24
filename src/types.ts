export type OrigamiStyle = 'auto' | 'task' | 'work-life' | 'triage';
export type OrigamiStatus = 'idle' | 'analyzing' | 'preview' | 'executing';

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

export interface AppState {
  status: OrigamiStatus;
  style?: OrigamiStyle;
  previewGroups: ClassificationResult[];
  error?: string;
}
