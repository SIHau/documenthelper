# 稿件 JSON 欄位說明

稿件就是公文小幫手的 `OfficialDocument`。**只需要寫用到的欄位**，缺少的欄位會自動補預設值（`dh normalize` 可看補齊後的完整稿件）。分項、表格列的 `id` 可省略。型別定義在專案的 `src/model/types.ts`。

## 共通欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `type` | 字串，必填 | 文種：`函` `書函` `令` `公告` `開會通知單` `催辦案件通知單` `簽` `議案關係文書` `審查報告對照表` `糾正案` `會議紀錄` `簽到表` `概算書` |
| `direction` | `上行`／`平行`／`下行`／`斜行` | 行文方向，決定稱謂（鈞／貴／大）與期望語是否恰當；預設 `平行` |
| `sender` | `{ name, code? }` | 發文機關（`code` 為機關代碼，選填） |
| `senderAddress` | 字串 | 發文機關地址 |
| `contact` | `{ person, phone, email, fax }` | 承辦人、連絡電話、電子信箱、傳真（空白的不會印） |
| `recipient` | `{ name, code? }` | 受文者（簽是「敬陳」對象，印在文末） |
| `date` | `YYYY-MM-DD` | 發文日期（西元格式，輸出時自動轉民國年）；簽的欄位名稱是「日期」 |
| `docNumber` | 字串 | 發文字號，例：`會字第1151109001號`；也是匯出檔名 |
| `urgency` | `""`／`普通件`／`速件`／`最速件` | 速別 |
| `secrecy` | `""`／`密`／`機密`／`極機密`／`絕對機密` | 密等；公開文件請留空 |
| `attachments` | 字串 | 附件說明；沒有附件留空（填「無」也可，會印出「附件：無」） |
| `limit` | `YYYY-MM-DD` | 限期辦理（選填）。**要寫進主旨**（例「…，於115年11月20日前辦理，請查照。」），`urgency` 留空 |
| `subject` | 字串 | 主旨（議案稱案由）；**一段、不換行**，函與書函結尾要有期望語 |
| `explanation` | 分項陣列 | 說明（公告為「依據」、開會通知單為「報告事項」） |
| `measures` | 分項陣列 | 辦法（公告為「公告事項」或「說明」、簽為「擬辦」、開會通知單為「討論事項」） |
| `primaryRecipients` | 字串 | 正本受文者，以「、」分隔 |
| `ccRecipients` | 字串 | 副本受文者，以「、」分隔 |
| `signature` | `{ enabled, title, name, font }` | 文末簽名；`font` 為 `yuji-boku`（預設）、`kai`、`default` |
| `archive` | `{ fileNo, retention }` | 檔號與保存年限（函頭右上角，函類預設會印空白欄位） |

## 分項（`explanation`、`measures`）

```json
[
  { "level": 0, "text": "依據貴單位115年11月1日○○字第○○○號函辦理。" },
  { "level": 0, "text": "辦理方式如下：" },
  { "level": 1, "text": "第一項。" },
  { "level": 1, "text": "第二項。" }
]
```

- `level` 0＝「一、」，1＝「(一)」，2＝「１、」（全形），3＝「(１)」（全形），4＝「甲、」，5＝「(甲)」。
- 編號由程式自動產生，**不要在 `text` 裡自己寫編號**。層級不能跳級（跳級時程式自動降到上一層加一）。
- 只有一項時也可以編號；空白的項目匯出時會略過。

## 開會通知單：`meeting`

| 欄位 | 說明 |
|---|---|
| `reason` `time` `place` `chair` `contact` | 開會事由、時間、地點、主持人、聯絡人及電話 |
| `attendees` `observers` | 出席者、列席者 |
| `remarks` | 備註；一行一點，匯出時自動加「一、」「二、」 |
| `agenda` | 議程頁標題，一行一列；有填議程標題、報告事項（`explanation`）或討論事項（`measures`）時，另起第二頁印議程 |
| `onLeave` `absent` `recorder` | 會議紀錄用：請假者、缺席者、記錄人員 |

## 議案關係文書與審查報告對照表：`motion`

| 欄位 | 說明 |
|---|---|
| `term` | 屆別，例 `十四`（頁首顯示「學生議會第十四屆」） |
| `proposer` `cosigners` | 提案人；連署人以空白或頓號分隔（黨團提案留空） |
| `draftTitle` | 草案名稱 |
| `mode` | `修正`（修正條文｜現行條文｜說明）或 `新訂`（條文｜說明） |
| `rows` | 草案對照表的列：`{ amended, current, reason, proposals? }`。修正案中 `amended` 空白＝刪除該條、`current` 空白＝新增條文 |
| `reviewer` `proposalNames` | 審查報告對照表：審查會名稱、併案審查的各提案名稱（一個提案一欄，`rows[].proposals` 依序對應） |

可用 `dh law 法規.txt` 把法規文字解析成條文，再放進 `rows`。

## 會議紀錄：`minutes`

`{ opening, speech, agendaNote, cases: [{ proposer, subject, explanation, resolution }], extempore }`——開會時刻、主席致詞、議程說明、各討論案（說明與決議一行一點）、臨時動議。另用 `meeting` 填會議名稱、時間、地點、主席、出席請假缺席列席與記錄人員。

## 概算書：`budget`

`{ year, period, editor, duties, divisions, purpose, tableTitle, items: [{ unit, name, code, amount, note }] }`——學年度、起訖期間、編製單位、前言三段、概算表標題與各項目；`amount` 為元，可含千分位逗號，合計自動計算；`unit` 與上一列相同時表格只印第一列。

## 最小稿件範例

```json
{
  "type": "函",
  "sender": { "name": "○○機關" },
  "recipient": { "name": "○○單位" },
  "date": "2026-11-09",
  "subject": "檢送○○一案，請查照。",
  "explanation": [{ "level": 0, "text": "依據貴單位來函辦理。" }],
  "attachments": "○○1份"
}
```
