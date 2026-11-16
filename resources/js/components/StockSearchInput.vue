<template>
  <div class="relative w-full">
    <div class="relative flex items-center">
      <input
        type="text"
        :value="modelValue"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        :placeholder="placeholder"
        class="input-dark font-mono uppercase pr-8"
        required
      />
      <span
        v-if="isLoading"
        class="absolute right-2.5 text-xs text-emerald-400 animate-spin pointer-events-none"
      >
        ⏳
      </span>
      <span
        v-else
        class="absolute right-2.5 text-xs text-zinc-500 pointer-events-none"
      >
        🔍
      </span>
    </div>

    <!-- 下拉自動推薦清單 (同時支援本地熱門與全市場即時搜尋 + 自訂保底) -->
    <div
      v-if="showSuggestions && (mergedSuggestions.length > 0 || (modelValue && modelValue.trim().length > 0))"
      class="absolute left-0 right-0 top-full mt-1 bg-[#1a1e28] border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-white/5 py-1 text-xs"
    >
      <div
        v-for="s in mergedSuggestions"
        :key="s.market + '_' + s.ticker"
        @mousedown.prevent="selectItem(s)"
        class="px-3 py-2 hover:bg-emerald-500/15 cursor-pointer flex items-center justify-between transition"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0"
            :class="s.market === 'US' ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'"
          >
            {{ s.market }}
          </span>
          <span class="font-bold text-white font-mono shrink-0">{{ s.ticker }}</span>
          <span class="text-zinc-300 truncate">{{ s.name }}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 ml-2">
          <span v-if="s.price" class="text-[11px] text-emerald-400 font-mono font-semibold">
            {{ s.price }}
          </span>
          <span class="text-[10px] text-zinc-500 font-mono">{{ s.currency }}</span>
        </div>
      </div>

      <!-- 自訂保底選項：若使用者輸入的代號不在清單或想強制使用自訂代號 -->
      <div
        v-if="modelValue && modelValue.trim().length > 0"
        @mousedown.prevent="selectCustomTyped"
        class="px-3 py-2 hover:bg-indigo-500/15 cursor-pointer flex items-center justify-between text-indigo-300 bg-white/[0.02]"
      >
        <div class="flex items-center gap-1.5">
          <span>✍️</span>
          <span>直接使用自訂代碼：<strong class="font-mono text-white">{{ modelValue.trim().toUpperCase() }}</strong></span>
        </div>
        <span class="text-[10px] text-zinc-400">自動查價 / 自訂</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

const props = defineProps({
  modelValue: String,
  marketType: {
    type: String,
    default: 'TW',
  },
  placeholder: {
    type: String,
    default: '輸入代號或中英文名稱搜尋 (亦可直接自訂)...',
  },
});

const emit = defineEmits(['update:modelValue', 'select', 'blur-ticker']);

const showSuggestions = ref(false);
const isLoading = ref(false);
const remoteResults = ref([]);
let searchTimer = null;

