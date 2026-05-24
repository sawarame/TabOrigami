<template>
  <div class="container">
    <header>
      <h1>🕊️ TabOrigami</h1>
    </header>

    <!-- エラー表示 -->
    <div v-if="appState.error" class="error-box">
      <p>{{ appState.error }}</p>
      <button @click="clearError" class="btn-secondary">閉じる</button>
    </div>

    <!-- 解析中・実行中 -->
    <div v-if="appState.status === 'analyzing' || appState.status === 'executing'" class="loading">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
      <button v-if="appState.status === 'analyzing'" @click="cancel" class="btn-secondary btn-small">キャンセル</button>
    </div>

    <!-- 初期状態 -->
    <div v-else-if="appState.status === 'idle'">
      <p class="description">折り方を選んで、タブを綺麗に整理しましょう。</p>
      <div class="style-grid">
        <button v-for="style in styles" :key="style.id" @click="analyze(style.id)" class="style-card">
          <span class="icon">{{ style.icon }}</span>
          <span class="label">{{ style.name }}</span>
        </button>
      </div>
      <div v-if="hasUndo" class="undo-section">
        <button @click="undo" class="btn-undo">直前の整理を元に戻す (Undo)</button>
      </div>
    </div>

    <!-- プレビュー -->
    <div v-else-if="appState.status === 'preview'" class="preview-area">
      <h2>整理のプレビュー</h2>
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
        <button @click="cancel" class="btn-secondary">キャンセル</button>
        <button @click="execute" class="btn-primary">実行する</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { OrigamiStyle, AppState } from '../types';

const styles = [
  { id: 'auto' as OrigamiStyle, name: 'おまかせ折り', icon: '✨' },
  { id: 'task' as OrigamiStyle, name: 'タスク集中折り', icon: '💻' },
  { id: 'work-life' as OrigamiStyle, name: 'オン・オフ折り', icon: '🏕️' },
  { id: 'triage' as OrigamiStyle, name: '断捨離折り', icon: '🧹' },
];

const appState = ref<AppState>({
  status: 'idle',
  previewGroups: [],
});

const allTabs = ref<chrome.tabs.Tab[]>([]);
const hasUndo = ref(false);

const loadingMessage = computed(() => {
  if (appState.value.status === 'analyzing') return 'AIがタブの内容を読み取っています...';
  if (appState.value.status === 'executing') return 'タブを整理しています...';
  return '';
});

onMounted(async () => {
  // 初回状態取得
  const [state, tabs] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'GET_STATE' }),
    chrome.runtime.sendMessage({ type: 'GET_TABS' })
  ]);
  appState.value = state;
  allTabs.value = tabs;

  const { lastSnapshot } = await chrome.storage.local.get('lastSnapshot');
  hasUndo.value = !!lastSnapshot;

  // 状態更新のリスナー
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATED') {
      appState.value = message.state;
      // 完了した場合は閉じるなどの処理（任意）
    }
  });
});

const getTabTitle = (id: number | undefined) => {
  return allTabs.value.find(t => t.id === id)?.title || '不明なタブ';
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
  // プレビューの個別調整は今後の課題（現状は全選択を前提とするが、
  // UI上はチェックボックスが表示されているため、可能であれば連動させたい）
  // ここではappState.previewGroupsを直接いじってBackgroundへ反映させる必要がある
};

const execute = async () => {
  await chrome.runtime.sendMessage({ type: 'EXECUTE_ORGANIZE', groups: appState.value.previewGroups });
  window.close();
};

const undo = async () => {
  appState.value.status = 'executing'; // 一時的にローディング表示
  try {
    await chrome.runtime.sendMessage({ type: 'UNDO' });
    allTabs.value = await chrome.runtime.sendMessage({ type: 'GET_TABS' });
    hasUndo.value = false;
  } catch (e) {
    alert('Undoに失敗しました。');
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
