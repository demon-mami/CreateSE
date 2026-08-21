# CreateSE responsive workbench — Design QA

実施日: 2026-08-22（JST）  
対象: PR #3 `feat/mobile-comparison-workbench` / Preview Pages  
Preview: https://demon-mami.github.io/CreateSE-preview/

## 判定

**Cloud Browserで確認可能な範囲はPASS。P0 / P1 / P2の未解決事項はありません。**

Productionの`main`、Production GitHub Pages、既存Production用Workflowは変更していません。実機iOS / iPadOS Safari固有挙動、My Soundの実ファイル入力、Favorite削除実行は下記の未確認事項として分離します。

## 検証環境と証拠

- iPad 13インチ横相当:
  - Cloud Browser Chrome、1363 × 936 CSS px。
  - 証拠: `/workspace/scratch/createse-preview-ipad-final-verified-20260822.jpg`
  - Source比較: `/workspace/scratch/createse-ipad-reference-vs-preview-20260822.jpg`
- iPhone縦:
  - Preview専用QAハーネス内の390 × 844 CSS px iframe。実機Safariや実タッチイベントとは同一視しない。
  - 折りたたみDock: `/workspace/scratch/createse-preview-iphone-final-clean-20260822.jpg`
  - 展開Dock / A–B反復中: `/workspace/scratch/createse-preview-iphone-final-expanded-loop-20260822.jpg`
  - Source比較: `/workspace/scratch/createse-mobile-reference-vs-preview-20260822.jpg`
- Source visual truth:
  - `generated_images/exec-e2aeb537-7ab5-4978-b1dd-89cba44258f3.png` — iPad two-pane direction。
  - `generated_images/exec-06d00dd7-9024-4983-a6a8-3daac063af35.png` — persistent bottom work surface / Dock direction。
- Console:
  - アプリ由来のerror / warningは0件。
  - Cloud Browser拡張のmetadata送信エラーのみ。CreateSEのURL / script由来ではない。

## 実操作結果

| 操作 | iPad横 | iPhone縦 | 観測結果 |
|---|---:|---:|---|
| 譜面選択・読み込み | PASS | PASS | `譜面読込中`から`準備完了`へ遷移し、再生が有効化。 |
| Don / Kat候補選択 | PASS | PASS | 選択番号、D/Kバッジ、操作対象、current pair、ARIA状態が同期。 |
| 再生 / 一時停止 | PASS | PASS | 本体とmini Dockのラベル・`aria-pressed`・時刻が同期。 |
| 再生中の複数候補切替 | PASS | PASS | 音楽とA–B状態を維持したままDon / Katを切替。 |
| −4秒 / ＋4秒 | PASS | PASS | 一時停止時に±4.000秒を確認。 |
| シーク | PASS | PASS | ポインタ位置へ時刻と`aria-valuetext`が更新。 |
| タイムライン / ズーム | PASS | PASS | hit pattern / overviewを表示し、±0.5s→±0.4sへ更新。 |
| A–B反復 | PASS | PASS | 4.000秒区間を設定し、再生中も`リピート ON`を維持。 |
| 片側無音 / 復帰 | PASS | PASS | `無音`、ボタン文言、`aria-pressed`が即時更新。 |
| Favorite追加 | PASS | PASS | 登録数、登録済み表示、statusを更新。 |
| Favorite再適用 | PASS | PASS | 別候補から保存ペアへ復帰し、ダイアログを閉じて結果を通知。 |
| 削除候補ON / OFF | PASS | PASS | 候補上の×、件数、ボタン文言、statusを同期。 |
| CSV出力 | PASS | 共通実装 | 535 bytesのCSVを生成し、2組のDon / Katと`Available=YES`を確認。 |
| 譜面変更 | PASS | PASS | 選択ペアを保持し、時刻とA–Bを安全に初期化。 |
| キーボード補助 | PASS | 共通実装 | Skip link→譜面→Don→Kat→My Soundの順でTab移動し、3px focus ringを確認。 |

## QAで発見して修正した項目

### Resolved P1 — Don / Kat候補位置の独立保持

