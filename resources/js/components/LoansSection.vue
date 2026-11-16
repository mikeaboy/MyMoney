<template>
  <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
    <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/5">
      <div>
        <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
          <span>📉 貸款負債與月付</span>
          <span class="text-xs font-mono text-rose-400">
            -{{ store.formatMoney(store.loanSummary.totalDebtTwd) }}
          </span>
        </div>
        <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
          <span>月還款: {{ store.formatMoney(store.loanSummary.monthlyPaymentTwd) }} /月</span>
          <span v-if="store.stressTestMode" class="text-rose-400 font-semibold">(壓力測試中)</span>
        </div>
      </div>
      <button
        @click="openAddModal"
        class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition flex items-center gap-1 shadow-sm"
      >
        <span>＋</span>
        <span>新增貸款</span>
      </button>
    </div>

    <!-- 1. 手機版專屬：卡片清單模式 (md 隱藏) -->
    <div class="block md:hidden divide-y divide-white/5 mt-1">
      <div
        v-for="(item, idx) in store.loanItems"
        :key="item.id || idx"
        class="py-3.5 space-y-2.5"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="font-bold text-white text-sm flex items-center gap-1.5">
              <span>{{ item.loanName }}</span>
              <span
                class="text-[9px] px-1.5 py-0.5 rounded font-mono"
                :class="store.calculateLoanDetail(item).isCurrentlyInGrace ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-zinc-400'"
              >
                {{ store.calculateLoanDetail(item).isCurrentlyInGrace ? '寬限期中' : '正常攤還' }}
              </span>
            </div>
            <div class="text-xs text-zinc-400 font-mono mt-0.5">
              年利率 {{ Number(item.interestRate || 0).toFixed(2) }}% · {{ item.totalMonths }}期
            </div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-base text-rose-400">
              -{{ store.formatMoney(item.principal) }}
            </div>
            <div class="text-[11px] font-mono text-white font-semibold">
              月繳 {{ store.formatMoney(store.calculateLoanDetail(item).effectiveMonthlyPay) }}
              <span v-if="store.calculateLoanDetail(item).isCustomGracePay" class="text-[9px] text-emerald-400 block">(自訂)</span>
            </div>
          </div>
        </div>

        <div class="text-[11px] text-zinc-500 flex items-center justify-between bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/5">
          <span>寬限期後月繳: <strong class="text-amber-400 font-mono">{{ store.formatMoney(store.calculateLoanDetail(item).postGraceMonthlyPay) }}</strong></span>
          <span>寬限期: {{ item.gracePeriodMonths || 0 }} 月</span>
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
            @click="removeLoan(idx)"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
          >
            🗑️ 刪除
          </button>
        </div>
      </div>

      <div v-if="store.loanItems.length === 0" class="py-8 text-center text-xs text-zinc-500">
        目前無任何貸款負債項目 🎉
      </div>
    </div>

    <!-- 2. 電腦版專屬：完整表格 (md 顯示) -->
    <div class="hidden md:block overflow-x-auto mt-3">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-zinc-500 border-b border-white/5">
            <th class="py-2.5 px-3">貸款名稱</th>
            <th class="py-2.5 px-3 text-right">剩餘貸款本金</th>
            <th class="py-2.5 px-3 text-right">年利率</th>
            <th class="py-2.5 px-3 text-right">總期數 / 寬限期</th>
            <th class="py-2.5 px-3 text-right">寬限期內月繳</th>
            <th class="py-2.5 px-3 text-right">寬限期後月繳</th>
            <th class="py-2.5 px-3 text-right">目前每月應付</th>
            <th class="py-2.5 px-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-zinc-300">
          <tr v-for="(item, idx) in store.loanItems" :key="item.id || idx" class="hover:bg-white/[0.02]">
            <td class="py-3 px-3 font-medium text-white">
              {{ item.loanName }}
              <div v-if="store.calculateLoanDetail(item).isCurrentlyInGrace" class="text-[10px] text-emerald-400">
                ● 寬限期履約中
              </div>
              <div v-else class="text-[10px] text-zinc-500">
                ● 本息正常攤還中
              </div>
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-rose-400">
              -{{ store.formatMoney(item.principal) }}
            </td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              {{ Number(item.interestRate || 0).toFixed(2) }}%
            </td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              {{ item.totalMonths }} 期 / {{ item.gracePeriodMonths || 0 }} 月
            </td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              {{ store.formatMoney(store.calculateLoanDetail(item).graceMonthlyPay) }}
              <div v-if="store.calculateLoanDetail(item).isCustomGracePay" class="text-[10px] text-emerald-400 font-sans">
                (自訂金額)
              </div>
            </td>
            <td class="py-3 px-3 text-right font-mono text-amber-400 font-medium">
              {{ store.formatMoney(store.calculateLoanDetail(item).postGraceMonthlyPay) }}
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-white">
              {{ store.formatMoney(store.calculateLoanDetail(item).effectiveMonthlyPay) }}
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
                  @click="removeLoan(idx)"
                  class="px-2.5 py-1 text-[11px] text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                >
                  刪除
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="store.loanItems.length === 0">
            <td colspan="8" class="py-8 text-center text-zinc-500">目前無任何貸款負債項目 🎉</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      type="loan"
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
  isEditing.value = false;
  currentItem.value = {
    loanName: '',
    principal: 5000000,
    interestRate: 2.15,
    totalMonths: 360,
    gracePeriodMonths: 36,
    customGraceMonthlyPay: '',
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
    store.loanItems[index] = { ...store.loanItems[index], ...data, updatedAt: nowTs };
  } else if (data) {
    store.loanItems.push({
      id: 'l_' + nowTs,
      ...data,
      remainingMonths: data.totalMonths,
      updatedAt: nowTs,
    });
  }
  store.triggerAutoSave();
}

function removeLoan(index) {
  if (confirm('確定要刪除此筆貸款紀錄嗎？')) {
    store.markRecordDeleted(store.loanItems[index]);
    store.loanItems.splice(index, 1);
    store.triggerAutoSave();
  }
}
</script>
