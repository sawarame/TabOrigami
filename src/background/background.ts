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
  await updateState({ status: 'analyzing', style, error: undefined, previewGroups: [], progress: undefined });
  
  try {
    const result = await handleOrganizeTabs(style, state.language);
    await updateState({ status: 'preview', previewGroups: result, progress: undefined });
  } catch (err: any) {
    await updateState({ status: 'idle', error: err.message, progress: undefined });
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

  if (!geminiApiKey) {
    throw new Error("MISSING_API_KEY");
  }

  const tabData = [];
  for (let i = 0; i < targetTabs.length; i++) {
    const t = targetTabs[i];
    let description = "";
    
    const message = lang === 'ja' 
      ? `タブの内容を読み取っています... (${i + 1}/${targetTabs.length})` 
      : `Reading tab content... (${i + 1}/${targetTabs.length})`;
    await updateState({ progress: { current: i + 1, total: targetTabs.length, message } });

    console.log(`[Debug] 処理開始: タブ ${i + 1}/${targetTabs.length} | ID=${t.id} | Status=${t.status} | Discarded=${t.discarded} | URL=${t.url}`);

    // スクリプト注入は http:// と https:// のみに限定（ストアページは除く）
    const isInjectableUrl = t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')) && !t.url.startsWith('https://chrome.google.com/webstore');

    if (t.id && isInjectableUrl) {
      try {
        console.log(`[Debug] スクリプト注入開始: タブ ID=${t.id}`);
        
        // 稀に休眠状態のタブ等でexecuteScriptが永久に返ってこない現象を防ぐため、2秒のタイムアウトを設定
        const scriptPromise = chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: () => {
            const getMeta = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
            const getOg = (property: string) => document.querySelector(`meta[property="${property}"]`)?.getAttribute('content') || '';
            
            const desc = getOg('og:description') || getMeta('description');
            const keywords = getMeta('keywords');
            const h1 = document.querySelector('h1')?.innerText.trim() || '';
            
            let bodyText = '';
            if (!desc) {
               bodyText = document.body?.innerText?.substring(0, 300).replace(/\s+/g, ' ') || '';
            }
            
            return { desc, keywords, h1, bodyText };
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('タイムアウト (2000ms)')), 2000)
        );

        const results = await Promise.race([scriptPromise, timeoutPromise]) as any[];
        console.log(`[Debug] スクリプト注入完了: タブ ID=${t.id}`);
        
        if (results && results[0] && results[0].result) {
          const res = results[0].result as any;
          const ext = [];
          if (res.desc) ext.push(`Desc: ${res.desc.substring(0, 200)}`);
          if (res.keywords) ext.push(`Keywords: ${res.keywords}`);
          if (res.h1) ext.push(`H1: ${res.h1.substring(0, 100)}`);
          if (res.bodyText) ext.push(`Body: ${res.bodyText}`);
          
          description = ext.join(' | ');
        }
      } catch (e: any) {
        console.warn(`[Debug] スクリプト注入失敗・スキップ: タブ ID=${t.id} | エラー: ${e.message}`);
      }
    } else {
      console.log(`[Debug] 注入対象外のURLのためスキップ: タブ ID=${t.id} | URL=${t.url}`);
    }
    
    console.log(`[Debug] 処理完了: タブ ${i + 1}/${targetTabs.length} | 抽出データ: ${description ? 'あり' : 'なし'}`);
    tabData.push({ id: t.id, title: t.title, url: t.url, description: description });
  }

  console.log(`[Debug] 全タブ処理完了。AIへリクエスト送信開始...`);

  const aiMessage = lang === 'ja' ? 'AIがグループ構成を考案中...' : 'AI is organizing groups...';
  await updateState({ progress: { current: targetTabs.length, total: targetTabs.length, message: aiMessage } });

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
  const tabList = tabs.map(t => {
    let info = `ID:${t.id}, Title:${t.title}, URL:${t.url}`;
    if (t.description) {
      info += `, Description:${t.description}`;
    }
    return info;
  }).join('\n');
  
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
    
    // 現在のウィンドウのグループ情報も取得して保存
    let currentGroups: chrome.tabGroups.TabGroup[] = [];
    if (chrome.tabGroups) {
      currentGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    }

    const snapshot = {
      tabs: currentTabs.map(t => ({
        id: t.id,
        index: t.index,
        groupId: t.groupId,
        pinned: t.pinned,
        url: t.url
      })),
      groups: currentGroups.map(g => ({
        id: g.id,
        title: g.title,
        color: g.color,
        collapsed: g.collapsed
      }))
    };
    await chrome.storage.local.set({ lastSnapshot: snapshot });

    const currentTabIds = new Set(currentTabs.map(t => t.id));

    for (const group of groups) {
      // 数値型であり、かつ現在開いているタブのID群に存在するものだけをフィルタリング（途中で閉じられたタブを除外）
      const validTabIds = group.tabIds.filter((id): id is number => typeof id === 'number' && currentTabIds.has(id));
      if (validTabIds.length === 0) continue;

      if (group.groupName === cleanupGroupName) {
        await chrome.tabs.remove(validTabIds);
      } else if (state.style !== 'triage') {
        // 先にタブをウィンドウの末尾に移動させることで、プレビュー画面のグループ・タブの並び順をブラウザ上に反映する
        await chrome.tabs.move(validTabIds, { index: -1 });
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
  const snapshotData = result.lastSnapshot as any;
  if (!snapshotData) return { success: false, error: 'No snapshot found' };
  
  // 後方互換性のため、配列の場合は古い形式とみなす
  const isOldFormat = Array.isArray(snapshotData);
  const lastSnapshotTabs = isOldFormat ? snapshotData : snapshotData.tabs;
  const lastSnapshotGroups = isOldFormat ? [] : (snapshotData.groups || []);
  
  // IDマッピング: 古いグループIDから新しく作成したグループIDへのマップ
  const groupIdMap = new Map<number, number>();

  for (const item of lastSnapshotTabs) {
    try {
      if (item.id) {
        // 先にインデックス位置へ移動
        await chrome.tabs.move(item.id, { index: item.index });
        
        // グループの復元処理
        if (item.groupId && item.groupId !== -1) {
          // すでに新しいグループを作成済みかチェック
          let targetGroupId = groupIdMap.get(item.groupId);
          
          if (targetGroupId === undefined) {
            // 対象の元のグループ情報を探す
            const originalGroup = lastSnapshotGroups.find((g: any) => g.id === item.groupId);
            
            // 新しくグループを作成してタブを追加
            targetGroupId = await chrome.tabs.group({ tabIds: [item.id] });
            groupIdMap.set(item.groupId, targetGroupId);
            
            // 元のグループ情報があればタイトルや色を復元
            if (originalGroup && chrome.tabGroups) {
              await chrome.tabGroups.update(targetGroupId, {
                title: originalGroup.title,
                color: originalGroup.color,
                collapsed: originalGroup.collapsed
              });
            }
          } else {
            // 既存の復元済みグループに追加
            await chrome.tabs.group({ tabIds: [item.id], groupId: targetGroupId });
          }
        } else {
          // グループに属していなかった場合はグループから外す
          await chrome.tabs.ungroup(item.id);
        }
      } else {
        await chrome.tabs.create({ url: item.url, index: item.index });
      }
    } catch (e) {
      // エラーが発生した場合は新しくタブを作成
      await chrome.tabs.create({ url: item.url, index: item.index });
    }
  }
  
  await chrome.storage.local.remove('lastSnapshot');
  return { success: true };
}
