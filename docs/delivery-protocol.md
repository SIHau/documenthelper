# StudentGov 公文送達協定 v1（P1）

本文件定義 StudentGov 各機關之間傳送公文時使用的**事件格式、文件包、簽章與 Receipt**。
參考實作在 `src/protocol/`，測試在 `src/protocol/protocol.test.ts`。

目標只有一個：任何人拿到一個 `.sgdoc` 文件包，不需要連上任何伺服器，就能回答三個問題：

1. **文件完整**：內容有沒有被改過？
2. **來源**：是誰、用哪一把鑰匙發的？
3. **已正式送達**：收文方有沒有簽收？什麼時候？

加密、中繼伺服器、OIDC 登入與角色授權（Role / Policy）不在 P1 範圍，見文末〈留給 P2〉。

## 1. 基本規則

### 1.1 標準化 JSON

所有要計算 hash 或簽章的 JSON 都先依 [RFC 8785（JCS）](https://www.rfc-editor.org/rfc/rfc8785) 標準化：

- 物件的鍵依 UTF-16 code unit 排序；
- 數字用 ECMAScript 的最短表示法（`4.50` → `4.5`，`1E30` → `1e+30`）；
- 不允許 `NaN`、`Infinity`、`undefined` 以外的非 JSON 值；值為 `undefined` 的鍵直接省略；
- 輸出為 UTF-8 位元組。

### 1.2 識別碼

| 種類 | 格式 | 計算方式 |
| --- | --- | --- |
| 金鑰 | `ed25519:<base64url 公鑰>` | Ed25519 公鑰 32 位元組，base64url 不補 `=` |
| 文件 | `doc:sha256:<hex>` | `manifest.json` 的 JCS 位元組做 SHA-256 |
| 事件 | `event:sha256:<hex>` | 事件**未簽章部分**（§2.1）的 JCS 做 SHA-256 |
| 檔案 | `sha256:<hex>` | 檔案原始位元組做 SHA-256 |

事件 id 不含 `sig` 與 `witness`，所以中繼補上見證後，事件 id 不變。

### 1.3 簽章

- 演算法：Ed25519（RFC 8032），使用經過稽核的 `@noble/curves`，不自行實作密碼學。
- 簽章一律加上用途前綴（domain separation），避免一種簽章被拿去冒充另一種：

  ```
  簽章內容 = UTF-8( <用途> + "\n" + <JCS 字串> )
  ```

  | 用途 | 簽什麼 |
  | --- | --- |
  | `studentgov/event/v1` | 事件未簽章部分 |
  | `studentgov/witness/v1` | `{ "event": <事件 id>, "relay": <中繼>, "at": <時間> }` |

- 簽章值以 base64url（不補 `=`）表示。

### 1.4 時間

時間一律為 ISO 8601 字串並帶時區，例：`2026-10-14T09:00:00+08:00` 或 `2026-10-14T01:00:00Z`。
比較時換算成同一時刻後再比較。

行為人自報的時間（`claimedAt`）只供參考；**正式時間以中繼見證的 `witness.at` 為準**。

## 2. 事件

公文的每一個狀態變化都是一筆簽章事件。狀態本身不另外儲存，而是由事件推導（§5）。

### 2.1 格式

```jsonc
{
  "v": 1,                                   // 協定版本
  "type": "doc.received",                   // 事件類型，見 §2.2
  "subject": "doc:sha256:…",                // 文件 id
  "actor": "person:google:1043…",           // 行為人；中繼為 relay:<名稱>
  "actorKey": "ed25519:…",                  // 簽章用的裝置鑰
  "asRole": "organ:student-council/clerk",  // 選填：以什麼身分行為（P2 起驗證）
  "policy": "policy:sha256:…",              // 選填：依據的治理規則版本（P2）
  "prev": ["event:sha256:…"],               // 本機已知的最新事件；發文事件為 []
  "claimedAt": "2026-10-14T11:00:00+08:00", // 行為人自報時間
  "body": { "receiptNumber": "會收字第1151014003號" },
  // 以上為「未簽章部分」，以下不在簽章範圍內
  "sig": "<base64url>",
  "witness": {                              // 選填：中繼的時間見證
    "relay": "relay:studentgov",
    "relayKey": "ed25519:…",
    "at": "2026-10-14T03:00:02Z",
    "sig": "<base64url>"
  }
}
```

驗證時只取上列欄位計算 id 與簽章；多出來的欄位一律忽略，不會進入簽章範圍。

### 2.2 事件類型

| 類型 | 名稱 | 誰可以做 | 何時可以做 | `body` 必填 |
| --- | --- | --- | --- | --- |
| `doc.sent` | 發文 | 發文方 | 每份文件恰好一筆，`prev` 為空 | `to`（收文者名稱陣列） |
| `doc.delivered` | 送達 | 收文方或中繼 | 已發文之後 | — |
| `doc.received` | 收文 | 收文方 | 已發文或已送達 | 選填 `receiptNumber` |
| `doc.assigned` | 分派 | 收文方 | 已收文、已分派 | `assignee` |
| `doc.progress` | 處理進度 | 收文方 | 已收文、已分派、處理中 | 選填 `note` |
| `doc.replied` | 回覆 | 收文方 | 已收文、已分派、處理中 | `reply`（回覆公文的 `doc:sha256:` id） |
| `doc.closed` | 結案 | 發文方 | 已回覆 | — |
| `doc.withdrawn` | 撤回 | 發文方 | 正式收文之前 | — |
| `doc.returned` | 退文 | 收文方 | 正式收文之前或剛收文時 | `reason` |

「發文方」指發文事件的 `actor`；其他行為人都視為收文方。P1 只做這個二分法，
「誰屬於收文機關、誰可以代表機關簽收」在 P2 以 Role 與 Policy 驗證。

### 2.3 兩種 Receipt

送達與收文刻意分成兩筆事件：

- **`doc.delivered` 送達 Receipt**：機器簽發。中繼或收文方裝置在文件進入收文信箱時自動產生，
  證明「文件到了」，不代表有人看過。
- **`doc.received` 收文 Receipt**：人簽發。收文承辦人簽收並可填入收文文號 `receiptNumber`，
  處理時限自此起算。驗證報告中的「已正式送達」以這一筆為準。

收文事件可以先於送達事件出現（例如收文方離線簽收後才同步）。晚到的送達 Receipt 仍然有效，但不會讓狀態倒退，
驗證報告會標記為「有效但沒有改變狀態」。

### 2.4 中繼見證

中繼收到事件時簽署 `{event, relay, at}`，附在事件的 `witness` 欄位。見證不改變事件 id；
同一筆事件若同時有見證與未見證的副本，合併時保留有見證的那一份。

## 3. 清單（manifest）

清單描述文件包內的每一個檔案，並由文件 id 綁定。

```jsonc
{
  "v": 1,
  "type": "studentgov.document",
  "docType": "函",
  "title": "檢送會議紀錄，請查照。",       // 主旨
  "docNumber": "議字第1151014001號",       // 選填
  "from": { "name": "學生議會", "code": "SC01" },
  "to": [{ "name": "學生會" }, { "name": "選舉委員會" }],
  "files": [
    { "path": "content.json", "role": "content", "mediaType": "application/vnd.documenthelper.document+json", "size": 812, "sha256": "sha256:…" },
    { "path": "document.pdf", "role": "rendering", "mediaType": "application/pdf", "size": 48213, "sha256": "sha256:…" },
    { "path": "attachments/紀錄.pdf", "role": "attachment", "mediaType": "application/pdf", "size": 10240, "sha256": "sha256:…" }
  ],
  "generator": { "name": "documenthelper", "version": "0.1.0" },
  "createdAt": "2026-10-14T09:00:00+08:00"
}
```

- `role`：`content` 是可機器讀取的公文內容，**恰好一個**；`rendering` 是給人看的版本（PDF）；`attachment` 是附件。
- `path` 不得以 `/` 開頭、不得含 `..`、不得重複。
- 公文小幫手產生的 `content.json` 是 `OfficialDocument` 的 JCS。

發文事件的 `subject` 就是清單的文件 id，所以發文簽章同時涵蓋了清單與清單列出的每個檔案 hash。
改動清單任何一個字（例如主旨），文件 id 就會改變，原本的發文簽章不再屬於這份文件。

## 4. 文件包（`.sgdoc`）

副檔名 `.sgdoc`，媒體類型 `application/vnd.studentgov.document+zip`，是一般的 zip 檔：

```
manifest.json            清單的 JCS 位元組
content.json             公文內容
document.pdf             給人看的版本
attachments/…            附件
events/<hex>.json        每筆事件一個檔案，檔名是事件 id 的 hex 部分
```

- 檔案時間固定為 2000-01-01，同樣的內容會產生完全相同的位元組。
- 文件包可以隨時加入新事件（收文、分派、回覆……）再傳下去；舊事件不會被改動。
- 讀取時清單以檔案中的位元組重新計算文件 id，不信任任何外部宣稱的 id。

## 5. 狀態推導

```
已發文 → 已送達 → 已正式收文 → 已分派承辦 → 處理中 → 已回覆 → 結案
   └──────┴→ 已撤回（發文方，收文前）
   └──────┴──────────┴→ 已退文（收文方，須附理由）
```

任何裝置拿到同一組事件，都必須算出同樣的結果：

1. 以事件 id 去重。
2. 逐筆檢查：協定版本、事件類型、`subject` 是否為本文件、簽章、見證簽章（如有）、`prev` 指向的事件是否都在。
3. 依 `prev` 做拓撲排序；同一層的事件依見證時間（無見證則用自報時間）排序，再以事件 id 排序。
4. 依序套用 §2.2 的規則。違反規則、或 `prev` 指向無效事件的事件標記為無效，不影響狀態。

無效事件不會被丟掉，而是連同原因一起列在驗證報告中，例如：

- 「簽章無效」「事件指向另一份文件」「缺少前一筆事件（prev）」「前一筆事件無效」
- 「同一份文件只能有一筆發文事件」
- 「只有發文方可以做這件事」「發文方不能替收文方做這件事」
- 「目前狀態是「已正式收文」，不能撤回」
- 「退文必須附理由（body.reason）」

## 6. 驗證報告

`verifyPackage(pkg)` 產生三項檢查：

| 檢查 | 通過條件 |
| --- | --- |
| 文件完整 | 清單列出的每個檔案都在，大小與 SHA-256 相符；沒有清單外的檔案（`events/` 除外） |
| 來源 | 有一筆有效的發文事件；報告列出發文者、金鑰、身分與時間（有見證時用見證時間） |
| 已正式送達 | 推導出的狀態已經到「已正式收文」或之後（且不是撤回或退文）；報告列出送達與收文 Receipt |

## 7. 留給 P2 以後

- **身分與授權**：`actorKey` 由誰背書（OIDC 登入後簽發裝置鑰）、`asRole` 與 `policy` 的驗證、機關成員名冊。
  P1 只證明「這把鑰匙簽了這件事」，不證明「這把鑰匙屬於學生會秘書」。
- **加密**：文件包對收文機關加密；P1 的文件包是明文。
- **中繼伺服器**：收文信箱、見證服務、事件同步。P1 只定義見證的格式與驗證。
- **期限**：處理期限、逾期提醒、擬制送達（收文方遲遲不簽收時，以送達 Receipt 起算）。
- **金鑰輪替與撤銷**。

## 8. 版本

本協定版本為 `v: 1`。不相容的變更會遞增版本號並使用新的簽章用途字串（例如 `studentgov/event/v2`），
讓舊版簽章不可能被誤認為新版。
