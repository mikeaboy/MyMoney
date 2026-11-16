<template>
  <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
    <!-- 標題與新增按鈕 -->
    <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/5">
      <div>
        <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
          <span>🏦 銀行現金存款</span>
          <span class="text-xs font-mono text-emerald-400">
            {{ store.formatMoney(store.bankSummary.totalTwd) }}
          </span>
        </div>
        <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
          預估年利息: +{{ store.formatMoney(store.bankSummary.annualInterestTwd) }} / 年
        </div>
      </div>
      <button
        @click="openAddModal"
        class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition flex items-center gap-1 shadow-sm"
      >
        <span>＋</span>
        <span>新增帳戶</span>
      </button>
    </div>

    <!-- 1. 手機版專屬：卡片清單模式 (md 隱藏) -->
    <div class="block md:hidden divide-y divide-white/5 mt-1">
      <div
        v-for="(item, idx) in store.bankAssets"
        :key="item.id || idx"
        class="py-3.5 space-y-2.5"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="font-bold text-white text-sm flex items-center gap-1.5">
              <span>{{ item.bankName }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                {{ item.accountType || '活存' }}
              </span>
            </div>
            <div class="text-xs text-zinc-400 font-mono mt-0.5">
              {{ store.formatMoney(item.balance, '', 2) }} {{ item.currency }}
              <span class="text-[11px] text-zinc-500 ml-1">({{ Number(item.interestRate || 0).toFixed(2) }}%)</span>
            </div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-base text-white">
              {{ store.formatMoney(store.convertToTwd(item.balance, item.currency)) }}
            </div>
            <div class="text-[10px] text-emerald-400 font-mono">
              +{{ store.formatMoney(store.convertToTwd(item.balance, item.currency) * ((item.interestRate || 0) / 100)) }} /年
            </div>
          </div>
        </div>

        <!-- 手機大按鈕操作區 -->
        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            @click="openEditModal(item, idx)"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition"
          >
            ✏️ 編輯
          </button>
          <button
            @click="removeBank(idx)"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
          >
            🗑️ 刪除
          </button>
        </div>
      </div>

      <div v-if="store.bankAssets.length === 0" class="py-8 text-center text-xs text-zinc-500">
        尚無銀行存款，點擊上方「新增帳戶」建立第一筆資產
      </div>
    </div>

    <!-- 2. 電腦版專屬：高密度完整表格 (md 顯示) -->
    <div class="hidden md:block overflow-x-auto mt-3">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-zinc-500 border-b border-white/5">
            <th class="py-2.5 px-3">銀行名稱 / 帳戶</th>
            <th class="py-2.5 px-3">幣別</th>
            <th class="py-2.5 px-3 text-right">帳戶餘額</th>
            <th class="py-2.5 px-3 text-right">年利率</th>
            <th class="py-2.5 px-3 text-right">預估年息</th>
            <th class="py-2.5 px-3 text-right">折合新台幣</th>
            <th class="py-2.5 px-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-zinc-300">
          <tr v-for="(item, idx) in store.bankAssets" :key="item.id || idx" class="hover:bg-white/[0.02]">
            <td class="py-3 px-3 font-medium text-white">
              {{ item.bankName }}
              <div class="text-[11px] text-zinc-500 font-normal">{{ item.accountType || '活期存款' }}</div>
            </td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded bg-white/5 font-mono text-zinc-300">
                {{ store.fxRates[item.currency]?.flag || '💰' }} {{ item.currency }}
              </span>
            </td>
            <td class="py-3 px-3 text-right font-mono font-semibold">
              {{ store.formatMoney(item.balance, '', 2) }}
            </td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              {{ Number(item.interestRate || 0).toFixed(2) }}%
            </td>
            <td class="py-3 px-3 text-right font-mono text-emerald-400 font-medium">
              +{{ store.formatMoney(store.convertToTwd(item.balance, item.currency) * ((item.interestRate || 0) / 100)) }}
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-white">
              {{ store.formatMoney(store.convertToTwd(item.balance, item.currency)) }}
            </td>
            <td class="py-3 px-3 text-center">
              <div class="inline-flex items-center gap-1.5">
                <button
                  @click="openEditModal(item, idx)"
                  class="px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition"
                >
                  編輯
                </button>
                <button
                  @click="removeBank(idx)"
                  class="px-2.5 py-1 text-[11px] text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                >
                  刪除
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="store.bankAssets.length === 0">
            <td colspan="7" class="py-8 text-center text-zinc-500">尚無銀行帳戶資料，點擊右上角新增</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      type="bank"
      :is-editing="isEditing"
      :edit-item="currentItem"
      :edit-index="currentIndex"
      @close="modalOpen = false"
      @save="handleSave"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useFinancialStore } from '../stores/useFinancialStore';
import AssetEditorModal from './AssetEditorModal.vue';

const store = useFinancialStore();

const modalOpen = ref(false);
const isEditing = ref(false);
const currentItem = ref(null);
const currentIndex = ref(-1);

function openAddModal() {
  const cache = store.lastInputCache?.bank || {};
  isEditing.value = false;
  currentItem.value = {
    bankName: cache.bankName || '國泰世華',
    accountType: cache.accountType || '活儲帳戶',
    currency: cache.currency || 'TWD',
    balance: '',
    interestRate: cache.interestRate || 1.5,
  };
  currentIndex.value = -1;
  modalOpen.value = true;
}

function openEditModal(item, index) {
  isEditing.value = true;
  currentItem.value = { ...item };
  currentIndex.value = index;
  modalOpen.value = true;
}

function handleSave({ isEditing: editing, index, data }) {
  const nowTs = Date.now();
  if (editing && index >= 0) {
    store.bankAssets[index] = { ...store.bankAssets[index], ...data, updatedAt: nowTs };
  } else if (data) {
    store.bankAssets.push({
      id: 'b_' + nowTs,
      ...data,
      updatedAt: nowTs,
    });
  }
  store.triggerAutoSave();
}

function removeBank(index) {
  if (confirm('確定要刪除此銀行帳戶紀錄嗎？')) {
    store.markRecordDeleted(store.bankAssets[index]);
    store.bankAssets.splice(index, 1);
    store.triggerAutoSave();
  }
}
</script>