// 擴充常見台股 (上市/上櫃/熱門高股息與債券 ETF) 與美股熱門標的字典 (0ms 秒開無流量)
const popularStocks = [
  // 🇹🇼 台股權值股与熱門股
  { ticker: '2330', name: '台積電', market: 'TW', currency: 'TWD' },
  { ticker: '2317', name: '鴻海', market: 'TW', currency: 'TWD' },
  { ticker: '2454', name: '聯發科', market: 'TW', currency: 'TWD' },
  { ticker: '2308', name: '台達電', market: 'TW', currency: 'TWD' },
  { ticker: '2382', name: '廣達', market: 'TW', currency: 'TWD' },
  { ticker: '2881', name: '富邦金', market: 'TW', currency: 'TWD' },
  { ticker: '2882', name: '國泰金', market: 'TW', currency: 'TWD' },
  { ticker: '2891', name: '中信金', market: 'TW', currency: 'TWD' },
  { ticker: '2886', name: '兆豐金', market: 'TW', currency: 'TWD' },
  { ticker: '2884', name: '玉山金', market: 'TW', currency: 'TWD' },
  { ticker: '2892', name: '第一金', market: 'TW', currency: 'TWD' },
  { ticker: '2880', name: '華南金', market: 'TW', currency: 'TWD' },
  { ticker: '2885', name: '元大金', market: 'TW', currency: 'TWD' },
  { ticker: '2412', name: '中華電', market: 'TW', currency: 'TWD' },
  { ticker: '3045', name: '台灣大', market: 'TW', currency: 'TWD' },
  { ticker: '4904', name: '遠傳', market: 'TW', currency: 'TWD' },
  { ticker: '2603', name: '長榮', market: 'TW', currency: 'TWD' },
  { ticker: '2609', name: '陽明', market: 'TW', currency: 'TWD' },
  { ticker: '2615', name: '萬海', market: 'TW', currency: 'TWD' },
  { ticker: '2618', name: '長榮航', market: 'TW', currency: 'TWD' },
  { ticker: '2610', name: '華航', market: 'TW', currency: 'TWD' },
  { ticker: '3231', name: '緯創', market: 'TW', currency: 'TWD' },
  { ticker: '6669', name: '緯穎', market: 'TW', currency: 'TWD' },
  { ticker: '2357', name: '華碩', market: 'TW', currency: 'TWD' },
  { ticker: '2303', name: '聯電', market: 'TW', currency: 'TWD' },
  { ticker: '3711', name: '日月光投控', market: 'TW', currency: 'TWD' },
  { ticker: '2002', name: '中鋼', market: 'TW', currency: 'TWD' },
  { ticker: '1216', name: '統一', market: 'TW', currency: 'TWD' },
  { ticker: '3008', name: '大立光', market: 'TW', currency: 'TWD' },
  { ticker: '3293', name: '鈊象', market: 'TW', currency: 'TWD' },
  { ticker: '6488', name: '環球晶', market: 'TW', currency: 'TWD' },
  { ticker: '8069', name: '元太', market: 'TW', currency: 'TWD' },
  // 🇹🇼 台股熱門 ETF (含債券 ETF)
  { ticker: '0050', name: '元大台灣50', market: 'TW', currency: 'TWD' },
  { ticker: '006208', name: '富邦台50', market: 'TW', currency: 'TWD' },
  { ticker: '0056', name: '元大高股息', market: 'TW', currency: 'TWD' },
  { ticker: '00878', name: '國泰永續高股息', market: 'TW', currency: 'TWD' },
  { ticker: '00919', name: '群益台灣精選高息', market: 'TW', currency: 'TWD' },
  { ticker: '00929', name: '復華台灣科技優息', market: 'TW', currency: 'TWD' },
  { ticker: '00940', name: '元大台灣價值高息', market: 'TW', currency: 'TWD' },
  { ticker: '00939', name: '統一台灣高息動能', market: 'TW', currency: 'TWD' },
  { ticker: '00713', name: '元大台灣高息低波', market: 'TW', currency: 'TWD' },
  { ticker: '00915', name: '凱基優選高股息30', market: 'TW', currency: 'TWD' },
  { ticker: '00918', name: '大華優利高填息30', market: 'TW', currency: 'TWD' },
  { ticker: '00679B', name: '元大美債20年', market: 'TW', currency: 'TWD' },
  { ticker: '00687B', name: '國泰20年美債', market: 'TW', currency: 'TWD' },
  { ticker: '00937B', name: '群益ESG投等債20+', market: 'TW', currency: 'TWD' },
  { ticker: '00720B', name: '元大投資級公司債', market: 'TW', currency: 'TWD' },
  { ticker: '00751B', name: '元大AAA至A公司債', market: 'TW', currency: 'TWD' },
  { ticker: '00757', name: '統一FANG+', market: 'TW', currency: 'TWD' },
  { ticker: '00830', name: '國泰費城半導體', market: 'TW', currency: 'TWD' },
  { ticker: '00631L', name: '元大台灣50正2', market: 'TW', currency: 'TWD' },
  // 🇺🇸 美股主要熱門權值與指數 ETF
  { ticker: 'NVDA', name: '輝達 (NVIDIA)', market: 'US', currency: 'USD' },
  { ticker: 'AAPL', name: '蘋果 (Apple)', market: 'US', currency: 'USD' },
  { ticker: 'TSLA', name: '特斯拉 (Tesla)', market: 'US', currency: 'USD' },
  { ticker: 'MSFT', name: '微軟 (Microsoft)', market: 'US', currency: 'USD' },
  { ticker: 'GOOGL', name: 'Alphabet (Google)', market: 'US', currency: 'USD' },
  { ticker: 'AMZN', name: '亞馬遜 (Amazon)', market: 'US', currency: 'USD' },
  { ticker: 'META', name: 'Meta (Facebook)', market: 'US', currency: 'USD' },
  { ticker: 'AVGO', name: '博通 (Broadcom)', market: 'US', currency: 'USD' },
  { ticker: 'TSM', name: '台積電 ADR (TSMC)', market: 'US', currency: 'USD' },
  { ticker: 'AMD', name: '超微半導體 (AMD)', market: 'US', currency: 'USD' },
  { ticker: 'PLTR', name: 'Palantir Technologies', market: 'US', currency: 'USD' },
  { ticker: 'COIN', name: 'Coinbase Global', market: 'US', currency: 'USD' },
  { ticker: 'MSTR', name: 'MicroStrategy', market: 'US', currency: 'USD' },
  { ticker: 'NFLX', name: 'Netflix (網飛)', market: 'US', currency: 'USD' },
  { ticker: 'BRK-B', name: '波克夏海瑟威 (Berkshire)', market: 'US', currency: 'USD' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'US', currency: 'USD' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', market: 'US', currency: 'USD' },
  { ticker: 'QQQ', name: 'Invesco 納斯達克 100 ETF', market: 'US', currency: 'USD' },
  { ticker: 'VT', name: 'Vanguard 全世界股票 ETF', market: 'US', currency: 'USD' },
  { ticker: 'VTI', name: 'Vanguard 整體股市 ETF', market: 'US', currency: 'USD' },
  { ticker: 'SOXX', name: 'iShares 半導體 ETF', market: 'US', currency: 'USD' },
  { ticker: 'SMH', name: 'VanEck 半導體 ETF', market: 'US', currency: 'USD' },
  { ticker: 'TLT', name: 'iShares 20年期以上美國公債 ETF', market: 'US', currency: 'USD' },
];

const mergedSuggestions = computed(() => {
  const query = (props.modelValue || '').trim().toLowerCase();
  if (!query) {
    return popularStocks.filter(s => s.market === props.marketType).slice(0, 8);
  }

  // 先從本地字典模糊比對
  const localMatches = popularStocks.filter(s => {
    return s.ticker.toLowerCase().includes(query) || s.name.toLowerCase().includes(query);
  });

  // 合併後端即時搜尋結果並去重
  const map = new Map();
  [...remoteResults.value, ...localMatches].forEach(item => {
    const key = `${item.market}_${item.ticker}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values()).slice(0, 10);
});

function handleFocus() {
  showSuggestions.value = true;
}

function handleInput(e) {
  const val = e.target.value.toUpperCase();
  emit('update:modelValue', val);
  showSuggestions.value = true;

  clearTimeout(searchTimer);
  const q = val.trim();
  if (q.length < 2) {
    remoteResults.value = [];
    return;
  }

  // 防抖 350ms 查詢全市場股票
  searchTimer = setTimeout(async () => {
    isLoading.value = true;
    try {
      const res = await axios.get('/api/v1/market/stocks/search', {
        params: { q },
      });
      if (res.data && Array.isArray(res.data.items)) {
        remoteResults.value = res.data.items;
      }
    } catch (err) {
      // 忽略錯誤，使用本地字典與自訂保底
    } finally {
      isLoading.value = false;
    }
  }, 350);
}

function selectItem(item) {
  emit('update:modelValue', item.ticker);
  emit('select', item);
  showSuggestions.value = false;
}

function selectCustomTyped() {
  const raw = (props.modelValue || '').trim().toUpperCase();
  if (!raw) return;
  const isTw = /^[0-9]{4,6}[A-Z]?$/.test(raw) || raw.endsWith('.TW') || raw.endsWith('.TWO');
  emit('select', {
    ticker: raw,
    name: '',
    market: isTw ? 'TW' : (props.marketType || 'TW'),
    currency: isTw ? 'TWD' : (props.marketType === 'US' ? 'USD' : 'TWD'),
  });
  showSuggestions.value = false;
}

function handleBlur() {
  setTimeout(() => {
    showSuggestions.value = false;
    const raw = (props.modelValue || '').trim().toUpperCase();
    if (raw) {
      emit('blur-ticker', raw);
    }
  }, 220);
}
</script>

<style scoped>
.input-dark {
  width: 100%;
  min-height: 42px;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  color: #fff;
  outline: none;
  transition: border-color 0.15s, background-color 0.15s;
}
.input-dark:focus {
  border-color: #10b981;
  background-color: rgba(255, 255, 255, 0.08);
}
</style>
