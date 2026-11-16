<template>
  <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-white/5 gap-3">
      <div>
        <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
          <span>📈 股票證券持倉</span>
          <span class="text-xs font-mono text-emerald-400">
            {{ store.formatMoney(store.stockSummary.totalTwd) }}
          </span>
        </div>
        <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
          台股 {{ store.formatMoney(store.stockSummary.twStockTwd) }} · 美股 {{ store.formatMoney(store.stockSummary.usStockTwd) }} (≈ ${{ store.formatMoney(store.stockSummary.totalUsd, '', 0) }} USD)
        </div>
      </div>

      <!-- 右側動作按鈕區 (更新股價 + 新增股票) -->
      <div class="flex items-center gap-2">
        <button
          @click="store.refreshStockQuotes"
          :disabled="store.isRefreshingStocks || store.stockAssets.length === 0"
          title="自動抓取台股與美股最新價格"
          class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition flex items-center gap-1.5 disabled:opacity-40"
        >
          <span :class="store.isRefreshingStocks ? 'animate-spin inline-block' : ''">⚡</span>
          <span>{{ store.isRefreshingStocks ? '抓取報價中...' : '自動更新股價' }}</span>
        </button>
        <button
          @click="openAddModal"
          class="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition flex items-center gap-1 shadow-sm"
        >
          <span>＋</span>
          <span>新增股票</span>
        </button>
      </div>
    </div>

    <!-- 市場類別次級過濾標籤 (全部 / 台股 / 美股) -->
    <div class="flex items-center gap-1.5 pt-3 pb-1">
      <button
        v-for="tab in marketTabs"
        :key="tab.id"
        @click="activeMarketFilter = tab.id"
        class="px-2.5 py-1 rounded-lg text-xs font-medium transition"
        :class="activeMarketFilter === tab.id ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-zinc-400 hover:text-white border border-transparent'"
      >
        {{ tab.label }}
        <span class="text-[10px] ml-0.5 opacity-70">({{ getMarketCount(tab.id) }})</span>
      </button>
    </div>

    <!-- 1. 手機版專屬：卡片清單模式 (md 隱藏) -->
    <div class="block md:hidden divide-y divide-white/5 mt-1">
      <div
        v-for="(item, idx) in filteredStocks"
        :key="item.id || idx"
        class="py-3.5 space-y-2.5"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
              <span v-if="item.name" class="text-zinc-100 font-semibold">{{ item.name }}</span>
              <span class="font-mono" :class="item.name ? 'text-zinc-400 font-normal text-xs' : ''">({{ item.ticker }})</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                :class="isUsStock(item) ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'"
              >
                {{ isUsStock(item) ? '美股' : '台股' }}
              </span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-normal">
                {{ item.brokerName || '證券戶' }}
              </span>
            </div>
            <div class="text-xs text-zinc-400 font-mono mt-0.5">
              {{ Number(item.shares).toLocaleString() }} 股 · 現價 {{ store.formatMoney(item.currentPrice, (item.currency || (isUsStock(item) ? 'USD' : 'TWD')) + ' ', 2) }}
              <span v-if="item.changePercent !== undefined" :class="item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="ml-1 text-[11px]">
                ({{ item.changePercent >= 0 ? '+' : '' }}{{ Number(item.changePercent).toFixed(2) }}%)
              </span>
            </div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-base text-white">
              {{ store.formatMoney(getItemMarketTwd(item)) }}
            </div>
            <div class="text-[11px] font-mono font-semibold" :class="getItemPnl(item) >= 0 ? 'text-emerald-400' : 'text-rose-400'">
              {{ getItemPnl(item) >= 0 ? '+' : '' }}{{ store.formatMoney(getItemPnl(item), (item.currency || 'TWD') + ' ', 0) }}
              <span class="text-[10px] opacity-75 font-normal">({{ getItemRoi(item).toFixed(1) }}%)</span>
            </div>
          </div>
        </div>

        <!-- 手機大按鈕操作區 -->
        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            @click="openEditModal(item, getOriginalIndex(item))"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition"
          >
            ✏️ 編輯
          </button>
          <button
            @click="removeStock(getOriginalIndex(item))"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
          >
            🗑️ 刪除
          </button>
        </div>
      </div>

      <div v-if="filteredStocks.length === 0" class="py-8 text-center text-xs text-zinc-500">
        {{ activeMarketFilter === 'all' ? '尚無股票持倉，點擊上方按鈕新增第一筆投資' : '此分類下暫無股票標的' }}
      </div>
    </div>

    <!-- 2. 電腦版專屬：完整表格 (md 顯示) -->
    <div class="hidden md:block overflow-x-auto mt-3">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-zinc-500 border-b border-white/5">
            <th class="py-2.5 px-3">市場 / 代號 / 券商</th>
            <th class="py-2.5 px-3 text-right">持有股數</th>
            <th class="py-2.5 px-3 text-right">平均成本價</th>
            <th class="py-2.5 px-3 text-right">目前現價</th>
            <th class="py-2.5 px-3 text-right">未實現損益</th>
            <th class="py-2.5 px-3 text-right">市值 (折合 TWD)</th>
            <th class="py-2.5 px-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-zinc-300">
          <tr v-for="(item, idx) in filteredStocks" :key="item.id || idx" class="hover:bg-white/[0.02]">
            <td class="py-3 px-3 font-medium text-white">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                  :class="isUsStock(item) ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'"
                >
                  {{ isUsStock(item) ? '美股' : '台股' }}
                </span>
                <span v-if="item.name" class="font-bold text-white">{{ item.name }}</span>
                <span class="font-mono text-zinc-400 text-xs">({{ item.ticker }})</span>
              </div>
              <div class="text-[11px] text-zinc-500 font-normal mt-0.5">{{ item.brokerName || '證券戶' }}</div>
            </td>
            <td class="py-3 px-3 text-right font-mono">{{ Number(item.shares).toLocaleString() }} 股</td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              {{ store.formatMoney(item.costPrice, (item.currency || (isUsStock(item) ? 'USD' : 'TWD')) + ' ', 2) }}
            </td>
            <td class="py-3 px-3 text-right font-mono font-semibold text-white">
              {{ store.formatMoney(item.currentPrice, (item.currency || (isUsStock(item) ? 'USD' : 'TWD')) + ' ', 2) }}
              <div v-if="item.changePercent !== undefined" :class="item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'" class="text-[10px] font-normal">
                {{ item.changePercent >= 0 ? '+' : '' }}{{ Number(item.changePercent).toFixed(2) }}%
              </div>
            </td>
            <td class="py-3 px-3 text-right font-mono font-semibold" :class="getItemPnl(item) >= 0 ? 'text-emerald-400' : 'text-rose-400'">
              {{ getItemPnl(item) >= 0 ? '+' : '' }}{{ store.formatMoney(getItemPnl(item), (item.currency || (isUsStock(item) ? 'USD' : 'TWD')) + ' ', 2) }}
              <div class="text-[10px] font-normal text-zinc-400">({{ getItemRoi(item).toFixed(1) }}%)</div>
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-white">
              {{ store.formatMoney(getItemMarketTwd(item)) }}
              <div v-if="isUsStock(item)" class="text-[10px] text-zinc-400 font-normal">
                ≈ ${{ store.formatMoney(item.shares * item.currentPrice, '', 2) }} USD
              </div>
            </td>
            <td class="py-3 px-3 text-center">
              <div class="inline-flex items-center gap-1.5">
                <button
                  @click="openEditModal(item, getOriginalIndex(item))"
                  class="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-white/5 rounded-lg border border-white/5 transition"
                >
                  編輯
                </button>
                <button
                  @click="removeStock(getOriginalIndex(item))"
                  class="px-2.5 py-1 text-xs text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 transition"
                >
                  刪除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredStocks.length === 0" class="py-8 text-center text-xs text-zinc-500">
        {{ activeMarketFilter === 'all' ? '尚無股票持倉紀錄，點擊右上角新增股票' : '此市場分類暫無持倉標的' }}
      </div>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      type="stock"
      :is-editing="isEditing"
      :edit-item="currentItem"
      :edit-index="currentIndex"
      @close="modalOpen = false"
      @save="modalOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useFinancialStore } from '../stores/useFinancialStore';
