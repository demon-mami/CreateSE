# osu!taiko Hitsound Lab

`osutaiko-mami-viewer` を元にした、Hitsound組み合わせ検証専用の派生ツールです。

元リポジトリ `demon-mami/osutaiko-mami-viewer` は変更しません。

## テスト譜面

OSZを毎回選ぶ方式は使わず、以下5譜面だけを `TEST CHART` から選択します。

- What Hurts The Most (Topmodelz ReMix) — `Gomen Yuuka [1.4x Rate]`
- Over the Fullereneshift — `Eternity`
- navi 98 — `genjuro's hell oni`
- Tool-Assisted Speedcore (TQBF Frame Advance RMX) — `Frame Perfect`
- Sunglow (Sped Up Ver.) — `Blazing Hope of the Dazzling Sun`

repo rootの `maps.zip` には、この5つについて指定難易度の `.osu` とその難易度が使用するMusicだけを収録します。

## Audio Engine

譜面再生・Audio同期の核心部分は、既存Viewerの固定コミット
`c22e29e4ce9cd8ae8c7a5ec3f2c4c9388c6b66c9`
の `app-v4.js` を利用します。

MusicとHitsoundは同じAudioContext、同じ`when`、同じ`offset`から開始します。

## Hitsound Pair Builder

- D / K / Bに残った52素材を `hitsounds.zip` として候補ライブラリ化
- Donだけ変更 / Katだけ変更
- Low Don / High Kat制約
- All / Same family切替
- Don / Kat単体Preview
- Pair Save
- KEEP / MAYBE / DROP
- 保存Pairを再Load
- Hitsound変更時にEffect Bufferを再構築

## 削除した機能

- OSZ手動選択
- 複数Difficulty選択
- START / END
- V1 / V2
- 区間長 / 区間ジャンプ
- 用途(Type)
- Fade-in/out
- テキスト出力
- Copy系
- 旧最下部Output一式

## 必須バイナリ

repo root:

- `hitsounds.zip` — 52候補Hitsound
- `maps.zip` — 固定5テスト譜面

## GitHub Pages

公開URL:

`https://demon-mami.github.io/osutaiko-hitsound-lab/`
