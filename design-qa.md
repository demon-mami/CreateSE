# CreateSE Current111 / mobile workbench — Design QA

実施日: 2026-08-23〜24（JST）  
対象: Production `demon-mami/CreateSE` / `main`  
Production: https://demon-mami.github.io/CreateSE/  
iPhone QA: https://demon-mami.github.io/CreateSE/qa-iphone.html

## 判定

指定されたCurrent111への全音源差し替え、A / B / C識別、cyber gradient、category packingをProduction `main`へ直接反映した。Cloud BrowserのiPad 13インチ横相当（1363 × 936）とiPhone縦（390 × 844）では、今回の変更に起因する未解決のP0 / P1 / P2は確認していない。

- built-in hitsoundを111音源へ全置換。旧packはProduction treeから削除。
- visible source名は`SRC-nnn`のみ。candidate button本体は既存の高速比較性を優先して3桁番号表示を維持。
- drum familyに加え、各button上端の静止heat stripでA / B / Cを識別。A＝虹、B＝金、C＝赤。文字はaccessible nameのみに保持。
- 1 categoryは最大12 slot、2 categoryは`X + Y + 1空白 = 12 slot`で同一行へ配置。
- 候補面と再生面を、固定のdark cyber gradientで明確に分離。連続animationは使用していない。
- 一般向けの説明文、凡例、追加titleはUIへ加えていない。

## Audio dataset / integrity

| 項目 | 結果 |
|---|---|
| source archive | `osu_taiko_Current111_ABC_Sorted_v5(3).zip` |
| built-in WAV | 111 files |
| ABC内訳 | A 83 / B 26 / C 2 |
| audio format | 全件 48 kHz / 24-bit / stereo PCM |
| source ID | `SRC-001`〜`SRC-116`、欠番 018 / 044 / 075 / 103 / 104 |
| deployed pack | `hitsounds-current111-abc-v5.zip` |
| SHA-256 | `64eb71441e5362a4a0293fd616cb3becc663097e49673c970603f0a1c684889c` |
| Git blob / size | `17fc04a68a4fca7a1dd810f85773328d97102188` / 15,392,553 bytes |
| integrity | ZIP CRC clean、0-byteなし、重複なし、source WAVとbyte-identical |

旧`hitsounds-single-base-116.zip`は最終Production treeに存在しない。初回転送時の破損はCloud Browserの実読込で検出し、再転送後に期待するGit blob SHAとの一致を確認した。

## Category packing rule

- row capacityは利用可能幅から最大12、最小4で算出。
- 1 category row: `X = capacity`。
- 2 category row: `X + 1 explicit spacer + Y = capacity`。
- 同一行へ入る2 categoryは、合計button数が`capacity - 1`以下の場合のみ組み合わせる。
- category境界の1 slotはDOM上の明示的spacerであり、buttonではない。
- iPad 12-slot時は11 rows、うち9 rowsが2 category。20 categoryで奇数余りと12件categoryがあるため、2 rowsは単独表示。
- iPhone 6-slot時は18 rows。狭幅でも48px高と約50px幅を維持し、横overflowを発生させない。

## Browser-rendered evidence

### iPhone縦

| 項目 | 観測値 |
|---|---:|
| CSS viewport | 390 × 844 px |
| candidate数 | 111 |
| ABC | A 83 / B 26 / C 2 |
| row capacity | 6 slots |
| family rows | 18 |
| 最小candidate target | 49.83 × 48 px |
| horizontal overflow | 0 px |
| comparison dock | mini / expandedとも表示・操作可 |

### iPad 13インチ横相当

| 項目 | 観測値 |
|---|---:|
| CSS viewport | 1363 × 936 px |
| candidate数 | 111 |
| ABC | A 83 / B 26 / C 2 |
| row capacity | 12 slots |
| family rows | 11（2 category row: 9） |
| 最小candidate target | 56.80 × 48 px |
| horizontal overflow | 0 px |

