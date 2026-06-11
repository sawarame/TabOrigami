<template>
  <div :class="['options-container', { 'is-popup': isPopup }]">
    <header class="options-header">
      <div class="header-left">
        <button v-if="isPopup" @click="emit('close')" class="btn-back" :title="t('back')">
          <ArrowLeft :size="20" />
        </button>
        <Settings v-else class="title-icon" :size="24" />
        <h1>{{ isPopup ? t('settings') : t('optionsTitle') }}</h1>
      </div>
      <div class="header-right">
        <a href="https://aistudio.google.com/app/apikey" target="_blank" class="header-link" title="Google AI Studio">
          AI Studio <ExternalLink :size="14" />
        </a>
        <button @click="save" class="btn-save" :disabled="!isDirty" :class="{ 'btn-saved': saved }">
          <Save v-if="!saved" :size="16" />
          <Check v-else :size="16" />
          {{ t('save') }}
        </button>
      </div>
    </header>
    <div class="options-content">
    <section>
      <h2>
        <Key class="section-icon" :size="20" />
        {{ t('apiSettings') }}
      </h2>
      <p class="section-desc">{{ t('helpApiKey') }}</p>
      
      <div class="field">
        <label for="api-key">{{ t('apiKeyLabel') }}</label>
        <div class="input-wrapper">
          <input 
            id="api-key" 
            v-model="apiKey" 
            :type="showApiKey ? 'text' : 'password'" 
            placeholder="AIza..."
          />
          <button @click="showApiKey = !showApiKey" class="btn-icon-only">
            <Eye v-if="!showApiKey" :size="18" />
            <EyeOff v-else :size="18" />
          </button>
        </div>
      </div>

      <div class="field">
        <label for="model-name">{{ t('modelLabel') }}</label>
        <div class="input-group">
          <input 
            id="model-name" 
            v-model="modelName" 
            type="text" 
            placeholder="gemini-3.1-flash-lite"
          />
          <button @click="resetModel" class="btn-reset">
            <RotateCcw :size="14" />
            {{ t('resetToDefault') }}
          </button>
        </div>
        <p class="hint">
          {{ originalState.language === 'ja' ? '推奨:' : 'Recommended:' }} 
          <code>gemini-2.5-flash</code>, <code>gemini-3.5-flash</code>, <code>gemini-flash-latest</code>
        </p>
      </div>

      <div class="field">
        <label for="language">{{ t('languageLabel') }}</label>
        <div class="select-wrapper">
          <Languages class="select-icon" :size="18" />
          <select id="language" v-model="language">
            <option value="ja">日本語 (Japanese)</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div class="field checkbox-field">
        <label>
          <input type="checkbox" v-model="excludePinnedTabs" />
          {{ t('excludePinnedLabel') }}
        </label>
      </div>

      <div class="field help-section">
        <a href="https://github.com/sawarame/TabOrigami/issues" target="_blank" class="help-link">
          <Bug :size="16" /> {{ t('reportBug') }} <ExternalLink :size="14" />
        </a>
      </div>

    </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Settings, Key, Eye, EyeOff, RotateCcw, Languages, Save, Check, ExternalLink, ArrowLeft, Bug } from '@lucide/vue';
import { OrigamiLanguage } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';

