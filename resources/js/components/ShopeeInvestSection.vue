<template>
  <div class="space-y-4 sm:space-y-5">
    <!-- 頂部獨立標題卡片 -->
    <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-950/40 via-[#141216] to-[#11141a] border border-orange-500/20 shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-xl font-bold text-white shadow-md shadow-orange-500/20 shrink-0">
            🛒
          </div>
          <div>
            <div class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>蝦皮商業投資 (獨立營運帳)</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">
                公私分立
              </span>
            </div>
            <div class="text-xs text-zinc-400 mt-0.5">
              資金進出獨立記錄 · 專屬營運走勢圖 · 不混入個人生活資產
            </div>
          </div>
        </div>

        <!-- 快捷操作動作按鈕群組 -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            @click="openModal('in')"
            class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>📥</span>
            <span>投入本金</span>
          </button>
          <button
            @click="openModal('out')"
            class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>📤</span>
            <span>提領資金</span>
          </button>
          <button
            @click="openModal('update_balance')"
            class="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>✏️</span>
            <span>更新當前餘額</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 4 大核心金額數據看板 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      <!-- 1. 目前蝦皮總餘額/資金總值 -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-[#11141a] border border-white/5 space-y-1">
        <div class="text-[11px] text-zinc-400 flex items-center justify-between">
          <span>💰 目前蝦皮資產總值</span>
          <span class="text-[10px] text-orange-400">當前現值</span>
        </div>
        <div class="font-mono font-bold text-base sm:text-lg text-white">
          {{ store.formatMoney(store.shopeeSummary.currentValue) }}
        </div>
        <div class="text-[10px] text-zinc-500">蝦皮帳戶與資金總餘額</div>
      </div>

      <!-- 2. 淨投入本金 (投入 - 提領) -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-[#11141a] border border-white/5 space-y-1">
        <div class="text-[11px] text-zinc-400 flex items-center justify-between">
          <span>💼 淨投入本金</span>
          <span class="text-[10px] text-zinc-400">已扣除回收</span>
        </div>
        <div class="font-mono font-bold text-base sm:text-lg text-zinc-200">
          {{ store.formatMoney(store.shopeeSummary.netInvested) }}
        </div>
        <div class="text-[10px] text-zinc-500">
          投入 {{ store.formatMoney(store.shopeeSummary.invested) }} / 提領 {{ store.formatMoney(store.shopeeSummary.withdrawn) }}
        </div>
      </div>

      <!-- 3. 累計淨利潤 -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-[#11141a] border border-white/5 space-y-1">
        <div class="text-[11px] text-zinc-400 flex items-center justify-between">
          <span>📈 累計商業獲利</span>
          <span class="text-[10px] font-semibold" :class="store.shopeeSummary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'">
            {{ store.shopeeSummary.profit >= 0 ? '▲ 獲利' : '▼ 虧損' }}
          </span>
        </div>
        <div class="font-mono font-bold text-base sm:text-lg" :class="store.shopeeSummary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'">
          {{ store.formatMoney(store.shopeeSummary.profit) }}
        </div>
        <div class="text-[10px] text-zinc-500">現值 + 提領 - 總投入</div>
      </div>

      <!-- 4. 投資報酬率 ROI -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-[#11141a] border border-white/5 space-y-1">
        <div class="text-[11px] text-zinc-400 flex items-center justify-between">
          <span>🎯 投資回報率 (ROI)</span>
          <span class="text-[10px] text-amber-400">總回報</span>
        </div>
        <div class="font-mono font-bold text-base sm:text-lg" :class="store.shopeeSummary.roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
          {{ store.shopeeSummary.roiPct >= 0 ? '+' : '' }}{{ store.shopeeSummary.roiPct.toFixed(1) }}%
        </div>
        <div class="text-[10px] text-zinc-500">累計商業投資績效</div>
      </div>
    </div>

    <!-- 專屬蝦皮營運資金趨勢圖表 (滿足需求 3) -->
    <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5 space-y-3">
      <div class="flex items-center justify-between border-b border-white/5 pb-3">
        <div>
          <div class="text-sm font-bold text-white flex items-center gap-2">
            <span>📊 蝦皮投資資金與獲利走勢</span>
          </div>
          <div class="text-[11px] text-zinc-500 mt-0.5">
            每次更新餘額自動留存軌跡 · 追蹤網拍本金與淨利成長曲線
          </div>
        </div>
      </div>

      <!-- SVG 專屬走勢圖 -->
      <div v-if="chartPoints.length >= 2" class="w-full h-44 sm:h-52 relative pt-2">
        <svg class="w-full h-full overflow-visible" :viewBox="`0 0 ${svgWidth} ${svgHeight}`" preserveAspectRatio="none">
          <defs>
            <linearGradient id="shopee-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f97316" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#f97316" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- 網格水平線 -->
          <line
            v-for="i in 3"
            :key="i"
            x1="20"
            :y1="(svgHeight / 4) * i"
            :x2="svgWidth - 20"
            :y2="(svgHeight / 4) * i"
            stroke="rgba(255,255,255,0.06)"
            stroke-dasharray="3,3"
          />

          <!-- 折線陰影填色 -->
          <polygon :points="areaPoints" fill="url(#shopee-grad)" />

          <!-- 折線 -->
          <polyline
            :points="polylinePoints"
            fill="none"
            stroke="#f97316"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- 資料圓點 -->
          <g v-for="(p, idx) in chartPoints" :key="idx">
            <circle
              :cx="p.x"
              :cy="p.y"
              r="4.5"
              fill="#f97316"
              stroke="#090b0e"
              stroke-width="2.5"
            />
          </g>
        </svg>

        <!-- X 軸日期標籤 -->
        <div class="flex items-center justify-between text-[10px] text-zinc-500 mt-2 px-2 font-mono">
          <span v-for="s in store.shopeeSummary.snapshots" :key="s.id">{{ s.date }}</span>
        </div>
      </div>

      <!-- 少於 2 筆紀錄時的提示 -->
      <div v-else class="py-8 text-center text-xs text-zinc-500 space-y-1.5">
        <div class="text-2xl">🛒</div>
        <div>目前有 {{ store.shopeeSummary.snapshots.length }} 筆蝦皮營運快照紀錄</div>
        <div class="text-[11px] text-zinc-600">每次您更新蝦皮餘額或紀錄資金進出時，系統將自動繪製專屬走勢圖</div>
      </div>
    </div>

    <!-- 金額進出紀錄清單 -->
    <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5 space-y-3">
      <div class="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div class="text-xs font-bold text-white flex items-center gap-1.5">
          <span>📜 資金進出流水帳</span>
          <span class="text-[10px] text-zinc-500 font-mono">({{ store.shopeeSummary.records.length }} 筆紀錄)</span>
        </div>
      </div>

      <div v-if="store.shopeeSummary.records.length > 0" class="divide-y divide-white/5">
        <div
          v-for="r in store.shopeeSummary.records"
          :key="r.id"
          class="py-2.5 flex items-center justify-between text-xs"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              :class="r.type === 'in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'"
            >
              {{ r.type === 'in' ? '↓' : '↑' }}
            </span>
            <div>
              <div class="font-medium text-white">{{ r.note || (r.type === 'in' ? '投入本金' : '提領資金') }}</div>
              <div class="text-[10px] text-zinc-500 font-mono">{{ r.date }}</div>
            </div>
          </div>
          <div class="font-mono font-bold text-sm" :class="r.type === 'in' ? 'text-emerald-400' : 'text-sky-400'">
            {{ r.type === 'in' ? '+ ' : '- ' }}{{ store.formatMoney(r.amount) }}
          </div>
        </div>
      </div>

      <div v-else class="py-6 text-center text-xs text-zinc-500">
        尚未有資金進出紀錄，點擊上方按鈕記錄第一筆投入或提領
      </div>
    </div>

    <!-- 彈窗操作 Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div class="w-full max-w-sm rounded-2xl bg-[#161922] border border-white/10 p-5 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-white/5 pb-3">
          <div class="font-bold text-white text-sm">
            {{ modalType === 'in' ? '📥 投入營運本金' : modalType === 'out' ? '📤 提領資金/利潤' : '✏️ 更新目前蝦皮總餘額' }}
          </div>
          <button @click="showModal = false" class="text-zinc-500 hover:text-white text-xs">✕</button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[11px] text-zinc-400 block mb-1">
              {{ modalType === 'update_balance' ? '最新蝦皮帳戶與資金總餘額 (TWD)' : '操作金額 (TWD)' }}
            </label>
            <input
              type="number"
              v-model.number="modalAmount"
              placeholder="0"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label class="text-[11px] text-zinc-400 block mb-1">備註說明（選填）</label>
            <input
              type="text"
              v-model="modalNote"
              :placeholder="modalType === 'in' ? '例: 進貨周轉金' : modalType === 'out' ? '例: 本月營運分紅' : '例: 本週結算'"
              class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            @click="showModal = false"
            class="px-3.5 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-zinc-300 transition"
          >
            取消
          </button>
          <button
            @click="submitModal"
            class="px-4 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-black transition"
          >
            確認送出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useFinancialStore } from '../stores/useFinancialStore';

const store = useFinancialStore();

const showModal = ref(false);
const modalType = ref('in');
const modalAmount = ref(0);
const modalNote = ref('');

function openModal(type) {
  modalType.value = type;
  modalAmount.value = type === 'update_balance' ? store.shopeeSummary.currentValue : 0;
  modalNote.value = '';
  showModal.value = true;
}

function submitModal() {
  if (modalAmount.value < 0) {
    alert('金額不可小於 0');
    return;
  }

  if (modalType.value === 'update_balance') {
    store.updateShopeeAccountBalance(modalAmount.value, modalNote.value);
  } else {
    store.recordShopeeCashflow(modalType.value, modalAmount.value, modalNote.value);
  }

  showModal.value = false;
}

// 走勢圖計算
const svgWidth = 600;
const svgHeight = 160;

const chartPoints = computed(() => {
  const list = store.shopeeSummary.snapshots || [];
  if (list.length === 0) return [];

  const values = list.map(s => s.currentValue);
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;
  const range = maxVal - minVal || 1;

  const paddingX = 30;
  const paddingY = 20;
  const usableWidth = svgWidth - paddingX * 2;
  const usableHeight = svgHeight - paddingY * 2;
  const stepX = list.length > 1 ? usableWidth / (list.length - 1) : 0;

  return list.map((s, idx) => {
    const x = paddingX + idx * stepX;
    const ratio = (s.currentValue - minVal) / range;
    const y = svgHeight - paddingY - ratio * usableHeight;
    return {
      x: Math.round(x),
      y: Math.round(y),
      snapshot: s,
    };
  });
});

const polylinePoints = computed(() => {
  return chartPoints.value.map(p => `${p.x},${p.y}`).join(' ');
});

const areaPoints = computed(() => {
  if (chartPoints.value.length === 0) return '';
  const first = chartPoints.value[0];
  const last = chartPoints.value[chartPoints.value.length - 1];
  const base = `${last.x},${svgHeight} ${first.x},${svgHeight}`;
  return `${polylinePoints.value} ${base}`;
});
</script>
