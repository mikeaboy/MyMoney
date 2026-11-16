import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  // 徹底清除舊版不當殘留的快取
  localStorage.removeItem('mymoney_local_state');
  localStorage.removeItem('mymoney_gas_url');
  localStorage.removeItem('mymoney_sync_mode');

  const sessionKey = ref(localStorage.getItem('mymoney_session_key') || '');
  const currentUser = ref(JSON.parse(localStorage.getItem('mymoney_user') || 'null'));
  const accessToken = ref(localStorage.getItem('mymoney_gdrive_token') || '');
  const tokenExpiresAt = ref(Number(localStorage.getItem('mymoney_gdrive_token_exp') || 0));
  const driveFileId = ref(localStorage.getItem('mymoney_gdrive_file_id') || '');

  const isLoggedIn = computed(() => !!currentUser.value && !!currentUser.value.email);
  const hasValidDriveToken = computed(() => {
    return !!accessToken.value && Date.now() < tokenExpiresAt.value;
  });

  const syncStatus = ref('請連接 Google Drive 讀取雲端資料');
  const syncColor = ref('bg-amber-400');
  const lastDriveSyncTime = ref(localStorage.getItem('mymoney_last_drive_sync') || '');

  function updateDriveSyncTime() {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    lastDriveSyncTime.value = timeStr;
    localStorage.setItem('mymoney_last_drive_sync', timeStr);
  }

  function setDriveToken(token, expiresInSeconds = 3599) {
    accessToken.value = token;
    // 提前 60 秒視為即將到期
    const exp = Date.now() + (Number(expiresInSeconds) - 60) * 1000;
    tokenExpiresAt.value = exp;
    localStorage.setItem('mymoney_gdrive_token', token);
    localStorage.setItem('mymoney_gdrive_token_exp', String(exp));
  }

  function setDriveFileId(fileId) {
    driveFileId.value = fileId || '';
    if (fileId) {
      localStorage.setItem('mymoney_gdrive_file_id', fileId);
    } else {
      localStorage.removeItem('mymoney_gdrive_file_id');
    }
  }

  async function initSession() {
    if (!sessionKey.value) {
      sessionKey.value = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('mymoney_session_key', sessionKey.value);
    }
  }

  function setGoogleUser(user) {
    currentUser.value = {
      id: user.id || user.sub || '',
      email: user.email,
      name: user.name || user.email.split('@')[0],
      avatar: user.avatar || user.picture || '',
    };
    localStorage.setItem('mymoney_user', JSON.stringify(currentUser.value));
  }

  function logout() {
    if (accessToken.value && typeof google !== 'undefined' && google.accounts?.oauth2) {
      try {
        google.accounts.oauth2.revoke(accessToken.value, () => {});
      } catch (e) {}
    }
    currentUser.value = null;
    accessToken.value = '';
    tokenExpiresAt.value = 0;
    driveFileId.value = '';
    localStorage.removeItem('mymoney_user');
    localStorage.removeItem('mymoney_gdrive_token');
    localStorage.removeItem('mymoney_gdrive_token_exp');
    localStorage.removeItem('mymoney_gdrive_file_id');
    localStorage.removeItem('mymoney_local_state');
    localStorage.removeItem('mymoney_local_backup_v2');
    localStorage.removeItem('mymoney_pending_drive_sync');
    updateSyncStatus('🎭 訪客展示模式 (隨機假資料・不儲存)', 'bg-indigo-400');
  }

  function updateSyncStatus(text, colorClass) {
    syncStatus.value = text;
    syncColor.value = colorClass;
  }

  return {
    sessionKey,
    currentUser,
    accessToken,
    tokenExpiresAt,
    driveFileId,
    isLoggedIn,
    hasValidDriveToken,
    syncStatus,
    syncColor,
    lastDriveSyncTime,
    updateDriveSyncTime,
    setDriveToken,
    setDriveFileId,
    initSession,
    setGoogleUser,
    logout,
    updateSyncStatus,
  };
});
