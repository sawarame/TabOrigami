interface Window {
  ai?: {
    languageModel?: {
      create: (options?: any) => Promise<any>;
      capabilities: () => Promise<any>;
    }
  }
}

declare const ai: {
  languageModel: {
    create: (options?: any) => Promise<any>;
    capabilities: () => Promise<any>;
  }
};
