<template>
  <div class="container">
    <header>
      <h1>{{ t('title') }}</h1>
      <button @click="openOptions" class="btn-settings" :title="t('settings')">
        <Settings :size="20" />
      </button>
    </header>

    <!-- エラー表示 -->
    <div v-if="appState.error" class="error-box">
      <template v-if="appState.error === 'MISSING_API_KEY'">
        <h3>{{ t('missingApiKeyTitle') }}</h3>
        <p>{{ t('missingApiKeyDescription') }}</p>
        <div class="error-actions">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" class="link-external">Google AI Studio ↗</a>
          <button @click="openOptions" class="btn-primary btn-small">{{ t('settings') }}</button>
        </div>
      </template>
      <template v-else>
        <p>{{ appState.error }}</p>
        <button @click="clearError" class="btn-secondary">{{ t('close') }}</button>
      </template>
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
          <component :is="style.icon" class="icon" :size="28" />
          <span class="label">{{ style.name }}</span>
        </button>
      </div>
      <div v-if="hasUndo" class="undo-section">
        <button @click="undo" class="btn-undo">
          <RotateCcw :size="16" />
          {{ t('undo') }}
        </button>
      </div>
    </div>

    <!-- プレビュー -->
    <div v-else-if="appState.status === 'preview'" class="preview-area">
      <h2>{{ t('previewTitle') }}</h2>
      <div v-for="(group, gIdx) in appState.previewGroups" :key="gIdx" class="group-card">
        <h3>
          {{ group.groupName }}
          <span v-if="appState.style === 'triage' && group.groupName !== cleanupGroupName" class="keep-badge">
            {{ t('keepLabel') }}
          </span>
          <Trash2 v-if="appState.style === 'triage' && group.groupName === cleanupGroupName" :size="16" class="trash-icon" />
        </h3>
        <ul>
          <li v-for="(tabId, tIdx) in originalGroups[gIdx]?.tabIds" :key="tIdx">
            <label :class="{ 'no-checkbox': appState.style === 'triage' && group.groupName !== cleanupGroupName }">
              <input 
                v-if="!(appState.style === 'triage' && group.groupName !== cleanupGroupName)"
                type="checkbox" 
                :checked="isTabSelected(gIdx, tabId)" 
                @change="toggleTab(gIdx, tabId)"
              >
              <img v-if="getTabFavIcon(tabId)" :src="getTabFavIcon(tabId)" class="favicon" alt="">
              <FileText v-else :size="14" class="favicon-fallback" />
              <span class="tab-title">{{ getTabTitle(tabId) }}</span>
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
import { Settings, Sparkles, Layout, Workflow, Trash2, RotateCcw, FileText } from '@lucide/vue';
import { OrigamiStyle, AppState, OrigamiLanguage, ClassificationResult } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';

const appState = ref<AppState>({
  status: 'idle',
  previewGroups: [],
  language: 'ja',
});

// 元のグループ構成を保持（チェックボックスを外してもリストから消えないようにするため）
const originalGroups = ref<ClassificationResult[]>([]);

const t = (key: TranslationKey) => getTranslation(appState.value.language, key);

const styles = computed(() => [
  { id: 'auto' as OrigamiStyle, name: t('styleAuto'), icon: Sparkles },
  { id: 'task' as OrigamiStyle, name: t('styleTask'), icon: Layout },
  { id: 'work-life' as OrigamiStyle, name: t('styleWorkLife'), icon: Workflow },
  { id: 'triage' as OrigamiStyle, name: t('styleTriage'), icon: Trash2 },
]);

const allTabs = ref<chrome.tabs.Tab[]>([]);
const hasUndo = ref(false);

const loadingMessage = computed(() => {
  if (appState.value.status === 'analyzing') return t('analyzing');
  if (appState.value.status === 'executing') return t('executing');
  return '';
});

