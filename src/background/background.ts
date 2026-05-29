import { ClassificationResult, OrigamiStyle, AppState, OrigamiLanguage } from '../types';
import { getTranslation } from '../utils/translations';

const INITIAL_STATE: AppState = {
  status: 'idle',
  previewGroups: [],
  language: 'ja' // デフォルト
};

/**
 * ストレージから読み込んだ AppState を正規化するヘルパー。
 *
 * 背景:
 *   Vue 3 の Proxy オブジェクトを chrome.storage.local.set() に直接渡すと、
 *   配列が JSON.stringify() 相当の処理を経ずにインデックスキーのオブジェクト形式
 *   ({ "0": 1, "1": 2 } など) として保存される場合がある。
 *   この関数はそのような壊れた tabIds を Array.from() / Object.values() で
 *   正規の配列に修復する。
 *
 * @param state - ストレージから読み込んだ AppState（未正規化の可能性あり）
 * @returns 正規化された AppState
 */
function normalizeState(state: AppState): AppState {
  // previewGroups 自体が配列でない場合（オブジェクト形式で保存されている場合）も修復する
  const rawGroups = state.previewGroups;
  const groupsArray: ClassificationResult[] = Array.isArray(rawGroups)
    ? rawGroups
    : Object.values((rawGroups || {}) as Record<string, ClassificationResult>);

  return {
    ...state,
    previewGroups: groupsArray.map(group => ({
      ...group,
      tabIds: Array.isArray(group.tabIds)
        ? group.tabIds
        // 配列でない場合はオブジェクトのバリューを配列として取得
        : Object.values(group.tabIds as Record<string, number | undefined>),
    })),
  };
}

async function getState(): Promise<AppState> {
  const result = await chrome.storage.local.get(['appState', 'language']);
  // normalizeState を通して読み込み時に壊れた tabIds を修復する
  const state = normalizeState((result.appState as AppState) || INITIAL_STATE);
  if (result.language) state.language = result.language as OrigamiLanguage;
  return state;
}


async function updateState(partialState: Partial<AppState>) {
  const currentState = await getState();
  const newState = { ...currentState, ...partialState };
  await chrome.storage.local.set({ appState: newState });
  chrome.runtime.sendMessage({ type: 'STATE_UPDATED', state: newState }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    getState().then(sendResponse);
    return true;
  }

  if (message.type === 'GET_TABS') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sendResponse(tabs);
    });
    return true;
  }

  if (message.type === 'ORGANIZE_TABS') {
    startOrganizeTabs(message.style);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'EXECUTE_ORGANIZE') {
    handleExecuteOrganize(message.groups).then(sendResponse);
    return true;
  }

  if (message.type === 'CANCEL') {
    updateState({ status: 'idle', previewGroups: [], error: undefined }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'UNDO') {
    handleUndo().then(sendResponse);
    return true;
  }
});

async function startOrganizeTabs(style: OrigamiStyle) {
  const state = await getState();
  await updateState({ status: 'analyzing', style, error: undefined, previewGroups: [] });
  
  try {
    const result = await handleOrganizeTabs(style, state.language);
    await updateState({ status: 'preview', previewGroups: result });
  } catch (err: any) {
    await updateState({ status: 'idle', error: err.message });
  }
}

async function handleOrganizeTabs(style: OrigamiStyle, lang: OrigamiLanguage): Promise<ClassificationResult[]> {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  const result = await chrome.storage.local.get(['geminiApiKey', 'geminiModelName', 'excludePinnedTabs']);
  const geminiApiKey = typeof result.geminiApiKey === 'string' ? result.geminiApiKey.trim() : null;
  const modelName = typeof result.geminiModelName === 'string' ? result.geminiModelName.trim() : "gemini-3.1-flash-lite";
  const excludePinned = result.excludePinnedTabs === true;

  let targetTabs = tabs;
  if (excludePinned) {
    targetTabs = tabs.filter(t => !t.pinned);
  }

  const tabData = targetTabs.map(t => ({ id: t.id, title: t.title, url: t.url }));
  
  if (!geminiApiKey) {
    throw new Error("MISSING_API_KEY");
  }

  const prompt = constructPrompt(style, tabData, lang);
  const systemInstruction = getTranslation(lang, 'aiSystemInstruction');

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemInstruction}\n\n${prompt}` }]
        }],
        generationConfig: {
          response_mime_type: "application/json",
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI response was empty.");

    const parsed = JSON.parse(text) as ClassificationResult[];
    if (style === 'triage') {
      // 整理モードが断捨離の場合は、「断捨離」グループのみをプレビュー対象にする
      const cleanupGroupName = getTranslation(lang, 'aiDanshari');
      return parsed.filter(g => g.groupName === cleanupGroupName);
    }
    return parsed;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

function constructPrompt(style: OrigamiStyle, tabs: any[], lang: OrigamiLanguage): string {
  const tabList = tabs.map(t => `ID:${t.id}, Title:${t.title}, URL:${t.url}`).join('\n');
  
  let styleInstruction = "";
  switch (style) {
    case 'auto': styleInstruction = getTranslation(lang, 'aiStyleAuto'); break;
    case 'task': styleInstruction = getTranslation(lang, 'aiStyleTask'); break;
    case 'work-life': styleInstruction = getTranslation(lang, 'aiStyleWorkLife'); break;
    case 'triage': styleInstruction = getTranslation(lang, 'aiStyleTriage'); break;
  }

  const commonInstruction = getTranslation(lang, 'aiCommonInstruction');

  return `${getTranslation(lang, 'aiPromptHeader')}

${getTranslation(lang, 'aiRuleHeader')}
${commonInstruction}

${getTranslation(lang, 'aiStyleHeader').replace('{style}', style)}
${styleInstruction}

${getTranslation(lang, 'aiTabListHeader')}
${tabList}`;
}

async function handleExecuteOrganize(groups: ClassificationResult[]) {
  const state = await getState();
  const cleanupGroupName = getTranslation(state.language, 'aiDanshari');

  await updateState({ status: 'executing' });
  try {
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const snapshot = currentTabs.map(t => ({
      id: t.id,
      index: t.index,
      groupId: t.groupId,
      pinned: t.pinned,
      url: t.url
    }));
    await chrome.storage.local.set({ lastSnapshot: snapshot });

    for (const group of groups) {
      const validTabIds = group.tabIds.filter((id): id is number => typeof id === 'number');
      if (validTabIds.length === 0) continue;

      if (group.groupName === cleanupGroupName) {
        await chrome.tabs.remove(validTabIds);
      } else if (state.style !== 'triage') {
        const groupId = await chrome.tabs.group({ tabIds: validTabIds as any });
        await chrome.tabGroups.update(groupId, { title: group.groupName });
      }
    }
    await updateState({ status: 'idle', previewGroups: [] });
    return { success: true };
  } catch (err: any) {
    await updateState({ status: 'preview', error: `Error: ${err.message}` });
    return { success: false, error: err.message };
  }
}

async function handleUndo() {
  const result = await chrome.storage.local.get('lastSnapshot');
  const lastSnapshot = result.lastSnapshot as any[];
  if (!lastSnapshot) return { success: false, error: 'No snapshot found' };
  
  for (const item of lastSnapshot) {
    try {
      if (item.id) {
        await chrome.tabs.ungroup(item.id);
        await chrome.tabs.move(item.id, { index: item.index });
      } else {
        await chrome.tabs.create({ url: item.url, index: item.index });
      }
    } catch (e) {
      await chrome.tabs.create({ url: item.url, index: item.index });
    }
  }
  
  await chrome.storage.local.remove('lastSnapshot');
  return { success: true };
}
