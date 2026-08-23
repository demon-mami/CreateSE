# CreateSE Current111 / mobile workbench — Design QA

実施日: 2026-08-23（JST）  
対象: Production `demon-mami/CreateSE` / UI・data commit `1071e911e1268ff10e90538088ec8fc15485f670` / performance commit `50e993c95c251917c3f14029db3deb3e37e0a773`  
Production: https://demon-mami.github.io/CreateSE/?qa=50e993c  
iPhone QA: https://demon-mami.github.io/CreateSE/qa-iphone.html?qa=50e993c

## 判定

指定されたCurrent111への全音源差し替え、A / B / C識別、cyber gradient、category packingをProduction `main`へ直接反映した。Cloud BrowserのiPad 13インチ横相当（1363 × 936）とiPhone縦（390 × 844）では、今回の変更に起因する未解決のP0 / P1 / P2は確認していない。

- built-in hitsoundを111音源へ全置換。旧packはProduction treeから削除。
- visible source名は`SRC-nnn`のみ。candidate button本体は既存の高速比較性を優先して3桁番号表示を維持。
- drum familyに加え、各buttonへA / B / Cを文字と色で常時表示。
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

両viewportで候補面と再生面のgradient差、A / B / Cの文字識別、Don / Kat選択状態、category spacerを視認できた。`Taiko Reference`はbutton配列内のみ`Taiko`へ短縮し、1-slot categoryでの不自然な折返しを防いでいる。

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
- candidateのvisible labelは番号、A / B / C文字、family groupingで構成。accessible nameは`SRC-nnn`を保持。

## Automated checks

- `node --check`: PASS。
- `node --test tests/*.test.mjs`: 18 / 18 PASS。
- final fresh Production tab: CreateSE由来のconsole error / warning 0。
- final GitHub tree: new packのみ存在し、old packなし。

## Accessibility / interaction checks

- candidateは両viewportとも44 × 44px以上。
- ABCは色だけでなくA / B / C文字を併用。
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
- [x] drum familyとA / B / Cを同時識別可能にした。
- [x] `X = 12` / `X + Y + 1空白 = 12`のpacking ruleを実装。
- [x] responsive capacityと44px以上のtouch targetを維持。
- [x] 候補面 / 再生面をcyber gradientで分離。
- [x] iPhone / iPad Cloud Browserでrenderingと主要操作をQA。
- [x] 18 / 18 tests PASS、final console error / warning 0。

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
- temporary volume controlは追加せず、Music `0.85` / Hitsound `1.00`の既定mixを維持する。
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
| automated | `node --check` PASS、`node --test tests/*.test.mjs` 18 / 18 PASS |

Cloud Browserの計測値にはremote input・iframe・rendering overheadが含まれ、純粋なaudio処理時間や実機Safariのlatencyではない。絶対値よりも、連打後に待ちqueueが積み上がらないこと、再生が継続すること、最後のtapが正しく残ることを合格条件とした。未cache候補の初回展開・decodeコストは端末性能に依存するため、実機iPhone / iPad Safariでの最終確認を残す。

final result: passed
