# sin1's studio ウェブサイト リポジトリ

[**🌐 公開ウェブサイトを表示する**](https://sin1.studio/)

Astro（静的サイトジェネレータ）で構築された、個人のポートフォリオサイトのリポジトリです。

製作したロボット、ソフトウェア、VRプロジェクト、および主催している企画をまとめています。

内容は上記の公開ウェブサイトからご覧下さい。

## 開発

```bash
npm install
npm run dev       # 開発サーバー
npm run build     # 静的ビルド（出力: dist/）
npm run preview   # ビルド結果をローカルで確認
```

- `_data/*.yml` と `scripts/*.py` は GitHub Actions（`.github/workflows/update-data.yml`）による
  ProtoPedia / GitHub リポジトリの自動更新パイプラインが使用しているため変更しないこと。
- 旧Jekyll版（Hydejackテーマ）のファイルは `_legacy/` に保存されている。
- デプロイは `.github/workflows/deploy.yml`（main への push で自動実行）→ GitHub Pages。

## 記事管理画面 (`/admin/`)

ブラウザだけでブログ記事の新規作成・編集ができる管理画面です（`src/pages/admin.astro`）。
GitHub Contents API を直接叩いてコミットするため、サーバーは持ちません。

- 認証は GitHub Fine-grained Personal Access Token（対象リポジトリのみ・Contents: Read and write）を
  ページ内の入力欄からブラウザの `localStorage` に保存する方式です。**他者に公開して見せる想定のページではなく、
  トークンはあなたのブラウザにのみ保存されます。** 検索エンジンにも `noindex` を指定しています。
- 本文中のURL貼り付けをMarkdownリンクへ自動変換する機能は、CORSの制約上 Google Apps Script のWebアプリを
  プロキシとして利用します。導入手順は `admin/gas-ogp-proxy/README.md` を参照してください（GASプロジェクトの
  作成・デプロイはユーザー自身の手動操作が必要です）。
- 画像はクリップボード貼り付けで `public/img/blog/` へ自動アップロードされます。

---
© 2026 sin1
