# CreateSE mobile comparison workbench — Design QA

実施日: 2026-08-22（JST）  
対象: PR #3 `feat/mobile-comparison-workbench` / UI commit `8a614e6a40c3751a3202356f4f31acacfc4d7e01`  
Preview: https://demon-mami.github.io/CreateSE-preview/?qa=8a614e6  
iPhone QA: https://demon-mami.github.io/CreateSE-preview/qa-iphone.html?qa=8a614e6

## 判定

今回指定された可視コピーの削減、iPhoneのCSS最小化／最大化アイコン、−4秒／再生／＋4秒の比率と間隔、Dock遷移中の誤タップ防止を反映しました。Cloud Browserで再現したiPhone縦とiPad 13インチ横相当では、未解決のP0 / P1 / P2はありません。

Production `demon-mami/CreateSE`の`main`、Production GitHub Pages、既存Production用Workflowは変更していません。Previewは`demon-mami/CreateSE-preview`のGitHub Pages Run #18で公開済みです。

## Source visual truth

- ユーザー添付の全体ラフ: `/workspace/scratch/534ae2b2b179/upload/IMG_7214(1).jpeg`（1290 × 1646 px）。
  - iPhone展開面の情報量、再生操作の余白、中央ボタン比率の方向性を確認するラフ基準。
- ユーザー添付の操作部ラフ: `/workspace/scratch/534ae2b2b179/upload/IMG_7216.jpeg`（1290 × 621 px）。
  - −4秒／再生／＋4秒の密集緩和と、現在ペアからtransportへの間隔の基準。
- 変更前Preview:
  - iPad: `/workspace/scratch/createse-preview-ipad-static-neon-loop-bd9f84c-20260822.jpg`（1363 × 936 px）。
  - iPhone: `/workspace/scratch/createse-preview-iphone-static-neon-bd9f84c-20260822.jpg`（390 × 844 px）。
  - 既存の2-pane / PIP構成、色、文字、候補密度、Favorite到達性を守る回帰基準。
- 添付は「目安程度のラフ参考」と明示されているため、見た目の完全複製ではなく、指定されたコピー削減・比率・間隔・誤タップ防止を判定対象にした。

## Browser-rendered implementation evidence

### iPhone縦

- CSS viewport: QA harness内390 × 844 px iframe、outer Cloud Browser 1363 × 936 px、deviceScaleFactor 1。
- 展開状態: `/workspace/scratch/createse-preview-iphone-compact-controls-8a614e6-20260822.jpg`（390 × 844 px）。
- 収納状態: `/workspace/scratch/createse-preview-iphone-mini-css-icon-8a614e6-20260822.jpg`（390 × 844 px）。
- State: 譜面読込済み、Don 026 / Kat 027、Kat操作中、Dock展開／収納、再生／一時停止確認済み。
- Density normalization: inner CSS viewportとscreenshotが1:1のため追加変換なし。
- Full-view comparison: `/workspace/scratch/qa-iphone-full-reference-vs-8a614e6.jpg`（添付ラフ / 実装を同一画像内で比較）。
- Focused comparison: `/workspace/scratch/qa-iphone-transport-reference-vs-8a614e6.jpg`（現在ペアとtransportを同一画像内で比較）。

### iPad 13インチ横相当

- CSS viewport: 1363 × 936 px、deviceScaleFactor 1、Cloud Browser Chrome。
- Implementation: `/workspace/scratch/createse-preview-ipad-compact-controls-8a614e6-20260822.jpg`（1363 × 936 px）。
- State: 譜面読込済み、Don 026 / Kat 027、Kat操作中、再生／一時停止確認済み、Favorite 2件。
- Density normalization: CSS viewportとscreenshotが1:1のため追加変換なし。
- Full-view regression comparison: `/workspace/scratch/qa-ipad-regression-bd9f84c-vs-8a614e6.jpg`（変更前 / 変更後を同一画像内で比較）。
- Focused controls comparison: `/workspace/scratch/qa-ipad-controls-bd9f84c-vs-8a614e6.jpg`。

