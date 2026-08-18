# osu!taiko Hitsound Lab

`osutaiko-mami-viewer` を元にした、Hitsound組み合わせ検証専用の派生ツールです。

元リポジトリ `demon-mami/osutaiko-mami-viewer` は変更しません。

## 構成

譜面再生・Audio同期の核心部分は、既存Viewerの固定コミット
`c22e29e4ce9cd8ae8c7a5ec3f2c4c9388c6b66c9`
の `app-v4.js` を利用します。

新repo側ではPair Builderと候補素材管理だけを追加しています。

## 残した機能

- `.osz / .OSZ` の端末内解析
- osu!taiko Mode:1のみ
- 難易度選択
- OBJECT TIMELINE
- SONG TIMELINE
- Kiai / BPM / ノーツ密度
- Seek
- Play / Pause
- -4s / +4s
- Timeline zoom: ±0.5 / ±0.4 / ±0.3
- Music / Hitsoundを同一AudioContext・同一when・同一offsetで同期再生

## 追加機能

- D / K / Bに残った52素材を `hitsounds.zip` として候補ライブラリ化
- Don候補だけ変更
- Kat候補だけ変更
- Low Don / High Kat制約
- All / Same family切替
- Don / Kat単体Preview
- Pair Save
- KEEP / MAYBE / DROP
- 保存Pairを再Load
- Hitsound変更時、現在位置を保持してEffect Bufferを再構築
- 再生中に変更した場合は、再構築後に同位置から再開

## 削除した機能

- START / END
- V1 / V2
- 区間長
- 区間ジャンプ
- 用途(Type)選択
- Fade-in/out選択
- テキスト出力
- Copy / コピペ系
- 旧最下部Output一式

## 候補素材

ユーザー手動選別の `D / K / B` のみを含みます。

- `?` = 今回は使わないが保存価値あり → 非搭載
- `X` = 除外 → 非搭載
- D/K/Bは固定役割ではなく弱い参考ラベル
- Pair内ではPitchProxy上の低い側をDon、高い側をKatへ割当

## 必須ファイル

repo rootに `hitsounds.zip` が必要です。
ZIP内には `A003.wav` のような候補ID名で52ファイルを格納します。

## GitHub Pages

1. Repository Settings
2. Pages
3. Build and deployment → Deploy from a branch
4. Branch: `main` / `/ (root)`

公開URL:

`https://demon-mami.github.io/osutaiko-hitsound-lab/`
