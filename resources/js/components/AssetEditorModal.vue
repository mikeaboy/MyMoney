<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
    <!-- 半透明背景遮罩 -->
    <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="close"></div>

    <!-- 彈窗主體 (手機版貼底抽屜式，電腦版置中卡片) -->
    <div class="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#14171f] border border-white/10 shadow-2xl p-5 sm:p-6 z-10 text-zinc-100 max-h-[92vh] overflow-y-auto">
      <!-- 頂部手機把手指示條 -->
      <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden"></div>

      <!-- 標題與關閉按鈕 -->
      <div class="flex items-center justify-between pb-3.5 border-b border-white/10">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>{{ modalTitle }}</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-normal">
            {{ isEditing ? '編輯項目' : '新增項目' }}
          </span>
        </h3>
        <button @click="close" class="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition min-w-[36px] min-h-[36px] flex items-center justify-center">
          ✕
        </button>
      </div>

      <!-- 表單內容 -->
      <form @submit.prevent="handleSubmit" class="mt-4 space-y-3.5 sm:space-y-4 text-xs">
        
        <!-- ==================== 1. 銀行帳戶表單 ==================== -->
        <template v-if="type === 'bank'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">銀行機構名稱</label>
              <input v-model="form.bankName" type="text" placeholder="例如: 國泰世華" required class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">帳戶類型</label>
              <input v-model="form.accountType" type="text" placeholder="例如: 活存 / 薪轉" class="input-dark" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">計價幣別</label>
              <CurrencySelector v-model="form.currency" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">帳戶餘額</label>
              <input v-model.number="form.balance" type="number" step="any" placeholder="0" required class="input-dark font-mono font-semibold" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">預估年利率 (%)</label>
              <input v-model.number="form.interestRate" type="number" step="0.01" placeholder="1.5" class="input-dark font-mono" />
            </div>
          </div>
          <!-- 等值即時換算參考 -->
          <div v-if="form.balance" class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-zinc-400">
            <span>折合價值參考：</span>
            <span class="font-mono text-zinc-200">
              ≈ {{ store.formatMoney(store.convertToTwd(form.balance, form.currency)) }}
              <span class="text-zinc-500 text-[11px] ml-1">({{ store.formatMoney(store.convertTwdToUsdt(store.convertToTwd(form.balance, form.currency)), '$ ', 1) }} USDT)</span>
            </span>
          </div>
        </template>

        <!-- ==================== 2. 股票持倉表單 (含台股/美股與公司名稱) ==================== -->
        <template v-else-if="type === 'stock'">
          <div>
            <label class="block text-zinc-400 mb-1.5">市場類別</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="setStockMarket('TW')"
                class="py-2 px-3 rounded-xl border text-center transition font-medium"
                :class="form.marketType !== 'US' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'"
              >
                🇹🇼 台灣股市 (TWD)
              </button>
              <button
                type="button"
                @click="setStockMarket('US')"
                class="py-2 px-3 rounded-xl border text-center transition font-medium"
                :class="form.marketType === 'US' ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'"
              >
                🇺🇸 美國股市 (USD)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">券商帳戶</label>
              <input v-model="form.brokerName" type="text" :placeholder="form.marketType === 'US' ? '例如: Firstrade / 複委託' : '例如: 富邦證券'" class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">
                股票代號
                <span class="text-[10px] text-zinc-500 ml-1">(可打中文搜尋或自訂)</span>
              </label>
              <StockSearchInput
                v-model="form.ticker"
                :market-type="form.marketType || 'TW'"
                @select="handleStockSelected"
                @blur-ticker="handleStockTickerBlur"
              />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">公司/標的簡稱</label>
              <input v-model="form.name" type="text" placeholder="例如: 台積電 / 輝達 (自動帶出)" class="input-dark font-medium" />
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">計價幣別</label>
              <CurrencySelector v-model="form.currency" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">持有股數</label>
              <input v-model.number="form.shares" type="number" step="any" placeholder="1000" required class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">平均成本價</label>
              <input v-model.number="form.costPrice" type="number" step="any" placeholder="100" class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">目前現價</label>
              <input v-model.number="form.currentPrice" type="number" step="any" placeholder="120" required class="input-dark font-mono font-semibold text-emerald-400" />
            </div>
          </div>

          <!-- 即時市值換算 -->
          <div v-if="form.shares && form.currentPrice" class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-zinc-400">
            <span>預估總市值：</span>
            <span class="font-mono text-zinc-200">
              ≈ {{ store.formatMoney(store.convertToTwd(form.shares * form.currentPrice, form.currency)) }}
              <span class="text-zinc-500 text-[11px] ml-1">({{ store.formatMoney(store.convertTwdToUsdt(store.convertToTwd(form.shares * form.currentPrice, form.currency)), '$ ', 1) }} USDT)</span>
            </span>
          </div>
        </template>

        <!-- ==================== 3. 基金投資表單 ==================== -->
        <template v-else-if="type === 'fund'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">申購平台 / 帳戶</label>
              <input v-model="form.platform" type="text" placeholder="例如: 基富通 / 鉅亨買基金" class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">基金名稱 / 標的</label>
              <input v-model="form.fundName" type="text" placeholder="例如: 摩根全方位科技基金" required class="input-dark" />
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">計價幣別</label>
              <CurrencySelector v-model="form.currency" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">持有單位數</label>
              <input v-model.number="form.units" type="number" step="any" placeholder="1500.25" required class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">平均申購淨值</label>
              <input v-model.number="form.costNav" type="number" step="any" placeholder="15.2" class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">最新參考淨值</label>
              <input v-model.number="form.currentNav" type="number" step="any" placeholder="18.5" required class="input-dark font-mono font-semibold text-cyan-400" />
            </div>
          </div>
          <!-- 基金市值試算 -->
          <div v-if="form.units && (form.currentNav || form.costNav)" class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-zinc-400">
            <span>基金市值參考：</span>
            <span class="font-mono text-zinc-200">
              ≈ {{ store.formatMoney(store.convertToTwd(form.units * (form.currentNav || form.costNav), form.currency)) }}
              <span class="text-zinc-500 text-[11px] ml-1">({{ store.formatMoney(store.convertTwdToUsdt(store.convertToTwd(form.units * (form.currentNav || form.costNav), form.currency)), '$ ', 1) }} USDT)</span>
            </span>
          </div>
        </template>

        <!-- ==================== 4. 加密貨幣表單 ==================== -->
        <template v-else-if="type === 'crypto'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">存放錢包 / 交易所</label>
              <input v-model="form.walletName" type="text" placeholder="例如: 幣安 (Binance) / 冷錢包" required class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">幣種搜尋 (支援全球幣種搜尋或直接自訂)</label>
              <CurrencySelector
                v-model="form.symbol"
                :is-crypto-mode="true"
                @select-crypto="handleCryptoSelected"
              />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">幣種全名 (自動帶出或自訂)</label>
              <input v-model="form.name" type="text" placeholder="例如: Bitcoin / Sui" class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">持有數量</label>
              <input v-model.number="form.amount" type="number" step="any" placeholder="0.5" required class="input-dark font-mono font-semibold text-amber-400" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">目前單價 USD (自動抓取/可自訂)</label>
              <input v-model.number="form.customPriceUsd" type="number" step="any" placeholder="自動抓取即時幣價" class="input-dark font-mono text-emerald-400" />
            </div>
          </div>
          <!-- 即時查詢折合 USDT 與台幣 -->
          <div v-if="form.amount && form.symbol" class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <div class="flex items-center justify-between text-zinc-300">
              <span>即時參考單價：</span>
              <span class="font-mono font-semibold text-white">
                ${{ (Number(form.customPriceUsd) || store.getCryptoPriceUsd(form.symbol, form)).toLocaleString(undefined, { maximumFractionDigits: 8 }) }} USD
              </span>
            </div>
            <div class="flex items-center justify-between text-amber-300 font-medium">
              <span>等值 USDT：</span>
              <span class="font-mono font-bold">
                ≈ {{ store.formatMoney(form.amount * (Number(form.customPriceUsd) || store.getCryptoPriceUsd(form.symbol, form)), '$ ', 2) }} USDT
              </span>
            </div>
            <div class="flex items-center justify-between text-zinc-300">
              <span>折合新台幣：</span>
              <span class="font-mono font-bold text-white">
                ≈ {{ store.formatMoney(form.amount * (Number(form.customPriceUsd) || store.getCryptoPriceUsd(form.symbol, form)) * store.getRateToTwd('USD')) }}
              </span>
            </div>
          </div>
        </template>

        <!-- ==================== 5. 貸款負債表單 ==================== -->
        <template v-else-if="type === 'loan'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">貸款項目名稱</label>
              <input v-model="form.name" type="text" placeholder="例如: 新青安房貸 (A銀行)" required class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">目前剩餘本金 (TWD)</label>
              <input v-model.number="form.principal" type="number" step="any" placeholder="8000000" required class="input-dark font-mono font-semibold text-rose-400" />
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">年利率 (%)</label>
              <input v-model.number="form.interestRate" type="number" step="0.01" placeholder="2.18" required class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">總期數 (月)</label>
              <input v-model.number="form.totalMonths" type="number" placeholder="360" required class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">寬限期 (月)</label>
              <input v-model.number="form.gracePeriodMonths" type="number" placeholder="36" class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">剩餘期數 (月)</label>
              <input v-model.number="form.remainingMonths" type="number" placeholder="340" required class="input-dark font-mono" />
            </div>
          </div>
          <div>
            <label class="block text-zinc-400 mb-1">自訂寬限期內月繳金額 (TWD，選填)</label>
            <input v-model="form.customGraceMonthlyPay" type="number" step="any" placeholder="留空則依本金×月利率自動計算" class="input-dark font-mono" />
          </div>
        </template>

        <!-- ==================== 6. 信用卡帳單與分期表單 ==================== -->
        <template v-else-if="type === 'creditCard'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">發卡銀行機構</label>
              <input v-model="form.bankName" type="text" placeholder="例如: 國泰世華 / 玉山" required class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">卡片名稱</label>
              <input v-model="form.cardName" type="text" placeholder="例如: CUBE 卡 / 雙幣卡" required class="input-dark" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">每月自動扣款日 (1~31)</label>
              <input v-model.number="form.payDay" type="number" min="1" max="31" placeholder="15" class="input-dark font-mono" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">本期應繳帳單 (TWD)</label>
              <input v-model.number="form.currentDueAmount" type="number" step="any" placeholder="18500" class="input-dark font-mono font-semibold text-rose-400" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">剩餘未到期分期款 (TWD)</label>
              <input v-model.number="form.remainingInstallmentAmount" type="number" step="any" placeholder="32000" class="input-dark font-mono" />
            </div>
          </div>
          <div v-if="form.currentDueAmount || form.remainingInstallmentAmount" class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-zinc-300">
            <span>合計卡費負債：</span>
            <span class="font-mono font-bold text-rose-400">
              -{{ store.formatMoney(Number(form.currentDueAmount || 0) + Number(form.remainingInstallmentAmount || 0)) }}
            </span>
          </div>
        </template>

        <!-- ==================== 7. 儲蓄險資產表單 ==================== -->
        <template v-else-if="type === 'insurance'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">保險公司</label>
              <input v-model="form.company" type="text" placeholder="例如: 富邦人壽" required class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">保單名稱</label>
              <input v-model="form.policyName" type="text" placeholder="例如: 美元利率變動型終身壽險" required class="input-dark" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">計價幣別</label>
              <CurrencySelector v-model="form.currency" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">目前保單解約現金價值</label>
              <input v-model.number="form.cashValue" type="number" step="any" placeholder="10000" required class="input-dark font-mono font-semibold" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">預估宣告/分紅利率 (%)</label>
              <input v-model.number="form.annualReturnRate" type="number" step="0.01" placeholder="3.8" class="input-dark font-mono" />
            </div>
          </div>
        </template>

        <!-- ==================== 8. 🌟 定期保障型保險支出表單 ==================== -->
        <template v-else-if="type === 'protectionInsurance'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">保險公司</label>
              <input v-model="form.company" type="text" placeholder="例如: 國泰人壽 / 南山人壽" required class="input-dark" />
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">保單名稱</label>
              <input v-model="form.policyName" type="text" placeholder="例如: 實支實付醫療險 / 意外責任險" required class="input-dark" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">險種分類</label>
              <select v-model="form.category" class="input-dark">
                <option value="醫療實支">🏥 醫療實支實付</option>
                <option value="重大傷病/癌症">🎗️ 重大傷病 / 癌症險</option>
                <option value="意外傷害">🩹 意外傷害險</option>
                <option value="定期壽險">🕊️ 定期壽險</option>
                <option value="汽機車/責任險">🚗 汽機車責任險</option>
                <option value="其他保障">🛡️ 其他保障保險</option>
              </select>
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">繳費週期</label>
              <select v-model="form.payFrequency" class="input-dark">
                <option value="yearly">📅 年繳 (每年一次)</option>
                <option value="monthly">📆 月繳 (每月扣款)</option>
              </select>
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">每期保費金額 (TWD)</label>
              <input v-model.number="form.premiumAmount" type="number" step="any" placeholder="36000" required class="input-dark font-mono font-semibold text-rose-400" />
            </div>
          </div>
          <!-- 月平均換算說明 -->
          <div v-if="form.premiumAmount" class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-zinc-400">
            <span>折合每月固定保費負擔：</span>
            <span class="font-mono text-zinc-200">
              ≈ NT$ {{ Math.round(form.payFrequency === 'monthly' ? form.premiumAmount : form.premiumAmount / 12).toLocaleString() }} /月
              <span class="text-zinc-500 text-[11px] ml-1">(自動納入每月現金流支出)</span>
            </span>
          </div>
        </template>

        <!-- ==================== 9. 定期收支表單 ==================== -->
        <template v-else-if="type === 'cashflow'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-zinc-400 mb-1">項目類別</label>
              <select v-model="form.flowType" class="input-dark">
                <option value="income">💰 每月固定收入</option>
                <option value="expense">🛒 每月固定生活支出</option>
              </select>
            </div>
            <div>
              <label class="block text-zinc-400 mb-1">項目名稱</label>
              <input v-model="form.name" type="text" placeholder="例如: 本薪 / 房屋水電" required class="input-dark" />
            </div>
          </div>
          <div>
            <label class="block text-zinc-400 mb-1">每月金額 (TWD)</label>
            <input v-model.number="form.amount" type="number" step="any" placeholder="50000" required class="input-dark font-mono font-semibold" />
          </div>
        </template>

        <!-- 按鈕操作區 -->
        <div class="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
          <button
            type="button"
            @click="close"
            class="min-h-[42px] px-4 py-2 text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            class="min-h-[42px] px-6 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
          >
            <span>✓</span>
            <span>{{ isEditing ? '儲存變更' : '確認新增' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, computed } from 'vue';
import axios from 'axios';
import { useFinancialStore } from '../stores/useFinancialStore';
import CurrencySelector from './CurrencySelector.vue';
import StockSearchInput from './StockSearchInput.vue';

const props = defineProps({
  isOpen: Boolean,
  type: String, // 'bank' | 'stock' | 'fund' | 'crypto' | 'loan' | 'creditCard' | 'insurance' | 'protectionInsurance' | 'cashflow'
  initialData: Object,
  editItem: Object,
  index: Number,
  editIndex: Number,
  isEditing: Boolean,
});

const emit = defineEmits(['close', 'saved', 'save']);
const store = useFinancialStore();

const form = reactive({});

watch(() => props.isOpen, (open) => {
  if (open) {
    Object.keys(form).forEach(k => delete form[k]);
    const sourceData = props.initialData || props.editItem;

    if (props.isEditing && sourceData) {
      // 編輯模式：帶入該項目既有資料
      Object.assign(form, JSON.parse(JSON.stringify(sourceData)));
    } else {
      // 🌟 新增模式：智慧帶入「上一次輸入內容」快取，大幅省去重複打字！
      const cache = store.lastInputCache?.[props.type] || {};
      Object.assign(form, JSON.parse(JSON.stringify(cache)));

      if (props.type === 'stock') {
        if (!form.marketType) form.marketType = 'TW';
        if (!form.currency) form.currency = form.marketType === 'US' ? 'USD' : 'TWD';
      } else if (props.type === 'fund') {
        if (!form.currency) form.currency = 'TWD';
      } else if (props.type === 'protectionInsurance') {
        if (!form.category) form.category = '醫療實支';
        if (!form.payFrequency) form.payFrequency = 'yearly';
      } else if (props.type === 'creditCard') {
        if (!form.payDay) form.payDay = 15;
      }
    }
  }
});

function setStockMarket(market) {
  form.marketType = market;
  if (market === 'US') {
    form.currency = 'USD';
  } else {
    form.currency = 'TWD';
  }
}

function handleStockSelected(item) {
  form.ticker = item.ticker;
  if (item.name) form.name = item.name;
  form.marketType = item.market || form.marketType || 'TW';
  form.currency = item.currency || (form.marketType === 'US' ? 'USD' : 'TWD');
  if (!form.brokerName) {
    form.brokerName = form.marketType === 'US' ? 'Firstrade' : '富邦證券';
  }
  if (item.price && Number(item.price) > 0) {
    form.currentPrice = Number(item.price);
    if (!form.costPrice) form.costPrice = Number(item.price);
  }
  fetchStockQuoteForTicker(item.ticker);
}

function handleStockTickerBlur(tickerStr) {
  if (!tickerStr) return;
  fetchStockQuoteForTicker(tickerStr);
}

function fetchStockQuoteForTicker(tickerStr) {
  const clean = String(tickerStr || '').trim().toUpperCase();
  if (!clean) return;
  axios.get('/api/v1/market/stocks', { params: { symbols: clean } })
    .then(res => {
      const base = clean.replace(/\.(TW|TWO)$/i, '');
      const q = res.data?.quotes?.[clean] || res.data?.quotes?.[base] || res.data?.quotes?.[base + '.TW'] || res.data?.quotes?.[base + '.TWO'];
      if (q && Number(q.price) > 0) {
        form.currentPrice = Number(q.price);
        if (!form.costPrice) form.costPrice = Number(q.price);
        if (q.name && (!form.name || form.name === clean)) {
          form.name = q.name;
        }
        if (q.currency) {
          form.currency = q.currency;
          form.marketType = q.currency === 'USD' ? 'US' : 'TW';
        }
      }
    }).catch(() => {});
}

async function handleCryptoSelected(item) {
  if (!item || !item.code) return;
  form.symbol = item.code.toUpperCase();
  if (item.name && item.name !== item.code) {
    form.name = item.name;
  }
  if (item.coingeckoId) {
    form.coingeckoId = item.coingeckoId;
  }
  const quote = await store.fetchSingleCryptoQuote(form.symbol, item.coingeckoId || '');
  if (quote && Number(quote.priceUsd) > 0) {
    form.customPriceUsd = Number(quote.priceUsd);
    if (quote.name && (!form.name || form.name === form.symbol)) {
      form.name = quote.name;
    }
    if (quote.coingeckoId) {
      form.coingeckoId = quote.coingeckoId;
    }
  }
}

const modalTitle = computed(() => {
  const map = {
    bank: '🏦 銀行存款帳戶',
    stock: '📈 股票證券投資',
    fund: '📊 基金投資配置',
    crypto: '⚡ 加密貨幣錢包',
    loan: '📉 長期貸款負債',
    creditCard: '💳 信用卡帳單與分期',
    insurance: '🛡️ 儲蓄險保單資產',
    protectionInsurance: '🩺 定期保障型保險支出',
    cashflow: '💸 現金收支項目',
  };
  return map[props.type] || '資產項目編輯';
});

function close() {
  emit('close');
}

function handleSubmit() {
  const targetIdx = props.index !== undefined ? props.index : props.editIndex;

  // 🌟 記錄「上一次輸入內容」到快取中
  if (!store.lastInputCache) store.lastInputCache = {};
  store.lastInputCache[props.type] = {
    bankName: form.bankName,
    accountType: form.accountType,
    brokerName: form.brokerName,
    marketType: form.marketType,
    currency: form.currency,
    platform: form.platform,
    walletName: form.walletName,
    company: form.company,
    category: form.category,
    payFrequency: form.payFrequency,
    payDay: form.payDay,
    interestRate: form.interestRate,
    totalMonths: form.totalMonths,
    gracePeriodMonths: form.gracePeriodMonths,
  };

  const nowTs = Date.now();
  const itemWithTs = {
    ...form,
    updatedAt: nowTs,
  };

  if (props.type === 'bank') {
    if (props.isEditing) {
      store.bankAssets[targetIdx] = { ...store.bankAssets[targetIdx], ...itemWithTs };
    } else {
      store.bankAssets.push({ ...itemWithTs, id: 'bank_' + nowTs });
    }
  } else if (props.type === 'stock') {
    if (props.isEditing) {
      store.stockAssets[targetIdx] = { ...store.stockAssets[targetIdx], ...itemWithTs };
    } else {
      store.stockAssets.push({ ...itemWithTs, id: 'stock_' + nowTs });
    }
    store.refreshStockQuotes();
  } else if (props.type === 'fund') {
    if (props.isEditing) {
      store.fundAssets[targetIdx] = { ...store.fundAssets[targetIdx], ...itemWithTs };
    } else {
      store.fundAssets.push({ ...itemWithTs, id: 'fund_' + nowTs });
    }
  } else if (props.type === 'crypto') {
    if (Number(itemWithTs.customPriceUsd) > 0 && itemWithTs.symbol) {
      const sym = String(itemWithTs.symbol).toUpperCase();
      store.cryptoQuotes[sym] = {
        symbol: sym,
        name: itemWithTs.name || store.cryptoQuotes[sym]?.name || sym,
        coingeckoId: itemWithTs.coingeckoId || store.cryptoQuotes[sym]?.coingeckoId || '',
        priceUsd: Number(itemWithTs.customPriceUsd),
        isWatched: true,
      };
    }
    if (props.isEditing) {
      store.cryptoAssets[targetIdx] = { ...store.cryptoAssets[targetIdx], ...itemWithTs };
    } else {
      store.cryptoAssets.push({ ...itemWithTs, id: 'crypto_' + nowTs });
    }
    store.refreshCryptoQuotes();
  } else if (props.type === 'loan') {
    if (props.isEditing) {
      store.loanItems[targetIdx] = { ...store.loanItems[targetIdx], ...itemWithTs };
    } else {
      store.loanItems.push({ ...itemWithTs, id: 'loan_' + nowTs });
    }
  } else if (props.type === 'creditCard') {
    if (props.isEditing) {
      store.creditCardItems[targetIdx] = { ...store.creditCardItems[targetIdx], ...itemWithTs };
    } else {
      store.creditCardItems.push({ ...itemWithTs, id: 'cc_' + nowTs });
    }
  } else if (props.type === 'insurance') {
    if (props.isEditing) {
      store.insuranceAssets[targetIdx] = { ...store.insuranceAssets[targetIdx], ...itemWithTs };
    } else {
      store.insuranceAssets.push({ ...itemWithTs, id: 'ins_' + nowTs });
    }
  } else if (props.type === 'protectionInsurance') {
    if (props.isEditing) {
      store.protectionInsurances[targetIdx] = { ...store.protectionInsurances[targetIdx], ...itemWithTs };
    } else {
      store.protectionInsurances.push({ ...itemWithTs, id: 'prot_ins_' + nowTs });
    }
  } else if (props.type === 'cashflow') {
    const targetArr = form.flowType === 'income' ? store.recurringIncomes : store.recurringExpenses;
    if (props.isEditing) {
      targetArr[targetIdx] = { ...targetArr[targetIdx], ...itemWithTs };
    } else {
      targetArr.push({ ...itemWithTs, id: 'cf_' + nowTs });
    }
  }

  store.triggerAutoSave();
  emit('saved');
  emit('save');
  close();
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
  border-color: #6366f1;
  background-color: rgba(255, 255, 255, 0.08);
}
</style>