## Required fidelity surfaces

### Fonts and typography

- 既存のsystem sans、数字のtabular表示、white / muted text階層を維持。
- 可視見出し「試聴・判断」と上部status badgeを除去し、候補比較で不要な文字量を削減。
- 「Don / Katを操作中」はactive side切替時に表示せず、選択結果・無音・Favorite等の意味のあるfeedbackは維持。
- 表示文字を削った収納／展開ボタンには`試聴パネルを収納` / `試聴パネルを展開`のaccessible nameを保持。

### Spacing and layout rhythm

- iPhone transportは中央列を72pxから96pxへ拡幅、左右とのgapを5pxから10pxへ変更。実測は左右108.5px、中央96px、gap 10px。
- iPhoneの現在ペア下端からtransport上端は10px。3ボタンの中心で`elementFromPoint`が各ボタン自身を返し、意図しない重なりなし。
- iPad transportは中央列92px、左右170.22px、gap 10px。現在ペアとの間隔9px。
- 両端末でhorizontal overflow 0px。可視操作対象に44 × 44 CSS px未満なし。

### Colors and visual tokens

- 既存のdark gray surface、Don `#EEB9B2`系、Kat `#B0CCD7`系、cyan再生actionを維持。
- active sideの静止ネオングラデーション、文字、番号、`aria-pressed`を維持し、コピー削減後も状態を識別できる。

### Image quality and asset fidelity

- 写真、illustration、logo、外部image assetの変更なし。
- 今回の最小化／最大化はユーザー指定どおりCSSによる単純記号。画像やロゴの代替ではない。
- Timeline Canvasの寸法・DPR制御は前回修正を維持し、今回のレイアウト変更によるぼけやcropなし。

### Copy and content

- 画面上から「試聴・判断」「推奨：—」「削除候補（0）：—」「準備完了 / 譜面を選択」のstatus badgeを除去。
- 有効なA–B区間が設定済みでも未反復ならmini Dockに「A–B 設定済み」を表示しない。反復中と未設定は状態把握のため維持。
- recommendation、削除候補一覧、譜面load statusはscreen reader向けlive regionとして保持し、視覚上のみ1px clip。

### Icons and controls

- iPhoneの収納は16 × 2pxのminus、展開は15 × 15pxのmaximize mark。どちらも44 × 44pxボタン内で中央揃え。
- visible textは空で、accessible nameとfocus ringは維持。
- play / pause、単音試聴、mute、Favorite、削除候補の既存記号は変更なし。

## Primary interactions tested

| 操作 | 結果 |
|---|---|
| Preview公開 | GitHub Pages Run #18、Preview commit `e71f61e661820c779015bfc5446f72f174c33dc9`がsuccess。 |
| 譜面選択・読み込み | iPhone / iPadとも対象譜面を読み込み、play control enabled、`#errorCard` hidden。 |
| 候補選択 | Don 026 / Kat 027を選択し、番号・色・静止neon・`aria-pressed`が同期。 |
| 再生 / 一時停止 | iPadで`aria-pressed`がtrue / falseへ同期し、時刻・timeline・overviewが更新。iPhoneでもcontrol enabledと表示状態を確認。 |
| iPhone収納 / 展開 | CSS icon、accessible name、96px収納 / 607.67px展開を確認。 |
| 遷移中の誤タップ防止 | 収納開始直後、panel `pointer-events:auto`、inner layer `none`、panel上のhit targetは`#auditionPanel`。入力が背後候補へ貫通しない。 |
| transport | 中央幅拡張、gap 10px、各ボタン中心のhit target一致を両端末で確認。 |
| Touch target / overflow | 44px未満0件、horizontal overflow 0px。 |
| Favorite到達性 | iPad / iPhone展開状態でFavorite open buttonが44px以上でviewport内。 |

## Console and error check