const props = defineProps({
  isPopup: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const apiKey = ref('');
const showApiKey = ref(false);
const modelName = ref('gemini-3.1-flash-lite');
const language = ref<OrigamiLanguage>('ja');
const excludePinnedTabs = ref(false);
const saved = ref(false);

const originalState = ref({
  apiKey: '',
  modelName: 'gemini-3.1-flash-lite',
  language: 'ja' as OrigamiLanguage,
  excludePinnedTabs: false
});

const isDirty = computed(() => {
  return apiKey.value !== originalState.value.apiKey ||
         modelName.value !== originalState.value.modelName ||
         language.value !== originalState.value.language ||
         excludePinnedTabs.value !== originalState.value.excludePinnedTabs;
});

const t = (key: TranslationKey) => getTranslation(originalState.value.language, key);

onMounted(async () => {
  const result = await chrome.storage.local.get(['geminiApiKey', 'geminiModelName', 'language', 'excludePinnedTabs']);
  if (typeof result.geminiApiKey === 'string') {
    apiKey.value = result.geminiApiKey;
  }
  if (typeof result.geminiModelName === 'string') {
    modelName.value = result.geminiModelName;
  }
  if (result.language) {
    language.value = result.language as OrigamiLanguage;
  } else {
    // デフォルト言語の判定
    const uiLang = chrome.i18n.getUILanguage();
    language.value = uiLang.startsWith('ja') ? 'ja' : 'en';
  }
  if (typeof result.excludePinnedTabs === 'boolean') {
    excludePinnedTabs.value = result.excludePinnedTabs;
  }
  
  updateOriginalState();
});

const updateOriginalState = () => {
  originalState.value = {
    apiKey: apiKey.value,
    modelName: modelName.value,
    language: language.value,
    excludePinnedTabs: excludePinnedTabs.value
  };
};

const resetModel = () => {
  modelName.value = 'gemini-3.1-flash-lite';
};

const save = async () => {
  if (!isDirty.value) return;

  await chrome.storage.local.set({ 
    geminiApiKey: apiKey.value,
    geminiModelName: modelName.value,
    language: language.value,
    excludePinnedTabs: excludePinnedTabs.value
  });
  
  updateOriginalState();
  
  // Backgroundの状態も更新
  const { appState } = await chrome.storage.local.get('appState');
  if (appState) {
    await chrome.storage.local.set({ appState: { ...appState, language: language.value } });
  }

  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 2000);
};
</script>

<style scoped>
.options-container {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  color: #1e293b;
  min-height: 100vh;
}
.options-content {
  padding: 32px 40px 40px;
}

/* ポップアップ表示用のスタイル上書き */
.options-container.is-popup {
  box-shadow: none;
  border-radius: 0;
  max-width: none;
  min-height: auto;
}
.options-header {
  position: sticky;
  top: 0;
  background-color: #ffffff;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 40px;
  border-bottom: 1px solid #e2e8f0;
}
.is-popup .options-header {
  padding: 16px;
}
.is-popup .options-content {
  padding: 16px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.options-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
}
.is-popup .options-header h1 {
  font-size: 1.1rem;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header-link {
  font-size: 0.8rem;
  color: #3498db;
  text-decoration: none;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.header-link:hover {
  text-decoration: underline;
}
.btn-saved {
  background-color: #10b981 !important;
}
.btn-saved:hover {
  background-color: #059669 !important;
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
  background-color: #f1f5f9;
  color: #1e293b;
}
.title-icon {
  color: #3498db;
}
section {
  margin-top: 32px;
}
h2 {
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  margin-bottom: 8px;
}
.section-icon {
  color: #64748b;
}
.section-desc {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 24px;
}
.field {
  margin-bottom: 24px;
}
label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  color: #475569;
}
.input-wrapper, .input-group, .select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
input, select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  background-color: #f8fafc;
}
input:focus, select:focus {
  outline: none;
  border-color: #3498db;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}
.btn-icon-only {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
}
.btn-icon-only:hover {
  color: #1e293b;
}
.btn-reset {
  margin-left: 12px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.btn-reset:hover {
  background: #e2e8f0;
}
.select-icon {
  position: absolute;
  left: 12px;
  color: #64748b;
  pointer-events: none;
  z-index: 1;
}
.select-wrapper select {
  padding-left: 40px;
}
.hint {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 8px;
}
.checkbox-field label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 500;
}
.checkbox-field input {
  width: auto;
  margin: 0;
}
.btn-save {
  background: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
  font-size: 0.85rem;
}
.btn-save:hover:not(:disabled) {
  background: #2980b9;
}
.btn-save:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  opacity: 0.7;
}
.help-section {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
  text-align: center;
}
.help-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}
.help-link:hover {
  color: #3498db;
  text-decoration: underline;
}
</style>
