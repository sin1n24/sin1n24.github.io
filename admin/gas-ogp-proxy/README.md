# sin1studio-admin-ogp-proxy

`/admin/` 記事編集画面の「URLをMarkdownリンクに変換」機能用のプロキシです。
ブラウザから任意サイトへ直接 `fetch` するとCORSでブロックされるため、
Google Apps Script のWebアプリを間に挟み、対象URLの `<title>` / `og:title` を
取得してJSONで返します。

このディレクトリにはコードのみを用意しています。**実際の`clasp create`によるGASプロジェクト作成・デプロイはユーザー自身で行ってください**（Googleアカウントの認証操作が必要なため、エージェント側では実行していません）。

## 事前準備

- `clasp` がインストール済みであること（`npm install -g @google/clasp`、または他プロジェクトで既に導入済みならそのまま使えます）
- `clasp login` 済みであること

## セットアップ手順

1. このディレクトリに移動
   ```bash
   cd admin/gas-ogp-proxy
   ```

2. 新規GASプロジェクトを作成（スタンドアロン、Webアプリとして使う）
   ```bash
   clasp create --type webapp --title "sin1studio-admin-ogp-proxy" --rootDir .
   ```
   実行すると `.clasp.json` が生成されます（このファイルはプロジェクト固有IDを含むため、コミットするかどうかは任意です。他プロジェクトの運用に合わせてください）。

   すでに `Code.js` を作成済みの状態で `clasp create` すると、`Code.js`（や生成される `appsscript.json`）を上書きするか聞かれることがあります。既存のものを残したい場合は `clasp create` 後に中身をこのディレクトリのファイルで上書きしてください。

3. コードをプッシュ
   ```bash
   clasp push
   ```

4. Webアプリとしてデプロイ
   ```bash
   clasp deploy --description "v1"
   ```
   または `clasp open` でGASエディタを開き、「デプロイ」→「新しいデプロイ」→種類「ウェブアプリ」を選択し、
   - 実行するユーザー: 自分（Me）
   - アクセスできるユーザー: 全員（Anyone）

   で手動デプロイしても構いません。

5. 初回デプロイ時、`UrlFetchApp`（外部サイトへのアクセス）権限の承認画面が表示されます。表示に従ってGoogleアカウントで承認してください（このリポジトリの他のGASプロジェクトと同様の手順です）。

6. デプロイ完了後に発行される「ウェブアプリのURL」（`https://script.google.com/macros/s/xxxxx/exec` の形式）をコピーします。

7. `/admin/` を開き、「接続設定」内の「URL変換プロキシ (GAS Web App URL)」欄にこのURLを貼り付けて保存します。以後このブラウザの `localStorage` に保存され、本文でURLだけをペーストすると自動的に `[タイトル](URL)` に変換されるようになります。

## 動作確認（デプロイ後）

ブラウザやcurlで以下にアクセスし、JSONが返ってくれば成功です。

```bash
curl "https://script.google.com/macros/s/xxxxx/exec?url=https://example.com/"
# => {"ok":true,"title":"Example Domain","url":"https://example.com/"}
```

## コードを更新する場合

`Code.js` を編集した後、再度 `clasp push` すれば反映されます。ただし既存のデプロイURLに反映するには
`clasp deploy` （既存デプロイIDを指定）または GASエディタから「デプロイを管理」→対象デプロイの編集→
「新しいバージョン」を選んで更新してください（`clasp push` だけでは公開中のWebアプリURLの中身は更新されません）。

## 制約・注意事項

- `access: ANYONE_ANONYMOUS` で公開されるため、このプロキシURL自体は誰でも叩けます（任意URLのtitleを取得できるだけで、機密情報は扱いません）。
- 取得先サイトが `<title>` も `og:title` も持たない、またはBot除けでブロックしている場合は `ok: false` が返ります。この場合 `/admin/` 側は元のURLをそのままMarkdownリンクとして挿入します。
- 実際の動作確認は、ユーザー自身が `clasp create` → デプロイ → URL設定を行った後の実地確認が必要です。
