# CreateSE mobile comparison workbench — Design QA

実施日: 2026-08-22（JST）  
対象: PR #3 `feat/mobile-comparison-workbench` / UI commit `bd9f84ce8f39cf54f3787a85dc2f31114c551b80`  
Preview: https://demon-mami.github.io/CreateSE-preview/?qa=bd9f84c  
iPhone QA: https://demon-mami.github.io/CreateSE-preview/qa-iphone.html?qa=bd9f84c

## 判定

Cloud Browserで再現したiPad 13インチ横相当とiPhone縦では、今回の変更による未解決のP0 / P1 / P2はありません。active Don / Katは常時アニメーションを廃止し、side colorの静止ネオングラデーションへ変更しました。timelineの描画時刻を33ms更新制限から分離し、重複Canvas描画と毎フレームの高コスト処理も抑制しています。

Production `demon-mami/CreateSE`の`main`、Production GitHub Pages、既存Production用Workflowは変更していません。実機iPhone / iPad Safariでの最終的な体感確認は、Cloud Browserと同一視せず未確認事項に残します。

## Source visual truth

- Production UI: `/workspace/scratch/audit-production-original-ipad-current-20260822.jpg`（1348 × 926 px）。
  - 文字量、暗色surface、Don / Kat色、候補密度、ボタン表現の基準。
- 変更前Preview:
  - iPad: `/workspace/scratch/534ae2b2b179/createse-preview-ipad-final-638b168-20260822.jpg`（1363 × 936 px）。
  - iPhone展開: `/workspace/scratch/534ae2b2b179/createse-preview-iphone-screen-expanded-638b168-20260822.jpg`（390 × 844 px）。
  - レイアウト、情報密度、端末別構成を維持する回帰比較の基準。
- 添付motion reference: `/workspace/scratch/534ae2b2b179/upload/CSSアニメ.mp4`。
  - 今回のユーザー指示でactive枠の周回表現は正式に廃止。参考動画は履歴資料のみとし、現在のvisual targetは「Don / Kat色に追従する静止ネオングラデーション」。
- 合意済み端末要件:
  - iPad: 候補変更と実譜面再生・判断を同一作業面に置く。
  - iPhone: 96pxの常設Dockと展開面をPIP風に連続変形させる。
  - visible copyはProductionに近い密度へ抑え、詳細はaccessible nameに保持する。

## Browser-rendered implementation evidence

### iPad 13インチ横相当

- CSS viewport: 1363 × 936 px、Cloud Browser Chrome。
- Implementation screenshot: `/workspace/scratch/createse-preview-ipad-static-neon-loop-bd9f84c-20260822.jpg`（1363 × 936 px）。
- State: 譜面読込済み、Don 001 / Kat 021、Kat操作中、A=10秒 / B=12秒、loop ON、Favorite 2件、実譜面再生中。
- Density normalization: CSS viewportとscreenshotが1:1のため追加変換なし。
- Full-view comparison: `/workspace/scratch/qa-compare-ipad-static-neon-bd9f84c-20260822.jpg`（変更前 / 変更後を同一画像内で比較）。
- Focused active-state comparison: `/workspace/scratch/qa-focus-ipad-active-static-neon-bd9f84c-20260822.jpg`。
- Focused timeline comparison: `/workspace/scratch/qa-focus-ipad-timeline-bd9f84c-20260822.jpg`。

### iPhone縦

- CSS viewport: QA harness内390 × 844 px iframe、outer Cloud Browser 1363 × 936 px。
- Implementation screenshot: `/workspace/scratch/createse-preview-iphone-static-neon-bd9f84c-20260822.jpg`（iframeを390 × 844 pxで直接clip）。
- State: 譜面読込済み、Don 001 / Kat 021、Kat操作中、Dock展開、実譜面再生中、Favorite 2件。
- Density normalization: inner CSS viewportとscreen clipが1:1のため追加変換なし。
- Full-view comparison: `/workspace/scratch/qa-compare-iphone-static-neon-bd9f84c-20260822.jpg`。
- Focused active-state comparison: `/workspace/scratch/qa-focus-iphone-active-static-neon-bd9f84c-20260822.jpg`。

## Focused implementation verification

### 静止ネオングラデーション

