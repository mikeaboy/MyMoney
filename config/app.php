<?php

return [
    'name' => env('APP_NAME', '全方位整合帳務與跨幣別資產管理系統'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => 'Asia/Taipei',
    'locale' => 'zh_TW',
    'fallback_locale' => 'en',
    'faker_locale' => 'zh_TW',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'previous_keys' => [
        ...array_filter(
            explode(',', env('APP_PREVIOUS_KEYS', ''))
        ),
    ],
    'maintenance' => [
        'driver' => 'file',
    ],
];

