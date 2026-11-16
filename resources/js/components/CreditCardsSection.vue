<template>
  <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
    <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/5">
      <div>
        <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
          <span>💳 信用卡帳單與分期</span>
          <span class="text-xs font-mono text-rose-400">
            -{{ store.formatMoney(store.creditCardSummary.totalCreditCardDebtTwd) }}
          </span>
        </div>
        <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
          本期應繳 {{ store.formatMoney(store.creditCardSummary.currentDueTotalTwd) }} · 剩餘未到期分期 {{ store.formatMoney(store.creditCardSummary.remainingInstallmentTotalTwd) }}
        </div>
      </div>
      <button
        @click="openAddModal"
        class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition flex items-center gap-1 shadow-sm"
      >
        <span>＋</span>
        <span>新增卡片</span>
      </button>
    </div>

    <!-- 1. 手機版專屬：卡片清單模式 (md 隱藏) -->
    <div class="block md:hidden divide-y divide-white/5 mt-1">
      <div
        v-for="(item, idx) in store.creditCardItems"
        :key="item.id || idx"
        class="py-3.5 space-y-2.5"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="font-bold text-white text-sm flex items-center gap-1.5">
              <span>{{ item.cardName }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                {{ item.bankName || '銀行' }}
              </span>
            </div>
            <div class="text-xs text-zinc-400 font-mono mt-0.5">
              扣款日: 每月 {{ item.payDay || '15' }} 號 · 剩餘分期 {{ store.formatMoney(item.remainingInstallmentAmount || 0) }}
            </div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-base text-rose-400">
              -{{ store.formatMoney(Number(item.currentDueAmount || 0) + Number(item.remainingInstallmentAmount || 0)) }}
            </div>
            <div class="text-[11px] font-mono text-zinc-400">
              本期應繳: {{ store.formatMoney(item.currentDueAmount || 0) }}
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
            @click="removeCard(idx)"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
          >
            🗑️ 刪除
          </button>
        </div>
      </div>

      <div v-if="store.creditCardItems.length === 0" class="py-8 text-center text-xs text-zinc-500">
        目前無信用卡負債紀錄，點擊右上角新增卡片
      </div>
    </div>

    <!-- 2. 電腦版專屬：完整表格 (md 顯示) -->
    <div class="hidden md:block overflow-x-auto mt-3">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-zinc-500 border-b border-white/5">
            <th class="py-2.5 px-3">發卡銀行 / 卡片名稱</th>
            <th class="py-2.5 px-3">每月自動扣款日</th>
            <th class="py-2.5 px-3 text-right">本期應繳帳單 (TWD)</th>
            <th class="py-2.5 px-3 text-right">剩餘未到期分期 (TWD)</th>
            <th class="py-2.5 px-3 text-right">合計卡費負債</th>
            <th class="py-2.5 px-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-zinc-300">
          <tr v-for="(item, idx) in store.creditCardItems" :key="item.id || idx" class="hover:bg-white/[0.02]">
            <td class="py-3 px-3 font-medium text-white">
              {{ item.cardName }}
              <div class="text-[11px] text-zinc-500 font-normal">{{ item.bankName || '發卡銀行' }}</div>
            </td>
            <td class="py-3 px-3 font-mono text-zinc-300">
              每月 {{ item.payDay || '15' }} 日
            </td>
            <td class="py-3 px-3 text-right font-mono font-semibold text-rose-400">
              {{ store.formatMoney(item.currentDueAmount || 0) }}
            </td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              {{ store.formatMoney(item.remainingInstallmentAmount || 0) }}
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-white">
              -{{ store.formatMoney(Number(item.currentDueAmount || 0) + Number(item.remainingInstallmentAmount || 0)) }}
            </td>
            <td class="py-3 px-3 text-center">
              <div class="inline-flex items-center gap-1.5">
                <button
                  @click="openEditModal(item, idx)"
                  class="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-lg border border-white/5 transition"
                >
                  編輯
                </button>
                <button
                  @click="removeCard(idx)"
                  class="px-2.5 py-1 text-xs text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 transition"
                >
                  刪除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="store.creditCardItems.length === 0" class="py-8 text-center text-xs text-zinc-500">
        目前無信用卡帳單或分期，點擊右上角新增
      </div>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      type="creditCard"
      :is-editing="isEditing"
      :edit-item="currentItem"
      :edit-index="currentIndex"
      @close="modalOpen = false"
      @save="modalOpen = false"
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
  currentItem.value = {
    bankName: '國泰世華',
    cardName: 'CUBE 卡',
    payDay: 15,
    currentDueAmount: '',
    remainingInstallmentAmount: '',
  };
  currentIndex.value = -1;
  isEditing.value = false;
  modalOpen.value = true;
}

function openEditModal(item, index) {
  currentItem.value = { ...item };
  currentIndex.value = index;
  isEditing.value = true;
  modalOpen.value = true;
}

function removeCard(index) {
  if (confirm('確定要刪除這張信用卡紀錄嗎？')) {
    store.markRecordDeleted(store.creditCardItems[index]);
    store.creditCardItems.splice(index, 1);
    store.triggerAutoSave();
  }
}
</script>