const cleanupGroupName = computed(() => getTranslation(appState.value.language, 'aiDanshari'));

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
  if (appState.value.status === 'preview') {
    originalGroups.value = JSON.parse(JSON.stringify(appState.value.previewGroups));
  }
  allTabs.value = tabs;

  const { lastSnapshot } = await chrome.storage.local.get('lastSnapshot');
  hasUndo.value = !!lastSnapshot;

  // 状態更新のリスナー
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATED') {
      appState.value = { ...message.state, language: appState.value.language };
      if (appState.value.status === 'preview' && originalGroups.value.length === 0) {
        originalGroups.value = JSON.parse(JSON.stringify(appState.value.previewGroups));
      } else if (appState.value.status === 'idle') {
        originalGroups.value = [];
      }
    }
  });
});

const getTabTitle = (id: number | undefined) => {
  return allTabs.value.find(t => t.id === id)?.title || t('unknownTab');
};

const getTabFavIcon = (id: number | undefined) => {
  return allTabs.value.find(t => t.id === id)?.favIconUrl;
};

const isTabSelected = (gIdx: number, tabId: number | undefined) => {
  return appState.value.previewGroups[gIdx]?.tabIds.includes(tabId);
};

const toggleTab = (gIdx: number, tabId: number | undefined) => {
  const group = appState.value.previewGroups[gIdx];
  if (!group) return;

  const index = group.tabIds.indexOf(tabId);
  if (index > -1) {
    group.tabIds.splice(index, 1);
  } else {
    group.tabIds.push(tabId);
  }
  // 状態を同期
  chrome.storage.local.set({ appState: appState.value });
};

const analyze = async (style: OrigamiStyle) => {
  await chrome.runtime.sendMessage({ type: 'ORGANIZE_TABS', style });
};

const openOptions = () => {
  chrome.runtime.openOptionsPage();
};

const cancel = async () => {
  await chrome.runtime.sendMessage({ type: 'CANCEL' });
};

const clearError = () => {
  appState.value.error = undefined;
  chrome.storage.local.set({ appState: appState.value });
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
  color: #1e293b;
  min-width: 320px;
  padding: 16px;
  background-color: #ffffff;
}
header {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  margin-bottom: 16px;
}
header h1 {
  font-size: 1.25rem;
  margin: 0;
  font-weight: 700;
  color: #0f172a;
}
.btn-settings {
  position: absolute;
  right: 0;
  background: transparent;
  padding: 4px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, transform 0.2s;
  border: none;
  cursor: pointer;
}
.btn-settings:hover {
  color: #1e293b;
  transform: rotate(30deg);
}
.description {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 20px;
  text-align: center;
  line-height: 1.5;
}
.style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.style-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.style-card:hover {
  transform: translateY(-2px);
  border-color: #3498db;
  background: #f0f9ff;
  color: #3498db;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
.style-card .icon {
  color: inherit;
}
.style-card .label {
  font-size: 0.85rem;
  font-weight: 600;
}
.loading {
  text-align: center;
  padding: 40px 0;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f1f5f9;
  border-top: 3px solid #3498db;
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
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fee2e2;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 0.85rem;
}
.error-box h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
}
.error-box p {
  margin: 0 0 12px 0;
  line-height: 1.4;
}
.error-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.link-external {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
}
.link-external:hover {
  text-decoration: underline;
}
.preview-area h2 {
  font-size: 1rem;
  margin-bottom: 12px;
  color: #0f172a;
}
.group-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
}
.group-card h3 {
  font-size: 0.9rem;
  margin: 0 0 8px 0;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}
.keep-badge {
  background: #ecfdf5;
  color: #10b981;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.trash-icon {
  color: #ef4444;
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
  margin-bottom: 6px;
  color: #475569;
}
.group-card li label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.group-card li label.no-checkbox {
  padding-left: 0;
  cursor: default;
}
.favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.favicon-fallback {
  color: #94a3b8;
  flex-shrink: 0;
}
.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
button {
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}
.btn-primary {
  background: #3498db;
  color: white;
}
.btn-primary:hover {
  background: #2980b9;
}
.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}
.btn-secondary:hover {
  background: #e2e8f0;
}
.undo-section {
  margin-top: 24px;
}
.btn-undo {
  background: #f59e0b;
  color: white;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
}
.btn-undo:hover {
  background: #d97706;
}
</style>
