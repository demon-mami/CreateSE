# CreateSE mobile comparison workbench — Design QA

実施日: 2026-08-22（JST）  
対象: Production `demon-mami/CreateSE` / UI commit `05bbd8f566609efff45ce9785e26a6090d9e143b`  
Production: https://demon-mami.github.io/CreateSE/?qa=05bbd8f  
iPhone QA: https://demon-mami.github.io/CreateSE/qa-iphone.html?qa=05bbd8f

## 判定

今回指定された4点はProduction `main`へ直接反映済みです。Cloud BrowserのiPad 13インチ横相当（1363 × 936）と、Production本体を読み込むiPhone縦QA viewport（390 × 844）では、変更に起因する未解決のP0 / P1 / P2を確認していません。

- Don / Katの現在ペアから可視音源名を削除し、表示をside名と候補番号に限定。
- timeline noteをnormal 19px → 14px、big 22.5px → 17px、target 24.5px → 19.5pxへ縮小。fallback rendererも同じ方向へ調整。
- `♡ / 候補 / ♡ n`を再生面から候補選択面のsticky toolbarへ移動。seek直下から判断buttonを除去。
- 候補選択面を`#0AC6D7`、再生面を`#ED7855`を基準にした低彩度gradientで分離。

ユーザー指定の`#AC6D7`はCSSで無効な5桁hexのため、今回は先頭0省略と解釈して`#0AC6D7`を使用しています。

## Source visual truth

- 誤タップ証拠: `/workspace/scratch/534ae2b2b179/upload/IMG_7217.jpeg`（1290 × 224 px）。
  - seek thumbと直下の`♡ / 候補 / ♡ 0`が視覚的・操作的に競合している状態。
- 変更前iPhone: `/workspace/scratch/createse-preview-iphone-compact-controls-8a614e6-20260822.jpg`（390 × 844 px）。
- 変更前iPad: `/workspace/scratch/createse-preview-ipad-compact-controls-8a614e6-20260822.jpg`（1363 × 936 px）。
- 変更前／変更後比較:
  - iPhone: `/workspace/scratch/qa-compare-iphone-8a614e6-vs-0972ac3.jpg`。
  - iPad: `/workspace/scratch/qa-compare-ipad-8a614e6-vs-05bbd8f.jpg`。
  - 添付と移動後のfocused比較: `/workspace/scratch/qa-reference-overlap-vs-production-0972ac3.jpg`。

## Browser-rendered implementation evidence

### iPhone縦

- CSS viewport: 390 × 844 px、outer Cloud Browser 1363 × 936 px、deviceScaleFactor 1。
- Production QA harnessはsame-origin iframeでProduction本体を読み込み、`noindex,nofollow`を指定。
- 展開・notes表示: `/workspace/scratch/createse-production-iphone-expanded-notes-0972ac3-20260822.jpg`。
- 収納状態: `/workspace/scratch/createse-production-iphone-mini-0972ac3-20260822.jpg`。
- Final UI commit `05bbd8f`ではsticky headerの透明fadeだけを除去。`workbench.css?v=1.5.1-pane-identity`の反映と同じgeometryをCloud Browserで再確認。
- State: 譜面読込済み、Don 026 / Kat 027、Kat active、Dock展開／収納、再生／一時停止、seek実行、Favorite open / close、削除候補ON / OFFを確認。

### iPad 13インチ横相当

- CSS viewport: 1363 × 936 px、deviceScaleFactor 1、Cloud Browser Chrome。
- Final implementation: `/workspace/scratch/createse-production-ipad-pane-identity-05bbd8f-20260822.jpg`。
- State: 譜面読込済み、Don 026 / Kat 027、Kat active、再生／一時停止、Favorite open / close、削除候補ON / OFFを確認。

## Geometry / overlap verification

| 項目 | iPhone 390 × 844 | iPad 1363 × 936 |
|---|---:|---:|
| 判断button region | 345 × 44 px、候補側 | 778.56 × 44 px、候補側 |
| seek hit area | 341 × 44 px | 464.44 × 44 px |
| seek → zoom gap | 14 px | 16 px |
| 判断region → 再生panel gap | 5.33 px、非重複 | 別column、非重複 |
| 44 × 44px未満の可視操作対象 | 0 | 0 |
| horizontal overflow | 0 px | 0 px |

`favoriteOpenButton`は両端末とも`.hs-toolbar`内にあり、seekとのbounding-box交差はありません。iPhoneでは判断region下端226px、再生panel上端231.33pxでした。

## Required fidelity surfaces

### Typography / copy

