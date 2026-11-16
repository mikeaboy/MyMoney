<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- 主指標卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <!-- 總淨資產 -->
      <div class="p-4 sm:p-5 rounded-2xl bg-[#11141a] border border-white/5 relative overflow-hidden">
        <div class="text-[11px] sm:text-xs text-zinc-400 font-medium flex items-center justify-between">
          <span>總淨資產 (Net Worth)</span>
          <span class="text-[10px] text-zinc-400 font-mono">
            ≈ {{ store.formatMoney(store.convertTwdToUsdt(store.totalNetWorthTwd), '$ ', 0) }} USDT
          </span>
        </div>
        <div class="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold num-mono text-white tracking-tight break-all">
          {{ store.formatMoney(store.totalNetWorthTwd) }}
        </div>
        <div class="mt-2 text-[11px] sm:text-xs text-zinc-500 flex items-center justify-between">
          <span>總資產: {{ store.formatMoney(store.totalGrossAssetsTwd) }}</span>
          <span class="text-rose-400">總負債: -{{ store.formatMoney(store.loanSummary.totalDebtTwd) }}</span>
        </div>
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl"></div>
      </div>

      <!-- 每月淨現金流 -->
      <div class="p-4 sm:p-5 rounded-2xl bg-[#11141a] border border-white/5 relative overflow-hidden">
        <div class="text-[11px] sm:text-xs text-zinc-400 font-medium flex items-center justify-between">
          <span>每月淨現金流</span>
          <span
            class="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold"
            :class="store.waterLevelHealth.cfOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'"
          >
            {{ store.waterLevelHealth.cfOk ? '● 安全' : '● 警戒' }}
          </span>
        </div>
        <div
          class="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold num-mono tracking-tight break-all"
          :class="store.cashflowSummary.netMonthlyCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'"
        >
          {{ store.cashflowSummary.netMonthlyCashflow >= 0 ? '+' : '' }}{{ store.formatMoney(store.cashflowSummary.netMonthlyCashflow) }}
        </div>
        <div class="mt-2 text-[11px] sm:text-xs text-zinc-500 flex items-center justify-between">
          <span>月入: +{{ store.formatMoney(store.cashflowSummary.monthlyTotalIncome) }}</span>
          <span>月支: -{{ store.formatMoney(store.cashflowSummary.monthlyTotalExpense) }}</span>
        </div>
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl"></div>
      </div>

      <!-- 緊急預備金與負債比 -->
      <div class="p-4 sm:p-5 rounded-2xl bg-[#11141a] border border-white/5 relative overflow-hidden">
        <div class="text-[11px] sm:text-xs text-zinc-400 font-medium flex items-center justify-between">
          <span>緊急預備金覆蓋</span>
          <span
            class="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold"
            :class="store.waterLevelHealth.bankOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'"
          >
            目標 ≥ {{ store.waterLevelSettings.minEmergencyMonths }} 月
          </span>
        </div>
        <div class="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold num-mono text-white tracking-tight">
          {{ store.cashflowSummary.emergencyMonthsCovered.toFixed(1) }} <span class="text-sm text-zinc-400 font-normal">個月</span>
        </div>
        <div class="mt-2 text-[11px] sm:text-xs text-zinc-500 flex items-center justify-between">
          <span>現金: {{ store.formatMoney(store.bankSummary.totalTwd) }}</span>
          <span>負債比 DSR: {{ store.cashflowSummary.debtServiceRatioPct.toFixed(1) }}%</span>
        </div>
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-purple-500/5 rounded-full blur-2xl"></div>
      </div>
    </div>

    <!-- 資產配置佔比條 (含基金) -->
    <div class="p-3.5 sm:p-4 rounded-2xl bg-[#11141a] border border-white/5">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-zinc-300">總資產分佈比率</span>
        <span class="text-[10px] sm:text-[11px] text-zinc-500">
          全資產折合約 {{ store.formatMoney(store.convertTwdToUsdt(store.totalGrossAssetsTwd), '$ ', 0) }} USDT
        </span>
      </div>

      <div class="w-full h-2.5 sm:h-3 bg-zinc-800 rounded-full overflow-hidden flex">
        <div
          class="h-full bg-sky-500 transition-all duration-500"
          :style="{ width: getAssetPct(store.bankSummary.totalTwd) + '%' }"
          title="銀行存款"
        ></div>
        <div
          class="h-full bg-emerald-500 transition-all duration-500"
          :style="{ width: getAssetPct(store.stockSummary.totalTwd) + '%' }"
          title="股票持倉"
        ></div>
        <div
          class="h-full bg-cyan-500 transition-all duration-500"
          :style="{ width: getAssetPct(store.fundSummary.totalTwd) + '%' }"
          title="基金投資"
        ></div>
        <div
          class="h-full bg-amber-500 transition-all duration-500"
          :style="{ width: getAssetPct(store.cryptoSummary.totalTwd) + '%' }"
          title="加密貨幣"
        ></div>
        <div
          class="h-full bg-indigo-500 transition-all duration-500"
          :style="{ width: getAssetPct(store.insuranceSummary.totalCashValueTwd) + '%' }"
          title="儲蓄險保單"
        ></div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-2.5 border-t border-white/5">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
          <span class="text-[11px] text-zinc-400">銀行現金</span>
          <span class="text-[11px] font-mono text-zinc-200 ml-auto">{{ getAssetPct(store.bankSummary.totalTwd) }}%</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span class="text-[11px] text-zinc-400">股票投資</span>
          <span class="text-[11px] font-mono text-zinc-200 ml-auto">{{ getAssetPct(store.stockSummary.totalTwd) }}%</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-cyan-500 shrink-0"></span>
          <span class="text-[11px] text-zinc-400">基金配置</span>
          <span class="text-[11px] font-mono text-zinc-200 ml-auto">{{ getAssetPct(store.fundSummary.totalTwd) }}%</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
          <span class="text-[11px] text-zinc-400">加密貨幣</span>
          <span class="text-[11px] font-mono text-zinc-200 ml-auto">{{ getAssetPct(store.cryptoSummary.totalTwd) }}%</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
          <span class="text-[11px] text-zinc-400">儲蓄保單</span>
          <span class="text-[11px] font-mono text-zinc-200 ml-auto">{{ getAssetPct(store.insuranceSummary.totalCashValueTwd) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useFinancialStore } from '../stores/useFinancialStore';

const store = useFinancialStore();

function getAssetPct(partTwd) {
  const total = store.totalGrossAssetsTwd;
  if (!total || total <= 0) return 0;
  return Math.round(((Number(partTwd) || 0) / total) * 100);
}
</script>
