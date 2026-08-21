# CreateSE mobile comparison workbench — Design QA

実施日: 2026-08-22（JST）  
対象: PR #3 `feat/mobile-comparison-workbench` / UI commit `638b1680e0ba8a423e402b274862e9dad34ec4af`  
Preview: https://demon-mami.github.io/CreateSE-preview/?qa=638b168

## 判定

Cloud Browserで再現したiPad 13インチ横相当とiPhone縦の範囲では、未解決のP0 / P1 / P2はありません。Productionの`main`、Production GitHub Pages、既存Production用Workflowは変更していません。

今回のvisual truthは、Production UIの情報密度・色・文字量、添付動画の周回する枠表現、合意済みの端末別要件です。Productionの中央1カラム配置そのものはiPad主案ではなく、iPadは比較作業を同一面に置く2-pane、iPhoneは候補面とPIP風Dockを分離する構成が意図した差分です。

## Source visual truth

- Production UI: `/workspace/scratch/audit-production-original-ipad-current-20260822.jpg`
  - 1348 × 926 px。
  - 文字量、暗色surface、Don / Kat色、候補密度、ボタン表現の基準。
- 添付motion reference: `/workspace/scratch/534ae2b2b179/upload/CSSアニメ.mp4`
  - 抽出した12 frame: `/workspace/scratch/534ae2b2b179/audit-css-animation-contact-sheet.jpg`（1884 × 1026 px）。
  - bright segmentが枠周囲を移動する表現の基準。ユーザー指定により実装はreferenceより遅い5.6秒、常時loop。
- 合意済み要件:
  - iPad: 候補変更と実譜面再生・判断を同一作業面に置く。
  - iPhone: 96pxの常設Dockと展開面をPIP風に連続変形させる。
  - visible copyはProductionに近い密度へ抑え、詳細はaccessible nameに保持する。

## Browser-rendered implementation evidence

### iPad 13インチ横相当

- CSS viewport: 1363 × 936 px、Cloud Browser Chrome、screenshot 1363 × 936 px、1:1で比較（追加density normalizationなし）。
- State: 譜面読込済み、Don 001 / Kat 021、Kat操作中、A=10秒 / B=12秒、loop ON、Favorite 2件。
- Screenshot: `/workspace/scratch/534ae2b2b179/createse-preview-ipad-final-638b168-20260822.jpg`
- Full-view comparison: `/workspace/scratch/534ae2b2b179/qa-compare-production-preview-ipad-638b168.jpg`

### iPhone縦

- CSS viewport: QA harness内390 × 844 px iframe、outer Cloud Browser 1363 × 936 px。screen cropは390 × 844 px、1:1で比較。
- State: 候補一覧の下部、Kat操作中、Dock収納 / 展開の両状態。
- Collapsed screenshot: `/workspace/scratch/534ae2b2b179/createse-preview-iphone-screen-collapsed-638b168-20260822.jpg`
- Expanded screenshot: `/workspace/scratch/534ae2b2b179/createse-preview-iphone-screen-expanded-638b168-20260822.jpg`
- State comparison: `/workspace/scratch/534ae2b2b179/qa-compare-iphone-pip-states-638b168.jpg`

### Focused motion comparison

- Evidence: `/workspace/scratch/534ae2b2b179/qa-compare-motion-active-border-638b168.jpg`
- Source 12 framesとPreviewのactive Kat枠を同じ比較画像で確認。
- Computed state: `active-border-orbit 5.6s linear infinite`。Katの角度は75.27°→140.61°（900ms後）、別試行では231.705°を観測。Donへ切替後はDon cardだけがactiveとなり、Don token `#EEB9B2`、Kat token `#B0CCD7`へ追従。

## Required fidelity surfaces

### Fonts and typography

- Productionと同じsystem sans系の白文字・数字中心の密度を維持。
- visible labelは`▶`、`Ⅱ`、`A/B`、`↻`、`♡/♥`、`候補`へ圧縮し、長い説明は`aria-label`へ移した。
- 390pxで主要操作の重なり、横切れ、意図しない2行化はなし。動的な曲名・音源名は既存のtruncate方針を維持。