- Don / Katの3組（候補側、iPhone mini Dock、展開中current pair）はside名と候補番号だけを表示。
- `currentDonMeta` / `currentKatMeta`はDOMから削除。
- 音源名はvisible copyから除去した一方、操作buttonのaccessible nameには現在番号と音源名を保持。

### Colors

- 候補側token: `--source-pane-base:#0ac6d7`。
- 再生側token: `--playback-pane-base:#ed7855`。
- gradientは既存のdark UI、Don / Kat色、white text contrastを維持するため低opacityで適用。
- sticky候補toolbarは最終QAで透明fadeを除去し、背後候補番号の透けを防止。

### Notes / timeline

- visible renderer: normal 14px、big 17px、target 19.5px。
- fallback renderer: `[14, 14, 13.5]`、big倍率1.22。
- 既存のframe-synchronous transport clock、visible renderer直結、legacy重複Canvas停止、DPR上限2は維持。
- iPhone / iPadともseek後も再生位置・timeline・overviewが更新。

## Primary interactions tested

| 操作 | 結果 |
|---|---|
| Production公開 | GitHub Pages Run #104、UI commit `05bbd8f`でsuccess（33秒）。 |
| 譜面選択・読み込み | 両端末でplay enabled、`#errorCard` hidden。 |
| 候補選択 | Don 026 / Kat 027、side number、candidate marker、static neon、`aria-pressed`が同期。 |
| 再生 / 一時停止 | 両端末で`aria-pressed` true / false、時刻、timeline、overviewが同期。 |
| seek | iPhoneで中央tap後`01:22:220`へ移動し、再生状態を維持。 |
| iPhone収納 / 展開 | 96px収納 / 607.67px展開、CSS icon、accessible nameを確認。 |
| Favorite | 移動後のbuttonからsheet open / close成功。既存count 2を表示。 |
| 削除候補 | 両端末で`false → true → false`を確認し、元状態へ復帰。 |
| Touch target / overflow | 44px未満0件、horizontal overflow 0px。 |

## Pages workflow

Productionへ直接反映するため、Pages artifactに`workbench.css` / `workbench-ui.js` / `qa-iphone.html`を含め、削除済み`audio-ducking-bridge.js`のcopyを除去しました。

- Run #101: 旧workflowが削除済みファイルをcopyして失敗。
- Run #102: workflow整合後success。
- Run #103: Production iPhone QA viewport追加後success。
- Run #104: sticky toolbar opacity polish後success。

Productionの音源、譜面data、既存map asset、audio processingには今回追加変更なし。

## Console / automated checks

- CreateSE URL / script由来のconsole error / warning: iPhone / iPadとも0件。
- Cloud Browser拡張のmetadata送信errorのみ観測し、CreateSE由来ではない。
- `node --check`: PASS。
- `node --test tests/*.test.mjs`: 15 / 15 PASS。

## Findings

- P0 / P1 / P2: Cloud Browser範囲ではなし。
- P3: iPhoneでは判断regionと展開Dockの間隔が5.33px。hit boxは非重複で全操作44px以上だが、実指での境界tapは実機Safariで継続確認する。

## Accessibility

- visible controlは両端末で44 × 44px以上。
- Don / Katは文字、番号、side color、border、`aria-pressed`を併用。
- 可視音源名を削除してもbutton accessible nameに名称を保持。
- Favorite sheetはopen / close後にfocus returnする既存実装を維持。
- `:focus-visible` 3px ring、`prefers-reduced-motion`規則を維持。

## Open questions / 未確認事項

- `#AC6D7`の意図が`#0AC6D7`ではなく`#AC6DD7`等だった場合の色修正。
- 実機iPhone / iPad Safariのsafe area、address barによるdynamic viewport、長押し、実指境界tap、iOSオーディオ制約。
- Dynamic Type / Safariページ拡大時の最終レイアウト。
- 適切なWAVがないためMy Soundのfile picker、キャンセル、不正形式、8MB / 5秒上限。
- Favorite削除 / 6秒Undoは保存dataの破壊を避け、未実行。

## Implementation checklist

- [x] Production `main`へ直接反映。
- [x] 可視音源名を全current pair表示から削除し、accessible nameは保持。
- [x] timeline note / targetを縮小。
- [x] 判断buttonを候補側sticky toolbarへ移動。
- [x] seekと直下buttonの重なりを構造的に解消。
- [x] 候補側 / 再生側を指定基準色のgradientで分離。
- [x] iPhone / iPadのCloud Browser QAと比較画像確認。
- [x] 15 / 15 tests PASS、Production Pages Run #104 success。

final result: passed
