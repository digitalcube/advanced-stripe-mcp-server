
# 日本語ドキュメント: advanced-stripe-mcp-server について

## このプロジェクトについて

advanced-stripe-mcp-serverは、MCPプロトコル（Model Context Protocol）を活用して、複数のStripeアカウントを横断的に管理・操作することを可能にするサーバーです。このサーバーをClaudeなどのAIアシスタントと連携させることで、自然言語を使ってStripeアカウントのデータを検索・操作することができるようになります。

## 主な機能

### 複数Stripeアカウントの統合管理
- 複数のStripeアカウントを一元管理
- すべてのアカウントを横断して検索・操作が可能
- 特定のアカウントに限定した操作も簡単に実行可能

### 顧客（Customer）関連機能
- 名前による顧客検索（`search_stripe_customer_by_name`）
- メールアドレスによる顧客検索（`search_stripe_customer_by_email`）

### サブスクリプション関連機能
- 顧客ID、ステータス、商品IDなどによるサブスクリプション検索（`search_stripe_subscriptions`）

### 請求書（Invoice）関連機能


- 請求書リスト取得（`list_stripe_invoices`）
- 請求書ID指定による詳細情報取得（`get_stripe_invoice_by_id`）
- 顧客、ステータス、金額、サブスクリプションIDなどによる請求書検索（`search_stripe_invoices`）

## 利用例（スクリーンショット）

### 請求書の検索

![スクリーンショット 2025-04-04 10 31 52](https://github.com/user-attachments/assets/3bf80be6-03a4-4db6-b2e1-8488dba145da)

### サブスクリプション分析

![スクリーンショット 2025-04-04 10 34 33](https://github.com/user-attachments/assets/79e5aa72-8d0d-4731-89ca-71a2fd402112)

Claude Desktopの分析（アナリティクス）機能を使えば、グラフなども作れます。

![スクリーンショット 2025-04-04 10 35 18](https://github.com/user-attachments/assets/1d60c73a-8789-4de4-bc1b-ec07fa0d5b49)


## このMCPサーバーで解決できる業務課題

1. **複数アカウント管理の効率化**:
   - 異なるStripeアカウントのデータを切り替えずに一度に検索・閲覧可能
   - アカウントをまたいだデータの比較や分析が容易に

2. **顧客サポート業務の効率化**:
   - 顧客からの問い合わせに対して、名前やメールアドレスから素早く顧客情報を検索
   - サブスクリプション状況や請求書履歴を迅速に確認

3. **経理・財務管理の支援**:
   - 請求書ステータスや金額による検索で未払い請求書の確認が容易に
   - 複数アカウントの請求状況を一元的に把握

4. **AI連携による業務自動化**:
   - 「先月の未払い請求書をすべて表示して」などの自然言語での操作
   - データ分析や傾向把握をAIに依頼可能

## 使い方

### 1. セットアップ

#### 必要条件
- Node.js (v18以上)
- npm (v8以上)
- Stripe APIキー（複数アカウント分）

#### インストール手順

1. リポジトリをクローン:
```bash
git clone https://github.com/yourusername/advanced-stripe-mcp-server.git
cd advanced-stripe-mcp-server
```

2. 依存パッケージのインストール:
```bash
npm install
```

3. サーバーのビルド:
```bash
npm run build
```

### 2. 設定

Claude DesktopでMCPサーバーを使用するには、以下の設定ファイルを編集します:

- macOSの場合: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windowsの場合: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "advanced-stripe-mcp-server": {
      "command": "/path/to/advanced-stripe-mcp-server/build/index.js",
      "env": {
        "STRIPE_AMIMOTO_ACCOUNT_APIKEY": "Amimotoの制限つきAPIキー",
        "STRIPE_SHIFTER_ACCOUNT_APIKEY": "Shifterの制限つきAPIキー",
        "STRIPE_FINANSCOPE_ACCOUNT_APIKEY": "FinanScopeの制限つきAPIキー"
      }
    }
  }
}
```

#### 2.1. コマンドのパスを取得する方法

`command`のパスは、`npm run build`を実行した場所（ディレクトリ）で、以下のコマンドを実行します。

```bash
echo "\"$(pwd)/build/index.js\""
```

これで`command`に記述すべきパスが表示されます。
例: `"/Users/dc-okamotohidetaka/development/mcp-servers/advanced-stripe-mcp-server/build/index.js"`

macOSの場合、`echo "\"$(pwd)/build/index.js\"" | pbcopy`でコピーまでできます。

#### 2.2. Stripe APIキーの生成方法

セキュリティリスク、インシデント発生リスク削減のため、「シークレットキー」の利用は禁止しています。
`sk_`から始まるAPIキーを設定すると、エラーが出ますのでご了承ください。

制限つきAPIキーは、ユーザーごとに発行してください。AWSと一緒です。
作り方は、[Stripe のドキュメント](https://docs.stripe.com/keys?locale=ja-JP#create-restricted-api-secret-key)を参考にしましょう。
権限は、「読み込み」の権限を全部につけておけばOKです。不安な方は @hidetaka まで。

### 3. 使用例

Claude Desktopにて、以下のような自然言語クエリが可能になります:

- 「顧客の田中さんの最近の請求書を検索して」
- 「先月の未払いの請求書をすべて表示して」
- 「example@email.comに関連するサブスクリプションの状態を教えて」
- 「1st_accountとall_accountの両方で、最近キャンセルされたサブスクリプションを比較して」

### 4. デバッグ

MCPサーバーのデバッグには、MCP Inspectorを使用できます:

```bash
npm run inspector
```

これにより、ブラウザでデバッグツールにアクセスするためのURLが表示されます。

## 開発者向け情報

### ディレクトリ構造
- `src/index.ts`: メインサーバーファイル（ツール定義など）
- `src/libs/`: Stripe操作の基本クラスや共通関数
- `src/operations/`: 各種Stripe操作（顧客、サブスクリプション、請求書など）

### 追加機能の開発
新しいStripe API機能を追加する場合は、以下の手順に従ってください:

1. `src/operations/`に新しい操作を定義
2. `src/index.ts`に新しいツールとして登録
3. テストを作成して機能を検証

### 環境変数
- `STRIPE_*_ACCOUNT_APIKEY`: 各Stripeアカウントのシークレットキー
