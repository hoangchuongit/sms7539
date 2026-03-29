# CLAUDE.MD — SMS7 Viewer

> AI knowledge base: Đọc file này trước khi trả lời bất kỳ câu hỏi nào về project.

---

## 🧠 MENTAL MODEL

**SMS7 Viewer là gì?**
Một dashboard web đơn giản để xem và phân tích dữ liệu SMS từ một API nội bộ. Người dùng chọn máy (machine), nhập API key, bấm gửi → hệ thống hiển thị thống kê tổng và thống kê riêng cho máy đó.

**Flow chính trong 5 dòng:**
1. User chọn preset machine (liu1/2/3) → form tự điền API key + user_id
2. User bấm "Gửi" → `fetchData()` gọi GET `/api/sms7539` với header `x-api-key`
3. Response trả về JSON array → parse từng item, extract `user_id` từ field `sms`
4. Chia data thành 2 tập: **allItems** (toàn bộ) và **machineItems** (lọc theo user_id)
5. Render 4 section: Machine Info | All Stats | Machine Stats | Bảng so sánh chi tiết

---

## I. TỔNG QUAN HỆ THỐNG

| Mục | Giá trị |
|-----|---------|
| Mục đích | Dashboard thống kê dữ liệu SMS từ API, so sánh toàn hệ thống vs từng máy |
| Kiến trúc | Client-Side SPA — Vanilla JS, không framework |
| Backend | Không có — gọi thẳng API ngoài |
| Ngôn ngữ | JavaScript + HTML + CSS (thuần) |
| Ngôn ngữ UI | Tiếng Việt |
| Tổng LOC | ~1,136 (JS: 430, CSS: 551, HTML: 155) |

---

## II. CẤU TRÚC PROJECT

```
sms7539/
├── index.html    # Toàn bộ UI structure (155 lines)
├── script.js     # Toàn bộ business logic (430 lines)
└── style.css     # Dark theme + responsive layout (551 lines)
```

**Không có:** build tool, framework, package.json, backend, database.

---

## III. CÁC MODULE CHÍNH

### 3.1 Preset Configuration (index.html)

3 máy được hard-code trong HTML buttons:

| Machine | API Key | User ID | IP/Pass |
|---------|---------|---------|---------|
| `liu1` | `1c93e27bb1264f2abd53a1b908b055a6` | `a70bd27b-e1f4-4bd2-ad7e-7cd3bd3776e7` | IP: 192.168.50.187 |
| `liu2` | `96ef7f2a9f80448d87e8cb1efe91eee0` | `3ff1c0e1-2023-4a24-9080-11f193c56a63` | IP: 192.168.30.47 |
| `liu3` | `3843112f32de4be68b027ad09b1ca14f` | `89f20e70-383d-4674-a2ad-c3d78ccd2d54` | Pass: 802165502084 |

Default selection: `liu2`

### 3.2 API Layer (`fetchData()` — script.js:339-429)

- Endpoint: `https://luckburn.mobi/api/sms7539`
- Method: GET
- Auth: Header `x-api-key`
- Cache busting: query param `t={Date.now()}`
- Disable submit button trong khi chờ response
- Trả về JSON array của SMS items

### 3.3 Data Processing (`renderResult()` — script.js:204-337)

**Bước 1:** Validate response là array
**Bước 2:** Parse `user_id` từ mỗi item — gắn vào `item.__userId`
**Bước 3:** Tách thành 2 tập:
- `allItems` = toàn bộ data
- `machineItems` = filter `item.__userId === selectedUserId`

**Bước 4:** Tính toán cho cả 2 tập:
- `countByAmount()` — đếm theo `amount_tk`
- `calcTotalAmount()` — tổng tiền
- `getTopAmountChips()` — top 6 amount phổ biến

**Bước 5:** Render HTML 4 sections → inject vào `#result`

### 3.4 Rendering Functions (script.js)

| Function | Mục đích |
|----------|---------|
| `buildStatsSection()` | Render 1 card thống kê với hero stats + chips |
| `buildAmountRows()` | Render rows bảng theo amount distribution |
| `buildTopChips()` | Render chips top amounts |
| `formatNumber()` | Format số theo locale vi-VN |
| `escapeHtml()` | XSS protection |
| `sortAmountKeys()` | Sort: số trước (tăng dần), string sau |

