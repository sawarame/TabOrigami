<template>
  <div class="container">
    <div v-show="currentView === 'main'" class="main-content">
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
      <p v-if="!appState.progress">{{ loadingMessage }}</p>
      
      <div v-if="appState.progress" class="progress-container">
        <p class="progress-message">{{ appState.progress.message }}</p>
        <div class="progress-bar-bg">
          <div 
            class="progress-bar-fill" 
            :class="{ 'ai-thinking': appState.progress.current === appState.progress.total }"
            :style="{ width: getProgressWidth(appState.progress) }"
          ></div>
        </div>
      </div>

      <button v-if="appState.status === 'analyzing' || appState.status === 'executing'" @click="cancel" class="btn-secondary btn-small">{{ t('cancel') }}</button>
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
      <div class="custom-prompt-section" style="margin-top: 24px;">
        <button @click="currentView = 'customPrompt'" class="history-toggle-btn">
          <h3>
            <FileText :size="16" />
            {{ t('customPromptBtn') }}
          </h3>
        </button>
      </div>

      <div v-if="tabHistory && tabHistory.length > 0" class="history-section" style="margin-top: 16px;">
        <button @click="currentView = 'history'" class="history-toggle-btn">
          <h3>
            <History :size="16" />
            {{ t('historyTitle') }}
          </h3>
        </button>
      </div>
    </div>

    <!-- プレビュー -->
    <div v-else-if="appState.status === 'preview'" class="preview-area" @click="closeColorDropdown">
      <h2>{{ t('previewTitle') }}</h2>

      <div v-if="hasNoDanshariTabs" class="empty-message">
        <p>{{ t('noDanshariTabs') }}</p>
      </div>
      <template v-else>
        <!--
          グループカードのループ。
          グループ全体もドロップゾーンとして機能させることで、
          空グループや末尾へのドロップに対応する。
        -->
        <div
          v-for="(group, gIdx) in appState.previewGroups"
        :key="gIdx"
        class="group-card"
        @dragover.prevent="onDragOverGroup($event, gIdx)"
        @dragleave="onDragLeaveGroup($event, gIdx)"
        @drop.prevent="onDropToGroup($event, gIdx)"
        :class="{ 'drop-target': dropTargetGroupIdx === gIdx && dropInsertTabIdx === null }"
      >
        <div class="group-header">
          <h3>
            <input 
              v-if="!isCleanupGroup(group)"
              type="text" 
              v-model="group.groupName" 
              class="group-name-input"
              @change="saveState"
            />
            <span v-else>{{ group.groupName }}</span>
            <Trash2 v-if="isCleanupGroup(group)" :size="16" class="trash-icon" />
          </h3>
          <div class="custom-color-select" v-if="!isCleanupGroup(group)">
            <div 
              class="selected-color" 
              :class="`color-${group.color || 'default'}`"
              @click.stop="toggleColorDropdown(gIdx)"
            >
              <span class="color-dot" :class="`bg-${group.color || 'default'}`"></span>
              {{ getColorLabel(group.color) }}
            </div>
            
            <ul v-if="activeColorDropdown === gIdx" class="color-dropdown-list">
              <li @click.stop="selectColor(gIdx, undefined)">
                <span class="color-dot bg-default"></span> {{ t('colorAuto') }}
              </li>
              <li v-for="c in colorOptions" :key="c.value" @click.stop="selectColor(gIdx, c.value as any)">
                <span class="color-dot" :class="`bg-${c.value}`"></span> {{ c.label }}
              </li>
            </ul>
          </div>
        </div>

        <ul>
          <!--
            各タブ行。ドラッグ元かつドロップ先として機能する。
            draggable="true" でHTML5 D&Dを有効化。
          -->
          <li
            v-for="(tabId, tIdx) in originalGroups[gIdx]?.tabIds"
            :key="tIdx"
            draggable="true"
            @dragstart="onDragStart($event, gIdx, tabId)"
            @dragover.prevent="onDragOverTab($event, gIdx, tIdx)"
            @dragleave="onDragLeaveTab($event, gIdx, tIdx)"
            @drop.prevent="onDropToTab($event, gIdx, tIdx)"
            @dragend="onDragEnd"
            :class="{
              'dragging': dragState.fromGroupIdx === gIdx && dragState.tabId === tabId,
              // 挿入位置インジケーター: 上半分ホバー→上ライン、下半分ホバー or リスト末尾→下ライン
              'insert-before': dropTargetGroupIdx === gIdx && dropInsertTabIdx === tIdx,
              'insert-after':
                dropTargetGroupIdx === gIdx &&
                dropInsertTabIdx === (originalGroups[gIdx]?.tabIds.length ?? 0) &&
                tIdx === (originalGroups[gIdx]?.tabIds.length ?? 0) - 1,
            }"
          >
            <!-- ドラッグハンドル（左端のグリップアイコン） -->
            <span class="drag-handle" :title="t('dragHint')">
              <GripVertical :size="14" />
            </span>

            <label>
              <input
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
      </template>

      <div class="actions">
        <button @click="cancel" class="btn-secondary">{{ t('cancel') }}</button>
        <button v-if="!hasNoDanshariTabs" @click="execute" class="btn-primary">{{ t('execute') }}</button>
      </div>
    </div>
    </div>
    
    <div v-if="currentView === 'history'" class="history-page">
      <header class="history-header">
        <button @click="currentView = 'main'" class="btn-back" :title="t('close')">
          <ArrowLeft :size="20" />
        </button>
        <h1>{{ t('historyTitle') }}</h1>
      </header>
      <div class="history-content">
        <ul class="history-list">
          <li v-for="item in tabHistory" :key="item.id" class="history-item">
            <div class="history-info-container">
              <span class="history-date">{{ formatDate(item.createdAt) }}</span>
              <span class="history-info">{{ getHistoryInfo(item) }}</span>
            </div>
            <button @click="undo(item.id)" class="btn-undo btn-small" :title="t('undo')">
              <RotateCcw :size="14" />
              {{ t('undo') }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="currentView === 'customPrompt'" class="history-page">
      <header class="history-header">
        <button @click="currentView = 'main'" class="btn-back" :title="t('close')">
          <ArrowLeft :size="20" />
        </button>
        <h1>{{ t('customPromptTitle') }}</h1>
      </header>
      <div class="history-content" style="padding: 16px;">
        <textarea 
          v-model="customPromptText" 
          :placeholder="t('customPromptPlaceholder')" 
          style="width: 100%; box-sizing: border-box; height: 120px; padding: 12px; border-radius: 8px; border: 1px solid #ccc; background: #fff; color: #333; resize: vertical; margin-bottom: 16px; font-family: inherit; font-size: 14px;"
        ></textarea>
        <div style="display: flex; align-items: center; gap: 16px;">
          <button @click="saveCustomPrompt" class="btn-primary" :class="{ 'btn-saved': showSavedMessage }" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background-color 0.2s;">
            <Save v-if="!showSavedMessage" :size="16" />
            <Check v-else :size="16" />
            {{ showSavedMessage ? t('saved') : t('save') }}
          </button>
        </div>
      </div>
    </div>
    
    <OptionsView v-if="currentView === 'options'" :isPopup="true" @close="currentView = 'main'" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { Settings, Sparkles, Layout, Workflow, Trash2, RotateCcw, FileText, GripVertical, ChevronDown, History, ArrowLeft, Save, Check } from '@lucide/vue';
import { OrigamiStyle, AppState, OrigamiLanguage, ClassificationResult, TabHistoryItem } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';
import OptionsView from '../options/Options.vue';

const currentView = ref<'main' | 'options' | 'history' | 'customPrompt'>('main');

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
const tabHistory = ref<TabHistoryItem[]>([]);
const customPromptText = ref('');
const showSavedMessage = ref(false);

const loadingMessage = computed(() => {
  if (appState.value.status === 'analyzing') return t('analyzing');
  if (appState.value.status === 'executing') return t('executing');
  return '';
});

// カスタムカラーピッカーの状態と選択肢
const activeColorDropdown = ref<number | null>(null);

const colorOptions = computed(() => [
  { value: 'grey', label: t('colorGrey') },
  { value: 'blue', label: t('colorBlue') },
  { value: 'red', label: t('colorRed') },
  { value: 'yellow', label: t('colorYellow') },
  { value: 'green', label: t('colorGreen') },
  { value: 'pink', label: t('colorPink') },
  { value: 'purple', label: t('colorPurple') },
  { value: 'cyan', label: t('colorCyan') },
  { value: 'orange', label: t('colorOrange') }
]);

const getColorLabel = (color: string | undefined) => {
  if (!color) return t('colorAuto');
  const option = colorOptions.value.find(o => o.value === color);
  return option ? option.label : t('colorAuto');
};

const toggleColorDropdown = (gIdx: number) => {
  if (activeColorDropdown.value === gIdx) {
    activeColorDropdown.value = null;
  } else {
    activeColorDropdown.value = gIdx;
  }
};

const selectColor = (gIdx: number, color: chrome.tabGroups.Color | undefined) => {
  const group = appState.value.previewGroups[gIdx];
  if (group) {
    group.color = color;
    saveState();
  }
  activeColorDropdown.value = null;
};

const closeColorDropdown = () => {
  activeColorDropdown.value = null;
};

const cleanupGroupName = computed(() => getTranslation(appState.value.language, 'aiDanshari'));

const isCleanupGroup = (group: ClassificationResult) => {
  return group.action === 'close' || (group.groupName && group.groupName.includes(cleanupGroupName.value));
};

const hasNoDanshariTabs = computed(() => {
  if (appState.value.style !== 'triage' || appState.value.status !== 'preview') return false;
  return appState.value.previewGroups.length === 0 || appState.value.previewGroups.every(g => g.tabIds.length === 0);
});

onMounted(async () => {
  // 初回状態取得
  const [state, tabs] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'GET_STATE' }),
    chrome.runtime.sendMessage({ type: 'GET_TABS' })
  ]);
  
  // ストレージから言語設定等を取得して補完
  const { language, customPrompt } = await chrome.storage.local.get(['language', 'customPrompt']);
  if (typeof customPrompt === 'string') {
    customPromptText.value = customPrompt;
  }
  appState.value = { 
    ...state, 
    language: language || state.language || (chrome.i18n.getUILanguage().startsWith('ja') ? 'ja' : 'en')
  };
  if (appState.value.status === 'preview') {
    originalGroups.value = JSON.parse(JSON.stringify(appState.value.previewGroups));
  }
  allTabs.value = tabs;

  const result = await chrome.storage.local.get(['tabHistory', 'lastSnapshot']);
  const historyData = result.tabHistory as TabHistoryItem[] | undefined;
  const lastSnapshot = result.lastSnapshot as any;

  if (historyData && Array.isArray(historyData) && historyData.length > 0) {
    tabHistory.value = historyData;
  } else if (lastSnapshot) {
    // 過去バージョンとの互換性
    tabHistory.value = [{
      id: 'legacy',
      createdAt: Date.now(),
      snapshot: lastSnapshot
    }];
  }

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

  // 設定の変更（言語設定など）を監視してリアルタイムに反映
  chrome.storage.onChanged.addListener(handleStorageChange);
});

