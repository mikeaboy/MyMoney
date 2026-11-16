<template>
  <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-white/5 gap-3">
      <div>
        <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
          <span>⚡ 加密貨幣冷熱錢包</span>
          <span class="text-xs font-mono text-amber-400">
            {{ store.formatMoney(store.cryptoSummary.totalTwd) }}
          </span>
        </div>
        <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
          約折合 {{ store.formatMoney(store.cryptoSummary.totalUsdt, '$ ', 0) }} USDT
        </div>
      </div>

      <!-- 右側按鈕：即時行情刷新 + 新增 -->
      <div class="flex items-center gap-2">
        <button
          @click="store.refreshCryptoQuotes"
          :disabled="store.isRefreshingCrypto"
          title="自動抓取 CoinGecko 即時幣價"
          class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition flex items-center gap-1.5 disabled:opacity-40"
        >
          <span :class="store.isRefreshingCrypto ? 'animate-spin inline-block' : ''">⚡</span>
          <span>{{ store.isRefreshingCrypto ? '刷新中...' : '即時幣價' }}</span>
        </button>
        <button
          @click="openAddModal"
          class="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition flex items-center gap-1 shadow-sm"
        >
          <span>＋</span>
          <span>新增幣種</span>
        </button>
      </div>
    </div>

    <!-- 1. 手機版專屬：卡片清單模式 (md 隱藏) -->
    <div class="block md:hidden divide-y divide-white/5 mt-1">
      <div
        v-for="(item, idx) in store.cryptoAssets"
        :key="item.id || idx"
        class="py-3.5 space-y-2.5"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="font-bold text-white text-sm flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono text-xs font-bold">
                {{ item.symbol }}
              </span>
              <span class="text-xs text-white font-medium">
                {{ item.name || store.cryptoQuotes[item.symbol]?.name || '' }}
              </span>
              <span class="text-xs text-zinc-400 font-normal">
                ({{ item.walletName }})
              </span>
            </div>
            <div class="text-xs text-zinc-400 font-mono mt-1">
              {{ Number(item.amount) }} {{ item.symbol }} · 單價 ${{ store.getCryptoPriceUsd(item.symbol, item).toLocaleString(undefined, { maximumFractionDigits: 8 }) }}
            </div>
          </div>
          <div class="text-right">
            <div class="font-mono font-bold text-base text-white">
              {{ store.formatMoney(store.convertCryptoToTwd(item.amount, item.symbol, item)) }}
            </div>
            <div class="text-[11px] text-amber-300 font-mono font-semibold">
              ≈ {{ store.formatMoney(item.amount * store.getCryptoPriceUsd(item.symbol, item), '$ ', 2) }} USDT
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
            @click="removeCrypto(idx)"
            class="min-h-[36px] px-3.5 py-1.5 text-xs text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 active:bg-rose-500/20 transition"
          >
            🗑️ 刪除
          </button>
        </div>
      </div>

      <div v-if="store.cryptoAssets.length === 0" class="py-8 text-center text-xs text-zinc-500">
        尚無加密貨幣紀錄，點擊上方按鈕新增
      </div>
    </div>

    <!-- 2. 電腦版專屬：完整表格 (md 顯示) -->
    <div class="hidden md:block overflow-x-auto mt-3">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-zinc-500 border-b border-white/5">
            <th class="py-2.5 px-3">存放錢包 / 交易所</th>
            <th class="py-2.5 px-3">幣種</th>
            <th class="py-2.5 px-3 text-right">持有數量</th>
            <th class="py-2.5 px-3 text-right">即時參考單價</th>
            <th class="py-2.5 px-3 text-right">折合 USDT</th>
            <th class="py-2.5 px-3 text-right">折合新台幣 (TWD)</th>
            <th class="py-2.5 px-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-zinc-300">
          <tr v-for="(item, idx) in store.cryptoAssets" :key="item.id || idx" class="hover:bg-white/[0.02]">
            <td class="py-3 px-3 font-medium text-white">
              {{ item.walletName }}
            </td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-bold mr-1.5">
                {{ item.symbol }}
              </span>
              <span class="text-xs text-zinc-300 font-normal">
                {{ item.name || store.cryptoQuotes[item.symbol]?.name || '' }}
              </span>
            </td>
            <td class="py-3 px-3 text-right font-mono">{{ Number(item.amount) }}</td>
            <td class="py-3 px-3 text-right font-mono text-zinc-400">
              ${{ store.getCryptoPriceUsd(item.symbol, item).toLocaleString(undefined, { maximumFractionDigits: 8 }) }} USD
            </td>
            <td class="py-3 px-3 text-right font-mono font-semibold text-amber-300">
              ${{ store.formatMoney(item.amount * store.getCryptoPriceUsd(item.symbol, item), '', 2) }} USDT
            </td>
            <td class="py-3 px-3 text-right font-mono font-bold text-white">
              {{ store.formatMoney(store.convertCryptoToTwd(item.amount, item.symbol, item)) }}
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
                  @click="removeCrypto(idx)"
                  class="px-2.5 py-1 text-xs text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 transition"
                >
                  刪除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="store.cryptoAssets.length === 0" class="py-8 text-center text-xs text-zinc-500">
        尚無加密貨幣紀錄，點擊右上角新增幣種
      </div>
    </div>

    <!-- 自訂彈窗 -->
    <AssetEditorModal
      :is-open="modalOpen"
      type="crypto"
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
  const cache = store.lastInputCache?.crypto || {};
  currentItem.value = {
    walletName: cache.walletName || '幣安 (Binance)',
    symbol: cache.symbol || 'BTC',
    amount: '',
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

function removeCrypto(index) {
  if (confirm('確定要刪除這筆加密貨幣紀錄嗎？')) {
    store.markRecordDeleted(store.cryptoAssets[index]);
    store.cryptoAssets.splice(index, 1);
    store.triggerAutoSave();
  }
}
</script>
