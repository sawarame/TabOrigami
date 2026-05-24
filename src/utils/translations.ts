import { OrigamiLanguage } from '../types';

export const translations = {
  ja: {
    // Popup
    title: '🕊️ TabOrigami',
    description: '折り方を選んで、タブを綺麗に整理しましょう。',
    analyzing: 'AIがタブの内容を読み取っています...',
    executing: 'タブを整理しています...',
    previewTitle: '整理のプレビュー',
    cancel: 'キャンセル',
    execute: '実行する',
    undo: '直前の整理を元に戻す (Undo)',
    unknownTab: '不明なタブ',
    close: '閉じる',
    // Styles
    styleAuto: 'おまかせ折り',
    styleTask: 'タスク集中折り',
    styleWorkLife: 'オン・オフ折り',
    styleTriage: '断捨離折り',
    // Options
    optionsTitle: '🕊️ TabOrigami 設定',
    apiSettings: 'Gemini API 設定',
    apiKeyLabel: 'Gemini API Key:',
    modelLabel: '使用するモデル名:',
    save: '保存',
    saved: '保存しました！',
    languageLabel: '表示言語 (Language):',
    helpApiKey: 'APIキーをお持ちでない場合は、Google AI Studio で無料で作成できます。',
    excludePinnedLabel: '固定されたタブを整理の対象外にする',
    // Background / AI
    aiSystemInstruction: 'あなたはブラウザのタブを整理する専門家です。与えられたタブのリストを、指定されたスタイルに従ってJSON配列形式で分類してください。返却はJSON配列のみとし、説明文やMarkdownの装飾は一切含めないでください。形式: [{ "groupName": "グループ名", "tabIds": [1, 2, ...] }]',
    aiStyleAuto: 'タブのタイトルとURLから、最適なグループ名を考えて分類してください。',
    aiStyleTask: 'タブを「現在進行中のメインタスク（調査・開発）」、「リファレンス（後で読む資料）」、「無関係なノイズ（SNSや動画）」の3つのグループに分類してください。',
    aiStyleWorkLife: 'タブを「仕事・開発関連」と「趣味・プライベート関連」の2つのグループに分類してください。',
    aiStyleTriage: '「保存すべき重要タブ」と「閉じてよさそうな不要なタブ」の2つのグループに分類してください。不要なタブのグループ名は「断捨離」としてください。',
    aiCommonInstruction: '- 「新しいタブ」ページ（Titleが"New Tab"や"新しいタブ"のもの、またはURLが"chrome://newtab/"のもの）は、一律で「断捨離」というグループ名に分類してください。これらは実行時に自動的に閉じられます。\n- 同じドメイン（ホスト名）のタブは、可能な限り同じグループにまとめるか、連続したグループになるように整理してください。',
    aiDanshari: '断捨離',
    aiPromptHeader: '以下のタブを分類ルールに従って分類し、JSON配列で返してください。',
    aiRuleHeader: '【共通ルール】',
    aiStyleHeader: '【スタイル別ルール: {style}】',
    aiTabListHeader: '【タブリスト】'
  },
  en: {
    // Popup
    title: '🕊️ TabOrigami',
    description: 'Choose a style to organize your tabs beautifully.',
    analyzing: 'AI is analyzing your tabs...',
    executing: 'Organizing tabs...',
    previewTitle: 'Preview Organization',
    cancel: 'Cancel',
    execute: 'Execute',
    undo: 'Undo last organization',
    unknownTab: 'Unknown Tab',
    close: 'Close',
    // Styles
    styleAuto: 'Auto Fold',
    styleTask: 'Task Focus Fold',
    styleWorkLife: 'Work-Life Fold',
    styleTriage: 'Triage Fold',
    // Options
    optionsTitle: '🕊️ TabOrigami Settings',
    apiSettings: 'Gemini API Settings',
    apiKeyLabel: 'Gemini API Key:',
    modelLabel: 'Model Name:',
    save: 'Save',
    saved: 'Saved!',
    languageLabel: 'Language:',
    helpApiKey: 'If you don\'t have an API key, you can create one for free at Google AI Studio.',
    excludePinnedLabel: 'Exclude pinned tabs from organization',
    // Background / AI
    aiSystemInstruction: 'You are an expert at organizing browser tabs. Classify the given list of tabs into a JSON array format according to the specified style. Return only the JSON array, without any explanation or Markdown decoration. Format: [{ "groupName": "Group Name", "tabIds": [1, 2, ...] }]',
    aiStyleAuto: 'Create optimal group names based on tab titles and URLs.',
    aiStyleTask: 'Classify tabs into three groups: "Active Main Task (Research/Dev)", "Reference (Read later)", and "Irrelevant Noise (SNS/Video)".',
    aiStyleWorkLife: 'Classify tabs into two groups: "Work/Development" and "Personal/Private".',
    aiStyleTriage: 'Classify tabs into two groups: "Important Tabs to Keep" and "Unnecessary Tabs to Close". The name for the unnecessary tabs group should be "Cleanup".',
    aiCommonInstruction: '- "New Tab" pages (Title is "New Tab" or URL is "chrome://newtab/") should always be classified into a group named "Cleanup". These will be automatically closed.\n- Tabs from the same domain (hostname) should be grouped together or placed in consecutive groups as much as possible.',
    aiDanshari: 'Cleanup',
    aiPromptHeader: 'Please classify the following tabs according to the rules and return as a JSON array.',
    aiRuleHeader: '[Common Rules]',
    aiStyleHeader: '[Style Rules: {style}]',
    aiTabListHeader: '[Tab List]'
  }
};

export type TranslationKey = keyof typeof translations.ja;

export function getTranslation(lang: OrigamiLanguage, key: TranslationKey): string {
  return translations[lang][key] || translations['en'][key];
}
