---
layout: page
title: sin1's studio
cover: true
---

## 新着情報
+ 【26/05/30-31】 [JRRF 2026](https://japanreprapfestival.com/)に出展＆ミニ大会開催！報告は[こちら](https://sin1n24.hatenablog.com/entry/2026/06/13/045210)。
+ 【26/05/14】 ESP-NOWワイヤレスカメラロボット「[RobotS3RCam](https://github.com/sin1n24/RobotS3RCam)」を公開しました！
+ 【26/05/11】 [つくろがや！](https://tsukurogaya.nagoya/)に出展しました！
+ 【26/05/07】 初心者相談AI「[ミニかわBot](https://sin1.studio/MiniKawaRobo/docs/bot.html)」を公開しました。

---

## 作品（コンテスト・展示）
_[ProtoPedia](https://protopedia.net/prototyper/sin1) に掲載中の作品です。自動更新されます。_

{% include card-grid.html items=site.data.protopedia_works %}

[ProtoPediaで全作品を見る](https://protopedia.net/prototyper/sin1){: .btn }

---

## ソフト・サービス
_GitHubの公開リポジトリから自動更新されます。_

{% include card-grid.html items=site.data.github_repos %}

[GitHubで全リポジトリを見る](https://github.com/sin1n24){: .btn }

---

## ロボット

{% assign robots = site.data.projects | where: "category", "robot" %}
{% include card-grid.html items=robots %}

---

## ハードウエア

{% assign hw = site.data.projects | where: "category", "hardware" %}
{% include card-grid.html items=hw %}

---

## ソフトウエア

{% assign sw = site.data.projects | where: "category", "software" %}
{% include card-grid.html items=sw %}

---

## 企画

{% assign planning = site.data.projects | where: "category", "planning" %}
{% include card-grid.html items=planning %}

---

![ロゴ](./img/sss_logo_3x1.png){: width="300px" .center-img }
