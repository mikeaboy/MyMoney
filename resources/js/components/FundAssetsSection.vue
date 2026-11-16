<template>
  <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
    <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/5">
      <div>
        <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
          <span>📊 基金投資配置</span>
          <span class="text-xs font-mono text-cyan-400">
            {{ store.formatMoney(store.fundSummary.totalTwd) }}
          </span>
        </div>
        <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
          境內外基金、ETF 連結基金 · 約折合 {{ store.formatMoney(store.fundSummary.totalUsdt, '$ ', 0) }} USDT
        </div>
      </div>
      <button
        @click="openAddModal"
        class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition flex items-center gap-1 shadow-sm"
      >
        <span>＋</span>
        <span>新增基金</span>
      </button>
    </div>

    <!-- 1. 手機版專屬：卡片清單模式 (md 隱藏) -->
    <div class="block md:hidden divide-y divide-white/5 mt-1">
      <div
        v-for="(item, idx) in store.fundAssets"
        :key="item.id || idx"
        class="py-3.5 space-y-2.5"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="font-bold text-white text-sm flex items-center gap-1.5">
              <span>{{ item.fundName }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                {{ item.platform || '投資平台' }}
              </span>
            </div>
            <div class="text-xs text-zinc-400 font-mono mt-0.5">
              {{ Number(item.units).toLocaleString(undefined, { maximumFractionDigits: 4 }) }} 單位 · 淨值 {{ store.formatMoney(item.currentNav || item.costNav, (item.currency || 'TWD') + ' ', 2) }}
            </div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-base text-white">
              {{ store.formatMoney(getFundMarketTwd(item)) }}
            </div>
            <div class="text-[11px] font-mono font-semibold" :class="getFundPnlTwd(item) >= 0 ? 'text-emerald-400' : 'text-rose-400'">
              {{ getFundPnlTwd(item) >= 0 ? '+' : '' }}{{ store.formatMoney(getFundPnlTwd(item), 'NT$ ', 0) }}
              ({{ getFundRoi(item).toFixed(1) }}%)
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
            @click="removeFund(idx)"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
          >
            🗑️ 刪除
          </button>
        </div>
      </div>

      <div v-if="store.fundAssets.length === 0" class="py-8 text-center text-xs text-zinc-500">
        尚無基金持倉，點擊上方按鈕新增第一筆基金投資
      </div>
    </div>

    <!-- 2. 電腦版專屬：完整表格 (md 顯示) -->
    <div class="hidden md:block overflow-x-auto mt-3">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-zinc-500 border-b border-white/5">
            <th class="py-2.5 px-3">申購平台 / 基金名稱</th>
            <th class="py-2.5 px-3">計價幣別</th>
            <th class="py-2.5 px-3 text-right">持有單位數</th>
            <th class="py-2.5 px-3 text-right">平均申購淨值</th>
            <th class="py-2.5 px-3 text-right">最新淨值</th>
            <th class="py-2.5 px-3 text-right">未實現損益 (TWD)</th>
            <th class="py-2.5 px-3 text-right">當前市值 (TWD)</th>
            <th class="py-2.5 px-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-zinc-300">
          <tr v-for="(item, idx) in store.fundAssets" :key="item.id || idx" class="hover:bg-white/[0.02]">
            <td class="py-3 px-3 font-medium text-white">
              {{ item.fundName }}
              <div class="text-[11px] text-zinc-500 font-normal">{{ item.platform || '投資平台' }}</div>
            </td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded bg-white/5 font-mono text-zinc-300">
                {{ item.currency || 'TWD' }}
              </span>
            </td>
            <td class="py-3 px-3 text-right font-mono">
              {{ Number(item.units).toLocaleString(undefined, { maximumFractionDigits: 4 }) }}
            </td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              {{ store.formatMoney(item.costNav, (item.currency || 'TWD') + ' ', 2) }}
            </td>
            <td class="py-3 px-3 text-right font-mono font-semibold text-white">
              {{ store.formatMoney(item.currentNav || item.costNav, (item.currency || 'TWD') + ' ', 2) }}
            </td>
            <td class="py-3 px-3 text-right font-mono font-semibold" :class="getFundPnlTwd(item) >= 0 ? 'text-emerald-400' : 'text-rose-400'">
              {{ getFundPnlTwd(item) >= 0 ? '+' : '' }}{{ store.formatMoney(getFundPnlTwd(item), 'NT$ ', 0) }}
              <div class="text-[10px] font-normal">({{ getFundRoi(item).toFixed(1) }}%)</div>
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-white">
              {{ store.formatMoney(getFundMarketTwd(item)) }}
              <div class="text-[10px] text-zinc-400 font-normal">
                ≈ {{ store.formatMoney(store.convertTwdToUsdt(getFundMarketTwd(item)), '$ ', 1) }} USDT
              </div>
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
                  @click="removeFund(idx)"
                  class="px-2.5 py-1 text-xs text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 transition"
                >
                  刪除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="store.fundAssets.length === 0" class="py-8 text-center text-xs text-zinc-500">
        尚無基金持倉紀錄，點擊右上角新增第一筆基金
      </div>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      type="fund"
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
  const cache = store.lastInputCache?.fund || {};
  currentItem.value = {
    fundName: '',
    platform: cache.platform || '基富通',
    currency: cache.currency || 'TWD',
    units: '',
    costNav: '',
    currentNav: '',
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

function removeFund(index) {
  if (confirm('確定要刪除這筆基金項目嗎？')) {
    store.markRecordDeleted(store.fundAssets[index]);
    store.fundAssets.splice(index, 1);
    store.triggerAutoSave();
  }
}

function getFundMarketTwd(item) {
  const units = Number(item.units) || 0;
  const nav = Number(item.currentNav) || Number(item.costNav) || 0;
  const currency = item.currency || 'TWD';
  return store.convertToTwd(units * nav, currency);
}

function getFundPnlTwd(item) {
  const units = Number(item.units) || 0;
  const nav = Number(item.currentNav) || Number(item.costNav) || 0;
  const cost = Number(item.costNav) || nav;
  const currency = item.currency || 'TWD';
  const marketTwd = store.convertToTwd(units * nav, currency);
  const costTwd = store.convertToTwd(units * cost, currency);
  return marketTwd - costTwd;
}

function getFundRoi(item) {
  const nav = Number(item.currentNav) || Number(item.costNav) || 0;
  const cost = Number(item.costNav) || nav;
  if (cost <= 0) return 0;
  return ((nav - cost) / cost) * 100;
}
</script>
