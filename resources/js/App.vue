<template>
  <div class="min-h-screen bg-[#090b0e] text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
    <!-- 頂部導航 (含備份匯出選單、隱藏金額、同步狀態) -->
    <HeaderNav />

    <!-- 分頁頁籤導航 (Tabs Navigation) -->
    <div class="sticky top-[53px] sm:top-[61px] z-20 bg-[#090b0e]/95 backdrop-blur-md border-b border-white/5 py-2.5 px-3 sm:px-8">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <!-- 水平滾動分頁按鈕 -->
        <div class="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          <button
            v-for="tab in categoryTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
            :class="activeTab === tab.id
              ? 'bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5'"
          >
            <span>{{ tab.icon }}</span>
            <span>{{ tab.name }}</span>
            <span v-if="tab.badge" class="text-[10px] px-1.5 py-0.2 rounded-full font-mono" :class="activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-white/10 text-zinc-300'">
              {{ tab.badge }}
            </span>
          </button>
        </div>

        <!-- 全覽切換快捷 (右側圖示) -->
        <button
          @click="activeTab = activeTab === 'all' ? 'overview' : 'all'"
          :title="activeTab === 'all' ? '切換為分頁模式' : '切換為全展開檢視'"
          class="shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition hidden sm:flex items-center gap-1"
          :class="activeTab === 'all' ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'"
        >
          <span>{{ activeTab === 'all' ? '📑' : '📑' }}</span>
          <span>{{ activeTab === 'all' ? '返回分頁' : '展開全覽' }}</span>
        </button>
      </div>
    </div>

    <!-- 主體內容區塊 (分頁模式：簡潔清爽，單一視圖) -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      
      <!-- 1. 總覽儀表板分頁 (Overview) -->
      <div v-show="activeTab === 'overview' || activeTab === 'all'" class="space-y-5">
        <OverviewCards />

        <!-- 🌟 歷史淨值成長趨勢圖 (置於總覽正下方) -->
        <NetWorthTrendSection />

        <!-- 快速導航摘要小卡 -->
        <div v-if="activeTab === 'overview'" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <div
            @click="activeTab = 'bank'"
            class="p-3.5 rounded-2xl bg-[#11141a] border border-white/5 hover:border-sky-500/30 cursor-pointer transition group"
          >
            <div class="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>🏦 銀行存款</span>
              <span class="text-xs group-hover:translate-x-0.5 transition">→</span>
            </div>
            <div class="font-mono font-bold text-sm text-white mt-1.5">
              {{ financialStore.formatMoney(financialStore.bankSummary.totalTwd) }}
            </div>
            <div class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ financialStore.bankAssets.length }} 個帳戶</div>
          </div>

          <div
            @click="activeTab = 'stock'"
            class="p-3.5 rounded-2xl bg-[#11141a] border border-white/5 hover:border-emerald-500/30 cursor-pointer transition group"
          >
            <div class="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>📈 股票證券</span>
              <span class="text-xs group-hover:translate-x-0.5 transition">→</span>
            </div>
            <div class="font-mono font-bold text-sm text-white mt-1.5">
              {{ financialStore.formatMoney(financialStore.stockSummary.totalTwd) }}
            </div>
            <div class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ financialStore.stockAssets.length }} 檔標的 (含美股)</div>
          </div>

          <div
            @click="activeTab = 'fund'"
            class="p-3.5 rounded-2xl bg-[#11141a] border border-white/5 hover:border-cyan-500/30 cursor-pointer transition group"
          >
            <div class="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>📊 基金配置</span>
              <span class="text-xs group-hover:translate-x-0.5 transition">→</span>
            </div>
            <div class="font-mono font-bold text-sm text-white mt-1.5">
              {{ financialStore.formatMoney(financialStore.fundSummary.totalTwd) }}
            </div>
            <div class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ financialStore.fundAssets.length }} 筆基金</div>
          </div>

          <div
            @click="activeTab = 'crypto'"
            class="p-3.5 rounded-2xl bg-[#11141a] border border-white/5 hover:border-amber-500/30 cursor-pointer transition group"
          >
            <div class="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>⚡ 加密貨幣</span>
              <span class="text-xs group-hover:translate-x-0.5 transition">→</span>
            </div>
            <div class="font-mono font-bold text-sm text-white mt-1.5">
              {{ financialStore.formatMoney(financialStore.cryptoSummary.totalTwd) }}
            </div>
            <div class="text-[10px] text-zinc-500 font-mono mt-0.5">≈ ${{ financialStore.formatMoney(financialStore.cryptoSummary.totalUsdt, '', 0) }} USDT</div>
          </div>

          <div
            @click="activeTab = 'loan'"
            class="p-3.5 rounded-2xl bg-[#11141a] border border-white/5 hover:border-rose-500/30 cursor-pointer transition group"
          >
            <div class="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>📉 負債與卡費</span>
              <span class="text-xs group-hover:translate-x-0.5 transition">→</span>
            </div>
            <div class="font-mono font-bold text-sm text-rose-400 mt-1.5">
              -{{ financialStore.formatMoney(financialStore.totalLiabilitiesTwd) }}
            </div>
            <div class="text-[10px] text-zinc-500 font-mono mt-0.5">含信用卡與貸款</div>
          </div>

          <div
            @click="activeTab = 'insurance'"
            class="p-3.5 rounded-2xl bg-[#11141a] border border-white/5 hover:border-indigo-500/30 cursor-pointer transition group"
          >
            <div class="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>🛡️ 保單規劃</span>
              <span class="text-xs group-hover:translate-x-0.5 transition">→</span>
            </div>
            <div class="font-mono font-bold text-sm text-white mt-1.5">
              {{ financialStore.formatMoney(financialStore.insuranceSummary.totalCashValueTwd) }}
            </div>
            <div class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ financialStore.insuranceAssets.length }} 張保單</div>
          </div>
        </div>
      </div>

      <!-- 2. 獨立歷史趨勢分頁 -->
      <NetWorthTrendSection v-show="activeTab === 'trend'" />

      <!-- 3. 各功能模組分頁 -->
      <BankAssetsSection v-show="activeTab === 'bank' || activeTab === 'all'" />

      <StockAssetsSection v-show="activeTab === 'stock' || activeTab === 'all'" />

      <FundAssetsSection v-show="activeTab === 'fund' || activeTab === 'all'" />

      <CryptoAssetsSection v-show="activeTab === 'crypto' || activeTab === 'all'" />

      <!-- 貸款與負債分頁 (包含長期貸款與信用卡帳單) -->
      <div v-show="activeTab === 'loan' || activeTab === 'all'" class="space-y-5">
        <CreditCardsSection />
        <LoansSection />
      </div>

      <CashflowSection v-show="activeTab === 'cashflow' || activeTab === 'all'" />

      <InsuranceSection v-show="activeTab === 'insurance' || activeTab === 'all'" />

      <!-- 🛒 蝦皮商業投資獨立模組 -->
      <ShopeeInvestSection v-show="activeTab === 'shopee' || activeTab === 'all'" />
    </main>

    <!-- 頁尾 -->
    <footer class="border-t border-white/5 py-6 px-4 text-center text-xs text-zinc-600 mt-8">
      <p>全方位整合帳務與跨幣別資產管理系統 · MVVM (Vue 3 Pinia + Laravel 11)</p>
      <p class="mt-1">分頁簡潔模式 · 支援歷史淨值成長趨勢 · 股票中文智慧推薦 · 信用卡帳單分期</p>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import { useAuthStore } from './stores/useAuthStore';