import AssetEditorModal from './AssetEditorModal.vue';

const store = useFinancialStore();

const activeMarketFilter = ref('all');
const modalOpen = ref(false);
const isEditing = ref(false);
const currentItem = ref(null);
const currentIndex = ref(-1);

const marketTabs = [
  { id: 'all', label: '全部股票' },
  { id: 'TW', label: '🇹🇼 台股' },
  { id: 'US', label: '🇺🇸 美股' },
];

function isUsStock(item) {
  return item.marketType === 'US' || item.currency === 'USD';
}

const filteredStocks = computed(() => {
  if (activeMarketFilter.value === 'all') return store.stockAssets;
  if (activeMarketFilter.value === 'US') {
    return store.stockAssets.filter(s => isUsStock(s));
  }
  return store.stockAssets.filter(s => !isUsStock(s));
});

function getMarketCount(type) {
  if (type === 'all') return store.stockAssets.length;
  if (type === 'US') return store.stockAssets.filter(s => isUsStock(s)).length;
  return store.stockAssets.filter(s => !isUsStock(s)).length;
}

function getOriginalIndex(item) {
  return store.stockAssets.findIndex(s => s === item);
}

function getItemMarketTwd(item) {
  const shares = Number(item.shares) || 0;
  const price = Number(item.currentPrice) || 0;
  const currency = item.currency || (isUsStock(item) ? 'USD' : 'TWD');
  return store.convertToTwd(shares * price, currency);
}

function getItemPnl(item) {
  const shares = Number(item.shares) || 0;
  const price = Number(item.currentPrice) || 0;
  const cost = Number(item.costPrice) || price;
  return shares * (price - cost);
}

function getItemRoi(item) {
  const price = Number(item.currentPrice) || 0;
  const cost = Number(item.costPrice) || price;
  if (cost <= 0) return 0;
  return ((price - cost) / cost) * 100;
}

function openAddModal() {
  const cache = store.lastInputCache?.stock || {};
  currentItem.value = {
    marketType: cache.marketType || (activeMarketFilter.value === 'US' ? 'US' : 'TW'),
    ticker: '',
    name: '',
    brokerName: cache.brokerName || (activeMarketFilter.value === 'US' ? 'Firstrade' : '富邦證券'),
    currency: cache.currency || (activeMarketFilter.value === 'US' ? 'USD' : 'TWD'),
    shares: '',
    costPrice: '',
    currentPrice: '',
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

function removeStock(index) {
  if (index >= 0 && confirm('確定要刪除這筆股票持倉嗎？')) {
    store.markRecordDeleted(store.stockAssets[index]);
    store.stockAssets.splice(index, 1);
    store.triggerAutoSave();
  }
}
</script>
