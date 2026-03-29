const API_URL = "https://luckburn.mobi/api/sms7539";

const EXCLUDED_TOTAL_VALUES = new Set([401, 403, 404]);

function setApiPreset({ key, label, userId, ip }) {
  document.getElementById("apikey").value = key || "";
  document.getElementById("selectedLabel").value = label || "";
  document.getElementById("selectedUserId").value = userId || "";

  const ipText = ip ? ` (${ip})` : "";
  setStatus("idle", `Đã chọn ${label}${ipText}. Sẵn sàng gửi request.`);
  fetchOverview();
}

function clearResult() {
  document.getElementById("result").innerHTML = "";
  setStatus("idle", "Đã xóa kết quả hiển thị.");
}

function setStatus(type, text) {
  const badge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");

  badge.className = `status-badge ${type}`;

  if (type === "loading") badge.textContent = "Đang tải";
  else if (type === "success") badge.textContent = "Thành công";
  else if (type === "error") badge.textContent = "Lỗi";
  else badge.textContent = "Sẵn sàng";

  statusText.textContent = text;
}

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return String(value);
  return value.toLocaleString("vi-VN");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sortAmountKeys(keys) {
  return keys.sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);

    const aIsNum = !Number.isNaN(aNum);
    const bIsNum = !Number.isNaN(bNum);

    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;

    return String(a).localeCompare(String(b), "vi");
  });
}

function parseUserIdFromSms(sms) {
  if (typeof sms !== "string") return "";
  const parts = sms
    .split("||")
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 2) return "";
  return parts[1] || "";
}

