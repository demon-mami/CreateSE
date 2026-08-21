# CreateSE

osu!taiko向けHitsoundの組み合わせ検証ツールです。既存の `osutaiko-mami-viewer` を基盤に、固定譜面上でDon / Kat候補を素早く比較できます。

## 正式内蔵Hitsound：単音ベース 116

- 正式素材 **116音源**のみを収録
- 全ファイル：48 kHz / 24-bit PCM / Stereo WAV
- 表示番号：素材管理番号 **001〜116**
- 元ファイル名とソース系統を保持してカテゴリー表示
- 配布パック：`hitsounds-single-base-116.zip`
- 旧v1.2パック、旧50音源セット、Viewer由来の既定Hitsoundは使用しません

## My Sound

ユーザー自身の音源を最大4件までブラウザ内へ保存して比較できます。My Soundはデータセット更新時も保持します。

## 再生音量

- Music：`0.70`
- Hitsound：`1.00`（譜面に音量指定がある場合は、その割合を追加適用）

## 削除候補メモ

Don / Katの現在側で選択している内蔵音源を、実際には削除せず削除候補として記録できます。記録はブラウザ内に保存され、同じ音源で候補ボタンを再度押すと解除されます。

## Favorite / Pin

正式版への切替時に旧候補IDのFavorite / Pinはリセットされます。単音ベース116で選び直した結果のみを新しい比較結果として扱います。

## テスト譜面

以下15譜面を固定選択できます。追加10譜面は選択した1曲分だけを取得するため、全譜面を一括展開しません。

- What Hurts The Most (Topmodelz ReMix) — `Gomen Yuuka [1.4x Rate]`
- Over the Fullereneshift — `Eternity`
- navi 98 — `genjuro's hell oni`
- Tool-Assisted Speedcore (TQBF Frame Advance RMX) — `Frame Perfect`
- Sunglow (Sped Up Ver.) — `Blazing Hope of the Dazzling Sun`
- Everytime We Touch [Fvrwvrd's 700 BPM Speedcore Edit] — `ler's Elite Rizz`
- ファジィフューチャー — `Future`
- Paralysis — `Roxy- & Maeda's Hell Oni`
- 迷える音色は恋の唄 — `Melodic Romance`
- A flying Dance Hall — `Skyglide Pavilion`
- monochrome (Asterisk Makina Remix) — `Kaleidoscope`
- Pacific Girls — `Hell Oni`
- 草草！ミミカ — `kusa sugite kusa`
- 才能シュレッダー — `ll-taiko Sp.`
- 12^2x3.14-13 — `13 Hours of Love`

## GitHub Pages

https://demon-mami.github.io/CreateSE/
