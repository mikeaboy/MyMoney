import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './useAuthStore';
import axios from 'axios';

export const useFinancialStore = defineStore('financial', () => {
  const authStore = useAuthStore();

  // 核心狀態
  const hideAmounts = ref(false);
  const stressTestMode = ref(false); // 模擬寬限期結束還款壓力測試
  const lastUpdated = ref('剛剛');
  const isRefreshingStocks = ref(false);
  const isRefreshingCrypto = ref(false);

  // 智慧記憶上一次輸入內容 (跨表單預填，初始化為中性通用設定)
  const lastInputCache = ref({
    bank: { bankName: '', accountType: '活期存款', currency: 'TWD' },
    stock: { brokerName: '', marketType: 'TW', currency: 'TWD' },
    fund: { platform: '', currency: 'TWD' },
    crypto: { walletName: '', symbol: 'USDT' },
    loan: { interestRate: 2.15, totalMonths: 360, gracePeriodMonths: 0 },
    creditCard: { bankName: '', payDay: 10 },
    insurance: { company: '', currency: 'TWD', annualReturnRate: 2.0 },
    protectionInsurance: { company: '', category: '醫療實支實付', payFrequency: 'yearly' },
  });

  // 水位安全警戒線設定
  const waterLevelSettings = ref({
    minMonthlyNetCashflowTwd: 25000,
    minBankCashReserveTwd: 500000,
    minEmergencyMonths: 6,
    maxDebtServicePct: 35,
  });

  // 匯率字典
  const fxRates = ref({
    TWD: { currency: 'TWD', name: '新台幣', flag: '🇹🇼', rateToTwd: 1.0, changePercent: 0.0, isWatched: false },
    USD: { currency: 'USD', name: '美金', flag: '🇺🇸', rateToTwd: 32.15, changePercent: 0.18, isWatched: true },
    JPY: { currency: 'JPY', name: '日圓', flag: '🇯🇵', rateToTwd: 0.2115, changePercent: -0.35, isWatched: true },
    EUR: { currency: 'EUR', name: '歐元', flag: '🇪🇺', rateToTwd: 34.85, changePercent: 0.12, isWatched: true },
    CNY: { currency: 'CNY', name: '人民幣', flag: '🇨🇳', rateToTwd: 4.51, changePercent: -0.08, isWatched: true },
    HKD: { currency: 'HKD', name: '港幣', flag: '🇭🇰', rateToTwd: 4.13, changePercent: 0.05, isWatched: true },
  });

  // 加密貨幣字典 (動態擴充任意幣種)
  const cryptoQuotes = ref({
    BTC: { symbol: 'BTC', name: 'Bitcoin 比特幣', priceUsd: 92450.0, change24hPercent: 2.85, isWatched: true },
    ETH: { symbol: 'ETH', name: 'Ethereum 以太幣', priceUsd: 3180.0, change24hPercent: 1.42, isWatched: true },
    SOL: { symbol: 'SOL', name: 'Solana', priceUsd: 188.5, change24hPercent: 4.60, isWatched: true },
    BNB: { symbol: 'BNB', name: 'BNB 幣安幣', priceUsd: 645.0, change24hPercent: 0.75, isWatched: true },
    USDT: { symbol: 'USDT', name: 'Tether 泰達幣', priceUsd: 1.00, change24hPercent: 0.01, isWatched: true },
  });

  // 資產與負債陣列
  const bankAssets = ref([]);
  const cryptoAssets = ref([]);
  const stockAssets = ref([]);
  const fundAssets = ref([]);
  const insuranceAssets = ref([]); // 資產型儲蓄險
  const protectionInsurances = ref([]); // 🌟 新增：定期繳納的保障型保單 (醫療/壽險/車險/意外)
  const loanItems = ref([]);
  const creditCardItems = ref([]);
  const recurringExpenses = ref([]);
  const recurringIncomes = ref([]);
  const specificExpenses = ref([]);

  // 歷史資產淨值快照
  const historicalSnapshots = ref([]);

  // 🗑️ 單筆刪除墓碑紀錄 (Record ID -> 刪除毫秒時間戳)，用於跨裝置與雙向合併時精確識別「已刪除」vs「新增」
  const deletedRecords = ref({});

  // 標記單筆刪除墓碑
  function markRecordDeleted(item) {
    if (item && item.id) {
      deletedRecords.value[item.id] = Date.now();
    }
  }

  // 🛒 蝦皮商業投資獨立模組 (金額進出即可，有圖表，公私徹底分開)
  const shopeeData = ref({
    totalInvestedTwd: 0,          // 累計投入本金 (進)
    totalWithdrawnTwd: 0,         // 累計提領收回 (出)
    currentAccountBalanceTwd: 0,  // 目前蝦皮帳戶與資金總值 (當前價值)
    balanceUpdatedAt: 0,          // 當前總值最後更新毫秒時間戳
    cashflowRecords: [],          // 金額進出歷史紀錄 [{ id, date, type: 'in'|'out', amount, note, updatedAt }]
    snapshots: [],                // 蝦皮歷史趨勢紀錄 [{ id, date, netInvested, currentValue, profit, updatedAt }]
  });

  // ==================== 匯率與行情輔助 ====================
  function getRateToTwd(currency) {
    if (!currency || currency === 'TWD') return 1.0;
    const upper = String(currency).toUpperCase();
    if (upper === 'USDT') return getRateToTwd('USD');
    return fxRates.value[upper] ? Number(fxRates.value[upper].rateToTwd) || 1.0 : 1.0;
  }

  function convertToTwd(amount, currency) {
    return (Number(amount) || 0) * getRateToTwd(currency);
  }

  function convertTwdToUsdt(amountTwd) {
    const usdRate = getRateToTwd('USD');
    return usdRate > 0 ? (Number(amountTwd) || 0) / usdRate : 0;
  }

  function getCryptoPriceUsd(symbol, itemObj = null) {
    if (!symbol && !itemObj) return 0;
    const sym = String(symbol || itemObj?.symbol || '').toUpperCase();
    if (sym === 'USDT' || sym === 'USDC' || sym === 'USD') return 1.0;
    const marketPrice = cryptoQuotes.value[sym] ? Number(cryptoQuotes.value[sym].priceUsd) || 0 : 0;
    if (marketPrice > 0) return marketPrice;
    // 若網路無此自訂小幣行情，使用使用者設定的自訂參考單價保底
    if (itemObj && Number(itemObj.customPriceUsd) > 0) {
      return Number(itemObj.customPriceUsd);
    }
    return 0;
  }

  function convertCryptoToTwd(amount, symbol, itemObj = null) {
    const usd = (Number(amount) || 0) * getCryptoPriceUsd(symbol, itemObj);
    return usd * getRateToTwd('USD');
  }

  // ==================== 貸款試算邏輯 ====================
  function calculateLoanDetail(loan) {
    const P = Number(loan.principal) || 0;
    const annualRate = (Number(loan.interestRate) || 0) / 100;
    const r = annualRate / 12;
    const totalN = Math.max(1, Number(loan.totalMonths) || 1);
    const graceN = Math.max(0, Number(loan.gracePeriodMonths) || 0);
    const remainN = Math.max(1, Number(loan.remainingMonths) || totalN);

    const calcGraceMonthlyPay = r > 0 ? P * r : 0;
    const hasCustomGracePay = loan.customGraceMonthlyPay !== undefined &&
                              loan.customGraceMonthlyPay !== null &&
                              loan.customGraceMonthlyPay !== '' &&
                              Number(loan.customGraceMonthlyPay) >= 0;
    const graceMonthlyPay = hasCustomGracePay ? Number(loan.customGraceMonthlyPay) : calcGraceMonthlyPay;

    const amortizeN = Math.max(1, totalN - graceN);
    let postGraceMonthlyPay = 0;
    if (r > 0) {
      postGraceMonthlyPay = (P * (r * Math.pow(1 + r, amortizeN))) / (Math.pow(1 + r, amortizeN) - 1);
    } else {
      postGraceMonthlyPay = P / amortizeN;
    }

    const isCurrentlyInGrace = remainN > amortizeN;
    const currentActualMonthlyPay = isCurrentlyInGrace ? graceMonthlyPay : postGraceMonthlyPay;
    const effectiveMonthlyPay = stressTestMode.value ? postGraceMonthlyPay : currentActualMonthlyPay;

    return {
      principal: P,
      graceMonthlyPay,
      isCustomGracePay: hasCustomGracePay,
      postGraceMonthlyPay,
      isCurrentlyInGrace,
      currentActualMonthlyPay,
      effectiveMonthlyPay,
    };
  }

  // ==================== ViewModel 計算屬性 (Getters) ====================
  // 1. 銀行總額與預估年利息
  const bankSummary = computed(() => {
    let totalTwd = 0;
    let annualInterestTwd = 0;
    bankAssets.value.forEach(item => {
      const twd = convertToTwd(item.balance, item.currency);
      totalTwd += twd;
      annualInterestTwd += twd * ((Number(item.interestRate) || 0) / 100);
    });
    return {
      totalTwd,
      annualInterestTwd,
      totalUsdt: convertTwdToUsdt(totalTwd),
    };
  });

  // 2. 加密貨幣總額與損益 (支援任意動態新增幣種與自訂幣價保底)
  const cryptoSummary = computed(() => {
    let totalTwd = 0;
    let totalUsdt = 0;
    cryptoAssets.value.forEach(item => {
      const priceUsd = getCryptoPriceUsd(item.symbol, item);
      const usdtVal = (Number(item.amount) || 0) * priceUsd;
      totalUsdt += usdtVal;
      totalTwd += usdtVal * getRateToTwd('USD');
    });
    return { totalTwd, totalUsdt };
  });

  // 3. 股票總額 (含台股與美股，支援自動帶出名稱)
  const stockSummary = computed(() => {
    let totalTwd = 0;
    let totalUsd = 0;
    let twStockTwd = 0;
    let usStockTwd = 0;
    let totalCostTwd = 0;

    stockAssets.value.forEach(item => {
      const shares = Number(item.shares) || 0;
      const price = Number(item.currentPrice) || 0;
      const cost = Number(item.costPrice) || price;
      const currency = item.currency || (item.marketType === 'US' ? 'USD' : 'TWD');
      const itemTwd = convertToTwd(shares * price, currency);
      const itemCostTwd = convertToTwd(shares * cost, currency);

      totalTwd += itemTwd;
      totalCostTwd += itemCostTwd;

      if (currency === 'USD' || item.marketType === 'US') {
        usStockTwd += itemTwd;
        totalUsd += shares * price;
      } else {
        twStockTwd += itemTwd;
      }
    });

    const totalProfitTwd = totalTwd - totalCostTwd;
    const profitRatePct = totalCostTwd > 0 ? (totalProfitTwd / totalCostTwd) * 100 : 0;

    return {
      totalTwd,
      totalCostTwd,
      totalProfitTwd,
      profitRatePct,
      twStockTwd,
      usStockTwd,
      totalUsd,
      totalUsdt: convertTwdToUsdt(totalTwd),
    };
  });

  // 4. 基金總額
  const fundSummary = computed(() => {
    let totalTwd = 0;
    let totalCostTwd = 0;

    fundAssets.value.forEach(item => {
      const units = Number(item.units) || 0;
      const curNav = Number(item.currentNav) || Number(item.costNav) || 0;
      const costNav = Number(item.costNav) || curNav;
      const currency = item.currency || 'TWD';

      const marketTwd = convertToTwd(units * curNav, currency);
      const costTwd = convertToTwd(units * costNav, currency);

      totalTwd += marketTwd;
      totalCostTwd += costTwd;
    });

    const totalProfitTwd = totalTwd - totalCostTwd;
    const profitRatePct = totalCostTwd > 0 ? (totalProfitTwd / totalCostTwd) * 100 : 0;

    return {
      totalTwd,
      totalCostTwd,
      totalProfitTwd,
      profitRatePct,
      totalUsdt: convertTwdToUsdt(totalTwd),
    };
  });

  // 5. 儲蓄險資產總額與年息
  const insuranceSummary = computed(() => {
    let totalCashValueTwd = 0;
    let annualInterestTwd = 0;
    insuranceAssets.value.forEach(item => {
      const valTwd = convertToTwd(item.cashValue, item.currency);
      totalCashValueTwd += valTwd;
      annualInterestTwd += valTwd * ((Number(item.annualReturnRate) || 0) / 100);
    });
    return {
      totalCashValueTwd,
      annualInterestTwd,
      totalUsdt: convertTwdToUsdt(totalCashValueTwd),
    };
  });

  // 🌟 6. 定期保障型保單支出統計 (醫療/實支/意外/車險等)
  const protectionInsuranceSummary = computed(() => {
    let monthlyAvgExpenseTwd = 0;
    let yearlyTotalExpenseTwd = 0;

    protectionInsurances.value.forEach(item => {
      const premium = Number(item.premiumAmount) || 0;
      if (item.payFrequency === 'monthly') {
        monthlyAvgExpenseTwd += premium;
        yearlyTotalExpenseTwd += premium * 12;
      } else {
        // 預設為年繳
        monthlyAvgExpenseTwd += premium / 12;
        yearlyTotalExpenseTwd += premium;
      }
    });

    return {
      monthlyAvgExpenseTwd: Math.round(monthlyAvgExpenseTwd),
      yearlyTotalExpenseTwd: Math.round(yearlyTotalExpenseTwd),
      count: protectionInsurances.value.length,
    };
  });

  // 7. 信用卡負債統計
  const creditCardSummary = computed(() => {
    let currentDueTotalTwd = 0;
    let remainingInstallmentTotalTwd = 0;
    creditCardItems.value.forEach(item => {
      const due = Number(item.currentDueAmount) || 0;
      const installmentRemain = Number(item.remainingInstallmentAmount) || 0;
      currentDueTotalTwd += due;
      remainingInstallmentTotalTwd += installmentRemain;
    });
    const totalCreditCardDebtTwd = currentDueTotalTwd + remainingInstallmentTotalTwd;
    return {
      currentDueTotalTwd,
      remainingInstallmentTotalTwd,
      totalCreditCardDebtTwd,
    };
  });

  // 8. 貸款與長期負債
  const loanSummary = computed(() => {
    let totalDebtTwd = 0;
    let monthlyPaymentTwd = 0;
    loanItems.value.forEach(item => {
      const detail = calculateLoanDetail(item);
      totalDebtTwd += detail.principal;
      monthlyPaymentTwd += detail.effectiveMonthlyPay;
    });
    return { totalDebtTwd, monthlyPaymentTwd };
  });

  // 9. 總負債 (長期貸款 + 信用卡負債)
  const totalLiabilitiesTwd = computed(() => {
    return loanSummary.value.totalDebtTwd + creditCardSummary.value.totalCreditCardDebtTwd;
  });

  // 10. 總資產與總淨值
  const totalGrossAssetsTwd = computed(() => {
    return bankSummary.value.totalTwd +
      stockSummary.value.totalTwd +
      fundSummary.value.totalTwd +
      cryptoSummary.value.totalTwd +
      insuranceSummary.value.totalCashValueTwd;
  });

  const totalNetWorthTwd = computed(() => {
    return totalGrossAssetsTwd.value - totalLiabilitiesTwd.value;
  });

  // 🛒 蝦皮商業投資獨立統計 (金額進出即可，有圖表，徹底與個人資產分開)
  const shopeeSummary = computed(() => {
    const s = shopeeData.value;
    const invested = Number(s.totalInvestedTwd) || 0;
    const withdrawn = Number(s.totalWithdrawnTwd) || 0;
    const netInvested = Math.max(0, invested - withdrawn);
    const curVal = Number(s.currentAccountBalanceTwd) || 0;
    const totalProfit = (curVal + withdrawn) - invested;
    const roiPct = invested > 0 ? (totalProfit / invested) * 100 : 0;

    return {
      invested,
      withdrawn,
      netInvested,
      currentValue: curVal,
      totalProfit,
      roiPct,
      records: s.cashflowRecords || [],
      snapshots: s.snapshots || [],
    };
  });

  function recordShopeeCashflow(type, amount, note = '') {
    const num = Math.abs(Number(amount) || 0);
    if (num <= 0) return;
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    if (type === 'in') {
      shopeeData.value.totalInvestedTwd = (Number(shopeeData.value.totalInvestedTwd) || 0) + num;
    } else {
      shopeeData.value.totalWithdrawnTwd = (Number(shopeeData.value.totalWithdrawnTwd) || 0) + num;
    }

    if (!Array.isArray(shopeeData.value.cashflowRecords)) {
      shopeeData.value.cashflowRecords = [];
    }
    const nowTs = Date.now();
    shopeeData.value.cashflowRecords.unshift({
      id: 'shopee_cf_' + nowTs,
      date: dateStr,
      type, // 'in' (投入本金) | 'out' (提領利潤/本金)
      amount: num,
      note: note || (type === 'in' ? '追加營運本金' : '提領營運利潤'),
      updatedAt: nowTs,
    });

    autoSnapshotShopee();
    triggerAutoSave();
  }

  function updateShopeeAccountBalance(amount, note = '') {
    const num = Math.max(0, Number(amount) || 0);
    shopeeData.value.currentAccountBalanceTwd = num;
    shopeeData.value.balanceUpdatedAt = Date.now();
    autoSnapshotShopee(note);
    triggerAutoSave();
  }

  function autoSnapshotShopee(note = '') {
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    if (!Array.isArray(shopeeData.value.snapshots)) {
      shopeeData.value.snapshots = [];
    }

    const curVal = Number(shopeeData.value.currentAccountBalanceTwd) || 0;
    const invested = Number(shopeeData.value.totalInvestedTwd) || 0;
    const withdrawn = Number(shopeeData.value.totalWithdrawnTwd) || 0;
    const profit = (curVal + withdrawn) - invested;

    const snap = {
      id: 'shopee_snap_' + dateStr.replace(/\//g, ''),
      date: dateStr,
      currentValue: curVal,
      invested,
      profit,
      note: note || '營運餘額更新',
      updatedAt: Date.now(),
    };

    const existIdx = shopeeData.value.snapshots.findIndex(s => s.date === dateStr);
    if (existIdx >= 0) {
      shopeeData.value.snapshots[existIdx] = snap;
    } else {
      shopeeData.value.snapshots.push(snap);
    }
    shopeeData.value.snapshots.sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  // 11. 每月現金流分析 (加入信用卡應繳 + 保障型保險每月平均保費)
  const cashflowSummary = computed(() => {
    const monthlyActiveIncome = recurringIncomes.value.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const monthlyPassiveIncome = (bankSummary.value.annualInterestTwd + insuranceSummary.value.annualInterestTwd) / 12;
    const monthlyTotalIncome = monthlyActiveIncome + monthlyPassiveIncome;

    const monthlyLivingExpense = recurringExpenses.value.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const monthlyDebtService = loanSummary.value.monthlyPaymentTwd;
    const monthlyCreditCardDue = creditCardSummary.value.currentDueTotalTwd;
    const monthlyInsuranceExpense = protectionInsuranceSummary.value.monthlyAvgExpenseTwd; // 🌟 每月保險支出

    const monthlyTotalExpense = monthlyLivingExpense + monthlyDebtService + monthlyCreditCardDue + monthlyInsuranceExpense;
    const netMonthlyCashflow = monthlyTotalIncome - monthlyTotalExpense;

    const baseMonthlyBurn = Math.max(1, monthlyTotalExpense);
    const emergencyMonthsCovered = bankSummary.value.totalTwd / baseMonthlyBurn;
    const debtServiceRatioPct = monthlyTotalIncome > 0 ? ((monthlyDebtService + monthlyCreditCardDue) / monthlyTotalIncome) * 100 : 0;

    return {
      monthlyTotalIncome,
      monthlyLivingExpense,
      monthlyDebtService,
      monthlyCreditCardDue,
      monthlyInsuranceExpense,
      monthlyTotalExpense,
      netMonthlyCashflow,
      emergencyMonthsCovered,
      debtServiceRatioPct,
    };
  });

  // 12. 水位安全警戒判定
  const waterLevelHealth = computed(() => {
    const wl = waterLevelSettings.value;
    const cf = cashflowSummary.value;

    const cfOk = cf.netMonthlyCashflow >= wl.minMonthlyNetCashflowTwd;
    const bankOk = bankSummary.value.totalTwd >= wl.minBankCashReserveTwd && cf.emergencyMonthsCovered >= wl.minEmergencyMonths;
    const dsrOk = cf.debtServiceRatioPct <= wl.maxDebtServicePct;

    return { cfOk, bankOk, dsrOk };
  });

  // ==================== 📸 資產歷史淨值快照管理 (每次新日期自動留存) ====================
  function checkAndAutoSnapshot() {
    if (totalGrossAssetsTwd.value <= 0 && totalLiabilitiesTwd.value <= 0) return;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    const snap = {
      id: 'snap_' + dateStr.replace(/\//g, ''),
      month: monthKey,
      date: dateStr,
      netWorthTwd: Math.round(totalNetWorthTwd.value),
      grossAssetsTwd: Math.round(totalGrossAssetsTwd.value),
      totalDebtTwd: Math.round(totalLiabilitiesTwd.value),
      bankTwd: Math.round(bankSummary.value.totalTwd),
      stockTwd: Math.round(stockSummary.value.totalTwd),
      fundTwd: Math.round(fundSummary.value.totalTwd),
      cryptoTwd: Math.round(cryptoSummary.value.totalTwd),
      insuranceTwd: Math.round(insuranceSummary.value.totalCashValueTwd),
      note: `${dateStr} 餘額自動結算`,
      updatedAt: Date.now(),
    };

    const existIdx = historicalSnapshots.value.findIndex(s => s.date === dateStr);
    if (existIdx >= 0) {
      historicalSnapshots.value[existIdx] = snap;
    } else {
      historicalSnapshots.value.push(snap);
    }
    historicalSnapshots.value.sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  function recordSnapshot(note = '') {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    const newSnapshot = {
      id: 'snap_' + dateStr.replace(/\//g, ''),
      month: monthKey,
      date: dateStr,
      netWorthTwd: Math.round(totalNetWorthTwd.value),
      grossAssetsTwd: Math.round(totalGrossAssetsTwd.value),
      totalDebtTwd: Math.round(totalLiabilitiesTwd.value),
      bankTwd: Math.round(bankSummary.value.totalTwd),
      stockTwd: Math.round(stockSummary.value.totalTwd),
      fundTwd: Math.round(fundSummary.value.totalTwd),
      cryptoTwd: Math.round(cryptoSummary.value.totalTwd),
      insuranceTwd: Math.round(insuranceSummary.value.totalCashValueTwd),
      note: note || `${dateStr} 手動快照`,
      updatedAt: Date.now(),
    };

    const existingIdx = historicalSnapshots.value.findIndex(s => s.date === dateStr);
    if (existingIdx >= 0) {
      historicalSnapshots.value[existingIdx] = newSnapshot;
    } else {
      historicalSnapshots.value.push(newSnapshot);
    }

    historicalSnapshots.value.sort((a, b) => (a.date > b.date ? 1 : -1));
    triggerAutoSave();
    return newSnapshot;
  }

  function deleteSnapshot(index) {
    if (index >= 0 && index < historicalSnapshots.value.length) {
      markRecordDeleted(historicalSnapshots.value[index]);
      historicalSnapshots.value.splice(index, 1);
      triggerAutoSave();
    }
  }

  // ==================== 📥 匯出 CSV 與備份 JSON ====================
  function exportToCsv() {
    let csv = '\uFEFF';
    csv += '類別,名稱/代號,機構/帳戶/市場,幣別,持倉數量/本金,參考價格/淨值,折合新台幣 (TWD)\r\n';

    // 1. 銀行
    bankAssets.value.forEach(b => {
      const twd = convertToTwd(b.balance, b.currency);
      csv += `銀行存款,"${b.bankName}","${b.accountType || ''}",${b.currency || 'TWD'},${b.balance},1,${Math.round(twd)}\r\n`;
    });

    // 2. 股票
    stockAssets.value.forEach(s => {
      const cur = s.currency || (s.marketType === 'US' ? 'USD' : 'TWD');
      const twd = convertToTwd((Number(s.shares) || 0) * (Number(s.currentPrice) || 0), cur);
      csv += `股票證券,"${s.name ? s.name + ' ' : ''}${s.ticker}","${s.brokerName || ''} (${s.marketType === 'US' ? '美股' : '台股'})",${cur},${s.shares},${s.currentPrice},${Math.round(twd)}\r\n`;
    });

    // 3. 基金
    fundAssets.value.forEach(f => {
      const twd = convertToTwd((Number(f.units) || 0) * (Number(f.currentNav) || Number(f.costNav) || 0), f.currency || 'TWD');
      csv += `基金配置,"${f.fundName}","${f.platform || ''}",${f.currency || 'TWD'},${f.units},${f.currentNav || f.costNav},${Math.round(twd)}\r\n`;
    });

    // 4. 加密貨幣
    cryptoAssets.value.forEach(c => {
      const twd = convertCryptoToTwd(c.amount, c.symbol);
      csv += `加密貨幣,"${c.symbol}","${c.walletName || ''}",USD,${c.amount},${getCryptoPriceUsd(c.symbol)},${Math.round(twd)}\r\n`;
    });

    // 5. 儲蓄險
    insuranceAssets.value.forEach(i => {
      const twd = convertToTwd(i.cashValue, i.currency);
      csv += `儲蓄保單,"${i.policyName}","${i.company || ''}",${i.currency || 'TWD'},1,${i.cashValue},${Math.round(twd)}\r\n`;
    });

    // 6. 保障型保險
    protectionInsurances.value.forEach(p => {
      csv += `保障型保單,"${p.policyName}","${p.company || ''} (${p.payFrequency === 'monthly' ? '月繳' : '年繳'})",TWD,1,${p.premiumAmount},-${Math.round(p.premiumAmount)}\r\n`;
    });

    // 7. 貸款
    loanItems.value.forEach(l => {
      csv += `貸款負債,"${l.name}","利率 ${l.interestRate}%",TWD,1,-${l.principal},-${Math.round(l.principal)}\r\n`;
    });

    // 8. 信用卡
    creditCardItems.value.forEach(cc => {
      const totalCc = (Number(cc.currentDueAmount) || 0) + (Number(cc.remainingInstallmentAmount) || 0);
      csv += `信用卡負債,"${cc.cardName}","${cc.bankName || ''}",TWD,1,-${totalCc},-${Math.round(totalCc)}\r\n`;
    });

    csv += `\r\n總計,總資產 (TWD),,,,,${Math.round(totalGrossAssetsTwd.value)}\r\n`;
    csv += `總計,總負債 (TWD),,,,,-${Math.round(totalLiabilitiesTwd.value)}\r\n`;
    csv += `總計,總淨資產 (TWD),,,,,${Math.round(totalNetWorthTwd.value)}\r\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyMoney_資產總表_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportBackupJson() {
    const backupData = {
      version: '2.1',
      exportedAt: new Date().toISOString(),
      bankAssets: bankAssets.value,
      stockAssets: stockAssets.value,
      fundAssets: fundAssets.value,
      cryptoAssets: cryptoAssets.value,
      insuranceAssets: insuranceAssets.value,
      protectionInsurances: protectionInsurances.value,
      loanItems: loanItems.value,
      creditCardItems: creditCardItems.value,
      recurringExpenses: recurringExpenses.value,
      recurringIncomes: recurringIncomes.value,
      historicalSnapshots: historicalSnapshots.value,
      waterLevelSettings: waterLevelSettings.value,
      lastInputCache: lastInputCache.value,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyMoney_完整備份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackupJson(jsonString) {
    try {
      const d = JSON.parse(jsonString);
      if (d.bankAssets) bankAssets.value = d.bankAssets;
      if (d.stockAssets) stockAssets.value = d.stockAssets;
      if (d.fundAssets) fundAssets.value = d.fundAssets;
      if (d.cryptoAssets) cryptoAssets.value = d.cryptoAssets;
      if (d.insuranceAssets) insuranceAssets.value = d.insuranceAssets;
      if (d.protectionInsurances) protectionInsurances.value = d.protectionInsurances;
      if (d.loanItems) loanItems.value = d.loanItems;
      if (d.creditCardItems) creditCardItems.value = d.creditCardItems;
      if (d.recurringExpenses) recurringExpenses.value = d.recurringExpenses;
      if (d.recurringIncomes) recurringIncomes.value = d.recurringIncomes;
      if (d.historicalSnapshots) historicalSnapshots.value = d.historicalSnapshots;
      if (d.waterLevelSettings) waterLevelSettings.value = Object.assign(waterLevelSettings.value, d.waterLevelSettings);
      if (d.lastInputCache) lastInputCache.value = Object.assign(lastInputCache.value, d.lastInputCache);

      triggerAutoSave();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==================== ⚡ 行情即時查詢與更新 Actions ====================
  // 1. 股票即時更新 (自動帶出公司中文名稱，支援台股上市/上櫃/ETF與美股)
  async function refreshStockQuotes() {
    if (stockAssets.value.length === 0) return;
    isRefreshingStocks.value = true;
    try {
      const symbols = stockAssets.value.map(s => String(s.ticker || '').trim()).filter(Boolean).join(',');
      if (!symbols) return;

      const res = await axios.get('/api/v1/market/stocks', {
        params: { symbols }
      });

      if (res.data && res.data.success && res.data.quotes) {
        let updatedCount = 0;
        const nowTs = Date.now();
        stockAssets.value.forEach(item => {
          const symKey = String(item.ticker || '').trim().toUpperCase();
          const cleanSym = symKey.replace(/\.(TW|TWO)$/i, '');
          const q = res.data.quotes[symKey] || res.data.quotes[cleanSym] || res.data.quotes[cleanSym + '.TW'] || res.data.quotes[cleanSym + '.TWO'];
          if (q && Number(q.price) > 0) {
            item.currentPrice = Number(q.price);
            if (q.changePercent !== undefined) {
              item.changePercent = q.changePercent;
            }
            if (q.name && (!item.name || item.name === item.ticker)) {
              item.name = q.name;
            }
            item.updatedAt = nowTs;
            updatedCount++;
          }
        });
        if (updatedCount > 0) {
          triggerAutoSave();
        }
      }
    } catch (e) {
      console.warn('更新股票行情失敗:', e);
    } finally {
      isRefreshingStocks.value = false;
    }
  }

  // 常見與自訂幣種全稱名稱與 CoinGecko ID 對照表
  const CRYPTO_NAME_MAP = {
    BTC: 'Bitcoin 比特幣',
    ETH: 'Ethereum 以太幣',
    SOL: 'Solana 索拉納',
    BNB: 'BNB 幣安幣',
    USDT: 'Tether 泰達幣',
    USDC: 'USD Coin',
    DOGE: 'Dogecoin 狗狗幣',
    XRP: 'Ripple 瑞波幣',
    ADA: 'Cardano 艾達幣',
    PEPE: 'Pepe 佩佩蛙',
    SHIB: 'Shiba Inu 柴犬幣',
    TON: 'Toncoin',
    AVAX: 'Avalanche 雪崩幣',
    SUI: 'Sui',
    DOT: 'Polkadot 波卡幣',
    LINK: 'Chainlink',
    NEAR: 'NEAR Protocol',
    MATIC: 'Polygon',
    POL: 'Polygon (POL)',
    LTC: 'Litecoin 萊特幣',
    TRX: 'TRON 波場幣',
    BCH: 'Bitcoin Cash',
    APT: 'Aptos',
    UNI: 'Uniswap',
    CRO: 'Cronos (Crypto.com)',
    OKB: 'OKB',
    BGB: 'Bitget Token',
    KAS: 'Kaspa',
    ARB: 'Arbitrum',
    OP: 'Optimism',
    ATOM: 'Cosmos',
    FIL: 'Filecoin',
    INJ: 'Injective',
    AAVE: 'Aave',
    WIF: 'dogwifhat',
    BONK: 'Bonk',
    FLOKI: 'FLOKI',
    FTM: 'Fantom',
    SEI: 'Sei',
    TIA: 'Celestia',
    WLD: 'Worldcoin',
    JUP: 'Jupiter',
    PYTH: 'Pyth Network',
    ORDI: 'ORDI',
    RUNE: 'THORChain',
    MNT: 'Mantle',
    GT: 'GateToken',
    RENDER: 'Render',
    ICP: 'Internet Computer',
    ETC: 'Ethereum Classic',
  };

  const CRYPTO_COINGECKO_ID_MAP = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    BNB: 'binancecoin',
    USDT: 'tether',
    USDC: 'usd-coin',
    DOGE: 'dogecoin',
    XRP: 'ripple',
    ADA: 'cardano',
    PEPE: 'pepe',
    SHIB: 'shiba-inu',
    TON: 'the-open-network',
    AVAX: 'avalanche-2',
    SUI: 'sui',
    DOT: 'polkadot',
    LINK: 'chainlink',
    NEAR: 'near',
    MATIC: 'matic-network',
    POL: 'polygon-ecosystem-token',
    LTC: 'litecoin',
    TRX: 'tron',
    BCH: 'bitcoin-cash',
    APT: 'aptos',
    UNI: 'uniswap',
    CRO: 'crypto-com-chain',
    OKB: 'okb',
    BGB: 'bitget-token',
    KAS: 'kaspa',
    ARB: 'arbitrum',
    OP: 'optimism',
    ATOM: 'cosmos',
    FIL: 'filecoin',
    INJ: 'injective-protocol',
    AAVE: 'aave',
    WIF: 'dogwifcoin',
    BONK: 'bonk',
    FLOKI: 'floki',
    FTM: 'fantom',
    SEI: 'sei-network',
    TIA: 'celestia',
    WLD: 'worldcoin-wld',
    JUP: 'jupiter-exchange-solana',
    PYTH: 'pyth-network',
    ORDI: 'ordi',
    RUNE: 'thorchain',
    MNT: 'mantle',
    GT: 'gatetoken',
    RENDER: 'render-token',
    ICP: 'internet-computer',
    ETC: 'ethereum-classic',
  };

  // 查詢單一加密貨幣的即時報價與名稱 (用於表單輸入時即時預覽，前端直連 0 伺服器流量)
  async function fetchSingleCryptoQuote(symbol, coingeckoId = '') {
    const sym = String(symbol || '').trim().toUpperCase();
    if (!sym) return null;
    if (sym === 'USDT' || sym === 'USDC' || sym === 'USD') {
      const q = { symbol: sym, name: CRYPTO_NAME_MAP[sym] || sym, priceUsd: 1.0, isWatched: true };
      cryptoQuotes.value[sym] = q;
      return q;
    }

    let resolvedName = CRYPTO_NAME_MAP[sym] || cryptoQuotes.value[sym]?.name || sym;
    let resolvedCgId = coingeckoId || CRYPTO_COINGECKO_ID_MAP[sym] || '';
    let resolvedPrice = 0;
    let change24h = undefined;

    // 1. 優先嘗試 Binance 單一現貨對 (極速 < 100ms)
    try {
      const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym + 'USDT')}`);
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData && Number(bData.price) > 0) {
          resolvedPrice = Number(bData.price);
        }
      }
    } catch (e) {}

    // 2. 若無 CoinGecko ID 或尚未抓到價格，呼叫 CoinGecko Search API 自動解析任何自訂小幣的 ID 與全名
    if (!resolvedCgId || resolvedPrice <= 0 || resolvedName === sym) {
      try {
        const sRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData && Array.isArray(sData.coins) && sData.coins.length > 0) {
            const exact = sData.coins.find(c => String(c.symbol || '').toUpperCase() === sym) || sData.coins[0];
            if (exact) {
              if (!resolvedCgId) resolvedCgId = exact.id;
              if (exact.name) resolvedName = exact.name;
            }
          }
        }
      } catch (e) {}
    }

    // 3. 若有 CoinGecko ID，查詢 CoinGecko 價格與 24h 漲跌幅 (覆蓋幣安沒上的所有幣種如 CRO, BGB, OKB, KAS, MNT...)
    if (resolvedCgId) {
      try {
        const pRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(resolvedCgId)}&vs_currencies=usd&include_24hr_change=true`);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData && pData[resolvedCgId] && Number(pData[resolvedCgId].usd) > 0) {
            resolvedPrice = Number(pData[resolvedCgId].usd);
            if (pData[resolvedCgId].usd_24h_change !== undefined) {
              change24h = parseFloat(Number(pData[resolvedCgId].usd_24h_change).toFixed(2));
            }
          }
        }
      } catch (e) {}
    }

    if (resolvedPrice > 0) {
      cryptoQuotes.value[sym] = {
        symbol: sym,
        name: resolvedName,
        coingeckoId: resolvedCgId,
        priceUsd: resolvedPrice,
        change24hPercent: change24h ?? cryptoQuotes.value[sym]?.change24hPercent ?? 0,
        isWatched: true,
      };
      return cryptoQuotes.value[sym];
    }

    return null;
  }

  // 2. 加密貨幣動態即時更新 (支援所有自訂與新增的幣種，自動帶出名稱與最新價格)
  async function refreshCryptoQuotes() {
    isRefreshingCrypto.value = true;
    try {
      const assetSymbols = cryptoAssets.value.map(c => String(c.symbol || '').trim().toUpperCase()).filter(Boolean);
      const targetSymbols = Array.from(new Set(['BTC', 'ETH', 'SOL', 'BNB', 'USDT', ...assetSymbols]));

      // 自動為持倉補齊幣種名稱與 CoinGecko ID
      cryptoAssets.value.forEach(item => {
        const sym = String(item.symbol || '').trim().toUpperCase();
        if (!item.name && CRYPTO_NAME_MAP[sym]) {
          item.name = CRYPTO_NAME_MAP[sym];
        }
        if (!item.coingeckoId && CRYPTO_COINGECKO_ID_MAP[sym]) {
          item.coingeckoId = CRYPTO_COINGECKO_ID_MAP[sym];
        }
      });

      const foundByBinance = new Set();

      // 第一步：呼叫 Binance 公開端點 (免 Key，一次抓回所有幣安現貨對)
      try {
        const binanceRes = await axios.get('https://api.binance.com/api/v3/ticker/price');
        if (binanceRes.data && Array.isArray(binanceRes.data)) {
          const priceMap = {};
          binanceRes.data.forEach(item => {
            priceMap[item.symbol] = parseFloat(item.price);
          });

          targetSymbols.forEach(sym => {
            const symName = CRYPTO_NAME_MAP[sym] || cryptoQuotes.value[sym]?.name || sym;
            if (sym === 'USDT' || sym === 'USDC' || sym === 'USD') {
              cryptoQuotes.value[sym] = { symbol: sym, name: symName, priceUsd: 1.0, isWatched: true };
              foundByBinance.add(sym);
              return;
            }

            const pairKey = `${sym}USDT`;
            if (priceMap[pairKey] !== undefined && priceMap[pairKey] > 0) {
              foundByBinance.add(sym);
              if (!cryptoQuotes.value[sym]) {
                cryptoQuotes.value[sym] = { symbol: sym, name: symName, priceUsd: priceMap[pairKey], isWatched: true };
              } else {
                cryptoQuotes.value[sym].priceUsd = priceMap[pairKey];
                if (!cryptoQuotes.value[sym].name || cryptoQuotes.value[sym].name === sym) {
                  cryptoQuotes.value[sym].name = symName;
                }
              }
            }
          });
        }
      } catch (binanceErr) {
        console.warn('Binance API 查詢備援至 CoinGecko:', binanceErr);
      }

      // 第二步：找出還沒有 CoinGecko ID 的自訂幣種，透過 CoinGecko Search 自動補齊 ID 與全名
      for (const item of cryptoAssets.value) {
        const sym = String(item.symbol || '').trim().toUpperCase();
        if (!sym || sym === 'USDT' || sym === 'USDC' || sym === 'USD') continue;
        const cgId = item.coingeckoId || CRYPTO_COINGECKO_ID_MAP[sym] || cryptoQuotes.value[sym]?.coingeckoId;
        if (!cgId && !foundByBinance.has(sym)) {
          await fetchSingleCryptoQuote(sym);
          if (cryptoQuotes.value[sym]?.coingeckoId) {
            item.coingeckoId = cryptoQuotes.value[sym].coingeckoId;
          }
          if (cryptoQuotes.value[sym]?.name && !item.name) {
            item.name = cryptoQuotes.value[sym].name;
          }
        }
      }

      // 第三步：收集所有持倉與觀察清單的 CoinGecko ID，一次批次查詢 CoinGecko 即時價格與 24h 漲跌幅
      const symToCgId = {};
      targetSymbols.forEach(sym => {
        const assetItem = cryptoAssets.value.find(c => String(c.symbol || '').toUpperCase() === sym);
        const cgId = assetItem?.coingeckoId || CRYPTO_COINGECKO_ID_MAP[sym] || cryptoQuotes.value[sym]?.coingeckoId;
        if (cgId) {
          symToCgId[sym] = cgId;
        }
      });

      const allCgIds = Array.from(new Set(Object.values(symToCgId))).filter(Boolean);
      if (allCgIds.length > 0) {
        try {
          const cgRes = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(allCgIds.join(','))}&vs_currencies=usd&include_24hr_change=true`);
          if (cgRes.data) {
            Object.entries(symToCgId).forEach(([sym, id]) => {
              const d = cgRes.data[id];
              if (d && Number(d.usd) > 0) {
                const symName = CRYPTO_NAME_MAP[sym] || cryptoQuotes.value[sym]?.name || sym;
                if (!cryptoQuotes.value[sym]) {
                  cryptoQuotes.value[sym] = {
                    symbol: sym,
                    name: symName,
                    coingeckoId: id,
                    priceUsd: Number(d.usd),
                    isWatched: true,
                  };
                } else {
                  // 若 Binance 沒抓到，或優先使用最新報價
                  if (!foundByBinance.has(sym) || Number(d.usd) > 0) {
                    cryptoQuotes.value[sym].priceUsd = Number(d.usd);
                  }
                }
                if (d.usd_24h_change !== undefined) {
                  cryptoQuotes.value[sym].change24hPercent = parseFloat(Number(d.usd_24h_change).toFixed(2));
                }
              }
            });
          }
        } catch (cgErr) {}
      }

      // 同步回填持倉的名稱與最新參考價格
      cryptoAssets.value.forEach(item => {
        const sym = String(item.symbol || '').trim().toUpperCase();
        const q = cryptoQuotes.value[sym];
        if (q) {
          if (q.name && (!item.name || item.name === sym)) {
            item.name = q.name;
          }
          if (Number(q.priceUsd) > 0) {
            item.customPriceUsd = Number(q.priceUsd);
          }
        }
      });
    } catch (e) {
      console.warn('更新虛擬貨幣行情失敗:', e);
    } finally {
      isRefreshingCrypto.value = false;
    }
  }

  // ==================== 純 Google Drive 官方 REST API + 本地雙向智慧合併 (Per-Record Timestamp Merge) ====================
  const DRIVE_FILE_NAME = 'private_wealth_manager_data.json';
  const LOCAL_BACKUP_KEY = 'mymoney_local_backup_v2';
  const LOCAL_PENDING_SYNC_KEY = 'mymoney_pending_drive_sync';
  let debounceTimer = null;

  // 清空畫面所有資產狀態
  function resetStateToEmpty() {
    bankAssets.value = [];
    cryptoAssets.value = [];
    stockAssets.value = [];
    fundAssets.value = [];
    insuranceAssets.value = [];
    protectionInsurances.value = [];
    loanItems.value = [];
    creditCardItems.value = [];
    shopeeData.value = {
      totalInvestedTwd: 0,
      totalWithdrawnTwd: 0,
      currentAccountBalanceTwd: 0,
      balanceUpdatedAt: 0,
      cashflowRecords: [],
      snapshots: [],
    };
    recurringExpenses.value = [];
    recurringIncomes.value = [];
    specificExpenses.value = [];
    historicalSnapshots.value = [];
    deletedRecords.value = {};
  }

  // 🎭 未登入訪客模式：隨機假資料產生器 (100% 僅留存於記憶體展示，絕不寫入本地或雲端)
  function generateRandomMockState() {
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randStep = (min, max, step = 1000) => Math.round(randInt(min, max) / step) * step;

    const twdBank1 = randStep(180000, 850000, 5000);
    const twdBank2 = randStep(120000, 650000, 5000);
    const usdBank = randStep(3000, 18000, 500);

    const tsmcShares = randInt(1, 5) * 1000;
    const etfShares = randInt(5, 25) * 1000;
    const nvdaShares = randInt(15, 80);

    const btcAmount = Number((Math.random() * 0.45 + 0.08).toFixed(3));
    const usdtAmount = randStep(2000, 15000, 500);

    const shopeeIn = randStep(150000, 400000, 10000);
    const shopeeOut = randStep(40000, 120000, 5000);
    const shopeeCur = shopeeIn - shopeeOut + randStep(25000, 110000, 1000);

    const now = new Date();
    const mockSnapshots = [];
    const mockShopeeSnaps = [];
    let baseNw = randStep(2200000, 3800000, 10000);
    let baseShopee = Math.max(50000, shopeeCur - 60000);

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ymd = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/15`;
      baseNw += randStep(-40000, 135000, 5000);
      baseShopee += randStep(5000, 18000, 1000);

      mockSnapshots.push({
        id: 'mock_snap_' + i,
        month: ym,
        date: ymd,
        netWorthTwd: baseNw,
        grossAssetsTwd: baseNw + 4500000,
        totalDebtTwd: 4500000,
        bankTwd: twdBank1 + twdBank2,
        stockTwd: Math.round(baseNw * 0.55),
        fundTwd: 250000,
        cryptoTwd: 420000,
        insuranceTwd: 380000,
        note: `${ymd} 隨機展示快照`,
      });

      mockShopeeSnaps.push({
        id: 'mock_sp_snap_' + i,
        date: ymd,
        currentValue: baseShopee,
        invested: shopeeIn,
        profit: baseShopee + shopeeOut - shopeeIn,
        note: '展示營運結算',
      });
    }

    return {
      hideAmounts: false,
      stressTestMode: false,
      bankAssets: [
        { id: 'mock_b1', bankName: '國泰世華 (展示)', accountType: '高利活儲', currency: 'TWD', balance: twdBank1, interestRate: 1.8 },
        { id: 'mock_b2', bankName: '台新 Richart (展示)', accountType: '數位活儲', currency: 'TWD', balance: twdBank2, interestRate: 3.2 },
        { id: 'mock_b3', bankName: '玉山外幣帳戶 (展示)', accountType: '美元定存', currency: 'USD', balance: usdBank, interestRate: 4.6 },
      ],
      stockAssets: [
        { id: 'mock_s1', marketType: 'TW', ticker: '2330', name: '台積電', brokerName: '富邦證券 (展示)', currency: 'TWD', shares: tsmcShares, costPrice: 820, currentPrice: 1050 },
        { id: 'mock_s2', marketType: 'TW', ticker: '00878', name: '國泰永續高股息', brokerName: '國泰證券 (展示)', currency: 'TWD', shares: etfShares, costPrice: 19.5, currentPrice: 22.8 },
        { id: 'mock_s3', marketType: 'US', ticker: 'NVDA', name: '輝達 (NVIDIA)', brokerName: 'Firstrade (展示)', currency: 'USD', shares: nvdaShares, costPrice: 95, currentPrice: 138 },
      ],
      fundAssets: [
        { id: 'mock_f1', fundName: '安聯台灣科技基金 (展示)', platform: '基富通', currency: 'TWD', units: randInt(1200, 3500), costNav: 145.5, currentNav: 182.4 },
      ],
      cryptoAssets: [
        { id: 'mock_c1', walletName: 'Binance 幣安 (展示)', symbol: 'BTC', name: 'Bitcoin 比特幣', amount: btcAmount, customPriceUsd: 92000 },
        { id: 'mock_c2', walletName: 'Ledger 冷錢包 (展示)', symbol: 'USDT', name: 'Tether 泰達幣', amount: usdtAmount, customPriceUsd: 1.0 },
      ],
      insuranceAssets: [
        { id: 'mock_i1', company: '富邦人壽 (展示)', policyName: '美利豐沛美元利率變動型終身壽險', currency: 'USD', cashValue: randStep(8000, 22000, 1000), annualReturnRate: 3.85 },
      ],
      protectionInsurances: [
        { id: 'mock_pi1', company: '全球人壽 (展示)', policyName: '醫療實支實付定期附約', category: '醫療實支', payFrequency: 'yearly', premiumAmount: randStep(18000, 36000, 1000) },
      ],
      loanItems: [
        { id: 'mock_l1', loanName: '新青安首購房貸 (展示)', name: '新青安首購房貸 (展示)', principal: randStep(4000000, 7500000, 100000), interestRate: 2.15, totalMonths: 360, gracePeriodMonths: 36, remainingMonths: 342, customGraceMonthlyPay: '' },
      ],
      creditCardItems: [
        { id: 'mock_cc1', bankName: '國泰世華 (展示)', cardName: 'CUBE 卡', payDay: 15, currentDueAmount: randStep(12000, 42000, 500), remainingInstallmentAmount: randStep(15000, 45000, 1000) },
      ],
      recurringIncomes: [
        { id: 'mock_ri1', flowType: 'income', name: '本業薪資收入 (展示)', amount: randStep(68000, 125000, 1000) },
      ],
      recurringExpenses: [
        { id: 'mock_re1', flowType: 'expense', name: '家庭日常與水電開銷 (展示)', amount: randStep(22000, 38000, 1000) },
      ],
      shopeeData: {
        totalInvestedTwd: shopeeIn,
        totalWithdrawnTwd: shopeeOut,
        currentAccountBalanceTwd: shopeeCur,
        balanceUpdatedAt: 0,
        cashflowRecords: [
          { id: 'mock_sp1', date: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/01`, type: 'in', amount: shopeeIn, note: '首批進貨周轉本金 (展示)' },
          { id: 'mock_sp2', date: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/10`, type: 'out', amount: shopeeOut, note: '提領賣場結算利潤 (展示)' },
        ],
        snapshots: mockShopeeSnaps,
      },
      historicalSnapshots: mockSnapshots,
      deletedRecords: {},
    };
  }

  // 封裝目前完整狀態Payload
  function buildCurrentPayload() {
    return {
      hideAmounts: hideAmounts.value,
      stressTestMode: stressTestMode.value,
      waterLevelSettings: waterLevelSettings.value,
      fxRates: fxRates.value,
      cryptoQuotes: cryptoQuotes.value,
      bankAssets: bankAssets.value,
      cryptoAssets: cryptoAssets.value,
      stockAssets: stockAssets.value,
      fundAssets: fundAssets.value,
      insuranceAssets: insuranceAssets.value,
      protectionInsurances: protectionInsurances.value,
      loanItems: loanItems.value,
      creditCardItems: creditCardItems.value,
      shopeeData: shopeeData.value,
      recurringExpenses: recurringExpenses.value,
      recurringIncomes: recurringIncomes.value,
      specificExpenses: specificExpenses.value,
      historicalSnapshots: historicalSnapshots.value,
      lastInputCache: lastInputCache.value,
      deletedRecords: deletedRecords.value,
      lastSavedAt: new Date().toISOString(),
      lastSavedTs: Date.now(),
    };
  }

  // 將指定狀態套用至畫面響應式變數
  function applyStateToRefs(d) {
    if (!d || typeof d !== 'object') return;
    hideAmounts.value = d.hideAmounts || false;
    stressTestMode.value = d.stressTestMode || false;
    if (d.waterLevelSettings) waterLevelSettings.value = Object.assign(waterLevelSettings.value, d.waterLevelSettings);
    if (d.fxRates) fxRates.value = Object.assign(fxRates.value, d.fxRates);
    if (d.cryptoQuotes) cryptoQuotes.value = Object.assign(cryptoQuotes.value, d.cryptoQuotes);
    bankAssets.value = Array.isArray(d.bankAssets) ? d.bankAssets : [];
    cryptoAssets.value = Array.isArray(d.cryptoAssets) ? d.cryptoAssets : [];
    stockAssets.value = Array.isArray(d.stockAssets) ? d.stockAssets : [];
    fundAssets.value = Array.isArray(d.fundAssets) ? d.fundAssets : [];
    insuranceAssets.value = Array.isArray(d.insuranceAssets) ? d.insuranceAssets : [];
    protectionInsurances.value = Array.isArray(d.protectionInsurances) ? d.protectionInsurances : [];
    loanItems.value = Array.isArray(d.loanItems) ? d.loanItems : [];
    creditCardItems.value = Array.isArray(d.creditCardItems) ? d.creditCardItems : [];
    if (d.shopeeData) {
      shopeeData.value = Object.assign({
        totalInvestedTwd: 0,
        totalWithdrawnTwd: 0,
        currentAccountBalanceTwd: 0,
        balanceUpdatedAt: 0,
        cashflowRecords: [],
        snapshots: [],
      }, d.shopeeData);
    }
    recurringExpenses.value = Array.isArray(d.recurringExpenses) ? d.recurringExpenses : [];
    recurringIncomes.value = Array.isArray(d.recurringIncomes) ? d.recurringIncomes : [];
    specificExpenses.value = Array.isArray(d.specificExpenses) ? d.specificExpenses : [];
    historicalSnapshots.value = Array.isArray(d.historicalSnapshots) ? d.historicalSnapshots : [];
    if (d.lastInputCache) lastInputCache.value = Object.assign(lastInputCache.value, d.lastInputCache);
    deletedRecords.value = (d.deletedRecords && typeof d.deletedRecords === 'object') ? d.deletedRecords : {};
  }

  // 寫入本地瀏覽器防丟失備份
  function saveToLocalBackup(payload, isPendingSync = false) {
    try {
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(payload));
      localStorage.setItem(LOCAL_PENDING_SYNC_KEY, isPendingSync ? '1' : '0');
    } catch (e) {
      console.warn('本地備份寫入失敗:', e);
    }
  }

  function loadFromLocalBackup() {
    try {
      const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // 🧠 單一陣列逐筆時間戳記雙向智慧合併 (支援單筆 updatedAt 比對與 deletedRecords 墓碑刪除)
  function mergeRecordArray(localArr = [], cloudArr = [], mergedDeletedMap = {}, keyField = 'id') {
    const map = new Map();
    let hasDiffFromCloud = false;

    const getRecordKey = (item, idx) => {
      if (item && item[keyField]) return String(item[keyField]);
      if (item && item.id) return String(item.id);
      if (item && item.date) return `date_${item.date}`;
      return `idx_${idx}_${JSON.stringify(item).slice(0, 40)}`;
    };

    // 1. 先放入雲端紀錄（若已被墓碑標記刪除且刪除時間 >= 該筆修改時間，則略過）
    (Array.isArray(cloudArr) ? cloudArr : []).forEach((cItem, idx) => {
      if (!cItem) return;
      const k = getRecordKey(cItem, idx);
      const itemTs = Number(cItem.updatedAt) || 1;
      const delTs = Number(mergedDeletedMap[k]) || 0;
      if (delTs > 0 && delTs >= itemTs) {
        hasDiffFromCloud = true; // 雲端這筆在本地已被刪除，需同步回雲端
        return;
      }
      map.set(k, { ...cItem, updatedAt: itemTs });
    });

    // 2. 逐筆比對本地紀錄
    (Array.isArray(localArr) ? localArr : []).forEach((lItem, idx) => {
      if (!lItem) return;
      const k = getRecordKey(lItem, idx);
      const lTs = Number(lItem.updatedAt) || 1;
      const delTs = Number(mergedDeletedMap[k]) || 0;

      // 若這筆在雲端已被刪除（且刪除時間 >= 本地修改時間），則不保留
      if (delTs > 0 && delTs >= lTs) {
        return;
      }

      if (!map.has(k)) {
        // 雲端沒有、且未被刪除 -> 本地新增的紀錄，需同步上雲端
        map.set(k, { ...lItem, updatedAt: lTs });
        hasDiffFromCloud = true;
      } else {
        // 兩邊都有同一筆紀錄 -> 比較 updatedAt 毫秒時間戳
        const cItem = map.get(k);
        const cTs = Number(cItem.updatedAt) || 1;
        if (lTs > cTs) {
          // 本地這筆紀錄較新 -> 採用本地版本並標記需寫回雲端
          map.set(k, { ...lItem, updatedAt: lTs });
          hasDiffFromCloud = true;
        } else if (lTs === cTs && JSON.stringify(lItem) !== JSON.stringify(cItem)) {
          // 時間戳相同但內容不同（例如舊資料尚未加上時間戳）-> 以最後儲存整體時間較新者為準
          map.set(k, { ...lItem, updatedAt: Date.now() });
          hasDiffFromCloud = true;
        }
      }
    });

    return {
      mergedList: Array.from(map.values()),
      hasDiffFromCloud,
    };
  }

  // 🧠 完整狀態雙向智慧合併引擎 (Local <-> Google Drive)
  function mergeFinancialStates(localState, cloudState) {
    if (!localState) return { merged: cloudState, needUploadToCloud: false };
    if (!cloudState) return { merged: localState, needUploadToCloud: true };

    // 1. 合併刪除墓碑紀錄 (取最大刪除時間戳)
    const mergedDeleted = { ...(cloudState.deletedRecords || {}) };
    let needUploadToCloud = false;

    Object.entries(localState.deletedRecords || {}).forEach(([id, ts]) => {
      const lDelTs = Number(ts) || 0;
      const cDelTs = Number(mergedDeleted[id]) || 0;
      if (lDelTs > cDelTs) {
        mergedDeleted[id] = lDelTs;
        needUploadToCloud = true;
      }
    });

    // 2. 逐一合併各大資產/負債/收支陣列
    const arrayKeys = [
      'bankAssets',
      'cryptoAssets',
      'stockAssets',
      'fundAssets',
      'insuranceAssets',
      'protectionInsurances',
      'loanItems',
      'creditCardItems',
      'recurringExpenses',
      'recurringIncomes',
      'specificExpenses',
    ];

    const localOverallTs = Number(localState.lastSavedTs) || (localState.lastSavedAt ? new Date(localState.lastSavedAt).getTime() : 0);
    const cloudOverallTs = Number(cloudState.lastSavedTs) || (cloudState.lastSavedAt ? new Date(cloudState.lastSavedAt).getTime() : 0);
    const baseState = localOverallTs >= cloudOverallTs ? localState : cloudState;

    const merged = {
      ...baseState,
      deletedRecords: mergedDeleted,
    };

    arrayKeys.forEach(key => {
      const { mergedList, hasDiffFromCloud } = mergeRecordArray(
        localState[key],
        cloudState[key],
        mergedDeleted,
        'id'
      );
      merged[key] = mergedList;
      if (hasDiffFromCloud) needUploadToCloud = true;
    });

    // 3. 合併歷史資產快照 (依 date / id 智慧合併)
    const snapMerge = mergeRecordArray(
      localState.historicalSnapshots,
      cloudState.historicalSnapshots,
      mergedDeleted,
      'date'
    );
    merged.historicalSnapshots = snapMerge.mergedList.sort((a, b) => (a.date > b.date ? 1 : -1));
    if (snapMerge.hasDiffFromCloud) needUploadToCloud = true;

    // 4. 合併蝦皮商業投資獨立模組
    const lShopee = localState.shopeeData || {};
    const cShopee = cloudState.shopeeData || {};
    const shopeeCfMerge = mergeRecordArray(
      lShopee.cashflowRecords,
      cShopee.cashflowRecords,
      mergedDeleted,
      'id'
    );
    const shopeeSnapMerge = mergeRecordArray(
      lShopee.snapshots,
      cShopee.snapshots,
      mergedDeleted,
      'date'
    );

    // 根據合併後的流水帳重新精算累計投入與提領，避免重複或漏算
    let calcInvested = 0;
    let calcWithdrawn = 0;
    shopeeCfMerge.mergedList.forEach(r => {
      if (r.type === 'in') calcInvested += Number(r.amount) || 0;
      if (r.type === 'out') calcWithdrawn += Number(r.amount) || 0;
    });
    // 若無流水帳明細但有舊版總數，取時間較新者
    if (shopeeCfMerge.mergedList.length === 0) {
      calcInvested = localOverallTs >= cloudOverallTs ? (Number(lShopee.totalInvestedTwd) || 0) : (Number(cShopee.totalInvestedTwd) || 0);
      calcWithdrawn = localOverallTs >= cloudOverallTs ? (Number(lShopee.totalWithdrawnTwd) || 0) : (Number(cShopee.totalWithdrawnTwd) || 0);
    }

    const lBalTs = Number(lShopee.balanceUpdatedAt) || localOverallTs;
    const cBalTs = Number(cShopee.balanceUpdatedAt) || cloudOverallTs;
    const mergedShopeeBalance = lBalTs >= cBalTs
      ? (Number(lShopee.currentAccountBalanceTwd) || 0)
      : (Number(cShopee.currentAccountBalanceTwd) || 0);

    if (lBalTs > cBalTs && lShopee.currentAccountBalanceTwd !== cShopee.currentAccountBalanceTwd) {
      needUploadToCloud = true;
    }
    if (shopeeCfMerge.hasDiffFromCloud || shopeeSnapMerge.hasDiffFromCloud) {
      needUploadToCloud = true;
    }

    merged.shopeeData = {
      totalInvestedTwd: calcInvested,
      totalWithdrawnTwd: calcWithdrawn,
      currentAccountBalanceTwd: mergedShopeeBalance,
      balanceUpdatedAt: Math.max(lBalTs, cBalTs),
      cashflowRecords: shopeeCfMerge.mergedList.sort((a, b) => ((b.updatedAt || 0) - (a.updatedAt || 0))),
      snapshots: shopeeSnapMerge.mergedList.sort((a, b) => (a.date > b.date ? 1 : -1)),
    };

    if (localStorage.getItem(LOCAL_PENDING_SYNC_KEY) === '1') {
      needUploadToCloud = true;
    }

    return { merged, needUploadToCloud };
  }

  // 在使用者的 Google Drive 搜尋 private_wealth_manager_data.json (排除垃圾桶 trashed = false)
  async function findDriveFileId() {
    if (!authStore.hasValidDriveToken) return null;
    const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.accessToken}`,
      },
    });
    if (res.status === 401 || res.status === 403) {
      authStore.setDriveToken('', 0);
      throw new Error('AUTH_EXPIRED');
    }
    if (!res.ok) {
      throw new Error(`Drive search HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      authStore.setDriveFileId(data.files[0].id);
      return data.files[0].id;
    }
    authStore.setDriveFileId('');
    return null;
  }

  // 底層：將指定 Payload 寫入 Google Drive 檔案
  async function uploadPayloadToDrive(payload) {
    let fileId = await findDriveFileId();
    const fileContent = JSON.stringify(payload, null, 2);

    if (fileId) {
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authStore.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: fileContent,
      });
      if (updateRes.ok) {
        return true;
      }
      // 若 PATCH 因權限或舊檔問題失敗 (例如 403/404)，自動改走 POST 建立新檔接管
      console.warn(`Drive PATCH 狀態 ${updateRes.status}，自動改建新檔接管`);
    }

    const metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: 'application/json',
    };
    const boundary = '-------mymoney_gdrive_boundary_' + Date.now();
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    if (!createRes.ok) {
      throw new Error(`Drive POST create failed: ${createRes.status}`);
    }
    const created = await createRes.json();
    if (created && created.id) {
      authStore.setDriveFileId(created.id);
    }
    return true;
  }

  function triggerAutoSave() {
    // 🛑 最高優先級攔截：未登入 Google 帳號時處於「隨機假資料展示模式」，100% 絕對不儲存至本地或雲端！
    if (!authStore.isLoggedIn) {
      authStore.updateSyncStatus('🎭 訪客展示模式 (隨機假資料・不儲存)', 'bg-indigo-400');
      return;
    }

    // 🌟 第 0 秒：立即寫入本地備份並標記待同步 (確保就算立刻關網頁或斷線也 100% 不遺失)
    checkAndAutoSnapshot();
    const immediatePayload = buildCurrentPayload();
    saveToLocalBackup(immediatePayload, true);

    clearTimeout(debounceTimer);
    if (!authStore.hasValidDriveToken) {
      authStore.updateSyncStatus('已暫存於本地 (連接 Google Drive 後自動補傳雲端)', 'bg-amber-400 animate-pulse');
      return;
    }
    authStore.updateSyncStatus('已存本地 (等待 1.5s 同步至 Google Drive)...', 'bg-amber-400 animate-pulse');

    debounceTimer = setTimeout(async () => {
      await saveState();
    }, 1500);
  }

  async function saveState() {
    // 🛑 最高優先級攔截：未登入 Google 帳號時處於「隨機假資料展示模式」，100% 絕對不儲存至本地或雲端！
    if (!authStore.isLoggedIn) {
      authStore.updateSyncStatus('🎭 訪客展示模式 (隨機假資料・不儲存)', 'bg-indigo-400');
      return false;
    }

    // 1. 永遠先更新本地防丟失備份
    checkAndAutoSnapshot();
    const localPayload = buildCurrentPayload();
    saveToLocalBackup(localPayload, true);

    if (!authStore.hasValidDriveToken) {
      authStore.updateSyncStatus('已安全存於本地 (待連接 Google Drive 後自動補傳)', 'bg-amber-400');
      return false;
    }

    try {
      authStore.updateSyncStatus('正在同步至 Google Drive...', 'bg-sky-400 animate-pulse');

      // 2. 先檢查雲端是否已有檔案，若有則先做逐筆時間戳記雙向合併，避免覆蓋別台裝置的更新
      let finalPayload = localPayload;
      const fileId = await findDriveFileId();
      if (fileId) {
        try {
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
          const res = await fetch(downloadUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${authStore.accessToken}` },
          });
          if (res.ok) {
            const rawCloud = await res.json();
            const cloudData = (rawCloud && rawCloud.data && typeof rawCloud.data === 'object' && !Array.isArray(rawCloud.data))
              ? rawCloud.data
              : rawCloud;
            if (cloudData && typeof cloudData === 'object') {
              const { merged } = mergeFinancialStates(localPayload, cloudData);
              applyStateToRefs(merged);
              finalPayload = buildCurrentPayload();
            }
          }
        } catch (readErr) {
          console.warn('儲存前讀取雲端比對略過，直接寫入本地最新狀態:', readErr);
        }
      }

      // 3. 寫入 Google Drive
      await uploadPayloadToDrive(finalPayload);

      // 4. 更新本地備份並標記「已同步 (pendingSync = false)」
      saveToLocalBackup(finalPayload, false);

      authStore.updateDriveSyncTime();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      lastUpdated.value = timeStr;
      authStore.updateSyncStatus(`Google Drive 與本地已同步 (${timeStr})`, 'bg-emerald-400');
      return true;

    } catch (err) {
      console.error('Google Drive 儲存失敗 (已保留於本地待補傳):', err);
      saveToLocalBackup(localPayload, true);
      if (err.message === 'AUTH_EXPIRED') {
        authStore.updateSyncStatus('已暫存本地 (Google 授權過期，重連後自動補傳)', 'bg-amber-400');
      } else {
        authStore.updateSyncStatus('雲端寫入異常，已安全保存於本地 (連線後自動補傳)', 'bg-amber-400');
      }
      return false;
    }
  }

  // 判斷某個狀態是否有任何實質資產/收支資料
  function hasAnyMeaningfulData(stateObj) {
    if (!stateObj || typeof stateObj !== 'object') return false;
    const keys = [
      'bankAssets', 'cryptoAssets', 'stockAssets', 'fundAssets',
      'insuranceAssets', 'protectionInsurances', 'loanItems',
      'creditCardItems', 'recurringExpenses', 'recurringIncomes',
      'specificExpenses', 'historicalSnapshots'
    ];
    for (const k of keys) {
      if (Array.isArray(stateObj[k]) && stateObj[k].length > 0) return true;
    }
    if (stateObj.shopeeData) {
      if (Number(stateObj.shopeeData.currentAccountBalanceTwd) > 0) return true;
      if (Array.isArray(stateObj.shopeeData.cashflowRecords) && stateObj.shopeeData.cashflowRecords.length > 0) return true;
    }
    return false;
  }

  async function loadState() {
    // 🎭 0. 若尚未登入 Google 帳號 -> 進入「隨機假資料展示模式」(僅載入至記憶體，絕不儲存、絕不污染本地備份)
    if (!authStore.isLoggedIn) {
      resetStateToEmpty();
      const mockState = generateRandomMockState();
      applyStateToRefs(mockState);
      authStore.updateSyncStatus('🎭 訪客展示模式 (隨機假資料・不儲存)', 'bg-indigo-400');
      return;
    }

    // 🌟 已登入狀態：先徹底清空記憶體中可能殘留的隨機展示假資料
    resetStateToEmpty();

    // 1. 讀取本地真實備份（確保離線或 Token 過期時，畫面能立即顯示該登入者的本地最新真實資料）
    const localBackup = loadFromLocalBackup();
    if (localBackup) {
      applyStateToRefs(localBackup);
    }

    if (!authStore.hasValidDriveToken) {
      if (localBackup && hasAnyMeaningfulData(localBackup)) {
        const isPending = localStorage.getItem(LOCAL_PENDING_SYNC_KEY) === '1';
        authStore.updateSyncStatus(
          isPending ? '已載入本地未同步修改 (連接 Drive 後自動補傳)' : '已載入本地快取 (點擊右上連接 Drive 同步)',
          'bg-amber-400'
        );
      } else {
        resetStateToEmpty();
        authStore.updateSyncStatus('尚未連接 Google Drive (點擊右上按鈕載入)', 'bg-amber-400');
      }
      return;
    }

    try {
      authStore.updateSyncStatus('正在與 Google Drive 進行逐筆雙向同步...', 'bg-sky-400 animate-pulse');

      const fileId = await findDriveFileId();

      if (!fileId) {
        // 🌟 情況 1：Google Drive 上沒有檔案，但本地有備份資料 -> 自動將本地資料救回雲端！
        if (localBackup && hasAnyMeaningfulData(localBackup)) {
          applyStateToRefs(localBackup);
          const rescuePayload = buildCurrentPayload();
          await uploadPayloadToDrive(rescuePayload);
          saveToLocalBackup(rescuePayload, false);
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          authStore.updateSyncStatus(`已將本地資料自動救回 Google Drive (${timeStr})`, 'bg-emerald-400');
          return;
        }
        // 本地與雲端皆無資料
        resetStateToEmpty();
        authStore.updateSyncStatus('Google Drive 已連線 (尚無資料，新增後自動建立)', 'bg-emerald-400');
        return;
      }

      // 🌟 情況 2：Google Drive 上有檔案 -> 下載並與本地進行「逐筆時間戳記雙向合併」
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.accessToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        authStore.setDriveToken('', 0);
        throw new Error('AUTH_EXPIRED');
      }
      if (!res.ok) {
        throw new Error(`Drive download HTTP ${res.status}`);
      }

      const rawJson = await res.json();
      const cloudData = (rawJson && rawJson.data && typeof rawJson.data === 'object' && !Array.isArray(rawJson.data))
        ? rawJson.data
        : rawJson;

      if (cloudData && typeof cloudData === 'object') {
        const { merged, needUploadToCloud } = mergeFinancialStates(localBackup, cloudData);
        applyStateToRefs(merged);

        const finalPayload = buildCurrentPayload();

        // 若本地有較新的單筆修改、新增、刪除或待補傳標記 -> 自動補傳回 Google Drive！
        if (needUploadToCloud) {
          authStore.updateSyncStatus('偵測到本地較新紀錄，正在自動補傳至 Google Drive...', 'bg-sky-400 animate-pulse');
          await uploadPayloadToDrive(finalPayload);
        }

        saveToLocalBackup(finalPayload, false);

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        authStore.updateSyncStatus(
          needUploadToCloud
            ? `已完成雙向合併並補傳至 Google Drive (${timeStr})`
            : `Google Drive 雙向同步完成 (${timeStr})`,
          'bg-emerald-400'
        );

        refreshCryptoQuotes();
        if (stockAssets.value.length > 0) {
          refreshStockQuotes();
        }
      } else if (localBackup && hasAnyMeaningfulData(localBackup)) {
        // 雲端檔案為空，但本地有資料 -> 自動救回雲端
        applyStateToRefs(localBackup);
        const rescuePayload = buildCurrentPayload();
        await uploadPayloadToDrive(rescuePayload);
        saveToLocalBackup(rescuePayload, false);
        authStore.updateSyncStatus('已將本地資料補傳至 Google Drive', 'bg-emerald-400');
      }
    } catch (err) {
      console.error('Google Drive 同步異常，使用本地備份保護:', err);
      if (localBackup) {
        applyStateToRefs(localBackup);
      }
      if (err.message === 'AUTH_EXPIRED') {
        authStore.updateSyncStatus('已載入本地備份 (Drive 授權過期，重連後自動雙向同步)', 'bg-amber-400');
      } else {
        authStore.updateSyncStatus('網路異常，已載入本地備份 (連線恢復後自動補傳)', 'bg-amber-400');
      }
    }
  }

  // 🗑️ 徹底清空本地與雲端資料（供使用者主動重置時使用）
  async function clearAllLocalAndCloudData() {
    resetStateToEmpty();
    localStorage.removeItem(LOCAL_BACKUP_KEY);
    localStorage.removeItem(LOCAL_PENDING_SYNC_KEY);
    if (authStore.hasValidDriveToken) {
      const emptyPayload = buildCurrentPayload();
      await uploadPayloadToDrive(emptyPayload);
      saveToLocalBackup(emptyPayload, false);
      authStore.updateSyncStatus('已徹底清空本地與 Google Drive 資料', 'bg-emerald-400');
    } else {
      authStore.updateSyncStatus('已清空本地資料', 'bg-zinc-400');
    }
  }

  // 監聽瀏覽器網路恢復事件 (Online)：一旦網路恢復且有有效 Token，自動把未同步資料補傳回雲端
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (authStore.hasValidDriveToken && localStorage.getItem(LOCAL_PENDING_SYNC_KEY) === '1') {
        saveState();
      }
    });
  }

  // 格式化貨幣工具
  function formatMoney(amount, currencySymbol = 'NT$ ', decimals = 0) {
    if (hideAmounts.value) return '******';
    const num = Number(amount) || 0;
    return currencySymbol + num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return {
    hideAmounts,
    stressTestMode,
    lastUpdated,
    isRefreshingStocks,
    isRefreshingCrypto,
    lastInputCache,
    waterLevelSettings,
    fxRates,
    cryptoQuotes,
    bankAssets,
    cryptoAssets,
    stockAssets,
    fundAssets,
    insuranceAssets,
    protectionInsurances,
    loanItems,
    creditCardItems,
    shopeeData,
    shopeeSummary,
    recordShopeeCashflow,
    updateShopeeAccountBalance,
    recurringExpenses,
    recurringIncomes,
    specificExpenses,
    historicalSnapshots,
    getRateToTwd,
    convertToTwd,
    convertTwdToUsdt,
    getCryptoPriceUsd,
    convertCryptoToTwd,
    calculateLoanDetail,
    bankSummary,
    cryptoSummary,
    stockSummary,
    fundSummary,
    insuranceSummary,
    protectionInsuranceSummary,
    creditCardSummary,
    loanSummary,
    totalLiabilitiesTwd,
    totalGrossAssetsTwd,
    totalNetWorthTwd,
    cashflowSummary,
    waterLevelHealth,
    checkAndAutoSnapshot,
    recordSnapshot,
    deleteSnapshot,
    markRecordDeleted,
    clearAllLocalAndCloudData,
    exportToCsv,
    exportBackupJson,
    importBackupJson,
    refreshStockQuotes,
    refreshCryptoQuotes,
    fetchSingleCryptoQuote,
    triggerAutoSave,
    saveState,
    loadState,
    saveStateToApi: saveState,
    loadStateFromApi: loadState,
    formatMoney,
  };
});