### Spacing and layout rhythm

- iPadは候補paneと試聴・判断paneが同一viewport内に収まり、Favoriteもbottom 800pxで完全表示。
- iPhoneは収納96px、展開607.67px。候補のscroll位置を背後に保持し、展開面内で再生・loop・Favoriteまで到達可能。
- visible controlはiPad 80件、iPhone展開61件を計測し、44 × 44 CSS px未満は両方0件。
- page horizontal overflowは両方0。iPad right paneとiPhone展開面は必要時のみ安全なinner scrollを持つ。

### Colors and visual tokens

- Production由来のdark gray surface、Don red、Kat blueを維持。
- active targetは文字・`aria-pressed`・強い静的borderに加え、side colorの周回枠で識別。色だけに依存しない。
- `prefers-reduced-motion: reduce`では周回を停止し、強い静的borderへ置換。

### Image quality and asset fidelity

- このUIに写真・illustration・logo差し替えはない。既存canvas timelineと候補UIがvisual contentの中心。
- timeline canvasはdevice pixel ratioを最大2に制限し、style width / heightの不要な再設定を避けてsharpnessと更新負荷を両立。
- 添付motion referenceを画像assetとして埋め込まず、同じperimeter movementをCSS state feedbackとして適用したことは意図した実装差分。

### Copy and content

- Productionの短い候補番号・カテゴリ名・記号中心のUIへ寄せた。
- `曲を再生`、`Kat 021を単音試聴`、`現在位置をAに設定`などの詳細説明はaccessible nameに残す。
- statusは短文化したが、譜面読込、再生、loop、Favorite、削除候補の結果feedbackは維持。

## Primary interactions tested

| 操作 | 結果 |
|---|---|
| 譜面選択・読み込み | `譜面読込中`から`準備完了`へ遷移し、再生が有効。 |
| 候補タップcycle | Kat 021を選択→一回再生、同じ候補で解除→再生なし、再選択→一回再生して145.625msで終了。 |
| 再生中の候補切替 | 曲は`aria-pressed=true`のまま時刻が進み、候補変更で停止しない。 |
| 単音previewの音量制御 | `window.HitsoundDuckingBridge`は`undefined`、`audio-ducking-bridge.js`のscriptは0件。Music 0.85 / Hitsound 1.00の固定gain。 |
| Don / Kat target切替 | active card、文字、`aria-pressed`、side colorの周回枠が同時に移動。 |
| A–B反復 | A=10秒、B=12秒、`↻ ON`、`2.000 sを反復中`を確認。2.6秒後の位置は10秒へ戻った。 |
| Favorite到達性 | iPadは44px高・viewport内、iPhone展開も44px高・viewport内。 |
| PIP展開 / 収納 | 96px↔607.67px。`is-transitioning`と`aria-busy=true`はheight transition完了まで保持され、完了後のみ解除。 |
| 主要補助操作 | 再生 / 一時停止、±4秒、シーク、zoom、無音、Favorite追加 / 再適用、削除候補ON / OFF、CSV、譜面変更は既存Cloud Browser QAでPASS。 |

## Console and error check

- 最終URLで譜面読込・再生・候補切替・loop・Dock操作を完了し、visible app errorはなし。`#errorCard`はhidden。
- 同一Preview UIのconsole確認ではCreateSE由来のerror / warningは0件。Cloud Browser拡張のmetadata送信エラーのみで、CreateSEのURL / script由来ではない。
- asset破損や通信遮断を意図的に作る試験は実施していない。

## Comparison history — resolved P0 / P1 / P2

### Resolved P1 — iPad Favoriteが作業面から消える

- Earlier evidence: ユーザー実機確認でFavorite欄が見つからない。
- Fix: iPad expanded regionへsafe inner scrollを追加し、judgment panelをbottomへsticky配置。
- Post-fix evidence: final iPad screenshot。Favoriteはtop 756px / bottom 800px、44px高でviewport内。