// ストレージ変更イベントのハンドラ
const handleStorageChange = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => {
  if (areaName === 'local' && changes.language) {
    appState.value.language = changes.language.newValue as OrigamiLanguage;
  }
};

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChange);
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
  saveState();
};

const saveState = () => {
  // JSON.parse(JSON.stringify()) でディープクローンしてから保存する。
  // Vue の Proxy をそのまま渡すと配列がオブジェクト形式で保存されてしまうため。
  chrome.storage.local.set({ appState: JSON.parse(JSON.stringify(appState.value)) });
};

const analyze = async (style: OrigamiStyle) => {
  await chrome.runtime.sendMessage({ type: 'ORGANIZE_TABS', style });
};

const saveCustomPrompt = async () => {
  await chrome.storage.local.set({ customPrompt: customPromptText.value });
  showSavedMessage.value = true;
  setTimeout(() => {
    showSavedMessage.value = false;
  }, 2000);
};

const openOptions = () => {
  currentView.value = 'options';
};

const cancel = async () => {
  await chrome.runtime.sendMessage({ type: 'CANCEL' });
};

const clearError = () => {
  appState.value.error = undefined;
  saveState();
};

const execute = async () => {
  await chrome.runtime.sendMessage({ type: 'EXECUTE_ORGANIZE', groups: appState.value.previewGroups });
  window.close();
};

