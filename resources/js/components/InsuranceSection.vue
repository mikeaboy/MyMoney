<template>
  <div class="space-y-5">
    <!-- ==================== 1. 儲蓄險保單資產 ==================== -->
    <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
      <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/5">
        <div>
          <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
            <span>🛡️ 儲蓄險保單資產</span>
            <span class="text-xs font-mono text-indigo-400">
              {{ store.formatMoney(store.insuranceSummary.totalCashValueTwd) }}
            </span>
          </div>
          <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
            目前現金價值合計 · 預估年回饋利息: +{{ store.formatMoney(store.insuranceSummary.annualInterestTwd) }} /年
          </div>
        </div>
        <button
          @click="openAddSavingsModal"
          class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition flex items-center gap-1 shadow-sm"
        >
          <span>＋</span>
          <span>新增儲蓄險</span>
        </button>
      </div>

      <!-- 手機版：卡片清單 (md 隱藏) -->
      <div class="block md:hidden divide-y divide-white/5 mt-1">
        <div
          v-for="(item, idx) in store.insuranceAssets"
          :key="item.id || idx"
          class="py-3.5 space-y-2.5"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="font-bold text-white text-sm flex items-center gap-1.5">
                <span>{{ item.policyName }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                  {{ item.company || '保險公司' }}
                </span>
              </div>
              <div class="text-xs text-zinc-400 font-mono mt-0.5">
                現金價值 {{ store.formatMoney(item.cashValue, (item.currency || 'USD') + ' ', 0) }}
                <span class="text-[11px] text-emerald-400 ml-1">({{ Number(item.annualReturnRate || 0).toFixed(2) }}%)</span>
              </div>
            </div>
            <div class="text-right">
              <div class="font-mono font-bold text-base text-white">
                {{ store.formatMoney(store.convertToTwd(item.cashValue, item.currency)) }}
              </div>
              <div class="text-[10px] text-emerald-400 font-mono">
                +{{ store.formatMoney(store.convertToTwd(item.cashValue, item.currency) * ((item.annualReturnRate || 0) / 100)) }} /年
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              @click="openEditSavingsModal(item, idx)"
              class="min-h-[36px] px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition"
            >
              ✏️ 編輯
            </button>
            <button
              @click="removeSavingsInsurance(idx)"
              class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
            >
              🗑️ 刪除
            </button>
          </div>
        </div>

        <div v-if="store.insuranceAssets.length === 0" class="py-6 text-center text-xs text-zinc-500">
          尚無儲蓄型保單紀錄
        </div>
      </div>

      <!-- 電腦版：完整表格 (md 顯示) -->
      <div class="hidden md:block overflow-x-auto mt-3">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-zinc-500 border-b border-white/5">
              <th class="py-2.5 px-3">保險公司 / 保單名稱</th>
              <th class="py-2.5 px-3">幣別</th>
              <th class="py-2.5 px-3 text-right">保單解約現金價值</th>
              <th class="py-2.5 px-3 text-right">宣告利率 %</th>
              <th class="py-2.5 px-3 text-right">預估每年回饋</th>
              <th class="py-2.5 px-3 text-right">折合新台幣</th>
              <th class="py-2.5 px-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-zinc-300">
            <tr v-for="(item, idx) in store.insuranceAssets" :key="item.id || idx" class="hover:bg-white/[0.02]">
              <td class="py-3 px-3 font-medium text-white">
                {{ item.policyName }}
                <div class="text-[11px] text-zinc-500 font-normal">{{ item.company || '人壽保險' }}</div>
              </td>
              <td class="py-3 px-3">
                <span class="px-2 py-0.5 rounded bg-white/5 font-mono text-zinc-300">
                  {{ store.fxRates[item.currency]?.flag || '💰' }} {{ item.currency }}
                </span>
              </td>
              <td class="py-3 px-3 text-right font-mono">{{ Number(item.cashValue).toLocaleString() }}</td>
              <td class="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">{{ Number(item.annualReturnRate || 0).toFixed(2) }}%</td>
              <td class="py-3 px-3 text-right font-mono text-emerald-400">
                +{{ store.formatMoney(store.convertToTwd(item.cashValue, item.currency) * ((item.annualReturnRate || 0) / 100)) }}
              </td>
              <td class="py-3 px-3 text-right font-mono font-bold text-white">
                {{ store.formatMoney(store.convertToTwd(item.cashValue, item.currency)) }}
              </td>
              <td class="py-3 px-3 text-center">
                <div class="inline-flex items-center gap-1.5">
                  <button
                    @click="openEditSavingsModal(item, idx)"
                    class="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-lg border border-white/5 transition"
                  >
                    編輯
                  </button>
                  <button
                    @click="removeSavingsInsurance(idx)"
                    class="px-2.5 py-1 text-xs text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 transition"
                  >
                    刪除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="store.insuranceAssets.length === 0">
              <td colspan="7" class="py-6 text-center text-zinc-500">尚無儲蓄型保單資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================== 2. 🌟 定期保障型保險支出 (醫療/實支/意外/車險等) ==================== -->
    <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
      <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/5">
        <div>
          <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
            <span>🩺 定期保障型保險支出</span>
            <span class="text-xs font-mono text-rose-400">
              -{{ store.formatMoney(store.protectionInsuranceSummary.monthlyAvgExpenseTwd) }} /月
            </span>
          </div>
          <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
            醫療、意外、定期壽險與車險 · 全年保費合計: -{{ store.formatMoney(store.protectionInsuranceSummary.yearlyTotalExpenseTwd) }} /年 (已自動平攤至每月收支)
          </div>
        </div>
        <button
          @click="openAddProtectionModal"
          class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition flex items-center gap-1 shadow-sm"
        >
          <span>＋</span>
          <span>新增保障險</span>
        </button>
      </div>

      <!-- 手機版：卡片清單 (md 隱藏) -->
      <div class="block md:hidden divide-y divide-white/5 mt-1">
        <div
          v-for="(item, idx) in store.protectionInsurances"
          :key="item.id || idx"
          class="py-3.5 space-y-2.5"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="font-bold text-white text-sm flex items-center gap-1.5">
                <span>{{ item.policyName }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                  {{ item.category || '醫療險' }}
                </span>
              </div>
              <div class="text-xs text-zinc-400 font-mono mt-0.5">
                {{ item.company || '人壽' }} · {{ item.payFrequency === 'monthly' ? '月繳' : '年繳' }}
              </div>
            </div>
            <div class="text-right">
              <div class="font-mono font-bold text-base text-rose-400">
                -{{ store.formatMoney(item.premiumAmount) }}
                <span class="text-[10px] text-zinc-500 font-normal">({{ item.payFrequency === 'monthly' ? '/月' : '/年' }})</span>
              </div>
              <div class="text-[10px] text-zinc-400 font-mono">
                攤平約 -{{ store.formatMoney(item.payFrequency === 'monthly' ? item.premiumAmount : item.premiumAmount / 12) }} /月
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              @click="openEditProtectionModal(item, idx)"
              class="min-h-[36px] px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition"
            >
              ✏️ 編輯
            </button>
            <button
              @click="removeProtectionInsurance(idx)"
              class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
            >
              🗑️ 刪除
            </button>
          </div>
        </div>

        <div v-if="store.protectionInsurances.length === 0" class="py-6 text-center text-xs text-zinc-500">
          目前無定期保障型保險，點擊上方按鈕新增
        </div>
      </div>

      <!-- 電腦版：完整表格 (md 顯示) -->
      <div class="hidden md:block overflow-x-auto mt-3">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-zinc-500 border-b border-white/5">
              <th class="py-2.5 px-3">保險公司 / 保單名稱</th>
              <th class="py-2.5 px-3">險種分類</th>
              <th class="py-2.5 px-3">繳費週期</th>
              <th class="py-2.5 px-3 text-right">每期應繳保費 (TWD)</th>
              <th class="py-2.5 px-3 text-right">折合每月平均支出</th>
              <th class="py-2.5 px-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-zinc-300">
            <tr v-for="(item, idx) in store.protectionInsurances" :key="item.id || idx" class="hover:bg-white/[0.02]">
              <td class="py-3 px-3 font-medium text-white">
                {{ item.policyName }}
                <div class="text-[11px] text-zinc-500 font-normal">{{ item.company || '人壽保險' }}</div>
              </td>
              <td class="py-3 px-3">
                <span class="px-2 py-0.5 rounded bg-white/5 text-zinc-300">
                  {{ item.category || '醫療實支' }}
                </span>
              </td>
              <td class="py-3 px-3 font-medium">
                {{ item.payFrequency === 'monthly' ? '📆 月繳' : '📅 年繳' }}
              </td>
              <td class="py-3 px-3 text-right font-mono font-semibold text-rose-400">
                -{{ store.formatMoney(item.premiumAmount) }}
              </td>
              <td class="py-3 px-3 text-right font-mono font-bold text-white">
                -{{ store.formatMoney(item.payFrequency === 'monthly' ? item.premiumAmount : item.premiumAmount / 12) }} /月
              </td>
              <td class="py-3 px-3 text-center">
                <div class="inline-flex items-center gap-1.5">
                  <button
                    @click="openEditProtectionModal(item, idx)"
                    class="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-lg border border-white/5 transition"
                  >
                    編輯
                  </button>
                  <button
                    @click="removeProtectionInsurance(idx)"
                    class="px-2.5 py-1 text-xs text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 transition"
                  >
                    刪除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="store.protectionInsurances.length === 0">
              <td colspan="6" class="py-6 text-center text-zinc-500">尚無定期保障型保險資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      :type="modalType"
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
const modalType = ref('insurance'); // 'insurance' | 'protectionInsurance'
const isEditing = ref(false);
const currentItem = ref(null);
const currentIndex = ref(-1);

// 儲蓄險新增與編輯
function openAddSavingsModal() {
  const cache = store.lastInputCache?.insurance || {};
  modalType.value = 'insurance';
  currentItem.value = {
    company: cache.company || '富邦人壽',
    policyName: '',
    currency: cache.currency || 'USD',
    cashValue: '',
    annualReturnRate: cache.annualReturnRate || 3.8,
  };
  currentIndex.value = -1;
  isEditing.value = false;
  modalOpen.value = true;
}

function openEditSavingsModal(item, index) {
  modalType.value = 'insurance';
  currentItem.value = { ...item };
  currentIndex.value = index;
  isEditing.value = true;
  modalOpen.value = true;
}

function removeSavingsInsurance(index) {
  if (confirm('確定要刪除這筆儲蓄險保單嗎？')) {
    store.markRecordDeleted(store.insuranceAssets[index]);
    store.insuranceAssets.splice(index, 1);
    store.triggerAutoSave();
  }
}

// 保障型保險新增與編輯
function openAddProtectionModal() {
  const cache = store.lastInputCache?.protectionInsurance || {};
  modalType.value = 'protectionInsurance';
  currentItem.value = {
    company: cache.company || '國泰人壽',
    policyName: '',
    category: cache.category || '醫療實支',
    payFrequency: cache.payFrequency || 'yearly',
    premiumAmount: '',
  };
  currentIndex.value = -1;
  isEditing.value = false;
  modalOpen.value = true;
}

function openEditProtectionModal(item, index) {
  modalType.value = 'protectionInsurance';
  currentItem.value = { ...item };
  currentIndex.value = index;
  isEditing.value = true;
  modalOpen.value = true;
}

function removeProtectionInsurance(index) {
  if (confirm('確定要刪除這筆定期保障型保單嗎？')) {
    store.markRecordDeleted(store.protectionInsurances[index]);
    store.protectionInsurances.splice(index, 1);
    store.triggerAutoSave();
  }
}
</script>
