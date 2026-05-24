import { ClassificationResult, OrigamiStyle } from '../types';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TABS') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sendResponse(tabs);
    });
    return true;
  }

  if (message.type === 'ORGANIZE_TABS') {
    handleOrganizeTabs(message.style).then(sendResponse).catch(err => {
      console.error(err);
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'EXECUTE_ORGANIZE') {
    handleExecuteOrganize(message.groups).then(sendResponse);
    return true;
  }

  if (message.type === 'UNDO') {
    handleUndo().then(sendResponse);
    return true;
  }
});

async function handleOrganizeTabs(style: OrigamiStyle): Promise<ClassificationResult[]> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tabData = tabs.map(t => ({ id: t.id, title: t.title, url: t.url }));

  const result = await chrome.storage.local.get(['geminiApiKey', 'geminiModelName']);
  const geminiApiKey = typeof result.geminiApiKey === 'string' ? result.geminiApiKey.trim() : null;
  const modelName = typeof result.geminiModelName === 'string' ? result.geminiModelName.trim() : "gemini-2.5-flash";
  
  if (!geminiApiKey) {
    throw new Error("APIキーが設定されていません。オプション画面から設定してください。");
  }

  const prompt = constructPrompt(style, tabData);
  const systemInstruction = "あなたはブラウザのタブを整理する専門家です。与えられたタブのリストを、指定されたスタイルに従ってJSON配列形式で分類してください。返却はJSON配列のみとし、説明文やMarkdownの装飾は一切含めないでください。形式: [{ \"groupName\": \"グループ名\", \"tabIds\": [1, 2, ...] }]";

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
      // エラーが発生した場合は、原因を問わず利用可能なモデル一覧を取得して表示する
      let availableModels = "取得失敗";
      try {
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
        const listData = await listResponse.json();
        availableModels = listData.models
          ?.filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
          .map((m: any) => m.name.replace('models/', ''))
          .join(', ') || "none";
      } catch (e) {
        availableModels = "APIキーが無効、または通信エラーです。";
      }

      throw new Error(`${data.error.message} (Model: ${modelName}, Code: ${data.error.code})\n\n【利用可能なモデル一覧】\n${availableModels}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AIからの応答が空でした。");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

function constructPrompt(style: OrigamiStyle, tabs: any[]): string {
  const tabList = tabs.map(t => `ID:${t.id}, Title:${t.title}, URL:${t.url}`).join('\n');
  
  let styleInstruction = "";
  switch (style) {
    case 'auto':
      styleInstruction = "タブのタイトルとURLから、最適なグループ名を考えて分類してください。";
      break;
    case 'task':
      styleInstruction = "タブを「現在進行中のメインタスク（調査・開発）」、「リファレンス（後で読む資料）」、「無関係なノイズ（SNSや動画）」の3つのグループに分類してください。";
      break;
    case 'work-life':
      styleInstruction = "タブを「仕事・開発関連」と「趣味・プライベート関連」の2つのグループに分類してください。";
      break;
    case 'triage':
      styleInstruction = "「保存すべき重要タブ」と「閉じてよさそうな不要なタブ」の2つのグループに分類してください。不要なタブのグループ名は「断捨離」としてください。";
      break;
  }

  const commonInstruction = `
- 「新しいタブ」ページ（Titleが"New Tab"や"新しいタブ"のもの、またはURLが"chrome://newtab/"のもの）は、一律で「断捨離」というグループ名に分類してください。これらは実行時に自動的に閉じられます。
- 同じドメイン（ホスト名）のタブは、可能な限り同じグループにまとめるか、連続したグループになるように整理してください。`;

  return `以下のタブを分類ルールに従って分類し、JSON配列で返してください。

【共通ルール】
${commonInstruction}

【スタイル別ルール: ${style}】
${styleInstruction}

【タブリスト】
${tabList}`;
}

async function handleExecuteOrganize(groups: ClassificationResult[]) {
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

    if (group.groupName === '断捨離') {
       await chrome.tabs.remove(validTabIds);
    } else {
      const groupId = await chrome.tabs.group({ tabIds: validTabIds as any });
      await chrome.tabGroups.update(groupId, { title: group.groupName });
    }
  }
  
  return { success: true };
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