import { useFinancialStore } from './stores/useFinancialStore';
import HeaderNav from './components/HeaderNav.vue';
import OverviewCards from './components/OverviewCards.vue';
import NetWorthTrendSection from './components/NetWorthTrendSection.vue';
import BankAssetsSection from './components/BankAssetsSection.vue';
import StockAssetsSection from './components/StockAssetsSection.vue';
import FundAssetsSection from './components/FundAssetsSection.vue';
import CryptoAssetsSection from './components/CryptoAssetsSection.vue';
import CreditCardsSection from './components/CreditCardsSection.vue';
import LoansSection from './components/LoansSection.vue';
import CashflowSection from './components/CashflowSection.vue';
import InsuranceSection from './components/InsuranceSection.vue';
import ShopeeInvestSection from './components/ShopeeInvestSection.vue';

const authStore = useAuthStore();
const financialStore = useFinancialStore();

const activeTab = ref('overview');

const categoryTabs = computed(() => [
  { id: 'overview', name: '儀表總覽', icon: '🏠' },
  { id: 'trend', name: '成長趨勢', icon: '📈', badge: financialStore.historicalSnapshots.length || null },
  { id: 'shopee', name: '蝦皮投資', icon: '🛒', badge: financialStore.shopeeSummary.records.length || null },
  { id: 'bank', name: '銀行存款', icon: '🏦', badge: financialStore.bankAssets.length || null },
  { id: 'stock', name: '股票投資', icon: '📈', badge: financialStore.stockAssets.length || null },
  { id: 'fund', name: '基金配置', icon: '📊', badge: financialStore.fundAssets.length || null },
  { id: 'crypto', name: '加密貨幣', icon: '⚡', badge: financialStore.cryptoAssets.length || null },
  { id: 'loan', name: '負債卡費', icon: '📉', badge: (financialStore.loanItems.length + financialStore.creditCardItems.length) || null },
  { id: 'cashflow', name: '收支水線', icon: '💵' },
  { id: 'insurance', name: '保險資產', icon: '🛡️', badge: financialStore.insuranceAssets.length || null },
  { id: 'all', name: '全覽檢視', icon: '📑' },
]);

onMounted(async () => {
  await authStore.initSession();
  await financialStore.loadStateFromApi();
});
</script>

<style>
/* 隱藏橫向標籤列捲軸以維持美觀 */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
