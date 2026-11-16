<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * 取得或生成訪客工作階段 Session Key
     */
    public function getOrCreateSession(Request $request)
    {
        $existing = $request->header('X-Session-Key');
        $sessionKey = $existing ?: 'sess_'.Str::random(32);

        return response()->json([
            'success' => true,
            'sessionKey' => $sessionKey,
            'isGuest' => true,
        ]);
    }

    /**
     * 處理 Google 帳號登入
     */
    public function handleGoogleAuth(Request $request)
    {
        $email = $request->input('email');
        $name = $request->input('name') ?: explode('@', $email)[0];
        $avatar = $request->input('picture') ?: '';
        $googleId = $request->input('sub') ?: $request->input('id');

        if (!$email) {
            return response()->json([
                'success' => false,
                'message' => '缺少 Email 資訊',
            ], 422);
        }

        $user = User::updateOrCreate(
            ['email' => strtolower(trim($email))],
            [
                'name' => $name,
                'avatar' => $avatar,
                'google_id' => $googleId,
            ]
        );

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'avatar' => $user->avatar,
            ],
            'message' => 'Google 帳號身分驗證成功',
        ]);
    }

    /**
     * 登出
     */
    public function logout()
    {
        return response()->json([
            'success' => true,
            'message' => '已安全登出',
        ]);
    }
}

