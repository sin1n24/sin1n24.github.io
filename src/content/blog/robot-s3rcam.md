---
title: "ロボット遠隔操作システム「RobotS3RCam」"
date: 2026-07-19
categories: ["ミニかわロボ", "技術"]
---

AtomS3R-CAM＋AtomS3R（またはAtomS3）による、ESP-NOWワイヤレスカメラ遠隔操縦ロボットです。カメラ映像を見ながら手元のコントローラで操縦できる超小型FPVシステムで、ソースコードはオープンソースとして公開しています。

<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" frameborder="0" height="315" referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube.com/embed/P5PM_GwRe_A" title="RobotS3RCam 紹介動画" width="560"></iframe>

## 特徴

- **超小型FPVシステム**: [AtomS3R-CAM](https://ssci.to/9916)のカメラ映像を、手元の[AtomS3R](https://ssci.to/9915)にリアルタイム表示
- **ESP-NOWによる低遅延双方向通信**: Wi-Fiルーター不要で、起動してすぐにペアリング＆操縦が可能。ブロードキャストで1対多配信も可能
- **4モード切替**: コントローラ側は「右手持ち／左手持ち／ロボット／映像表示ロボット」の4モードに対応
- **M5Avatar表示**: カメラ無しのロボットモード時はアバターが走行状態に応じた表情を表示
- **スマートな配線管理**: [サーボ接続基板](https://ssci.to/11122)で配線をスッキリさせ、コンパクトなロボットを構築可能
- **専用コントローラキット**: 指先に収まる[小型コントローラ（キット）](https://ssci.to/9521)でジョイスティックとボタンによる直感的な操作が可能

## システム構成

2つの構成パターンに対応しています。

**パターン1（標準構成）**: AtomS3R-CAMをロボット側に搭載し、映像を手元のコントローラ（AtomS3R／AtomS3）に表示して操縦します。

**パターン2（CAM-Ctrlr構成）**: 逆にAtomS3R-CAMをコントローラとして持ち、AtomS3R側をロボット（映像表示）として使う構成も可能です。起動時の基板自動判別で、同じファームウェアがどちらの役割でも動作します。

## 主な部品

| 部品 | 品名 | 参考価格 |
|------|------|---------|
| カメラ付きマイコン | [AtomS3R-CAM](https://ssci.to/9916) | ¥3,630 |
| サーボ接続基板 | [ATOM向 サーボ基板キット](https://ssci.to/11122) | ¥1,000 |
| 液晶付きマイコン | [AtomS3R](https://ssci.to/9915) または [AtomS3](https://ssci.to/8670) | ¥3,443／¥3,014 |
| コントローラ | [小型コントローラ（キット）](https://ssci.to/9521) | ¥3,000 |
| マイクロサーボ | FS90／FS90Rなど | ¥450～ |

ロボットのメカ構造はお好みに合わせて自作・カスタマイズできます。手のひらサイズの[ミニかわロボ](https://sin1.studio/MiniKawaRobo/)と組み合わせれば、FPV操縦のミニかわロボも作れます。

## ソースコード

開発環境は[PlatformIO](https://platformio.org/)で、同一ソースコードをビルドフラグで切り替えてロボット／コントローラのどちらにも書き込めます。ペアリング手順・ピン配置・パケット仕様などの詳細はGitHubリポジトリを参照してください。

- [GitHub: sin1n24/RobotS3RCam](https://github.com/sin1n24/RobotS3RCam)