両viewportで候補面と再生面のgradient差、A / B / Cの静止heat strip、Don / Kat選択状態、category spacerを視認できた。`Taiko Reference`はbutton配列内のみ`Taiko`へ短縮し、1-slot categoryでの不自然な折返しを防いでいる。

## Functional QA

| 操作 | 結果 |
|---|---|
| 譜面選択・読込 | play enabled、error card hidden |
| pack読込 | Current111を解凍・candidate再生可能、最終fresh tabのconsole error / warning 0 |
| 候補選択→解除→再選択 | 成功 |
| Don / Kat切替 | 成功、active sideとselected candidateが同期 |
| A / B / C候補 | Cを含め表示・選択を確認 |
| 再生 / 一時停止 | 成功、時刻とseek位置が進行 |
| Favorite追加 | 成功 |
| Favorite再適用 | Don 001 / Kat 002を登録後、Kat 003へ変更し、再適用でDon 001 / Kat 002へ復元 |
| 削除候補 ON / OFF | `false → true → false`を確認 |
| iPhone収納 / 展開 | mini / expandedの切替成功 |

## State / storage

- built-in selection、Favorite、削除候補はCurrent111専用version keyへ移行し、旧datasetの番号状態を誤適用しない。
- My SoundのIndexedDB dataと機能は削除・移行していない。
- initial pairはCurrent111上のDon `SRC-093` / Kat `SRC-097`。
- candidateのvisible labelは抑えた3桁番号と静止heat strip、family groupingで構成。accessible nameは`SRC-nnn`、A / B / C、familyを保持。

## Automated checks

- `node --check`: PASS。
- `node --test tests/*.test.mjs`: 20 / 20 PASS。
- final fresh Production tab: CreateSE由来のconsole error / warning 0。
- final GitHub tree: new packのみ存在し、old packなし。

## Accessibility / interaction checks

- candidateは両viewportとも44 × 44px以上。
- visible ABC識別は静止heat stripのみ。個人用toolとして凡例と文字を追加しない方針を優先し、accessible nameにはA / B / Cを保持。
- Don / Kat selected stateは色、border、`aria-pressed`を併用。
- static cyber gradientのため、今回追加箇所に継続motionはない。
- category spacerは非interactiveで、Tab stopを増やさない。
- visible source表記を短縮してもaccessible nameは`SRC-nnn`を維持。

## 未確認事項

- 実機iPhone / iPad Safariのsafe area、address barによるdynamic viewport、長押し、実指での境界tap、Bluetooth keyboard、iOS audio制約。
- Dynamic Type、Safariページ拡大時の最終layout。
- iOS native file pickerにおけるMy Soundの選択、cancel、不正形式、上限超過。
- 通信遮断中の初回pack取得失敗と再試行体験。
- Cloud Browserは実機Safariと同一ではないため、上記をPASS扱いにしていない。

## Implementation checklist

- [x] 111 WAVへ全置換し、旧built-in packを削除。
- [x] visible source名を`SRC-nnn`へ統一。
- [x] drum familyとA / B / C heat stripを同時識別可能にした。
- [x] `X = 12` / `X + Y + 1空白 = 12`のpacking ruleを実装。
- [x] responsive capacityと44px以上のtouch targetを維持。
- [x] 候補面 / 再生面をcyber gradientで分離。
- [x] iPhone / iPad Cloud Browserでrenderingと主要操作をQA。
- [x] 20 / 20 tests PASS、final CreateSE由来console error / warning 0。

## Hitsound switching performance follow-up — 2026-08-24

### 観測した原因

- 初回候補tapまで15.4MBのCurrent111 ZIP取得を開始せず、そのtapにnetwork待ちが集中していた。
- 候補変更時に単音preview完了を待ってから実譜面用Hitsoundを反映しており、比較loopが直列化していた。
- 同じWAVを`HTMLAudio`のpreviewと、hidden file input経由のWeb Audio反映で別々にdecodeしていた。
- decoded buffer cacheが8件で、同じ候補へ戻る比較でも再decodeが発生しやすかった。
- 連打時は過去の選択処理がqueueとして残り、最後のtapまでの待ち時間が積み上がる場合があった。