---

## IV. DATA FLOW

```
[User Input]
  └─ API Key + User ID (từ preset hoặc manual)
       │
       ▼
[fetchData()]
  ├─ Validate inputs
  ├─ GET luckburn.mobi/api/sms7539
  │   Header: x-api-key
  └─ JSON response: Array<SmsItem>
       │
       ▼
[renderResult(data)]
  ├─ Parse user_id từ sms field của mỗi item
  ├─ allItems = tất cả (áp dụng exclusion rules)
  ├─ machineItems = filter theo __userId
  └─ Render → #result div
```

### Cấu trúc 1 SMS Item (ước tính từ code)

```json
{
  "sms": "some_data || user_id_uuid || extra_data",
  "amount_tk": 100,
  "__userId": "user_id_uuid"   // được gắn thêm bởi renderResult()
}
```

---

## V. BUSINESS RULES (CRITICAL)

### 5.1 Exclusion Rules

```javascript
// 1. Item bị loại hoàn toàn khỏi mọi tính toán nếu:
item.sms.includes("|| t")   // shouldExcludeItem()

// 2. Amount bị loại khỏi phép tính tổng nếu:
EXCLUDED_TOTAL_VALUES = new Set([401, 403, 404])
// (Các giá trị này là HTTP error codes xuất hiện trong amount field)
```

### 5.2 Parse User ID từ SMS

```javascript
// parseUserIdFromSms(sms):
sms.split("||")[1]?.trim()
// SMS format: "data || USER_ID || ..."
// Lấy segment index 1 (zero-based) → user_id
```

### 5.3 Tính tổng amount

```
calcTotalAmount(items):
  - Bỏ qua item có "|| t" trong sms
  - Bỏ qua amount_tk ∈ {401, 403, 404}
  - Bỏ qua amount_tk không phải số hợp lệ
  - Cộng dồn phần còn lại
```

### 5.4 Filtering máy

```
machineItems = allItems.filter(item => item.__userId === selectedUserId)
```
`selectedUserId` lấy từ input field `#userId` trên UI.

---

## VI. API / COMMUNICATION

### Endpoint duy nhất

```
GET https://luckburn.mobi/api/sms7539
Headers:
  x-api-key: <api_key>
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
Query:
  t={Date.now()}   // cache busting
```

**Response:** JSON array, mỗi item có ít nhất `sms` (string) và `amount_tk` (number).

---

## VII. ERROR HANDLING

| Layer | Xử lý |
|-------|-------|
| Form validation | Thiếu API key hoặc user_id → show error, không gửi request |
| HTTP error | Status không phải 2xx → hiển thị status code + message |
| JSON parse error | Response không phải valid JSON → thông báo rõ |
| Data validation | Response không phải array → báo lỗi |
| Network error | try/catch tổng → hiển thị error message |

**Không có retry/backoff.** Lỗi → hiển thị → user tự thử lại.

Status badge: `idle → loading → success/error`

---

## VIII. CONCURRENCY / ASYNC

- **Async/await** trong `fetchData()`
- **Không có race condition** vì submit button bị disabled trong khi request đang chạy
- **Single-threaded** (browser JS), không có worker hay parallel request
- Không có state management phức tạp — chỉ DOM manipulation trực tiếp

---

## IX. CONFIG & ENVIRONMENT

| Config | Giá trị |
|--------|---------|
| API URL | `https://luckburn.mobi/api/sms7539` (hard-code trong script.js) |
| Excluded amounts | `[401, 403, 404]` (hard-code) |
| Excluded sms pattern | `"|| t"` (hard-code) |
| Top chips limit | `6` (default param) |
| Locale | `vi-VN` |

**Không có .env, không có config file** — mọi thứ hard-code trong source.

---

## X. LOGGING & DEBUG

- Chỉ có `console.error(error)` khi fetch fail
- Không có logging framework
- **Cách debug nhanh nhất:** Mở DevTools → Network tab → xem request/response của API call
- Lỗi đều được render trực tiếp lên UI trong `#result`

---

## XI. ANTI-BUG / RISK ANALYSIS

### Chỗ dễ bug nhất

