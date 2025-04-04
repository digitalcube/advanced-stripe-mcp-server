
import { BaseSearchOptions } from '../libs/stripeService.js';
import Stripe from 'stripe';

// 操作結果の共通型
export interface OperationResult<T> {
    success: boolean;
    data: T;
    error?: any;
    message?: string;
    has_more?: boolean; // ページネーション用に追加
  }

// 操作関数の型定義をジェネリックで作成
export type Operation<TOptions, TResult> = 
  (stripe: Stripe, options: TOptions & BaseSearchOptions) => Promise<OperationResult<TResult>>;