- iPadのactive Kat cardとiPhone mini / expanded Katで、computed `animation-name: none`を確認。
- computed backgroundはKat token `rgb(176, 204, 215)`と白を用いた固定`conic-gradient(from 215deg, ...)`、opacity `0.94`。
- `@property --active-glow-angle`、`active-border-orbit` keyframes、連続animation、active枠の`filter: drop-shadow()`を削除。
- Don / Katの文字、番号、`aria-pressed`、side color、静的borderは維持し、色だけに依存しない。

### Timelineのカクつき対策

- 変更前は`seek.value`を約33msごとに更新し、`object-timeline-v2.js`が同じ値を描画時計として参照していたため、表示位置が約30fps相当に段階化していた。
- 変更後は`seek.value`を`requestAnimationFrame`ごとに同期。33ms制限は時刻テキストと`aria-valuetext`だけに残し、可視timelineの時計には適用しない。
- 外部timeline rendererは`CreateSEViewer.positionSec()`から再生位置を直接取得。range inputのDOM更新状態にも依存しない。
- 可視renderer有効時はlegacy timeline Canvasの再描画を停止。Cloud Browser実測ではlegacyのintrinsic bufferは既定300 × 150のまま、可視CanvasのみiPad 464 × 80、iPhone 341 × 58へ更新された。
- 可視Canvas DPRは最大2、viewportは`ResizeObserver`でcache、styleサイズは差分時のみ更新、表示候補の開始位置はbinary searchで取得、停止中の同一frame再描画をskip。
- Cloud Browserは実iOS Safariのframe pacingを再現しないため、「実機で完全に滑らか」はまだPASS判定していない。コード上の30fps上限制約と重複描画は解消済み。

## Required fidelity surfaces

### Fonts and typography

- Productionと同じsystem sans系、白文字と数字中心の情報密度を維持。
- 変更前後比較で文字サイズ、weight、line-height、truncate、主要操作の改行に新たな差異なし。

### Spacing and layout rhythm

- iPadの2-pane比率、right pane、Favorite到達性、A–B、timelineの配置を維持。
- iPhoneの96px収納 / 607.67px展開、PIP変形、候補scroll位置保持を維持。
- visible target計測: iPad 143件、iPhone展開144件。44 × 44 CSS px未満は両方0件。
- horizontal page overflowはiPad / iPhoneとも0px。

### Colors and visual tokens

- Production由来のdark gray surface、Don `#EEB9B2`系、Kat `#B0CCD7`系を維持。
- active枠は静止gradientと既存のouter glowを併用。常時再描画を発生させず、操作対象を視覚的に識別できる。

### Image quality and asset fidelity

- 写真、illustration、logo、外部image assetの変更なし。
- timeline CanvasはCloud BrowserのDPR 1でCSS寸法とほぼ1:1。実機高DPRでは最大2に制限し、過剰なpixel bufferを防ぐ。

### Copy and content

- visible copyは変更なし。Production寄りの短い候補番号、カテゴリ名、記号中心のUIを維持。
- `曲を再生`、`Kat 021を単音試聴`、`現在位置をAに設定`などのaccessible nameも維持。

## Primary interactions tested

| 操作 | 今回の結果 |
|---|---|
| Preview公開 | GitHub Pages Run #16、Preview commit `006f55508be61708cc3f0f00663ec802348345e6`がsuccess。 |
| 譜面選択・読み込み | iPad / iPhoneとも`準備完了`へ遷移し、`#errorCard`はhidden。 |
| 再生 / 一時停止 | 両端末で`aria-pressed`がtrue / falseへ同期し、時刻・timeline・overviewが更新。 |
| Timeline / A–B | iPadでA=10秒、B=12秒、2.000秒loop ON、再生位置が区間へ戻る状態を確認。 |
| active Don / Kat | Kat操作中に静止ネオン枠、文字、番号、`aria-pressed`が同期。computed animationは`none`。 |
| iPhone PIP展開 | 96pxから607.67pxへ遷移し、完了まで`aria-busy=true`、完了後に解除。 |
| Touch target / overflow | 44px未満0件、horizontal overflow 0px。 |
| 既存主要フロー | 候補cycle、再生中の候補切替、±4秒、シーク、zoom、無音、Favorite追加 / 再適用、削除候補、CSV、譜面変更は前回QA結果を維持。 |