### 対策

- Current111 ZIPをpage load後にbackground warm-upし、現在のDon / Kat entryを先に展開する。
- ZIP entry展開とWeb Audio decodeにin-flight promiseを持たせ、同じ音源の同時処理を1回へ集約する。
- 単音previewと実譜面反映で同じdecoded `AudioBuffer`を共有し、hidden file input経由の二重decodeをbuilt-in音源では廃止する。
- previewと実譜面反映を並行開始し、候補選択処理からpreview終了待ちを外す。
- rapid tapはselection serialでlatest-winsとし、古い処理が完了しても最後にtapした候補を上書きしない。
- decoded buffer cacheを8件から32件へ拡張する。
- My Sound等の互換経路として従来のfile input fallbackは保持する。
- temporary volume controlは追加せず、最終mixはMusic `0.70` / Hitsound `1.00`とする。
- 表示、文言、layoutには変更を加えていない。

### Production QA

| 確認 | 結果 |
|---|---|
| deploy | Productionが`app-v4.js?v=3.4-shared-hitsound-buffer`、`hitsound-controller.js?v=4.1-latest-switch-wins`、`workbench-ui.js?v=1.5.1-preview-state`を配信 |
| 通常表示・native tap相当 | `SRC-035 → 036 → 037`で819 / 255 / 263ms。最終Don 037、status `準備完了` |
| iPhone 390×844 harness・native tap相当 | `SRC-014 → 015 → 016`で505 / 999 / 998ms。最終Kat 016、status `準備完了` |
| 再生中の連続切替 | 通常表示・iPhone harnessとも再生が停止せず、最終tapの候補が残る |
| iPhone再生位置 | `SRC-011 → 012 → 013`の切替中に0.158秒から9.309秒へ進行、最終Kat 013 |
| Don / Kat | Katを維持したままDonのみ001 → 014へ変更できた |
| 無音 / 復帰 | Don 014 → 無音 → 015を確認 |
| Favorite再適用 | Don 001 + Kat 002を再適用し、両sideとstatusが同期 |
| errors | CreateSE由来のconsole error / warning 0 |
| automated | `node --check` PASS、`node --test tests/*.test.mjs` 19 / 19 PASS |

Cloud Browserの計測値にはremote input・iframe・rendering overheadが含まれ、純粋なaudio処理時間や実機Safariのlatencyではない。絶対値よりも、連打後に待ちqueueが積み上がらないこと、再生が継続すること、最後のtapが正しく残ることを合格条件とした。未cache候補の初回展開・decodeコストは端末性能に依存するため、実機iPhone / iPad Safariでの最終確認を残す。

## Phase7A Pair-12 Favorite seed — 2026-08-24

添付`Phase7A_Pair12_List_v5(1).md`の12ペアを、既存Favoriteを保持したまま一度だけ自動追加するmigrationとして実装した。

- P01: Don 070 + Kat 084
- P02: Don 015 + Kat 019
- P03: Don 098 + Kat 101
- P04: Don 098 + Kat 064
- P05: Don 056 + Kat 084
- P06: Don 070 + Kat 019
- P07: Don 089 + Kat 064
- P08: Don 089 + Kat 088
- P09: Don 101 + Kat 090
- P10: Don 056 + Kat 077
- P11: Don 084 + Kat 090
- P12: Don 079 + Kat 100

### Migration behavior

- 既存Favoriteは削除・上書きしない。
- Don / Katが同一の既存ペアは`entryKey`で重複追加しない。
- `phase7a-pair12-v5`専用migration keyにより、通常の再読込では再追加しない。
- 追加後にユーザーが削除したseed pairは、次回起動で自動復活しない。
- Favorite表示、削除、CSV、再適用の既存操作と表示形式は変更しない。

