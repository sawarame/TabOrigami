<template>
  <div class="options-container">
    <h1>
      <Settings class="title-icon" :size="24" />
      {{ t('optionsTitle') }}
    </h1>
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
          {{ language === 'ja' ? '推奨:' : 'Recommended:' }} 
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

      <div class="actions">
        <button @click="save" class="btn-save">
          <Save :size="18" />
          {{ t('save') }}
        </button>
        <span v-if="saved" class="status-msg">
          <Check :size="18" />
          {{ t('saved') }}
        </span>
      </div>

      <p class="help">
        <ExternalLink :size="14" />
        <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Settings, Key, Eye, EyeOff, RotateCcw, Languages, Save, Check, ExternalLink } from '@lucide/vue';
import { OrigamiLanguage } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';

const apiKey = ref('');
const showApiKey = ref(false);
const modelName = ref('gemini-3.1-flash-lite');
const language = ref<OrigamiLanguage>('ja');
const excludePinnedTabs = ref(false);
const saved = ref(false);

const t = (key: TranslationKey) => getTranslation(language.value, key);

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
});

const resetModel = () => {
  modelName.value = 'gemini-3.1-flash-lite';
};

const save = async () => {
  await chrome.storage.local.set({ 
    geminiApiKey: apiKey.value,
    geminiModelName: modelName.value,
    language: language.value,
    excludePinnedTabs: excludePinnedTabs.value
  });
  
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
  margin: 40px auto;
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  color: #1e293b;
}
h1 {
  margin-top: 0;
  font-size: 1.75rem;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 20px;
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
.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}
.btn-save {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}
.btn-save:hover {
  background: #2980b9;
}
.status-msg {
  color: #10b981;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}
.help {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.help a {
  color: #3498db;
  text-decoration: none;
}
.help a:hover {
  text-decoration: underline;
}
</style>
