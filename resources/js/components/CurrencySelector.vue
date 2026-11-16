<template>
  <div class="relative w-full">
    <div class="relative flex items-center">
      <input
        type="text"
        :value="modelValue"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        :placeholder="isCryptoMode ? '搜尋代號或幣名 (如 BTC, SUI, DOGE)...' : '搜尋幣別 (如 TWD, USD, JPY)...'"
        class="input-dark font-mono uppercase pr-8"
        required
      />
      <span
        v-if="isLoading"
        class="absolute right-2.5 text-xs text-amber-400 animate-spin pointer-events-none"
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

    <!-- 智慧模糊搜尋下拉選單 (支援熱門推薦 + CoinGecko 全球搜尋 + 自訂保底) -->
    <div
      v-if="showDropdown && (filteredOptions.length > 0 || (modelValue && modelValue.trim().length > 0))"
      class="absolute left-0 right-0 top-full mt-1 bg-[#1a1e28] border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-white/5 py-1 text-xs"
    >
      <div
        v-for="item in filteredOptions"
        :key="item.code + '_' + (item.coingeckoId || item.name)"
        @mousedown.prevent="selectOption(item)"
        class="px-3 py-2 hover:bg-amber-500/15 cursor-pointer flex items-center justify-between transition"
      >
        <div class="flex items-center gap-2 min-w-0">
          <img
            v-if="item.thumb"
            :src="item.thumb"
            class="w-4 h-4 rounded-full shrink-0"
            alt=""
          />
          <span v-else class="text-sm shrink-0">{{ item.icon || (isCryptoMode ? '🪙' : '💵') }}</span>
          <span class="font-bold text-white font-mono shrink-0">{{ item.code }}</span>
          <span class="text-zinc-300 truncate">{{ item.name }}</span>
        </div>
        <span v-if="item.rank" class="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
          #{{ item.rank }}
        </span>
      </div>

      <!-- 自訂保底選項：萬一搜尋不到或想強制使用自訂幣別 -->
      <div
        v-if="modelValue && modelValue.trim().length > 0"
        @mousedown.prevent="selectCustomTyped"
        class="px-3 py-2 hover:bg-indigo-500/15 cursor-pointer flex items-center justify-between text-indigo-300 bg-white/[0.02]"
      >
        <div class="flex items-center gap-1.5">
          <span>✍️</span>
          <span>直接使用自訂幣別：<strong class="font-mono text-white">{{ modelValue.trim().toUpperCase() }}</strong></span>
        </div>
        <span class="text-[10px] text-zinc-400">自訂保底</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'TWD',
  },
  isCryptoMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'select-crypto']);

const showDropdown = ref(false);
const isLoading = ref(false);
const remoteCryptoResults = ref([]);
let searchTimer = null;

// 法定貨幣完整常用清單
const fiatOptions = [
  { code: 'TWD', name: '新台幣 (TWD)', icon: '🇹🇼' },
  { code: 'USD', name: '美金 (USD)', icon: '🇺🇸' },
  { code: 'JPY', name: '日圓 (JPY)', icon: '🇯🇵' },
  { code: 'EUR', name: '歐元 (EUR)', icon: '🇪🇺' },
  { code: 'CNY', name: '人民幣 (CNY)', icon: '🇨🇳' },
  { code: 'HKD', name: '港幣 (HKD)', icon: '🇭🇰' },
  { code: 'GBP', name: '英鎊 (GBP)', icon: '🇬🇧' },
  { code: 'SGD', name: '新加坡幣 (SGD)', icon: '🇸🇬' },
  { code: 'AUD', name: '澳幣 (AUD)', icon: '🇦🇺' },
  { code: 'CAD', name: '加幣 (CAD)', icon: '🇨🇦' },
  { code: 'CHF', name: '瑞士法郎 (CHF)', icon: '🇨🇭' },
  { code: 'KRW', name: '韓元 (KRW)', icon: '🇰🇷' },
  { code: 'THB', name: '泰銖 (THB)', icon: '🇹🇭' },
  { code: 'NZD', name: '紐西蘭幣 (NZD)', icon: '🇳🇿' },
];

