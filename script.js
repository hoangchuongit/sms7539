const API_URL = "https://luckburn.mobi/api/sms7539";

function setApiKey(key, label) {
  document.getElementById("apikey").value = key;
  document.getElementById("selectedLabel").value = label;
  setStatus("idle", `Đã chọn ${label}. Sẵn sàng gửi request.`);
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

function renderResult(data) {
  const resultDiv = document.getElementById("result");

  if (!Array.isArray(data)) {
    resultDiv.innerHTML = `
      <div class="card error-card">
        API trả về dữ liệu không hợp lệ. Dữ liệu mong đợi là một mảng JSON.
      </div>
    `;
    return;
  }

  const counter = {};

  for (const item of data) {
    const rawVal = item?.amount_tk;
    const key = rawVal === null ? "null" : String(rawVal);
    counter[key] = (counter[key] || 0) + 1;
  }

  const excluded = new Set([401, 403, 404]);

  let totalCurrent = 0;
  for (const item of data) {
    const value = item?.amount_tk;
    if (typeof value === "number" && !excluded.has(value)) {
      totalCurrent += value;
    }
  }

  const now = new Date().toLocaleString("vi-VN");
  const amountKeys = sortAmountKeys(Object.keys(counter));

  const rows = amountKeys
    .map((key) => {
      const displayKey = key === "null" ? "null" : key;
      return `
        <tr>
          <td>${displayKey}</td>
          <td>${formatNumber(counter[key])}</td>
        </tr>
      `;
    })
    .join("");

  resultDiv.innerHTML = `
    <section class="card">
      <div class="summary-grid">
        <div class="stat-card">
          <div class="stat-label">Số object</div>
          <div class="stat-value">${formatNumber(data.length)}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Số loại amount_tk</div>
          <div class="stat-value">${formatNumber(amountKeys.length)}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Tổng hiện tại</div>
          <div class="stat-value">${formatNumber(totalCurrent)}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Thời điểm</div>
          <div class="stat-value" style="font-size:16px;">${now}</div>
        </div>
      </div>
    </section>

    <section class="card table-card">
      <h2 class="table-head">Các loại amount_tk và số lượng từng loại</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>amount_tk</th>
              <th>Số lượng</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

async function fetchData() {
  const apiKey = document.getElementById("apikey").value.trim();
  const selectedLabel = document.getElementById("selectedLabel").value.trim();
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

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang gửi...";
    setStatus("loading", `Đang gọi API cho ${selectedLabel}...`);

    console.log("Selected label:", selectedLabel);
    console.log("Sending x-api-key:", apiKey);

    const url = `${API_URL}?t=${Date.now()}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-api-key": apiKey,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    });

    const rawText = await response.text();

    console.log("HTTP status:", response.status);
    console.log("Response preview:", rawText.slice(0, 500));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText || "Request failed"}`);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error("Response không phải JSON hợp lệ.");
    }

    renderResult(data);
    setStatus(
      "success",
      `Lấy dữ liệu thành công cho ${selectedLabel}. Tổng số object: ${
        Array.isArray(data) ? data.length : 0
      }.`
    );
  } catch (error) {
    console.error(error);

    setStatus("error", error.message);

    resultDiv.innerHTML = `
      <div class="card error-card">
        <strong>Không thể lấy dữ liệu.</strong><br><br>
        Chi tiết: ${escapeHtml(error.message)}<br><br>
        Nếu bấm đổi API key nhưng dữ liệu vẫn không đổi thì thường là phía API hoặc proxy đang bỏ qua <code>x-api-key</code>.
      </div>
    `;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Gửi";
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}