1. **Parse user_id từ SMS** (`parseUserIdFromSms`)
   - Giả định SMS luôn có format `"... || user_id || ..."` với đúng dấu `||`
   - Nếu format thay đổi → `machineItems` sẽ luôn rỗng (không báo lỗi rõ)
   - **Dấu hiệu bug:** Machine Stats luôn hiển thị 0 items

2. **Hard-coded API keys trong HTML**
   - API keys của 3 máy visible trong source code
   - Ai cũng có thể inspect element và lấy key
   - **Rủi ro:** Không phải lỗi logic nhưng là security risk

3. **Exclusion rule "|| t"**
   - `shouldExcludeItem()` check `sms.includes("|| t")` — dễ false positive nếu sms hợp lệ chứa chuỗi này
   - Không rõ tại sao "|| t" được exclude — **chưa xác định nguồn gốc rule này**

4. **Amount 401/403/404**
   - Các giá trị này bị exclude khỏi tổng tiền nhưng **vẫn được đếm** trong `countByAmount()`
   - Có thể gây nhầm lẫn: object count ≠ count trong bảng chi tiết

5. **Không validate amount_tk type trong countByAmount()**
   - `calcTotalAmount()` có check `isValidAmount()` nhưng `countByAmount()` không check
   - Nếu `amount_tk` là string/null → có thể tạo key lạ trong counter

6. **innerHTML injection**
   - Nhiều chỗ dùng `innerHTML` để render
   - `escapeHtml()` đã được dùng cho data từ API — đủ an toàn
   - Nhưng nếu quên escape một field mới nào đó → XSS

### Assumption nguy hiểm

- API luôn trả về array (không handle case trả về object hay null gracefully trong mọi path)
- SMS format cố định với `||` separator — không có fallback
- Mỗi user_id là unique identifier đủ để phân biệt máy

---

## XII. HOW TO WORK WITH THIS PROJECT

### Thêm feature mới

1. **Thêm preset machine:** Vào `index.html`, copy 1 button preset, thêm `data-*` attributes, cập nhật `setApiPreset()` nếu cần field mới
2. **Thêm calculation mới:** Thêm function trong `script.js`, gọi trong `renderResult()`, render trong `buildStatsSection()` hoặc tạo section mới
3. **Thêm field hiển thị:** Cập nhật `renderResult()` để đọc field mới từ API response

### Debug

1. **Data không hiển thị đúng:** Xem `renderResult()` — trace từ `allItems` → `machineItems` → render
2. **Machine stats luôn 0:** Kiểm tra `parseUserIdFromSms()` — log `item.__userId` và `selectedUserId` để so sánh
3. **Tổng tiền sai:** Kiểm tra `calcTotalAmount()` — xem exclusion rules có đang filter quá mạnh không
4. **API lỗi:** Xem Network tab trong DevTools — check response status và body

### Fix bug

- Bug liên quan **filtering** → `parseUserIdFromSms()` và `renderResult()` lines 224-225
- Bug liên quan **tính toán** → `calcTotalAmount()`, `countByAmount()`
- Bug liên quan **hiển thị** → `buildStatsSection()`, `buildAmountRows()`, `buildTopChips()`
- Bug liên quan **API** → `fetchData()`

---

## XIII. LAYOUT UI (REFERENCE NHANH)

```
[Topbar: SMS7 Viewer]
[Control Card]
  ├─ [liu1] [liu2] [liu3]  ← Preset buttons
  ├─ Machine dropdown | User ID (readonly)
  ├─ API Key input
  └─ [Gửi] [Xóa kết quả]
[Status Badge: idle/loading/success/error]
[#result]
  ├─ Machine Info Card
  ├─ All System Stats Card
  ├─ Machine Query Stats Card (highlighted)
  └─ Detailed Comparison Table
```

---

## XIV. CSS DESIGN TOKENS

| Variable | Giá trị | Dùng cho |
|----------|---------|---------|
| `--bg` | `#0f172a` | Background chính |
| `--primary` | `#38bdf8` | Accent color (cyan) |
| `--success-*` | Green | Status success |
| `--error-*` | Red | Status error |

Breakpoints: `900px` (2-col → 1-col), `640px` (mobile)

---

*File này được tạo tự động bởi Claude. Cập nhật khi có thay đổi logic quan trọng.*