## Console and error check

- CreateSE URL / script由来のconsole error / warningはiPad / iPhoneとも0件。
- Cloud Browser拡張のmetadata送信エラーのみ観測し、CreateSE由来ではない。
- visible app errorなし、`#errorCard`はhidden。

## Comparison history — resolved P0 / P1 / P2

### Resolved P1 — iPhone / iPadのtimelineが段階的に動く

- Earlier evidence: ユーザー実機iPad・iPhoneでtimelineの強いカクつきを報告。
- Cause: 約33msのDOM throttle対象に、可視timelineが時計として読む`seek.value`を含めていた。
- Fix: frame-synchronous clockへ復帰し、visible rendererをtransport positionへ直接接続。重複Canvas、uncapped DPR、毎frame layout/style read、先頭からの候補走査も除去。
- Post-fix evidence: iPad / iPhoneの再生中screenshot、focused timeline比較、Canvas geometry、11 / 11 static tests。実機Safariの体感確認は継続項目。

### Resolved P2 — 操作対象Don / Katが判別しにくい

- Earlier evidence: active側が主に色差だけで、視線移動後に対象を失いやすかった。
- First fix: 周回するperimeter tracerを追加。
- Current fix: ユーザー判断によりcontinuous motionを廃止し、同じside colorと強度を持つ静止ネオングラデーションへ変更。
- Post-fix evidence: focused active-state比較、computed `animation-name: none`、Kat gradient token、文字・番号・ARIAの併用。

### Resolved P1 — iPad Favoriteが作業面から消える

- Fix: iPad expanded regionへsafe inner scrollを追加し、judgment panelをbottomへsticky配置。
- Post-fix: 今回の1363 × 936 screenshotでもFavorite導線はviewport内に維持。

### Resolved P1 — A / Bボタンが44px未満へ退行

- Fix: control columnsを44px固定へ復帰。
- Post-fix: 今回の両端末再計測でも44 × 44 CSS px未満0件。

### Resolved P2 — Dockがvisual transition中にunlockする

- Fix: `height`の`transitionend`でunlockし、fallback timerを保険として保持。
- Post-fix: iPhoneで最終高さ到達後だけ`aria-busy`と`is-transitioning`が解除。

## Findings

- P0 / P1 / P2: Cloud Browser範囲ではなし。
- P3: 静止glowの強度は実機OLED / LCDと暗所で微調整余地があるが、操作対象の識別は成立している。

## Accessibility

- visible tap targetは両端末で44px以上。
- Don / Katは文字、番号、border、`aria-pressed`を併用し、色だけに依存しない。
- active state自体が静止したため、`prefers-reduced-motion`に関係なく常時motion-free。PIP transitionは既存のreduced-motion規則で短縮。
- 3px `:focus-visible` ring、Skip link、accessible nameを維持。

## Open questions / 未確認事項

- 今回のPreviewを実機iPhone / iPad Safariで再生した際、timelineの体感カクつきが解消したか。
- Safariのsafe area、address barによるdynamic viewport、長押し、実指誤タップ、iOSオーディオ制約。
- Dynamic Type / Safariページ拡大時の最終レイアウト。
- 適切なWAVがないためMy Soundのファイル選択、キャンセル、不正形式、8MB / 5秒上限、iOS file picker。
- Favorite削除 / 6秒Undoは保存データの破壊を避け、導線・accessible name・実装の静的確認まで。

## Implementation checklist

- [x] active Don / Katを静止ネオングラデーションへ変更し、continuous animationを全削除。
- [x] timeline clockを33ms UI throttleから分離。
- [x] range seekをframe同期へ復帰し、visible rendererをtransport positionへ直接接続。
- [x] 重複legacy Canvas描画を停止。
- [x] visible timelineのDPR上限2、viewport / CSS token cache、binary search、停止中skipを追加。
- [x] Music 0.85 / Hitsound 1.00と、単音previewの非ducking仕様を維持。
- [x] `node --check` PASS、`node --test tests/workbench-static.test.mjs`: 11 / 11 PASS。
- [x] Preview GitHub Pages Run #16 success、Cloud BrowserでiPad / iPhoneを再QA。
- [x] Production `main` / Pages / Workflowは未変更。

final result: passed
