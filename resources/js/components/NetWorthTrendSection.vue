<template>
  <div class="rounded-2xl bg-[#11141a] border border-white/5 p-4 sm:p-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-white/5 gap-3">
      <div>
        <div class="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
          <span>📈 淨資產歷史成長趨勢</span>
          <span v-if="latestMonthGrowth" class="text-xs font-mono font-semibold" :class="latestMonthGrowth.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'">
            {{ latestMonthGrowth.amount >= 0 ? '▲ +' : '▼ ' }}{{ store.formatMoney(latestMonthGrowth.amount, 'NT$ ', 0) }}
            ({{ latestMonthGrowth.pct >= 0 ? '+' : '' }}{{ latestMonthGrowth.pct.toFixed(1) }}%)
          </span>
        </div>
        <div class="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
          每次新日期儲存自動留存軌跡 · 追蹤長年資產累積階梯
        </div>
      </div>

      <!-- 記錄快照按鈕 -->
      <button
        @click="handleRecordSnapshot"
        class="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition flex items-center gap-1.5 shadow-sm"
      >
        <span>📸</span>
        <span>手動記錄當前快照</span>
      </button>
    </div>

    <!-- 1. SVG 淨值成長折線圖 -->
    <div v-if="store.historicalSnapshots.length >= 2" class="mt-4 pt-2">
      <div class="w-full h-44 sm:h-52 relative">
        <svg class="w-full h-full overflow-visible" :viewBox="`0 0 ${svgWidth} ${svgHeight}`" preserveAspectRatio="none">
          <defs>
            <linearGradient id="networth-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- 網格水平虛線 -->
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

          <!-- 折線陰影填色區域 -->
          <polygon :points="areaPoints" fill="url(#networth-grad)" />

          <!-- 折線本體 -->
          <polyline
            :points="polylinePoints"
            fill="none"
            stroke="#10b981"
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
              fill="#10b981"
              stroke="#090b0e"
              stroke-width="2.5"
              class="cursor-pointer transition-transform hover:scale-125"
              @click="selectedPoint = p"
            />
          </g>
        </svg>

        <!-- X 軸日期標籤 -->
        <div class="flex items-center justify-between text-[10px] text-zinc-500 mt-2 px-2 font-mono">
          <span v-for="s in store.historicalSnapshots" :key="s.id">{{ s.date || s.month }}</span>
        </div>
      </div>
    </div>

    <!-- 若快照少於 2 筆時的引導畫面 -->
    <div v-else class="py-8 text-center text-xs text-zinc-500 space-y-2">
      <div class="text-2xl">📸</div>
      <div>目前已記錄 {{ store.historicalSnapshots.length }} 筆快照（需至少 2 筆即可繪製成長折線圖）</div>
      <div class="text-[11px] text-zinc-600">每個月發薪或結算時點擊上方按鈕，系統將自動為您繪製專屬的資產階梯曲線！</div>
    </div>

    <!-- 2. 快照歷史清單卡片 -->
    <div v-if="store.historicalSnapshots.length > 0" class="mt-4 pt-3 border-t border-white/5 space-y-2">
      <div class="text-xs font-semibold text-zinc-400 mb-2">歷史快照明細</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <div
          v-for="(snap, idx) in sortedSnapshotsDesc"
          :key="snap.id || idx"
          class="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition space-y-1.5"
        >
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-white font-mono">{{ snap.month }}</span>
            <span class="text-[10px] text-zinc-500">{{ snap.date }}</span>
          </div>
          <div class="flex items-baseline justify-between">
            <div class="font-mono font-bold text-base text-emerald-400">
              {{ store.formatMoney(snap.netWorthTwd) }}
            </div>
            <button
              @click="deleteSnapshot(snap.id)"
              class="text-[11px] text-rose-400/70 hover:text-rose-400 px-1 py-0.5 rounded transition"
            >
              刪除
            </button>
          </div>
          <div class="text-[10px] text-zinc-500 flex items-center justify-between font-mono">
            <span>資產: {{ store.formatMoney(snap.grossAssetsTwd) }}</span>
            <span>負債: {{ store.formatMoney(snap.totalDebtTwd) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useFinancialStore } from '../stores/useFinancialStore';

const store = useFinancialStore();

const svgWidth = 600;
const svgHeight = 160;
const selectedPoint = ref(null);

const sortedSnapshotsDesc = computed(() => {
  return [...store.historicalSnapshots].sort((a, b) => (a.month < b.month ? 1 : -1));
});

const latestMonthGrowth = computed(() => {
  const list = store.historicalSnapshots;
  if (list.length < 2) return null;
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const amount = last.netWorthTwd - prev.netWorthTwd;
  const pct = prev.netWorthTwd > 0 ? (amount / prev.netWorthTwd) * 100 : 0;
  return { amount, pct };
});

const chartPoints = computed(() => {
  const list = store.historicalSnapshots;
  if (list.length === 0) return [];

  const values = list.map(s => s.netWorthTwd);
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
    const ratio = (s.netWorthTwd - minVal) / range;
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

function handleRecordSnapshot() {
  const note = prompt('請輸入本月快照備註（選填）：', `${new Date().getMonth() + 1}月資產結算`);
  if (note !== null) {
    store.recordSnapshot(note);
  }
}

function deleteSnapshot(id) {
  if (confirm('確定要刪除這筆月份快照紀錄嗎？')) {
    const idx = store.historicalSnapshots.findIndex(s => s.id === id);
    if (idx >= 0) {
      store.deleteSnapshot(idx);
    }
  }
}
</script>