// 內建百大熱門加密貨幣字典 (含 CoinGecko 官方 ID，0ms 秒開不耗流量)
const cryptoOptions = [
  { code: 'USDT', name: 'Tether 泰達幣', coingeckoId: 'tether', icon: '🟢', rank: 3 },
  { code: 'BTC', name: 'Bitcoin 比特幣', coingeckoId: 'bitcoin', icon: '🟠', rank: 1 },
  { code: 'ETH', name: 'Ethereum 以太幣', coingeckoId: 'ethereum', icon: '🔷', rank: 2 },
  { code: 'SOL', name: 'Solana 索拉納', coingeckoId: 'solana', icon: '🟣', rank: 4 },
  { code: 'BNB', name: 'BNB 幣安幣', coingeckoId: 'binancecoin', icon: '🟡', rank: 5 },
  { code: 'XRP', name: 'XRP 瑞波幣', coingeckoId: 'ripple', icon: '⚪', rank: 6 },
  { code: 'DOGE', name: 'Dogecoin 狗狗幣', coingeckoId: 'dogecoin', icon: '🐕', rank: 7 },
  { code: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin', icon: '🔵', rank: 8 },
  { code: 'ADA', name: 'Cardano 艾達幣', coingeckoId: 'cardano', icon: '🔵', rank: 9 },
  { code: 'TRX', name: 'TRON 波場幣', coingeckoId: 'tron', icon: '🔴', rank: 10 },
  { code: 'AVAX', name: 'Avalanche 雪崩幣', coingeckoId: 'avalanche-2', icon: '🔺', rank: 11 },
  { code: 'TON', name: 'Toncoin', coingeckoId: 'the-open-network', icon: '💎', rank: 12 },
  { code: 'SHIB', name: 'Shiba Inu 柴犬幣', coingeckoId: 'shiba-inu', icon: '🐕', rank: 13 },
  { code: 'SUI', name: 'Sui', coingeckoId: 'sui', icon: '💧', rank: 14 },
  { code: 'DOT', name: 'Polkadot 波卡幣', coingeckoId: 'polkadot', icon: '🟣', rank: 15 },
  { code: 'LINK', name: 'Chainlink', coingeckoId: 'chainlink', icon: '🔗', rank: 16 },
  { code: 'BCH', name: 'Bitcoin Cash', coingeckoId: 'bitcoin-cash', icon: '🟢', rank: 17 },
  { code: 'NEAR', name: 'NEAR Protocol', coingeckoId: 'near', icon: '⚫', rank: 18 },
  { code: 'PEPE', name: 'Pepe 佩佩蛙', coingeckoId: 'pepe', icon: '🐸', rank: 19 },
  { code: 'LTC', name: 'Litecoin 萊特幣', coingeckoId: 'litecoin', icon: '⚪', rank: 20 },
  { code: 'UNI', name: 'Uniswap', coingeckoId: 'uniswap', icon: '🦄', rank: 21 },
  { code: 'APT', name: 'Aptos', coingeckoId: 'aptos', icon: '⚫', rank: 22 },
  { code: 'ICP', name: 'Internet Computer', coingeckoId: 'internet-computer', icon: '♾️', rank: 23 },
  { code: 'POL', name: 'Polygon (POL)', coingeckoId: 'polygon-ecosystem-token', icon: '🟣', rank: 24 },
  { code: 'MATIC', name: 'Polygon (MATIC)', coingeckoId: 'matic-network', icon: '🟣', rank: 25 },
  { code: 'ETC', name: 'Ethereum Classic', coingeckoId: 'ethereum-classic', icon: '🟢', rank: 26 },
  { code: 'RENDER', name: 'Render', coingeckoId: 'render-token', icon: '🔴', rank: 27 },
  { code: 'CRO', name: 'Cronos (Crypto.com)', coingeckoId: 'crypto-com-chain', icon: '🔵', rank: 28 },
  { code: 'OKB', name: 'OKB', coingeckoId: 'okb', icon: '⚫', rank: 29 },
  { code: 'BGB', name: 'Bitget Token', coingeckoId: 'bitget-token', icon: '🩵', rank: 30 },
  { code: 'KAS', name: 'Kaspa', coingeckoId: 'kaspa', icon: '🟢', rank: 31 },
  { code: 'ARB', name: 'Arbitrum', coingeckoId: 'arbitrum', icon: '🔵', rank: 32 },
  { code: 'OP', name: 'Optimism', coingeckoId: 'optimism', icon: '🔴', rank: 33 },
  { code: 'ATOM', name: 'Cosmos', coingeckoId: 'cosmos', icon: '⚛️', rank: 34 },
  { code: 'FIL', name: 'Filecoin', coingeckoId: 'filecoin', icon: '🔵', rank: 35 },
  { code: 'INJ', name: 'Injective', coingeckoId: 'injective-protocol', icon: '🔵', rank: 36 },
  { code: 'AAVE', name: 'Aave', coingeckoId: 'aave', icon: '👻', rank: 37 },
  { code: 'WIF', name: 'dogwifhat', coingeckoId: 'dogwifcoin', icon: '🐶', rank: 38 },
  { code: 'BONK', name: 'Bonk', coingeckoId: 'bonk', icon: '🐕', rank: 39 },
  { code: 'FLOKI', name: 'FLOKI', coingeckoId: 'floki', icon: '🐕', rank: 40 },
  { code: 'FTM', name: 'Fantom', coingeckoId: 'fantom', icon: '🔵', rank: 41 },
  { code: 'SEI', name: 'Sei', coingeckoId: 'sei-network', icon: '🔴', rank: 42 },
  { code: 'TIA', name: 'Celestia', coingeckoId: 'celestia', icon: '🟣', rank: 43 },
  { code: 'WLD', name: 'Worldcoin', coingeckoId: 'worldcoin-wld', icon: '🌐', rank: 44 },
  { code: 'JUP', name: 'Jupiter', coingeckoId: 'jupiter-exchange-solana', icon: '🪐', rank: 45 },
  { code: 'PYTH', name: 'Pyth Network', coingeckoId: 'pyth-network', icon: '🟣', rank: 46 },
  { code: 'ORDI', name: 'ORDI', coingeckoId: 'ordi', icon: '🟠', rank: 47 },
  { code: 'RUNE', name: 'THORChain', coingeckoId: 'thorchain', icon: '⚡', rank: 48 },
  { code: 'MNT', name: 'Mantle', coingeckoId: 'mantle', icon: '⚫', rank: 49 },
  { code: 'GT', name: 'GateToken', coingeckoId: 'gatetoken', icon: '🔵', rank: 50 },
];

const filteredOptions = computed(() => {
  const baseList = props.isCryptoMode ? cryptoOptions : fiatOptions;
  const q = (props.modelValue || '').trim().toLowerCase();

  if (!q) {
    return baseList.slice(0, 12);
  }

  // 本地模糊比對
  const localMatches = baseList.filter(item => {
    return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  });

  if (!props.isCryptoMode) {
    return localMatches.length > 0 ? localMatches : baseList.slice(0, 8);
  }

  // 合併 CoinGecko 遠端即時搜尋結果並去重
  const map = new Map();
  [...localMatches, ...remoteCryptoResults.value].forEach(item => {
    const key = item.coingeckoId || `${item.code}_${item.name}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values()).slice(0, 12);
});

function handleFocus() {
  showDropdown.value = true;
}

function handleInput(e) {
  const val = e.target.value.toUpperCase();
  emit('update:modelValue', val);
  showDropdown.value = true;

  if (!props.isCryptoMode) return;

  clearTimeout(searchTimer);
  const q = val.trim();
  if (q.length < 2) {
    remoteCryptoResults.value = [];
    return;
  }

  // 前端瀏覽器直接查詢 CoinGecko 官方公開 Search API (0 Cloud Run 伺服器流量消耗)
  searchTimer = setTimeout(async () => {
    isLoading.value = true;
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.coins)) {
          remoteCryptoResults.value = data.coins.slice(0, 10).map(c => ({
            code: String(c.symbol || '').toUpperCase(),
            name: c.name || c.symbol,
            coingeckoId: c.id,
            thumb: c.thumb,
            rank: c.market_cap_rank,
          }));
        }
      }
    } catch (err) {
      // 忽略錯誤，使用本地字典與自訂保底
    } finally {
      isLoading.value = false;
    }
  }, 350);
}

function selectOption(item) {
  emit('update:modelValue', item.code);
  if (props.isCryptoMode) {
    emit('select-crypto', item);
  }
  showDropdown.value = false;
}

function selectCustomTyped() {
  const code = (props.modelValue || '').trim().toUpperCase();
  if (!code) return;
  emit('update:modelValue', code);
  if (props.isCryptoMode) {
    // 檢查本地或遠端是否有剛好同名代號的項目
    const matched = [...cryptoOptions, ...remoteCryptoResults.value].find(c => c.code === code);
    emit('select-crypto', matched || { code, name: code, coingeckoId: '' });
  }
  showDropdown.value = false;
}

function handleBlur() {
  setTimeout(() => {
    showDropdown.value = false;
    if (props.isCryptoMode && props.modelValue) {
      const code = props.modelValue.trim().toUpperCase();
      const matched = [...cryptoOptions, ...remoteCryptoResults.value].find(c => c.code === code);
      if (matched) {
        emit('select-crypto', matched);
      } else {
        emit('select-crypto', { code, name: '', coingeckoId: '' });
      }
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
  border-color: #f59e0b;
  background-color: rgba(255, 255, 255, 0.08);
}
</style>
