<template>
  <header class="sticky top-0 z-30 bg-[#0c0e12]/95 backdrop-blur-md border-b border-white/5 px-3 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
    <!-- 左側系統識別 -->
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-black shadow-lg shadow-emerald-500/20 text-xs sm:text-sm shrink-0">
        💰
      </div>
      <div>
        <h1 class="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5 sm:gap-2">
          <span>資產帳務</span>
          <span class="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            Google Drive 直存
          </span>
        </h1>
        <div class="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5">
          <span class="inline-block w-1.5 h-1.5 rounded-full shrink-0" :class="authStore.syncColor"></span>
          <span class="truncate max-w-[145px] sm:max-w-none">{{ authStore.syncStatus }}</span>
        </div>
      </div>
    </div>

    <!-- 右側功能群組 -->
    <div class="flex items-center gap-1.5 sm:gap-2.5">
      <!-- PWA 一鍵安裝按鈕 (支援 beforeinstallprompt 時直接顯示於頂欄) -->
      <button
        v-if="deferredInstallPrompt && !isStandaloneApp"
        type="button"
        @click="handleInstallPwa"
        class="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1"
        title="將資產帳務安裝為獨立桌面 App"
      >
        <span>📲</span>
        <span class="hidden sm:inline">安裝 App</span>
      </button>

      <!-- 隱藏金額開關 -->
      <button
        type="button"
        @click="store.hideAmounts = !store.hideAmounts; store.triggerAutoSave()"
        class="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 hover:bg-white/5 transition flex items-center gap-1"
        :class="store.hideAmounts ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-zinc-300'"
      >
        <span>{{ store.hideAmounts ? '👁️' : '🙈' }}</span>
        <span class="hidden sm:inline">{{ store.hideAmounts ? '顯示金額' : '隱藏金額' }}</span>
      </button>

      <!-- 匯出與備份選單 -->
      <div class="relative">
        <button
          type="button"
          @click="showBackupMenu = !showBackupMenu"
          class="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 hover:bg-white/5 text-zinc-300 transition flex items-center gap-1"
          title="匯出試算表或雲端同步"
        >
          <span>☁️</span>
          <span class="hidden sm:inline">雲端/備份</span>
        </button>

        <!-- 下拉選單 -->
        <div
          v-if="showBackupMenu"
          class="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-[#161922] border border-white/10 shadow-2xl py-1.5 z-50 text-xs text-zinc-300 divide-y divide-white/5"
        >
          <div class="p-1">
            <button
              v-if="!isStandaloneApp"
              @click="handleInstallPwa(); showBackupMenu = false"
              class="w-full text-left px-3 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200 transition flex items-center gap-2 font-semibold mb-1"
            >
              <span>📲</span>
              <span>安裝 App 到手機/電腦桌面</span>
            </button>
            <button
              @click="handleManualDriveSync(); showBackupMenu = false"
              class="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition flex items-center gap-2 font-medium"
            >
              <span>☁️</span>
              <span>立即寫入 Google Drive</span>
            </button>
            <button
              @click="handleManualDriveReload(); showBackupMenu = false"
              class="w-full text-left px-3 py-2 rounded-xl hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 transition flex items-center gap-2"
            >
              <span>🔄</span>
              <span>從 Google Drive 重新讀取</span>
            </button>
            <button
              @click="store.exportToCsv(); showBackupMenu = false"
              class="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 hover:text-white transition flex items-center gap-2"
            >
              <span>📊</span>
              <span>匯出 Excel / CSV</span>
            </button>
            <button
              @click="store.exportBackupJson(); showBackupMenu = false"
              class="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 hover:text-white transition flex items-center gap-2"
            >
              <span>💾</span>
              <span>下載 JSON 備份檔</span>
            </button>
          </div>
          <div class="p-1">
            <label class="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 hover:text-white transition flex items-center gap-2 cursor-pointer">
              <span>📤</span>
              <span>匯入 JSON 備份檔</span>
              <input type="file" accept=".json" class="hidden" @change="handleFileImport" />
            </label>
            <button
              @click="handleClearAllData(); showBackupMenu = false"
              class="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition flex items-center gap-2 mt-0.5"
            >
              <span>🗑️</span>
              <span>清空本地與雲端資料</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 壓力測試開關 (模擬寬限期結束) -->
      <button
        type="button"
        @click="store.stressTestMode = !store.stressTestMode"
        class="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1"
        :class="store.stressTestMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'border-white/10 text-zinc-400 hover:bg-white/5'"
        :title="store.stressTestMode ? '關閉壓力測試' : '模擬寬限期結束還款負擔'"
      >
        <span>🔥</span>
        <span class="hidden md:inline">寬限期壓力測試</span>
      </button>

      <!-- 尚未授權 Google Drive 時顯示「連接 Google Drive」按鈕 -->
      <button
        v-if="!authStore.hasValidDriveToken"
        type="button"
        @click="connectGoogleDrive"
        class="min-h-[38px] px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-lg shadow-emerald-500/20 hover:brightness-110 transition flex items-center gap-1.5"
      >
        <span>🔐</span>
        <span>{{ authStore.isLoggedIn ? '重新授權 Drive' : '連接 Google Drive' }}</span>
      </button>

      <!-- 已連接 Google Drive 狀態顯示卡片 -->
      <div v-if="authStore.hasValidDriveToken && authStore.isLoggedIn" class="flex items-center gap-1.5 sm:gap-2 bg-white/5 border border-emerald-500/30 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 shadow-sm">
        <img
          v-if="authStore.currentUser.avatar"
          :src="authStore.currentUser.avatar"
          class="w-6 h-6 rounded-full object-cover border border-emerald-400/40 shrink-0"
          alt="Avatar"
        />
        <div class="text-left hidden sm:block">
          <div class="text-xs font-semibold text-white leading-tight truncate max-w-[100px]">{{ authStore.currentUser.name }}</div>
          <div class="text-[10px] text-emerald-400 font-mono truncate max-w-[110px]">Drive 已連線</div>
        </div>
        <button
          @click="handleLogout"
          class="text-xs text-zinc-400 hover:text-rose-400 px-1.5 py-1 rounded hover:bg-white/5 transition"
        >
          登出
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useFinancialStore } from '../stores/useFinancialStore';
import { useAuthStore } from '../stores/useAuthStore';

