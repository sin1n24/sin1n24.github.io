---
title: "AI秘書xangiで日用品の在庫管理をしてみる（予定）"
date: 2026-10-22
categories: ["技術"]
relatedProducts: ["B0GRXZJT9M", "B0F8NG1TDK", "B07PWJMNRN"]
---

「【Lenovo Pro Community】ガジェット研究室＠秋葉原 #10」でLTしてきました！

この記事はLTの後半、AI秘書「xangi」に家電と日用品の管理を任せてみる話です。当日急に決めたLTで、スライドは10分ほどでClaudeに作ってもらいました（その時の感想は[前半の記事](/blog/2026-10-22-taiwan-gadgets/)に書いています）。スライドは記事の末尾に載せています。

まだ構築中なので「予定」ですが、やりたいことと現状をまとめておきます。

## xangiとは

xangiは、からあげ先生（karaage0703）が公開しているオープンソースのAIアシスタントです。常駐させたPCで動かして、Discordのチャットから話しかけて使います。

- 専用のアプリ画面は不要で、Discordで頼むだけ
- 会話をまたいで記憶を持てる
- ファイル操作やプログラムの実行、Web検索まで自分で手を動かしてくれる

ソースコードはGitHubで公開されています（[karaage0703/xangi](https://github.com/karaage0703/xangi)）。

## きっかけ

ゆる言語学ラジオで、堀元さんが日用品の在庫管理や家電のメンテナンスまでAIに任せている、という話を聞いたのがきっかけです。

生活の細かい面倒ごとをAI秘書に丸投げするのは、正直かなり羨ましいです。うちでもやってみたくなりました。

## セットアップもAIにお任せ

仕組みづくり自体も、なるべくAIに任せています。

1. ラジオで聞いた話を、そのままAIに伝える
2. xangiに、在庫管理の仕組みを組んでもらう
3. 家電を少しずつ登録していく

家電は、洗濯機・冷蔵庫・電子レンジ・食洗機など、使う頻度の高いものから気が向いた順に増やしていく予定です（全部一気にやると続かないので）。

## Discordで家電を覚えさせると何ができるか

家電を登録しておくと、次のようなことをやってくれる想定です。

- **消耗品の在庫**：フィルターや洗剤などを家電ごとに把握する
- **発注のタイミング**：「そろそろ無くなりそう」を推測して知らせる
- **取扱説明書**：使い方やお手入れ方法を聞けばすぐ答える

運用の方針も決めました。

- 毎日在庫をチェックさせるとその分コストがかかるので、xangiの稼働は控えめにする
- 前回と同じ消耗品は、承認したうえで安いお店で買ってもらう

セットアップの手間は惜しまず、普段の運用は軽く、というバランスが良さそうです。

## Tab5で「おうちパネル」のデモを作りました

Discordだけだと通知が流れてしまうので、キッチンの壁で一目で分かる表示も作っています。最近手に入れたM5Stack Tab5（5インチのタッチ画面付き開発ボード）を使います。

![届いたM5Stack Tab5](/img/blog/xangi-home-stock-tab5.webp)

デモ版では、家電のお手入れと消耗品の予定を期日が近い順に並べます。終わったら「やった」、開けたら「開封」、買ったら「届いた」をタップするだけです。消耗品は開封した間隔から、次に買う日を見積もります。

![Tab5おうちパネルのデモ画面。洗濯機・エアコン・トイレットペーパーの予定が期日順に並んでいる](/img/blog/xangi-home-stock-tab5demo.webp)

本番版では、自宅PCの台帳とつながって、記録するとxangiがDiscordへのお知らせを入れ直す仕組みにする予定です。

デモはブラウザからTab5に書き込んで試せるので、Tab5をお持ちの方は是非触ってみてください。

- [Tab5 おうちパネル デモ](https://sin1.studio/Tab5HomePanelDemo/)

## まとめ

まだ構築中ですが、「家のことを覚えていて、必要な時だけ声をかけてくれる秘書」ができたらかなり便利そうです。実際に運用してみて、どれくらい手間が減ったかはまた報告したいと思います。

## LT資料

この内容は「【Lenovo Pro Community】ガジェット研究室＠秋葉原 #10」でLTとして発表しました。スライドは横にスクロールして見られます（全19枚。動画は会場のみの上映のため省略しています）。

<div style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px">
<img src="/img/blog/gadget-lab-10/p01.webp" alt="LT資料 1ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p02.webp" alt="LT資料 2ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p03.webp" alt="LT資料 3ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p04.webp" alt="LT資料 4ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p05.webp" alt="LT資料 5ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p06.webp" alt="LT資料 6ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p07.webp" alt="LT資料 7ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p08.webp" alt="LT資料 8ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p09.webp" alt="LT資料 9ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p10.webp" alt="LT資料 10ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p11.webp" alt="LT資料 11ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p12.webp" alt="LT資料 12ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p13.webp" alt="LT資料 13ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p14.webp" alt="LT資料 14ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p15.webp" alt="LT資料 15ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p16.webp" alt="LT資料 16ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p17.webp" alt="LT資料 17ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p18.webp" alt="LT資料 18ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
<img src="/img/blog/gadget-lab-10/p19.webp" alt="LT資料 19ページ目" loading="lazy" style="flex:0 0 100%;width:100%;aspect-ratio:16/9;scroll-snap-align:start;border-radius:8px;border:1px solid #ddd" />
</div>

[PDFでダウンロード](/slides/2026-10-22-gadget-lab-10.pdf)

LTの前半で話したガジェットの話は「[台湾旅行の前日にGO 3SとEven G2を買って、旅行中に使ってみました](/blog/2026-10-22-taiwan-gadgets/)」にまとめています。

<a class="link-card" href="https://www.amazon.co.jp/dp/B0GRXZJT9M/?tag=sin1n24-22" target="_blank" rel="noopener noreferrer sponsored"><img class="link-card-image" src="https://m.media-amazon.com/images/I/61NNJ+GVMxL._AC_UL320_.jpg" alt="" loading="lazy" /><span class="link-card-body"><span class="link-card-title">M5 Stack 公式 Tab5 IoTコントローラー 開発キット（ESP32-P4） バッテリーなし</span><span class="link-card-domain">amazon.co.jp</span></span></a>