const undo = async (historyId?: string) => {
  appState.value.status = 'executing';
  try {
    await chrome.runtime.sendMessage({ type: 'UNDO', historyId });
    allTabs.value = await chrome.runtime.sendMessage({ type: 'GET_TABS' });
    const { tabHistory: updatedHistory } = await chrome.storage.local.get('tabHistory');
    tabHistory.value = (updatedHistory as TabHistoryItem[]) || [];
  } catch (e) {
    alert('Undo failed.');
  } finally {
    appState.value.status = 'idle';
  }
};

const formatDate = (timestamp: number) => {
  return new Intl.DateTimeFormat(appState.value.language === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
};

const getHistoryInfo = (item: TabHistoryItem) => {
  // 古い形式の互換性も考慮
  const tabCount = Array.isArray(item.snapshot) ? item.snapshot.length : (item.snapshot.tabs?.length || 0);
  return appState.value.language === 'ja' ? `${tabCount}個のタブ` : `${tabCount} tabs`;
};

const getProgressWidth = (progress: { current: number; total: number } | undefined) => {
  if (!progress || progress.total === 0) return '0%';
  if (progress.current === progress.total) {
    // AI考案中はCSSアニメーションで90%までじわじわ進める
    return '90%';
  }
  // タブ読み取りは一瞬なので、最大20%として扱う
  return `${(progress.current / progress.total) * 20}%`;
};

// ============================================================
// ドラッグ＆ドロップ関連
// ============================================================

/**
 * ドラッグ中のタブ情報を保持する状態オブジェクト。
 * fromGroupIdx: ドラッグ元のグループインデックス
 * tabId: ドラッグ中のタブID
 */
const dragState = ref<{
  fromGroupIdx: number | null;
  tabId: number | undefined | null;
}>({ fromGroupIdx: null, tabId: null });

/**
 * ドロップ先インジケーター用のインデックス。
 * dropTargetGroupIdx: インジケーター表示対象グループ
 * dropInsertTabIdx: 挿入位置インデックス（このインデックスのアイテム上にラインを表示）
 *   - 0〜length-1: 対応するアイテムの上に表示
 *   - length: リスト末尾（最後のアイテムの下）に表示
 *   - null: グループ全体ハイライト（グループ末尾ドロップ時）
 */
const dropTargetGroupIdx = ref<number | null>(null);
const dropInsertTabIdx = ref<number | null>(null);

/**
 * ドラッグ開始時のハンドラ。
 * dataTransfer に元グループインデックスとタブIDをセットする。
 * @param event - DragEvent
 * @param fromGroupIdx - ドラッグ元グループのインデックス
 * @param tabId - ドラッグするタブのID
 */
const onDragStart = (event: DragEvent, fromGroupIdx: number, tabId: number | undefined) => {
  dragState.value = { fromGroupIdx, tabId };
  event.dataTransfer?.setData('text/plain', JSON.stringify({ fromGroupIdx, tabId }));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
};

/**
 * タブ行上へのドラッグオーバーハンドラ（挿入位置インジケーターの更新）。
 * カーソルのY座標とアイテム中心を比較し、挿入インデックスを決定する。
 * @param event - DragEvent
 * @param gIdx - ドラッグオーバー中のグループインデックス
 * @param tIdx - ドラッグオーバー中のタブインデックス
 */
const onDragOverTab = (event: DragEvent, gIdx: number, tIdx: number) => {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dropTargetGroupIdx.value = gIdx;

  // アイテムの中心より上なら「このアイテムの前」、下なら「このアイテムの後」に挿入
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  dropInsertTabIdx.value = event.clientY < midY ? tIdx : tIdx + 1;
};

/**
 * タブ行からカーソルが外れたときのハンドラ（インジケーター解除）。
 * @param _event - DragEvent（未使用）
 * @param gIdx - 対象グループインデックス
 * @param _tIdx - 対象タブインデックス（未使用）
 */
const onDragLeaveTab = (_event: DragEvent, gIdx: number, _tIdx: number) => {
  if (dropTargetGroupIdx.value === gIdx) {
    dropInsertTabIdx.value = null;
  }
};

/**
 * グループカード全体へのドラッグオーバーハンドラ（グループ末尾へのドロップを受け付ける）。
 * タブ行上にいる場合は dropInsertTabIdx が設定されているため処理をスキップする。
 * @param event - DragEvent
 * @param gIdx - 対象グループインデックス
 */
const onDragOverGroup = (event: DragEvent, gIdx: number) => {
  if (dropInsertTabIdx.value !== null) return;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dropTargetGroupIdx.value = gIdx;
};

/**
 * グループカードからカーソルが外れたときのハンドラ。
 * relatedTarget がグループカードの子要素でなければインジケーターを解除する。
 * @param event - DragEvent
 * @param gIdx - 対象グループインデックス
 */
const onDragLeaveGroup = (event: DragEvent, gIdx: number) => {
  const relatedTarget = event.relatedTarget as Node | null;
  const currentTarget = event.currentTarget as HTMLElement;
  // relatedTarget がグループカード内の要素であればインジケーターを維持
  if (relatedTarget && currentTarget.contains(relatedTarget)) return;
  if (dropTargetGroupIdx.value === gIdx) {
    dropTargetGroupIdx.value = null;
    dropInsertTabIdx.value = null;
  }
};

/**
 * タブ行へのドロップハンドラ（グループ内並び替え・グループ間移動）。
 * dropInsertTabIdx で計算済みの挿入位置にタブを移動する。
 * @param _event - DragEvent（未使用）
 * @param toGroupIdx - ドロップ先グループインデックス
 * @param _tIdx - ホバー中のタブインデックス（未使用。挿入位置は dropInsertTabIdx を使用）
 */
const onDropToTab = (_event: DragEvent, toGroupIdx: number, _tIdx: number) => {
  const { fromGroupIdx, tabId } = dragState.value;
  if (fromGroupIdx === null || tabId === null || dropInsertTabIdx.value === null) return;
  moveTab(fromGroupIdx, tabId, toGroupIdx, dropInsertTabIdx.value);
  resetDragState();
};

/**
 * グループカードへのドロップハンドラ（グループの末尾に追加）。
 * タブ行上でドロップされた場合は onDropToTab が優先されるため、
 * このハンドラはグループの空白部分へのドロップ時に機能する。
 * @param _event - DragEvent（未使用）
 * @param toGroupIdx - ドロップ先グループインデックス
 */
const onDropToGroup = (_event: DragEvent, toGroupIdx: number) => {
  const { fromGroupIdx, tabId } = dragState.value;
  if (fromGroupIdx === null || tabId === null) return;
  // 末尾インデックスを指定して挿入
  const toTabIdx = originalGroups.value[toGroupIdx]?.tabIds.length ?? 0;
  moveTab(fromGroupIdx, tabId, toGroupIdx, toTabIdx);
  resetDragState();
};

/**
 * ドラッグ終了時のハンドラ（ドロップがキャンセルされた場合も含む）。
 */
const onDragEnd = () => {
  resetDragState();
};

/**
 * ドラッグ状態をリセットするヘルパー関数。
 */
const resetDragState = () => {
  dragState.value = { fromGroupIdx: null, tabId: null };
  dropTargetGroupIdx.value = null;
  dropInsertTabIdx.value = null;
};

/**
 * タブを別グループ・別位置に移動するコアロジック。
 * originalGroups と appState.previewGroups の両方を同期的に更新する。
 * @param fromGroupIdx - 移動元グループインデックス
 * @param tabId - 移動するタブID
 * @param toGroupIdx - 移動先グループインデックス
 * @param toTabIdx - 移動先のタブインデックス（挿入位置）
 */
const moveTab = (
  fromGroupIdx: number,
  tabId: number | undefined | null,
  toGroupIdx: number,
  toTabIdx: number
) => {
  if (tabId === null || tabId === undefined) return;

  const fromOrigGroup = originalGroups.value[fromGroupIdx];
  const toOrigGroup = originalGroups.value[toGroupIdx];
  if (!fromOrigGroup || !toOrigGroup) return;

  // --- originalGroups の更新 ---
  const fromOrigIdx = fromOrigGroup.tabIds.indexOf(tabId);
  if (fromOrigIdx === -1) return;
  fromOrigGroup.tabIds.splice(fromOrigIdx, 1);

  // 同一グループ内で元の位置より後ろに挿入する場合はインデックスを1つ戻す
  let insertIdx = toTabIdx;
  if (fromGroupIdx === toGroupIdx && fromOrigIdx < toTabIdx) {
    insertIdx--;
  }
  toOrigGroup.tabIds.splice(Math.max(0, insertIdx), 0, tabId);

  // --- appState.previewGroups の更新（チェックボックス状態の同期） ---
  const fromPreviewGroup = appState.value.previewGroups[fromGroupIdx];
  const toPreviewGroup = appState.value.previewGroups[toGroupIdx];
  if (fromPreviewGroup && toPreviewGroup) {
    const previewIdx = fromPreviewGroup.tabIds.indexOf(tabId);
    if (previewIdx > -1) {
      fromPreviewGroup.tabIds.splice(previewIdx, 1);
      let insertPreviewIdx = toTabIdx;
      if (fromGroupIdx === toGroupIdx && previewIdx < toTabIdx) {
        insertPreviewIdx--;
      }
      toPreviewGroup.tabIds.splice(Math.max(0, insertPreviewIdx), 0, tabId);
    }
  }

  // D&Dによる並び替え・グループ間移動は、Vueのリアクティブ状態のみを更新する。
  // chrome.storage.local には書き込まない。
  //   理由: Vue の Proxy オブジェクトをそのまま chrome.storage.local.set() に渡すと、
  //         配列がインデックスキーのオブジェクト形式 ({0: ..., 1: ...}) で保存されてしまい、
  //         tabIds.includes() が「is not a function」エラーになるため。
  //   実行時は execute() から EXECUTE_ORGANIZE メッセージで現在の previewGroups を
  //   バックグラウンドに渡すので、ストレージへの書き込みは不要。
};
</script>

<style scoped>
.container {
  color: #1e293b;
  min-width: 320px;
  background-color: #ffffff;
}
.main-content {
  padding: 16px;
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
.progress-container {
  margin-top: 16px;
  margin-bottom: 12px;
  text-align: left;
  width: 80%;
  margin-left: auto;
  margin-right: auto;
}
.progress-message {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 8px;
  text-align: center;
}
.progress-bar-bg {
  width: 100%;
  height: 8px;
  background-color: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background-color: #3498db;
  transition: width 0.2s ease-out;
}
.progress-bar-fill.ai-thinking {
  /* AI考案中は8秒かけて90%までゆっくり進める */
  transition: width 8s cubic-bezier(0.1, 0.7, 0.1, 1);
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
.empty-message {
  text-align: center;
  padding: 32px 16px;
  color: #64748b;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
  margin-bottom: 16px;
}
.empty-message p {
  margin: 0;
  font-size: 0.95rem;
}
.group-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
  transition: border-color 0.15s, background-color 0.15s;
}
/* グループ全体へのドロップハイライト */
.group-card.drop-target {
  border-color: #3498db;
  background-color: #f0f9ff;
}
.trash-icon {
  color: #ef4444;
}
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.group-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.group-name-input {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  padding: 2px 4px;
  margin-left: -4px;
  transition: all 0.2s;
  width: 100%;
  font-family: inherit;
}
.group-name-input:hover {
  background: #f1f5f9;
}
.group-name-input:focus {
  outline: none;
  border-color: #3498db;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}
.custom-color-select {
  position: relative;
  font-size: 0.75rem;
}
.selected-color {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background-color: #fff;
  color: #334155;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}
.selected-color:hover {
  background-color: #f8fafc;
}
.color-dropdown-list {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  margin-bottom: 0;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px 0 !important;
  list-style: none;
  min-width: 140px;
  z-index: 50;
}
.color-dropdown-list li {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #475569;
  margin-bottom: 0 !important;
}
.color-dropdown-list li:hover {
  background-color: #f1f5f9;
}
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
  flex-shrink: 0;
}
.bg-default { background-color: #cbd5e1; }
.bg-grey { background-color: #94a3b8; }
.bg-blue { background-color: #3b82f6; }
.bg-red { background-color: #ef4444; }
.bg-yellow { background-color: #eab308; }
.bg-green { background-color: #22c55e; }
.bg-pink { background-color: #ec4899; }
.bg-purple { background-color: #a855f7; }
.bg-cyan { background-color: #06b6d4; }
.bg-orange { background-color: #f97316; }

.selected-color.color-grey { background-color: #f1f5f9; border-color: #e2e8f0; }
.selected-color.color-blue { background-color: #e0f2fe; color: #0284c7; border-color: #bae6fd; }
.selected-color.color-red { background-color: #fee2e2; color: #dc2626; border-color: #fecaca; }
.selected-color.color-yellow { background-color: #fef9c3; color: #ca8a04; border-color: #fef08a; }
.selected-color.color-green { background-color: #dcfce7; color: #16a34a; border-color: #bbf7d0; }
.selected-color.color-pink { background-color: #fce7f3; color: #db2777; border-color: #fbcfe8; }
.selected-color.color-purple { background-color: #f3e8ff; color: #9333ea; border-color: #e9d5ff; }
.selected-color.color-cyan { background-color: #cffafe; color: #0891b2; border-color: #a5f3fc; }
.selected-color.color-orange { background-color: #ffedd5; color: #ea580c; border-color: #fed7aa; }
.group-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.group-card li {
  font-size: 0.8rem;
  margin-bottom: 4px;
  color: #475569;
  border-radius: 4px;
  display: flex;
  align-items: center;
  /* 挿入インジケーターのために position: relative を設定 */
  position: relative;
  transition: opacity 0.15s;
}
/* ドラッグ中のアイテムを半透明表示 */
.group-card li.dragging {
  opacity: 0.4;
}
/* 挿入位置インジケーター（アイテムの上）*/
.group-card li.insert-before::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 20px; /* ドラッグハンドルの幅分オフセット */
  right: 0;
  height: 2px;
  background-color: #3498db;
  border-radius: 1px;
  pointer-events: none;
}
/* 挿入位置インジケーター（リスト末尾：アイテムの下）*/
.group-card li.insert-after::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 20px; /* ドラッグハンドルの幅分オフセット */
  right: 0;
  height: 2px;
  background-color: #3498db;
  border-radius: 1px;
  pointer-events: none;
}
.group-card li label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
  /* テキストのはみ出しを防ぐ */
  overflow: hidden;
}

.group-card li label.no-checkbox {
  cursor: default;
}
/* ドラッグハンドル（左端のグリップアイコン） */
.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  padding: 2px 0;
  color: #cbd5e1;
  cursor: grab;
  transition: color 0.15s;
}
/* ホバー時にハンドルを強調してドラッグ可能であることを示す */
.group-card li:hover .drag-handle {
  color: #94a3b8;
}
.drag-handle:active {
  cursor: grabbing;
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
.btn-saved {
  background-color: #10b981 !important;
  color: white !important;
}
.btn-saved:hover {
  background-color: #059669 !important;
}
.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}
.btn-secondary:hover {
  background: #e2e8f0;
}
.history-section {
  margin-top: 24px;
}
.history-toggle-btn {
  background: none;
  border: none;
  width: 100%;
  cursor: pointer;
  padding: 8px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 4px;
}
.history-toggle-btn h3 {
  font-size: 0.9rem;
  color: #475569;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.history-toggle-btn:hover h3 {
  color: #334155;
}
.history-toggle-btn h3 > svg {
  transition: transform 0.2s ease-in-out;
}
.rotate-180 {
  transform: rotate(180deg);
}
.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
}
.history-info-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.history-date {
  font-size: 0.75rem;
  color: #64748b;
}
.history-info {
  font-size: 0.85rem;
  color: #1e293b;
  font-weight: 500;
}
.btn-undo {
  background: #f59e0b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  padding: 6px 12px;
  margin-top: 0;
}
.btn-undo:hover {
  background: #d97706;
}
.btn-back {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  margin-left: -8px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s, color 0.2s;
}
.btn-back:hover {
  background: #f1f5f9;
  color: #1e293b;
}
.history-page {
  display: flex;
  flex-direction: column;
}
.history-header {
  position: sticky;
  top: 0;
  background-color: #ffffff;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}
.history-header h1 {
  margin: 0;
  font-size: 1.25rem;
  color: #1e293b;
}
.history-content {
  display: flex;
  flex-direction: column;
  padding: 16px;
}
</style>