const store = useFinancialStore();
const authStore = useAuthStore();
const showBackupMenu = ref(false);
const deferredInstallPrompt = ref(null);
const isStandaloneApp = ref(false);

async function handleInstallPwa() {
  if (deferredInstallPrompt.value) {
    deferredInstallPrompt.value.prompt();
    const { outcome } = await deferredInstallPrompt.value.userChoice;
    if (outcome === 'accepted') {
      deferredInstallPrompt.value = null;
    }
    return;
  }
  alert('📲 安裝至主畫面步驟：\n\n• Android (Chrome)：點擊瀏覽器右上角「⋮」選單 ➔ 點選「安裝應用程式」或「加到主畫面」。\n• iPhone (Safari)：點擊底部中間「分享 (⬆️)」按鈕 ➔ 往下滑點選「加入主畫面」。');
}

const GOOGLE_CLIENT_ID = '85808055000-dre50fq2k1esers9l3396s6lp5tidltl.apps.googleusercontent.com';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly openid email profile';

let tokenClient = null;

async function handleManualDriveSync() {
  if (!authStore.hasValidDriveToken) {
    connectGoogleDrive();
    return;
  }
  const ok = await store.saveState();
  if (ok) {
    alert('已成功寫入您的 Google Drive (private_wealth_manager_data.json)！');
  } else {
    alert('Google Drive 寫入失敗，請確認授權狀態。');
  }
}

async function handleManualDriveReload() {
  if (!authStore.hasValidDriveToken) {
    connectGoogleDrive();
    return;
  }
  await store.loadState();
}

async function handleClearAllData() {
  if (confirm('⚠️ 確定要徹底清空「本機備份」與「Google Drive 雲端」上的所有資料嗎？此操作無法復原。')) {
    await store.clearAllLocalAndCloudData();
    alert('已清空本地與雲端所有資料！');
  }
}

function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result;
    if (typeof content === 'string') {
      const res = store.importBackupJson(content);
      if (res.success) {
        alert('備份匯入成功！正在同步寫入您的 Google Drive...');
      } else {
        alert('匯入失敗：' + res.error);
      }
    }
  };
  reader.readAsText(file);
  showBackupMenu.value = false;
}

async function handleTokenResponse(tokenResponse) {
  if (!tokenResponse || tokenResponse.error) {
    console.error('Google OAuth Token 取得失敗:', tokenResponse);
    authStore.updateSyncStatus('Google Drive 授權取消或失敗', 'bg-rose-500');
    return;
  }

  const accessToken = tokenResponse.access_token;
  const expiresIn = tokenResponse.expires_in || 3599;
  authStore.setDriveToken(accessToken, expiresIn);

  // 透過 Google 官方 UserInfo API 取得目前登入者資訊
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userRes.ok) {
      const profile = await userRes.json();
      authStore.setGoogleUser({
        id: profile.sub,
        email: profile.email,
        name: profile.name || profile.given_name || profile.email,
        picture: profile.picture || '',
      });
    } else if (!authStore.isLoggedIn) {
      authStore.setGoogleUser({ id: 'gdrive_user', email: 'Google Drive 使用者', name: 'Google 使用者' });
    }
  } catch (e) {
    console.warn('讀取 Google UserInfo 失敗:', e);
    if (!authStore.isLoggedIn) {
      authStore.setGoogleUser({ id: 'gdrive_user', email: 'Google Drive 使用者', name: 'Google 使用者' });
    }
  }

  // 立即從使用者的 Google Drive 載入 private_wealth_manager_data.json
  await store.loadState();
}

function initGoogleDriveOAuth() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    setTimeout(initGoogleDriveOAuth, 300);
    return;
  }

  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPES,
      callback: handleTokenResponse,
    });
  } catch (err) {
    console.error('初始化 Google OAuth2 TokenClient 失敗:', err);
  }
}

function connectGoogleDrive() {
  if (!tokenClient) {
    initGoogleDriveOAuth();
    setTimeout(() => {
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: '' });
      } else {
        alert('Google 授權元件載入中，請稍候再試。');
      }
    }, 400);
    return;
  }
  // 若已有記住的使用者 email，帶入 hint 加速授權
  const hint = authStore.currentUser?.email || '';
  tokenClient.requestAccessToken({
    hint,
    prompt: '',
  });
}

function handleLogout() {
  authStore.logout();
  store.loadState();
}

onMounted(() => {
  initGoogleDriveOAuth();
  if (typeof window !== 'undefined') {
    isStandaloneApp.value = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt.value = e;
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt.value = null;
      isStandaloneApp.value = true;
    });
  }
});
</script>
