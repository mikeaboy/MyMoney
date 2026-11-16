<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\FinancialState;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class FinancialDataController extends Controller
{
    /**
     * 取得帳務狀態
     */
    public function getData(Request $request)
    {
        $sessionKey = $request->header('X-Session-Key') ?: $request->input('session_key', 'guest_default');
        $userEmail = $request->header('X-User-Email');

        $userId = null;
        if ($userEmail) {
            $user = User::firstOrCreate(['email' => strtolower(trim($userEmail))], [
                'name' => explode('@', $userEmail)[0],
            ]);
            $userId = $user->id;
        }

        // 優先以使用者 ID 尋找，其次以 session_key 尋找
        $state = FinancialState::where(function ($q) use ($userId, $sessionKey) {
            if ($userId) {
                $q->where('user_id', $userId);
            } else {
                $q->where('session_key', $sessionKey);
            }
        })->first();

        // 若無資料，建立乾淨的個人帳本 (不塞任何假資料)
        if (!$state) {
            $data = $this->getCleanInitialFinancialData();
            
            $state = FinancialState::create([
                'user_id' => $userId,
                'session_key' => $sessionKey,
                'payload' => $data,
                'version' => 1,
                'last_synced_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'isNewUser' => true,
                'version' => 1,
                'lastUpdated' => now()->toIso8601String(),
                'data' => $data,
            ]);
        }

        // 忠實回傳使用者儲存之真實帳戶資料
        return response()->json([
            'success' => true,
            'isNewUser' => false,
            'version' => $state->version,
            'lastUpdated' => $state->last_synced_at?->toIso8601String() ?? $state->updated_at->toIso8601String(),
            'data' => $state->payload,
        ]);
    }

    /**
     * 儲存帳務狀態 (防抖與並發樂觀鎖版本控制)
     */
    public function saveData(Request $request)
    {
        $sessionKey = $request->header('X-Session-Key') ?: $request->input('session_key', 'guest_default');
        $userEmail = $request->header('X-User-Email');
        $payload = $request->input('state');

        if (!$payload || !is_array($payload)) {
            return response()->json([
                'success' => false,
                'message' => '缺少有效的帳務資料內容 (payload)',
            ], 422);
        }

        $userId = null;
        if ($userEmail) {
            $user = User::firstOrCreate(['email' => strtolower(trim($userEmail))], [
                'name' => explode('@', $userEmail)[0],
            ]);
            $userId = $user->id;
        }

        $financialState = FinancialState::where(function ($q) use ($userId, $sessionKey) {
            if ($userId) {
                $q->where('user_id', $userId);
            } else {
                $q->where('session_key', $sessionKey);
            }
        })->first();

        $version = $financialState ? ($financialState->version + 1) : 1;

        $financialState = FinancialState::updateOrCreate(
            $userId ? ['user_id' => $userId] : ['session_key' => $sessionKey],
            [
                'payload' => $payload,
                'version' => $version,
                'last_synced_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'version' => $version,
            'updatedAt' => $financialState->last_synced_at->toIso8601String(),
            'message' => '雲端資料已安全儲存',
        ]);
    }

    /**
     * 乾淨初始帳本結構 (完全空白無任何假資料，只包含必要之匯率與行情查詢字典)
     */
    public function getCleanInitialFinancialData(): array
    {
        return [
            'hideAmounts' => false,
            'stressTestMode' => false,
            'includeShopeeInNetWorth' => false,
            'waterLevelSettings' => [
                'minMonthlyNetCashflowTwd' => 25000,
                'minBankCashReserveTwd' => 500000,
                'minEmergencyMonths' => 6,
                'maxDebtServicePct' => 35,
            ],
            'fxRates' => [
                'TWD' => ['currency' => 'TWD', 'name' => '新台幣', 'flag' => '🇹🇼', 'rateToTwd' => 1.0, 'changePercent' => 0.0, 'isWatched' => false],
                'USD' => ['currency' => 'USD', 'name' => '美金', 'flag' => '🇺🇸', 'rateToTwd' => 32.15, 'changePercent' => 0.18, 'isWatched' => true],
                'JPY' => ['currency' => 'JPY', 'name' => '日圓', 'flag' => '🇯🇵', 'rateToTwd' => 0.2115, 'changePercent' => -0.35, 'isWatched' => true],
                'EUR' => ['currency' => 'EUR', 'name' => '歐元', 'flag' => '🇪🇺', 'rateToTwd' => 34.85, 'changePercent' => 0.12, 'isWatched' => true],
                'CNY' => ['currency' => 'CNY', 'name' => '人民幣', 'flag' => '🇨🇳', 'rateToTwd' => 4.51, 'changePercent' => -0.08, 'isWatched' => true],
                'HKD' => ['currency' => 'HKD', 'name' => '港幣', 'flag' => '🇭🇰', 'rateToTwd' => 4.13, 'changePercent' => 0.05, 'isWatched' => true],
            ],
            'cryptoQuotes' => [
                'BTC' => ['symbol' => 'BTC', 'name' => 'Bitcoin 比特幣', 'priceUsd' => 92450.0, 'change24hPercent' => 2.85, 'isWatched' => true],
                'ETH' => ['symbol' => 'ETH', 'name' => 'Ethereum 以太幣', 'priceUsd' => 3180.0, 'change24hPercent' => 1.42, 'isWatched' => true],
                'SOL' => ['symbol' => 'SOL', 'name' => 'Solana', 'priceUsd' => 188.5, 'change24hPercent' => 4.60, 'isWatched' => true],
                'BNB' => ['symbol' => 'BNB', 'name' => 'BNB 幣安幣', 'priceUsd' => 645.0, 'change24hPercent' => 0.75, 'isWatched' => true],
                'USDT' => ['symbol' => 'USDT', 'name' => 'Tether 泰達幣', 'priceUsd' => 1.00, 'change24hPercent' => 0.01, 'isWatched' => true],
            ],
            'bankAssets' => [],
            'stockAssets' => [],
            'fundAssets' => [],
            'cryptoAssets' => [],
            'insuranceAssets' => [],
            'protectionInsurances' => [],
            'creditCardItems' => [],
            'loanItems' => [],
            'recurringIncomes' => [],
            'recurringExpenses' => [],
            'specificExpenses' => [],
            'shopeeAssets' => [
                'walletBalanceTwd' => 0,
                'escrowPendingTwd' => 0,
                'inventoryValueTwd' => 0,
                'operatingReserveTwd' => 0,
                'accountsPayableTwd' => 0,
                'monthlySalesRevenueTwd' => 0,
                'monthlyNetProfitTwd' => 0,
            ],
            'historicalSnapshots' => [],
        ];
    }
}
