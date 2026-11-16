<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'avatar',
        'google_id',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function financialState()
    {
        return $this->hasOne(FinancialState::class);
    }
}