### Production QA

| 確認 | 結果 |
|---|---|
| deploy | `hitsound-favorites.js?v=4.1-phase7a-pair12-v5`を配信 |
| existing data | Cloud Browser内の既存2件を保持 |
| merge | 12件を追加し合計14件、添付の全ペアと一致 |
| reload | 再読込後も14件で、重複追加なし |
| reapply | P12を適用しDon 079 / Kat 100へ同期 |
| errors | CreateSE由来のconsole error / warning 0 |
| automated | `node --check hitsound-favorites.js` PASS、19 / 19 tests PASS |

## Minimal candidate keys / heat hierarchy — 2026-08-24

- visible ABC文字とD / K文字badgeを削除。
- Aは2pxの静止rainbow、Bは静止gold、Cは静止redの上端stripで識別する。
- 3桁番号は11px・低contrast・中weightへ下げ、音の比較より先に読ませない。
- 選択状態はDon＝左下pink dot、Kat＝右下blue dot、active sideは静止outline / glowで補う。
- 44px以上のtouch targetと、`SRC-nnn・ABC・family`のaccessible nameは維持する。
- 連続animation、凡例、追加説明文は導入していない。

## iPad object timeline performance / final mix — 2026-08-24

### 観測した原因

- visible object rendererが独立した`requestAnimationFrame`で、再生位置が動く間はlane全体をdisplay refreshごとに再描画していた。
- 120HzのProMotion iPadでは、60Hz端末の約2倍のcanvas workが発生し得た。
- main transport loopも同時にrange inputと曲全体cursor canvasをdisplay refreshごとに更新していた。
- beat / measure lineを1本ずつstrokeし、各noteでcanvas stateをsave / restoreしていた。

### 対策

- audio clock、Hitsound scheduler、A–B判定は描画から分離したまま維持。
- object laneのvisual paintを最大約60fpsへ制限し、120Hz時の重複workを抑制。
- document hiddenまたはlaneがviewport外の場合はobject laneのpaintを停止し、復帰時にinvalidateする。
- seek range、time text、曲全体cursorを約30fpsへまとめ、毎display frameのDOM / canvas更新を廃止。
- time-copy button幅のlayout readをresize時へ移動。
- beat / measure lineを2 pathへbatchし、noteごとの`save()` / `restore()`を廃止。
- canvas DPR上限2とnoteの見た目は維持し、軽量化のための解像度低下は行っていない。
- 最終固定mixをMusic `0.70` / Effect `1.00`へ変更。音量sliderや説明文は追加していない。

### Production QA

| 確認 | 結果 |
|---|---|
| deploy | `object-timeline-v2.js?v=3.1-ipad-frame-budget`、最終`app-v4.js?v=3.7-music-070` |
| viewport | Cloud Browser 1363 × 936（iPad 13インチ横相当） |
| stress chart | `Everytime We Touch [Fvrwvrd's 700 BPM Speedcore Edit]` |
| sustained playback | 01:59まで再生を継続。object lane、全体cursor、seekが進行 |
| switching during playback | Kat 003→004、Don 001→002。再生を停止せず最終選択を維持 |
| pause | settle後1.2秒でseek差0ms |
| ±4秒 | +4.000秒 / -4.000秒 |
| zoom | ±0.5秒→±0.4秒、laneを再描画 |
| A–B repeat | A 02:05:079 / B 02:09:079。7.5秒後02:06:974で区間内、再生・loopともON |
| errors | CreateSE由来のconsole error / warning 0。Cloud Browser extension由来logは対象外 |
| automated | `node --check` PASS、`node --test tests/*.test.mjs` 20 / 20 PASS |

Cloud Browserは実機iPadOS SafariのProMotion、thermal throttling、実audio output、Safari固有のcanvas schedulingを再現しない。したがって実機の体感改善は未確認であり、Production更新後に同じ高密度譜面を長時間再生して最終確認する。

final result: passed