- 対象: iPhone縦、固定DockからDon / Katを切替。
- 修正前: Kat側を`scrollTop=1709`まで移動後にDonへ切り替えても同じ深い位置に残り、再度Katへ戻ると以前の位置へ戻ることがあった。
- 修正: layout × sideごとに数値`scrollTop`を保存し、side change時に同期復元。旧candidate ID形式も読み取り可能。
- 再QA: Kat `1709` → Don `0` → Kat `1709`を確認。

### Resolved P1 — シークのタップ対象

- 対象: iPad横 / iPhone縦。
- 修正前: range inputの実測高がiPad 30px、iPhone 28px。
- 修正: 両方44pxへ拡大し、iPhoneのgrid rowも44pxへ更新。
- 再QA: 表示中のbutton / select / input / linkに44 × 44 CSS px未満の対象なし。

### Resolved P2 — iPhoneのFavorite一覧導線

- 対象: iPhone展開Dock。
- 修正前: 44px幅かつ本文0pxで、件数のみのボタンに見えた。
- 修正: 74px幅、可視ラベル、10px文字へ変更。accessible nameは`Favoriteを開く`と件数を保持。

### Resolved P2 — iPhoneの主要操作文字と再生状態

- 対象: 単音試聴、無音、A / B、Favorite、削除候補、status、mini再生。
- 修正前: 多くが10px、狭幅では9px。mini Dockの`一時停止`が2行化。
- 修正: 主要操作を11px（最狭幅10px）へ引き上げ、mini再生をnowrap化。390pxで`一時停止`1行を確認。

## Source比較所見

### iPad横

- two-paneの目的である「候補変更」と「実譜面で聞く / 判断する」の同一作業面化は成立。
- current pair、再生、A–B、timeline、Favorite、削除候補が右pane内に収まり、候補paneとの往復スクロールは発生しない。
- Source visualの折りたたみカテゴリ / filter / inline Favorite再適用は今回の確定要件ではなく、実装は全候補スクロールとFavorite modalで代替している。
- 1363 × 936では横余白の浪費、page-level overflow、right paneの縦クリップは観測しなかった。

### iPhone縦

- desktop / iPad構成を縮小せず、候補面 + 96px固定Dock + 展開Dockへ分離できている。
- 折りたたみ時もDon / Kat、再生状態、A–B状態、現在時刻を保持。展開時は候補の現在位置を背後に残しつつ試聴・判断を完了できる。
- 390 × 844で横overflowとpage-level scrollは0。内部候補scrollのみ。
- Source visualは広幅Dock方向の概念図であり、iPhoneでは同一配置を強制せず端末固有構成へ変換している。

## Accessibility

- 表示中の操作対象はすべて44px以上。シークも44px。
- visible controlの空accessible nameは0件。
- Don / Katは色に加えて文字、D / Kバッジ、border、`aria-pressed` / `aria-description`で識別。
- 再生、無音、Favorite、削除候補、A–Bは文言とARIA状態を同期。
- 3px `:focus-visible` ringとSkip linkを確認。
- `prefers-reduced-motion: reduce`でanimation / transitionを実質停止するCSSあり。

## 未確認事項

- iPhone / iPad実機Safariのsafe area、address barによるdynamic viewport、長押し、実指誤タップ、iOSオーディオ制約。
- Dynamic Type / Safariページ拡大時の最終レイアウト。
- 適切なWAVがないためMy Soundのファイル選択、キャンセル、不正形式、8MB / 5秒上限、iOS file picker。
- Favorite削除 / 6秒Undoは、このCloud Browser内に残る保存データの削除確認が必要なため本サイクルでは実行していない。導線、accessible name、Undo実装は静的確認済み。
- 意図的な通信遮断、asset破損、Production改変によるエラー再現は未実施。

## Static verification

- `node --check workbench-ui.js`: PASS
- `node --check hitsound-grid.js`: PASS
- `node --check hitsound-favorites.js`: PASS
- `node --test tests/workbench-static.test.mjs`: 6 / 6 PASS
- Production `main`: `71fadcffaf5de9f25cb69b4670ded7a32939e6e7`のまま。

final result: passed (Cloud Browser scope)
