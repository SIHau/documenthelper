# 文種對照

先用 `dh types` 看程式實際的欄位設定；本表說明各文種的用途與要填的欄位。

| 文種 | 用途 | 要填的欄位 |
|---|---|---|
| 函 | 機關間行文（上行、平行、下行皆可）；最常用 | 發文機關、受文者、發文日期、發文字號、速別、`subject`（期望語結尾）、`explanation`、`measures`（可省）、附件、正本、副本、簽名 |
| 書函 | 較簡單的事務性行文，欄位同函 | 同函 |
| 令 | 發布、任免、獎懲等；發文日期與字號排在受文者之前 | `subject` 可省，只寫本文（`explanation`）；受文者可省 |
| 公告 | 對外公開周知；沒有受文者 | `subject`、`explanation`（依據）、`measures`（公告事項／說明）；結尾「特此公告。」 |
| 開會通知單 | 召集會議；沒有主旨與說明 | `meeting.*`（事由、時間、地點、主持人、聯絡人、出席者、列席者、備註）；議程用 `meeting.agenda`、`explanation`（報告事項）、`measures`（討論事項） |
| 催辦案件通知單 | 催辦案件 | `subject`、正本、副本 |
| 簽 | 內部對上級簽請核示；受文者印在文末「敬陳」 | `subject`、`explanation`、`measures`（擬辦）、`recipient`、簽名 |
| 議案關係文書 | 學生議會議案（提案、連署、草案對照表） | `motion.*`、`subject`（案由）、`explanation`（說明） |
| 審查報告對照表 | 審查會通過條文與各併案提案、現行條文的對照 | `motion.reviewer`、`motion.proposalNames`、`motion.rows`、`motion.draftTitle` |
| 糾正案 | 糾正機關 | `recipient`（被糾正機關）、`subject`（案由）、`explanation`（事實與理由）、提案人 |
| 會議紀錄 | 會議紀錄 | `meeting.*`、`minutes.*` |
| 簽到表 | 會議簽到 | `meeting.*`（會議名稱與日期）、`sender` |
| 概算書 | 預算概算 | `budget.*` |

後六種是學生議會專用格式（依板橋高中學生議會樣張），一般機關公文請用前面幾種。

## 內建範本（`dh templates show <id>`）

通用：`send`（檢送資料）、`reply`（函復）、`request`（請求協助）、`meeting`（開會通知單）、`announce`（一般公告）、`memo`（簽請核示）。
學生議會：`council-letter` `speaker-order` `speaker-order-plain` `appointment` `secretary-letter` `council-announce` `council-meeting` `council-urge` `council-review` `council-correction` `council-minutes` `council-signin` `council-budget` `motion-members` `motion-caucus`。

範本內容以「○」標示待填處，用範本起稿後要逐一補齊。
