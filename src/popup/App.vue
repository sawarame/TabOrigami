<template>
  <div class="container">
    <header>
      <h1>{{ t('title') }}</h1>
    </header>

    <!-- エラー表示 -->
    <div v-if="appState.error" class="error-box">
      <p>{{ appState.error }}</p>
      <button @click="clearError" class="btn-secondary">{{ t('close') }}</button>
    </div>

    <!-- 解析中・実行中 -->
    <div v-if="appState.status === 'analyzing' || appState.status === 'executing'" class="loading">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
      <button v-if="appState.status === 'analyzing'" @click="cancel" class="btn-secondary btn-small">{{ t('cancel') }}</button>
    </div>

    <!-- 初期状態 -->
    <div v-else-if="appState.status === 'idle'">
      <p class="description">{{ t('description') }}</p>
      <div class="style-grid">
        <button v-for="style in styles" :key="style.id" @click="analyze(style.id)" class="style-card">
          <span class="icon">{{ style.icon }}</span>
          <span class="label">{{ style.name }}</span>
        </button>
      </div>
      <div v-if="hasUndo" class="undo-section">
        <button @click="undo" class="btn-undo">{{ t('undo') }}</button>
      </div>
    </div>

    <!-- プレビュー -->
    <div v-else-if="appState.status === 'preview'" class="preview-area">
      <h2>{{ t('previewTitle') }}</h2>
      <div v-for="(group, gIdx) in appState.previewGroups" :key="gIdx" class="group-card">
        <h3>{{ group.groupName }}</h3>
        <ul>
          <li v-for="(tabId, tIdx) in group.tabIds" :key="tIdx">
            <label>
              <input type="checkbox" checked @change="toggleTab(gIdx, tIdx)">
              {{ getTabTitle(tabId) }}
            </label>
          </li>
        </ul>
      </div>
      <div class="actions">
        <button @click="cancel" class="btn-secondary">{{ t('cancel') }}</button>
        <button @click="execute" class="btn-primary">{{ t('execute') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { OrigamiStyle, AppState, OrigamiLanguage } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';

const appState = ref<AppState>({
  status: 'idle',
  previewGroups: [],
  language: 'ja',
});

const t = (key: TranslationKey) => getTranslation(appState.value.language, key);

const styles = computed(() => [
  { id: 'auto' as OrigamiStyle, name: t('styleAuto'), icon: '✨' },
  { id: 'task' as OrigamiStyle, name: t('styleTask'), icon: '💻' },
  { id: 'work-life' as OrigamiStyle, name: t('styleWorkLife'), icon: '🏕️' },
  { id: 'triage' as OrigamiStyle, name: t('styleTriage'), icon: '🧹' },
]);

const allTabs = ref<chrome.tabs.Tab[]>([]);
const hasUndo = ref(false);

const loadingMessage = computed(() => {
  if (appState.value.status === 'analyzing') return t('analyzing');
  if (appState.value.status === 'executing') return t('executing');
  return '';
});

onMounted(async () => {
  // 初回状態取得
  const [state, tabs] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'GET_STATE' }),
    chrome.runtime.sendMessage({ type: 'GET_TABS' })
  ]);
  
  // ストレージから言語設定を取得して補完
  const { language } = await chrome.storage.local.get('language');
  appState.value = { 
    ...state, 
    language: language || state.language || (chrome.i18n.getUILanguage().startsWith('ja') ? 'ja' : 'en')
  };
  allTabs.value = tabs;

  const { lastSnapshot } = await chrome.storage.local.get('lastSnapshot');
  hasUndo.value = !!lastSnapshot;

  // 状態更新のリスナー
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATED') {
      appState.value = { ...message.state, language: appState.value.language };
    }
  });
});

const getTabTitle = (id: number | undefined) => {
  return allTabs.value.find(t => t.id === id)?.title || t('unknownTab');
};

const analyze = async (style: OrigamiStyle) => {
  await chrome.runtime.sendMessage({ type: 'ORGANIZE_TABS', style });
};

const cancel = async () => {
  await chrome.runtime.sendMessage({ type: 'CANCEL' });
};

const clearError = () => {
  appState.value.error = undefined;
  chrome.storage.local.set({ appState: appState.value });
};

const toggleTab = (gIdx: number, tIdx: number) => {
  // TODO: 選択解除の実装
};

const execute = async () => {
  await chrome.runtime.sendMessage({ type: 'EXECUTE_ORGANIZE', groups: appState.value.previewGroups });
  window.close();
};

const undo = async () => {
  appState.value.status = 'executing';
  try {
    await chrome.runtime.sendMessage({ type: 'UNDO' });
    allTabs.value = await chrome.runtime.sendMessage({ type: 'GET_TABS' });
    hasUndo.value = false;
  } catch (e) {
    alert('Undo failed.');
  } finally {
    appState.value.status = 'idle';
  }
};
</script>

<style scoped>
.container {
  color: #333;
  min-width: 320px;
  padding: 16px;
}
header h1 {
  font-size: 1.2rem;
  margin-bottom: 16px;
  text-align: center;
}
.description {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 16px;
}
.style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.style-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.1s;
}
.style-card:hover {
  transform: translateY(-2px);
  border-color: #aaa;
}
.style-card .icon {
  font-size: 1.5rem;
  margin-bottom: 8px;
}
.style-card .label {
  font-size: 0.8rem;
  font-weight: bold;
}
.loading {
  text-align: center;
  padding: 32px 0;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.btn-small {
  padding: 4px 12px;
  font-size: 0.75rem;
  margin-top: 12px;
}
.error-box {
  background: #fee;
  color: #c0392b;
  border: 1px solid #fab1a0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 0.85rem;
}
.preview-area h2 {
  font-size: 1rem;
  margin-bottom: 12px;
}
.group-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #eee;
}
.group-card h3 {
  font-size: 0.9rem;
  margin: 0 0 8px 0;
  color: #2c3e50;
}
.group-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.group-card li {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
button {
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-primary {
  background: #3498db;
  color: white;
}
.btn-secondary {
  background: #eee;
  color: #333;
}
.undo-section {
  margin-top: 24px;
  text-align: center;
}
.btn-undo {
  background: #f39c12;
  color: white;
  width: 100%;
}
</style>