### Resolved P2 — timeline更新のカクつき

- Earlier evidence: ユーザー実機確認でtimelineがカクつく。
- Fix: CSS token cache、ResizeObserverによるviewport cache、canvas DPR上限2、DOM時刻更新を約33msへthrottle、canvas style再設定を差分時だけに限定。
- Post-fix evidence: Cloud Browserで再生・候補切替・A–B反復中も操作不能やvisible frame freezeなし。実機iPad Safariの体感再確認は未確認事項に残す。

### Resolved P2 — 操作対象Don / Katが判別しにくい

- Earlier evidence: active側が主に色差だけで、視線移動後に対象を失いやすい。
- Fix: reference準拠のperimeter tracerをside colorで常時loopし、文字・pressed state・静的borderも併用。
- Post-fix evidence: focused motion comparisonとcomputed animation値。

### Resolved P1 — A / Bボタンが44px未満へ退行

- Earlier evidence: first motion buildでA / Bが27px / 28px幅。
- Fix: control columnsを44px固定へ戻した。
- Post-fix evidence: iPad / iPhoneともvisible controlの44px未満0件。

### Resolved P2 — Dockがvisual transition中にunlockする

- Earlier evidence: timer-only解除ではthrottled iframe上で高さが変わる前に`is-transitioning`が外れる場合があった。
- Fix: `height`の`transitionend`でunlockし、3倍durationのfallbackを保険として使用。
- Post-fix evidence: 展開時はheight 96pxの間、収納時は607.67pxの間も`aria-busy=true`を維持し、最終高さ到達後だけ解除。

### Previously resolved items retained

- iPhoneのDon / Kat候補scroll位置をlayout × sideごとに独立保持。
- seek targetをiPad / iPhoneとも44px化。
- iPhone Favorite一覧導線を44px幅の件数だけから、74px以上の可視導線へ改善。
- 狭幅の主要操作文字とmini再生のnowrapを修正。

## Findings

- P0 / P1 / P2: なし。
- P3 follow-up: 周回速度とglow強度は実機OLED / LCD、実際の指操作、暗所での見え方により微調整余地がある。現在値はユーザー指定の「referenceより遅く、常時loop」を満たす5.6秒。

## Accessibility

- visible tap targetは両端末で44px以上。
- visible controlのaccessible name欠落はなし。詳細copyを隠してもARIA labelは維持。
- Don / Katは色以外に文字、番号、border、`aria-pressed`で識別。
- 3px `:focus-visible` ring、Skip link、Tab / Enter / Spaceの基本操作を既存QAで確認。
- reduced motion時はanimationを停止し、active state自体は静的borderで残す。

## Open questions / 未確認事項

- iPhone / iPad実機Safariのsafe area、address barによるdynamic viewport、長押し、実指誤タップ、iOSオーディオ制約。
- ユーザー報告のtimeline体感が実機iPad Safariで十分改善したか。
- Dynamic Type / Safariページ拡大時の最終レイアウト。
- 適切なWAVがないためMy Soundのファイル選択、キャンセル、不正形式、8MB / 5秒上限、iOS file picker。
- Favorite削除 / 6秒Undoは保存データの破壊を避け、導線・accessible name・実装の静的確認まで。
- 実機の`prefers-reduced-motion`切替とBluetooth keyboard操作。

## Implementation checklist

- [x] 候補の選択→解除→再選択cycleと、一回だけの単音preview。
- [x] 単音previewからtemporary Music / Hitsound gain制御を全削除。
- [x] Music 0.85 / Hitsound 1.00。
- [x] active Don / Katの5.6秒continuous perimeter loopとreduced-motion fallback。
- [x] iPhone PIP風収納 / 展開とtransition中の誤操作防止。
- [x] iPad Favorite到達性とtimeline更新負荷の改善。
- [x] Productionに寄せたvisible text densityとaccessible name維持。
- [x] iPad / iPhoneのCloud Browser実操作、responsive geometry、evidence capture。

final result: passed

