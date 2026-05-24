<template>
  <div class="options-container">
    <h1>{{ t('optionsTitle') }}</h1>
    <section>
      <h2>{{ t('apiSettings') }}</h2>
      <p>{{ t('helpApiKey') }}</p>
      
      <div class="field">
        <label for="api-key">{{ t('apiKeyLabel') }}</label>
        <input 
          id="api-key" 
          v-model="apiKey" 
          type="password" 
          placeholder="AIza..."
        />
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
          <button @click="resetModel" class="btn-reset">{{ t('resetToDefault') }}</button>
        </div>
        <p class="hint">
          {{ language === 'ja' ? '推奨:' : 'Recommended:' }} 
          <code>gemini-2.5-flash</code>, <code>gemini-3.5-flash</code>, <code>gemini-flash-latest</code>, <code>gemini-2.5-flash-lite</code>, <code>gemini-3.1-flash-lite</code>, <code>gemini-flash-lite-latest</code>
        </p>
      </div>

      <div class="field">
        <label for="language">{{ t('languageLabel') }}</label>
        <select id="language" v-model="language">
          <option value="ja">日本語 (Japanese)</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="field checkbox-field">
        <label>
          <input type="checkbox" v-model="excludePinnedTabs" />
          {{ t('excludePinnedLabel') }}
        </label>
      </div>

      <div class="actions">
        <button @click="save" class="btn-save">{{ t('save') }}</button>
        <span v-if="saved" class="status-msg">{{ t('saved') }}</span>
      </div>

      <p class="help">
        <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { OrigamiLanguage } from '../types';
import { getTranslation, TranslationKey } from '../utils/translations';

const apiKey = ref('');
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
  background: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
h1 {
  margin-top: 0;
  font-size: 1.5rem;
  border-bottom: 2px solid #1abc9c;
  padding-bottom: 12px;
}
section {
  margin-top: 24px;
}
h2 {
  font-size: 1.1rem;
  color: #333;
}
.field {
  margin: 16px 0;
}
.input-group {
  display: flex;
  gap: 8px;
}
.input-group input {
  flex: 1;
}
.btn-reset {
  background: #f1f1f1;
  color: #666;
  border: 1px solid #ddd;
  padding: 0 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.btn-reset:hover {
  background: #e9e9e9;
}
.checkbox-field {
  display: flex;
  align-items: center;
}
.checkbox-field label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 0;
}
.checkbox-field input {
  width: auto;
  margin: 0;
}
label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}
input, select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
}
.hint {
  font-size: 0.75rem;
  color: #888;
  margin-top: 4px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-save {
  background: #1abc9c;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.status-msg {
  color: #27ae60;
  font-weight: bold;
}
.help {
  font-size: 0.85rem;
  color: #666;
  margin-top: 24px;
}
a {
  color: #3498db;
  text-decoration: none;
}
</style>
