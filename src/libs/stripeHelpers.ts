/**
 * 環境変数からStripeのAPIキーを抽出する関数
 * 
 * 環境変数の形式:
 *   "STRIPE_1ST_ACCOUNT_APIKEY": "sk_test_xxx",
 *   "STRIPE_2ND_ACCOUNT_APIKEY": "sk_test_xxx",
 *   "STRIPE_3RD_ACCOUNT_APIKEY": "sk_test_xxx"
 * 
 * 戻り値の形式:
 * {
 *  '1st_account': 'sk_test_xxx',
 *  '2nd_account': 'sk_test_xxx',
 *  '3rd_account': 'sk_test_xxx',
 * }
 * 
 * @param env 環境変数オブジェクト
 * @returns 抽出されたStripe APIキーのオブジェクト
 */
export function extractStripeApiKeys(env: Record<string, string | undefined>): Record<string, string> {
  return Object.entries(env)
    .filter(([key, value]) => key.startsWith('STRIPE_') && key.includes('_ACCOUNT_') && key.endsWith('_APIKEY'))
    .filter(([_, value]) => {
        if (!value) return false;
        if (value.startsWith('sk_')) return true;
        return value.startsWith('rk_');
    })
    .reduce((acc, [key, value]) => {
      // STRIPE_1ST_ACCOUNT_APIKEY から 1st_account を抽出
      const accountName = key.replace('STRIPE_', '').replace('_APIKEY', '').toLowerCase();
      return {
        ...acc,
        [accountName]: value as string
      };
    }, {} as Record<string, string>);
} 