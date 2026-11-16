<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class MarketDataController extends Controller
{
    /**
     * 查詢股票即時行情 (支援台股上市/上櫃/興櫃/債券ETF 與美股)
     * 1. 台股優先走台灣證交所/櫃買中心官方即時 API (保留 ETF 尾碼字母如 00679B)
     * 2. 若證交所無回應或為興櫃/特殊標的，自動 fallback 至 Yahoo Finance (.TW / .TWO)
     * 3. 美股走 Yahoo Finance v8/chart API
     */
    public function getStockQuotes(Request $request)
    {
        $rawSymbols = $request->query('symbols', '');
        if (empty($rawSymbols)) {
            return response()->json(['success' => true, 'quotes' => (object)[]]);
        }

        $symbolList = array_filter(array_map('trim', explode(',', strtoupper($rawSymbols))));
        if (empty($symbolList)) {
            return response()->json(['success' => true, 'quotes' => (object)[]]);
        }

        $results = [];
        $twSymbolsToFetch = [];
        $usSymbolsToFetch = [];

        foreach ($symbolList as $sym) {
            $cleanKey = preg_replace('/[^A-Za-z0-9]/', '', $sym);
            $cacheKey = "stock_quote_v2_" . $cleanKey;
            try {
                if (Cache::has($cacheKey)) {
                    $cached = Cache::get($cacheKey);
                    if ($cached && !empty($cached['price'])) {
                        $results[$sym] = $cached;
                        $baseCode = preg_replace('/\.(TW|TWO)$/i', '', $sym);
                        $results[$baseCode] = $cached;
                        continue;
                    }
                }
            } catch (\Throwable $e) {}

            // 判斷是否為台股：純數字、數字開頭帶尾碼字母 (如 00679B, 00687B, 2881A)、或含 .TW / .TWO
            $baseSym = preg_replace('/\.(TW|TWO)$/i', '', $sym);
            if (preg_match('/^[0-9]{4,6}[A-Z]?$/i', $baseSym) || str_ends_with($sym, '.TW') || str_ends_with($sym, '.TWO')) {
                $twSymbolsToFetch[] = $baseSym;
            } else {
                $usSymbolsToFetch[] = $sym;
            }
        }

        // 2. 批次查詢台股 (台灣證交所 MIS 官方 API + Yahoo .TW / .TWO 自動備援)
        if (!empty($twSymbolsToFetch)) {
            $twQuotes = $this->fetchTwseQuotes($twSymbolsToFetch);
            foreach ($twSymbolsToFetch as $baseSym) {
                $q = $twQuotes[$baseSym] ?? null;

                // 若 TWSE MIS 沒抓到有效價格，自動備援查 Yahoo Finance (.TW 與 .TWO)
                if (!$q || empty($q['price']) || $q['price'] <= 0) {
                    $q = $this->fetchYahooQuote($baseSym . '.TW') ?? $this->fetchYahooQuote($baseSym . '.TWO');
                    if ($q) {
                        $q['symbol'] = $baseSym;
                        $q['currency'] = 'TWD';
                    }
                }

                if ($q && !empty($q['price']) && $q['price'] > 0) {
                    $results[$baseSym] = $q;
                    $results[$baseSym . '.TW'] = $q;
                    $results[$baseSym . '.TWO'] = $q;
                    try {
                        $cleanKey = preg_replace('/[^A-Za-z0-9]/', '', $baseSym);
                        Cache::put("stock_quote_v2_" . $cleanKey, $q, 60);
                    } catch (\Throwable $e) {}
                }
            }
        }

        // 3. 查詢美股 (Yahoo Finance API)
        if (!empty($usSymbolsToFetch)) {
            foreach ($usSymbolsToFetch as $sym) {
                $quote = $this->fetchYahooQuote($sym);
                if ($quote && !empty($quote['price']) && $quote['price'] > 0) {
                    $results[$sym] = $quote;
                    try {
                        $cleanKey = preg_replace('/[^A-Za-z0-9]/', '', $sym);
                        Cache::put("stock_quote_v2_" . $cleanKey, $quote, 60);
                    } catch (\Throwable $e) {}
                }
            }
        }

        return response()->json([
            'success' => true,
            'quotes' => (object)$results,
            'timestamp' => now()->toIso8601String()
        ]);
    }

    /**
     * 股票代碼與中文名稱模糊搜尋端點 (支援台股中文名稱、台股代號、美股代號與英文名稱)
     */
    public function searchStocks(Request $request)
    {
        $q = trim($request->query('q', ''));
        if (mb_strlen($q) < 1) {
            return response()->json(['success' => true, 'items' => []]);
        }

        $cacheKey = 'stock_search_' . md5(mb_strtolower($q));
        try {
            if (Cache::has($cacheKey)) {
                return response()->json(['success' => true, 'items' => Cache::get($cacheKey)]);
            }
        } catch (\Throwable $e) {}

        $items = [];

        // 1. 若輸入包含中文字或台股代號格式，先查台灣證交所/Yahoo 台股搜尋與內建中文對照
        try {
            // 呼叫 Yahoo Finance Search API (同時支援全球代號與部分名稱)
            $yhRes = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept' => 'application/json',
            ])->timeout(4)->get('https://query2.finance.yahoo.com/v1/finance/search', [
                'q' => $q,
                'quotesCount' => 10,
                'newsCount' => 0,
            ]);

            if ($yhRes->successful()) {
                $quotes = $yhRes->json('quotes') ?? [];
                foreach ($quotes as $qt) {
                    $sym = $qt['symbol'] ?? '';
                    if (empty($sym)) continue;
                    $quoteType = $qt['quoteType'] ?? '';
                    if (!in_array($quoteType, ['EQUITY', 'ETF', 'INDEX'])) continue;

                    $isTw = str_ends_with($sym, '.TW') || str_ends_with($sym, '.TWO');
                    $cleanTicker = $isTw ? preg_replace('/\.(TW|TWO)$/i', '', $sym) : $sym;
                    $name = $qt['shortname'] ?? $qt['longname'] ?? $cleanTicker;

                    $items[] = [
                        'ticker' => $cleanTicker,
                        'name' => $name,
                        'market' => $isTw ? 'TW' : 'US',
                        'currency' => $isTw ? 'TWD' : 'USD',
                    ];
                }
            }
        } catch (\Throwable $e) {}

        // 2. 若搜尋的是台股代號 (例如 4~6 碼數字+可選字母)，直接透過證交所 MIS 查出正體中文名稱與即時價格
        $cleanTwCode = strtoupper(preg_replace('/\.(TW|TWO)$/i', '', $q));
        if (preg_match('/^[0-9]{4,6}[A-Z]?$/', $cleanTwCode)) {
            $twQuotes = $this->fetchTwseQuotes([$cleanTwCode]);
            if (!empty($twQuotes[$cleanTwCode])) {
                $tq = $twQuotes[$cleanTwCode];
                // 置頂證交所官方中文名稱與報價
                array_unshift($items, [
                    'ticker' => $tq['symbol'],
                    'name' => $tq['name'],
                    'market' => 'TW',
                    'currency' => 'TWD',
                    'price' => $tq['price'],
                ]);
            }
        }

        // 去重
        $unique = [];
        $seen = [];
        foreach ($items as $it) {
            $key = $it['market'] . '_' . $it['ticker'];
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $unique[] = $it;
            }
        }

        $resultItems = array_slice($unique, 0, 10);
        try {
            Cache::put($cacheKey, $resultItems, 300);
        } catch (\Throwable $e) {}

        return response()->json([
            'success' => true,
            'items' => $resultItems,
        ]);
    }

    /**
     * 批次從台灣證交所/櫃買中心官方即時端點抓取台股行情
     * 修正：完整保留尾碼英文字母 (如 00679B, 00687B, 00937B)
     */
    private function fetchTwseQuotes(array $symbols): array
    {
        $quotes = [];
        $channels = [];

        foreach ($symbols as $sym) {
            // 移除 .TW / .TWO 後保留數字與尾碼英文字母
            $base = preg_replace('/\.(TW|TWO)$/i', '', strtoupper(trim($sym)));
            $code = preg_replace('/[^A-Z0-9]/', '', $base);
            if (empty($code)) continue;

            // 同時加入上市 (tse) 與上櫃 (otc) 查詢通道
            $tseKey = "tse_{$code}.tw";
            $otcKey = "otc_{$code}.tw";
            $channels[] = $tseKey;
            $channels[] = $otcKey;
        }

        if (empty($channels)) return $quotes;

        try {
            $exChParam = implode('|', array_unique($channels));
            $url = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch={$exChParam}&json=1&delay=0";

            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer' => 'https://mis.twse.com.tw/stock/fibest.jsp?lang=zh_tw',
                'Accept' => 'application/json, text/javascript, */*',
            ])->timeout(5)->get($url);

            if ($response->successful()) {
                $data = $response->json();
                $items = $data['msgArray'] ?? [];

                foreach ($items as $item) {
                    $code = strtoupper(trim($item['c'] ?? ''));
                    if (empty($code)) continue;

                    // 1. 優先取當盤成交價 z
                    $price = (!empty($item['z']) && $item['z'] !== '-') ? (float)$item['z'] : 0.0;

                    // 2. 若盤中尚未撮合或收盤 z 為 '-'，取最佳委買 b / 最佳委賣 a 的第一檔
                    if ($price <= 0 && !empty($item['b']) && $item['b'] !== '-') {
                        $bParts = array_filter(explode('_', $item['b']), fn($v) => is_numeric($v) && (float)$v > 0);
                        if (!empty($bParts)) {
                            $price = (float)reset($bParts);
                        }
                    }
                    if ($price <= 0 && !empty($item['a']) && $item['a'] !== '-') {
                        $aParts = array_filter(explode('_', $item['a']), fn($v) => is_numeric($v) && (float)$v > 0);
                        if (!empty($aParts)) {
                            $price = (float)reset($aParts);
                        }
                    }

                    // 3. 若仍無，取昨收價 y
                    if ($price <= 0 && !empty($item['y']) && is_numeric($item['y'])) {
                        $price = (float)$item['y'];
                    }

                    if ($price <= 0) continue;

                    $prevClose = (!empty($item['y']) && is_numeric($item['y'])) ? (float)$item['y'] : $price;
                    $change = $price - $prevClose;
                    $changePercent = $prevClose > 0 ? ($change / $prevClose) * 100 : 0.0;

                    $quoteData = [
                        'symbol' => $code,
                        'name' => $item['n'] ?? $code,
                        'querySymbol' => $code . '.TW',
                        'price' => round($price, 2),
                        'previousClose' => round($prevClose, 2),
                        'change' => round($change, 2),
                        'changePercent' => round($changePercent, 2),
                        'currency' => 'TWD',
                        'marketState' => 'OPEN',
                    ];

                    $quotes[$code] = $quoteData;
                    $quotes[$code . '.TW'] = $quoteData;
                    $quotes[$code . '.TWO'] = $quoteData;
                }
            }
        } catch (\Throwable $e) {
            Log::warning("TWSE quote error: " . $e->getMessage());
        }

        return $quotes;
    }

    /**
     * 從 Yahoo Finance 抓取美股或台股備援即時報價
     */
    private function fetchYahooQuote(string $symbol): ?array
    {
        try {
            // Yahoo Finance 中 BRK.B 需轉為 BRK-B 查詢
            $querySym = str_replace('.', '-', $symbol);
            // 但保留 .TW 與 .TWO
            if (str_ends_with(strtoupper($symbol), '.TW')) {
                $querySym = substr($symbol, 0, -3) . '.TW';
            } elseif (str_ends_with(strtoupper($symbol), '.TWO')) {
                $querySym = substr($symbol, 0, -4) . '.TWO';
            }

            $url = "https://query1.finance.yahoo.com/v8/finance/chart/{$querySym}?interval=1d&range=1d";
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept' => '*/*',
            ])->timeout(5)->get($url);

            if ($response->successful()) {
                $data = $response->json();
                $meta = $data['chart']['result'][0]['meta'] ?? null;
                if ($meta && isset($meta['regularMarketPrice'])) {
                    $price = (float)$meta['regularMarketPrice'];
                    $prevClose = (float)($meta['previousClose'] ?? $meta['chartPreviousClose'] ?? $price);
                    $change = $price - $prevClose;
                    $changePercent = $prevClose > 0 ? ($change / $prevClose) * 100 : 0;

                    return [
                        'symbol' => $symbol,
                        'name' => $meta['shortName'] ?? $meta['longName'] ?? $symbol,
                        'querySymbol' => $querySym,
                        'price' => round($price, 2),
                        'previousClose' => round($prevClose, 2),
                        'change' => round($change, 2),
                        'changePercent' => round($changePercent, 2),
                        'currency' => $meta['currency'] ?? 'USD',
                        'marketState' => $meta['marketState'] ?? 'REGULAR',
                    ];
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Failed to fetch quote for {$symbol}: " . $e->getMessage());
        }

        return null;
    }
}