- CreateSE URL / script由来のconsole error / warningはiPhone / iPadとも0件。
- Cloud Browser拡張のmetadata送信エラーのみ観測し、CreateSE由来ではない。
- visible app errorなし、`#errorCard`はhidden。

## Comparison history — resolved P0 / P1 / P2

### Resolved P1 — iPhone Dock遷移中に背後の候補へタップが抜ける

- Earlier evidence: ユーザー添付で再生ビューと上部button領域が重なり、意図しないbutton pressを報告。
- Cause: `.audition-panel.is-transitioning{pointer-events:none}`がfixed panel全体をhit testから外していた。
- Fix: panelを常にinput shieldとして残し、遷移中だけ`.dock-mini` / `.dock-expanded`内のcontrolを無効化。
- Post-fix: transition中のcomputed `panelPointerEvents: auto`、inner layer `none`、`elementFromPoint`は`#auditionPanel`。

### Resolved P2 — transport controlsの密集感

- Earlier evidence: iPhoneで左右skipが広く、中央play / pauseが72pxと狭く、control間gapが5pxだった。
- Fix: iPhone中央96px、iPad中央92px、gap 10pxへ変更し、現在ペアとの縦間隔も確保。
- Post-fix: focused side-by-side comparisonと実測geometryで重なりなし。

### Resolved P2 — 不要な可視コピーが比較面を圧迫

- Fix: 指定文字を視覚上削除し、状態通知が必要な内容はaccessible live region / accessible nameに保持。
- Post-fix: iPhone / iPad screenshotで上部status、recommendation、削除候補一覧、展開見出しが非表示。

### Resolved P1 — iPhone / iPadのtimelineが段階的に動く

- Previous fix: frame-synchronous clock、visible renderer直結、重複legacy Canvas停止、DPR / viewport / style read最適化。
- Post-fix: ユーザーが実機iPad / iPhoneで「解消した」と確認。今回の変更ではtimeline実装を変更していない。

### Resolved P2 — 操作対象Don / Katが判別しにくい

- Previous fix: side colorの静止ネオングラデーション、番号、文字、`aria-pressed`を併用。
- Post-fix: 今回の両端末screenshotでもKat 027のactive stateを維持。

## Findings

- P0 / P1 / P2: Cloud Browser範囲ではなし。
- P3: maximize markは視覚上簡潔だが、実機でcheckbox等と誤認されないかは指操作QAで確認余地あり。accessible nameは保持済み。

## Accessibility

- visible tap targetは両端末で44px以上。
- 文字を除去した収納／展開buttonにも明確なaccessible name、44px hit area、3px `:focus-visible` ringを維持。
- clipしたload / recommendation / delete-candidate statusはDOMから削除せず、screen reader向けlive regionとして維持。
- Don / Katは文字、番号、border、`aria-pressed`を併用し、色だけに依存しない。
- PIP transitionは既存の`prefers-reduced-motion`規則で短縮。

## Open questions / 未確認事項

- 実機iPhone Safariで、収納／展開中に高速連打・実指swipeを行った際も背後候補が選択されないか。
- Safariのsafe area、address barによるdynamic viewport、長押し、iOSオーディオ制約。
- Dynamic Type / Safariページ拡大時の最終レイアウト。
- 適切なWAVがないためMy Soundのファイル選択、キャンセル、不正形式、8MB / 5秒上限、iOS file picker。
- Favorite削除 / 6秒Undoは保存データの破壊を避け、今回も未実行。

## Implementation checklist

- [x] 指定された可視コピーを削減し、accessible stateは保持。
- [x] iPhone収納／展開をCSS iconへ変更。
- [x] −4秒／再生／＋4秒の列幅とgapを調整。
- [x] Dock遷移中のhit-throughを防止。
- [x] `node --check` PASS、`node --test tests/*.test.mjs`: 13 / 13 PASS。
- [x] Preview GitHub Pages Run #18 success、Cloud BrowserでiPhone / iPadを再QA。
- [x] Production `main` / Pages / Workflowは未変更。

final result: passed