function isValidAmount(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function shouldExcludeItem(item) {
  const sms = typeof item?.sms === "string" ? item.sms : "";
  return sms.includes("|| t");
}

function calcTotalAmount(items) {
  let total = 0;
  for (const item of items) {
    const value = item?.amount_tk;
    if (shouldExcludeItem(item)) continue;
    if (isValidAmount(value) && !EXCLUDED_TOTAL_VALUES.has(value)) {
      total += value;
    }
  }
  return total;
}

function countByAmount(items) {
  const counter = {};
  for (const item of items) {
    if (shouldExcludeItem(item)) continue;

    const rawVal = item?.amount_tk;
    const key = rawVal === null ? "null" : String(rawVal);
    counter[key] = (counter[key] || 0) + 1;
  }
  return counter;
}

function getTopAmountChips(counter, limit = 6) {
  const entries = Object.entries(counter).sort((a, b) => {
    const countDiff = b[1] - a[1];
    if (countDiff !== 0) return countDiff;

    const aNum = Number(a[0]);
    const bNum = Number(b[0]);
    const aIsNum = !Number.isNaN(aNum);
    const bIsNum = !Number.isNaN(bNum);

    if (aIsNum && bIsNum) return bNum - aNum;
    return String(a[0]).localeCompare(String(b[0]), "vi");
  });

  return entries.slice(0, limit);
}

function buildAmountRows(counter) {
  const amountKeys = sortAmountKeys(Object.keys(counter));

  return amountKeys
    .map((key) => {
      const displayKey = key === "null" ? "null" : key;
      return `
        <tr>
          <td>${escapeHtml(displayKey)}</td>
          <td>${formatNumber(counter[key])}</td>
        </tr>
      `;
    })
    .join("");
}

function buildTopChips(counter) {
  const topItems = getTopAmountChips(counter);

  if (!topItems.length) {
    return `<div class="empty-inline">Không có dữ liệu amount_tk.</div>`;
  }

  return topItems
    .map(([amount, count]) => {
      const label = amount === "null" ? "null" : amount;
      return `
        <span class="chip">
          <span class="chip-amount">${escapeHtml(label)}</span>
          <span class="chip-count">${formatNumber(count)}</span>
        </span>
      `;
    })
    .join("");
}

function buildStatsSection({
  title,
  subtitle,
  objectCount,
  totalAmount,
  amountTypeCount,
  topChipsHtml,
  accentClass = "",
}) {
  return `
    <section class="card stats-section ${accentClass}">
      <div class="section-head">
        <div>
          <h2 class="table-head">${escapeHtml(title)}</h2>
          <p class="section-subtitle">${escapeHtml(subtitle)}</p>
        </div>
      </div>

      <div class="summary-grid summary-grid-2">
        <div class="stat-card stat-card-hero">
          <div class="stat-label">Tổng số object</div>
          <div class="stat-value">${formatNumber(objectCount)}</div>
        </div>

        <div class="stat-card stat-card-hero">
          <div class="stat-label">Tổng số tiền</div>
          <div class="stat-value">${formatNumber(totalAmount)}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Số loại amount_tk</div>
          <div class="stat-value">${formatNumber(amountTypeCount)}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Top amount_tk</div>
          <div class="chip-row">
            ${topChipsHtml}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderResult(data) {
  const resultDiv = document.getElementById("result");
  const selectedLabel = document.getElementById("selectedLabel").value.trim();
  const selectedUserId = document.getElementById("selectedUserId").value.trim();
  const now = new Date().toLocaleString("vi-VN");

  if (!Array.isArray(data)) {
    resultDiv.innerHTML = `
      <div class="card error-card">
        API trả về dữ liệu không hợp lệ. Dữ liệu mong đợi là một mảng JSON.
      </div>
    `;
    return;
  }

  const allItems = data.map((item) => ({
    ...item,
    __userId: parseUserIdFromSms(item?.sms),
  }));

  const machineItems = allItems.filter(
    (item) => item.__userId === selectedUserId,
  );

  const allCounter = countByAmount(allItems);
  const machineCounter = countByAmount(machineItems);

  const allAmountKeys = sortAmountKeys(Object.keys(allCounter));
  const machineAmountKeys = sortAmountKeys(Object.keys(machineCounter));

  const allTotalAmount = calcTotalAmount(allItems);
  const machineTotalAmount = calcTotalAmount(machineItems);

  const allRows = buildAmountRows(allCounter);
  const machineRows = buildAmountRows(machineCounter);

  const allSection = buildStatsSection({
    title: "Toàn bộ hệ thống",
    subtitle: `Thống kê trên tất cả object API trả về tại thời điểm ${now}.`,
    objectCount: allItems.length,
    totalAmount: allTotalAmount,
    amountTypeCount: allAmountKeys.length,
    topChipsHtml: buildTopChips(allCounter),
  });

  const machineSection = buildStatsSection({
    title: `Máy đang query: ${selectedLabel}`,
    subtitle: `Lọc riêng theo user_id: ${selectedUserId}`,
    objectCount: machineItems.length,
    totalAmount: machineTotalAmount,
    amountTypeCount: machineAmountKeys.length,
    topChipsHtml: buildTopChips(machineCounter),
    accentClass: "stats-section-highlight",
  });

  const machineInfoCard = `
    <section class="card info-strip">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Máy</span>
          <span class="info-value">${escapeHtml(selectedLabel)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">User ID</span>
          <span class="info-value info-value-break">${escapeHtml(selectedUserId)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Object khớp</span>
          <span class="info-value">${formatNumber(machineItems.length)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Thời điểm</span>
          <span class="info-value">${escapeHtml(now)}</span>
        </div>
      </div>
    </section>
  `;

  const tableSection = `
    <section class="card table-card">
      <div class="dual-table-head">
        <div>
          <h2 class="table-head">Chi tiết amount_tk</h2>
          <p class="section-subtitle">
            So sánh toàn bộ dữ liệu với phần dữ liệu thuộc máy đang query.
          </p>
        </div>
      </div>

      <div class="dual-table-grid">
        <div class="subtable-card">
          <h3 class="subtable-title">Toàn bộ hệ thống</h3>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>amount_tk</th>
                  <th>Số lượng</th>
                </tr>
              </thead>
              <tbody>
                ${allRows || `<tr><td colspan="2">Không có dữ liệu</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="subtable-card">
          <h3 class="subtable-title">Riêng máy đang query</h3>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>amount_tk</th>
                  <th>Số lượng</th>
                </tr>
              </thead>
              <tbody>
                ${machineRows || `<tr><td colspan="2">Không có dữ liệu khớp user_id</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;

  resultDiv.innerHTML = `
    ${machineInfoCard}
    ${allSection}
    ${machineSection}
    ${tableSection}
  `;
}

async function fetchData() {
  const apiKey = document.getElementById("apikey").value.trim();
  const selectedLabel = document.getElementById("selectedLabel").value.trim();
  const selectedUserId = document.getElementById("selectedUserId").value.trim();
  const submitBtn = document.getElementById("submitBtn");
  const resultDiv = document.getElementById("result");

  if (!apiKey) {
    setStatus("error", "Bạn chưa nhập API key.");
    resultDiv.innerHTML = `
      <div class="card error-card">
        Vui lòng nhập <code>x-api-key</code> trước khi gửi.
      </div>
    `;
    return;
  }

  if (!selectedUserId) {
    setStatus("error", "Bạn chưa chọn user_id cho máy đang query.");
    resultDiv.innerHTML = `
      <div class="card error-card">
        Vui lòng chọn đúng máy để có thể lọc dữ liệu theo <code>user_id</code>.
      </div>
    `;
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang gửi...";
    setStatus(
      "loading",
      `Đang gọi API cho ${selectedLabel} và lọc theo user_id ${selectedUserId}...`,
    );

    const url = `${API_URL}?t=${Date.now()}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-api-key": apiKey,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${rawText || "Request failed"}`,
      );
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error("Response không phải JSON hợp lệ.");
    }

    renderResult(data);

    const matchedCount = Array.isArray(data)
      ? data.filter((item) => parseUserIdFromSms(item?.sms) === selectedUserId)
          .length
      : 0;

    setStatus(
      "success",
      `Lấy dữ liệu thành công cho ${selectedLabel}. Tổng object toàn bộ: ${
        Array.isArray(data) ? data.length : 0
      }. Object của máy này: ${matchedCount}.`,
    );
  } catch (error) {
    console.error(error);

    setStatus("error", error.message);

    resultDiv.innerHTML = `
      <div class="card error-card">
        <strong>Không thể lấy dữ liệu.</strong><br><br>
        Chi tiết: ${escapeHtml(error.message)}<br><br>
        Nếu đổi API key nhưng dữ liệu vẫn không đổi thì thường là phía API hoặc proxy đang bỏ qua <code>x-api-key</code>.
      </div>
    `;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Gửi";
  }
}

// ============================================================
// GLOBAL OVERVIEW — Failed / Pending / Payout APIs
// ============================================================

let _prevFailedCount = null;
let _prevExistCount = null;
let _prevRutCount = null;
let _autoRefreshTimer = null;

function getOverviewApiKey() {
  return (
    document.getElementById("apikey").value.trim() ||
    "1c93e27bb1264f2abd53a1b908b055a6"
  );
}

async function fetchOverview() {
  const apiKey = getOverviewApiKey();
  const btn = document.getElementById("overviewRefreshBtn");
  const updatedEl = document.getElementById("overviewUpdated");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "↻ Đang tải...";
  }

  try {
    const headers = {
      "x-api-key": apiKey,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    };
    const t = Date.now();

    const [failedRes, existRes, rutRes] = await Promise.all([
      fetch(`${API_URL}/player-fail?t=${t}`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/exist?t=${t}`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/player-rut?t=${t}`, { headers, cache: "no-store" }),
    ]);

    const parseJson = async (res) => {
      try {
        return res.ok ? await res.json() : [];
      } catch {
        return [];
      }
    };

    const [failedData, existData, rutData] = await Promise.all([
      parseJson(failedRes),
      parseJson(existRes),
      parseJson(rutRes),
    ]);

    renderOverviewCards(failedData, existData, rutData);
    renderPayoutBreakdown(rutData);

    if (updatedEl) {
      updatedEl.textContent = `Cập nhật lúc: ${new Date().toLocaleString("vi-VN")}`;
    }
  } catch (err) {
    if (updatedEl) {
      updatedEl.textContent = `Lỗi tải tổng quan: ${escapeHtml(err.message)}`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "↻ Làm mới";
    }
  }
}

function renderOverviewCards(failedData, existData, rutData) {
  const failedCount = Array.isArray(failedData) ? failedData.length : 0;
  const existCount = Array.isArray(existData) ? existData.length : 0;
  const rutItems = Array.isArray(rutData) ? rutData : [];
  const rutCount = rutItems.length;
  const rutTotal = rutItems.reduce((sum, item) => {
    const v = item?.amount_tk;
    return typeof v === "number" && !Number.isNaN(v) ? sum + v : sum;
  }, 0);

  const failedDelta = buildDelta(_prevFailedCount, failedCount);
  const existDelta = buildDelta(_prevExistCount, existCount);
  const rutDelta = buildDelta(_prevRutCount, rutCount);

  _prevFailedCount = failedCount;
  _prevExistCount = existCount;
  _prevRutCount = rutCount;

  const failedVariant = failedCount > 0 ? "metric-card--danger" : "metric-card--ok";
  const failedSub = failedCount > 0 ? "⚠ Cần lưu ý" : "✓ Bình thường";

  document.getElementById("overviewGrid").innerHTML = `
    <div class="metric-card ${failedVariant}">
      <div class="metric-label">Failed Players</div>
      <div class="metric-value">${formatNumber(failedCount)}</div>
      <div class="metric-sub">${failedSub}${failedDelta ? `<br>${failedDelta}` : ""}</div>
    </div>

    <div class="metric-card metric-card--warning">
      <div class="metric-label">Pending — chưa gửi SMS</div>
      <div class="metric-value">${formatNumber(existCount)}</div>
      <div class="metric-sub">Đã đăng ký, đang chờ xử lý${existDelta ? `<br>${existDelta}` : ""}</div>
    </div>

    <div class="metric-card metric-card--success">
      <div class="metric-label">Sẵn sàng payout</div>
      <div class="metric-value">
        ${formatNumber(rutCount)}<span class="metric-value-unit"> players</span>
      </div>
      <div class="metric-sub">Tổng tiền: <strong>${formatNumber(rutTotal)}</strong> đ${rutDelta ? `<br>${rutDelta}` : ""}</div>
    </div>
  `;
}

function buildDelta(prev, current) {
  if (prev === null) return "";
  const delta = current - prev;
  if (delta > 0)
    return `<span class="metric-delta metric-delta--up">▲ +${delta} so với lần trước</span>`;
  if (delta < 0)
    return `<span class="metric-delta metric-delta--down">▼ ${Math.abs(delta)} giảm</span>`;
  return `<span class="metric-delta metric-delta--same">→ Không đổi</span>`;
}

function renderPayoutBreakdown(rutData) {
  const section = document.getElementById("payoutBreakdown");
  const content = document.getElementById("payoutBreakdownContent");

  const items = Array.isArray(rutData) ? rutData : [];

  if (!items.length) {
    section.style.display = "none";
    return;
  }

  // Group by amount_tk
  const groups = {};
  let totalPlayers = 0;
  let totalAmount = 0;

  for (const item of items) {
    const amount = item?.amount_tk;
    const key = typeof amount === "number" ? String(amount) : "null";
    if (!groups[key]) groups[key] = { count: 0, subtotal: 0 };
    groups[key].count++;
    if (typeof amount === "number" && !Number.isNaN(amount)) {
      groups[key].subtotal += amount;
      totalAmount += amount;
    }
    totalPlayers++;
  }

  const keys = sortAmountKeys(Object.keys(groups));

  const rows = keys
    .map((key) => {
      const g = groups[key];
      const displayKey =
        key === "null" ? "null" : formatNumber(Number(key));
      return `
        <tr>
          <td>${escapeHtml(displayKey)}</td>
          <td>${formatNumber(g.count)}</td>
          <td>${formatNumber(g.subtotal)}</td>
        </tr>
      `;
    })
    .join("");

  content.innerHTML = `
    <div class="payout-hero-row">
      <div class="payout-hero-card">
        <div class="stat-label">Tổng players</div>
        <div class="stat-value">${formatNumber(totalPlayers)}</div>
      </div>
      <div class="payout-hero-card payout-hero-card--accent">
        <div class="stat-label">Tổng tiền có thể payout</div>
        <div class="stat-value payout-amount-total">${formatNumber(totalAmount)} <span style="font-size:16px;font-weight:500">đ</span></div>
      </div>
    </div>
    <div class="table-scroll" style="margin-top: 14px">
      <table>
        <thead>
          <tr>
            <th>Mức tiền (amount_tk)</th>
            <th>Số players</th>
            <th>Tổng tiền</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="table-total-row">
            <td><strong>Tổng cộng</strong></td>
            <td><strong>${formatNumber(totalPlayers)}</strong></td>
            <td><strong>${formatNumber(totalAmount)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  section.style.display = "";
}

function toggleAutoRefresh(enabled) {
  if (_autoRefreshTimer) {
    clearInterval(_autoRefreshTimer);
    _autoRefreshTimer = null;
  }
  if (enabled) {
    _autoRefreshTimer = setInterval(fetchOverview, 60_000);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  fetchOverview();
  fetchData();
});