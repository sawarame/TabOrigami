<template>
  <div class="options-container">
    <h1>🕊️ TabOrigami 設定</h1>
    <section>
      <h2>Gemini API 設定</h2>
      <p>この拡張機能を使用するには、Google AI Studio で取得した API キーが必要です。</p>
      
      <div class="field">
        <label for="api-key">Gemini API Key:</label>
        <input 
          id="api-key" 
          v-model="apiKey" 
          type="password" 
          placeholder="AIza..."
        />
      </div>

      <div class="field">
        <label for="model-name">使用するモデル名:</label>
        <input 
          id="model-name" 
          v-model="modelName" 
          type="text" 
          placeholder="gemini-flash-lite-latest"
        />
        <p class="hint">
          推奨: <code>gemini-flash-lite-latest</code>, <code>gemini-3.1-flash-lite</code>, <code>gemini-2.5-flash-lite</code>
        </p>
      </div>

      <div class="actions">
        <button @click="save" class="btn-save">保存</button>
        <span v-if="saved" class="status-msg">保存しました！</span>
      </div>

      <p class="help">
        APIキーをお持ちでない場合は、<a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a> で無料で作成できます。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const apiKey = ref('');
const modelName = ref('gemini-2.5-flash');
const saved = ref(false);

onMounted(async () => {
  const result = await chrome.storage.local.get(['geminiApiKey', 'geminiModelName']);
  if (typeof result.geminiApiKey === 'string') {
    apiKey.value = result.geminiApiKey;
  }
  if (typeof result.geminiModelName === 'string') {
    modelName.value = result.geminiModelName;
  }
});

const save = async () => {
  await chrome.storage.local.set({ 
    geminiApiKey: apiKey.value,
    geminiModelName: modelName.value
  });
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
label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}
input {
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
