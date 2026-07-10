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

---
© 2026 sin1
