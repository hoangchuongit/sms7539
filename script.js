async function fetchData() {
  const apiKey = document.getElementById("apikey").value.trim();

  if (!apiKey) {
    alert("Vui lòng nhập API key");
    return;
  }

  const res = await fetch("https://luckburn.mobi/api/sms7539", {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });

  const data = await res.json();

  renderResult(data);
}

function renderResult(data) {
  const resultDiv = document.getElementById("result");

  if (!Array.isArray(data)) {
    resultDiv.innerHTML = "<p>API trả về dữ liệu không hợp lệ</p>";
    return;
  }

  const counter = {};

  data.forEach((item) => {
    const val = item.amount_tk;

    counter[val] = (counter[val] || 0) + 1;
  });

  const excluded = new Set([401, 403, 404]);

  let total = 0;

  data.forEach((item) => {
    const val = item.amount_tk;

    if (typeof val === "number" && !excluded.has(val)) {
      total += val;
    }
  });

  const now = new Date().toLocaleString();

  let html = "";

  html += `<p><b>Số object:</b> ${data.length}</p>`;
  html += `<p><b>Số loại amount_tk:</b> ${Object.keys(counter).length}</p>`;

  html += `<h3>Các loại amount_tk</h3>`;

  html += `<table>
        <tr>
            <th>amount_tk</th>
            <th>Số lượng</th>
        </tr>`;

  Object.keys(counter)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((k) => {
      html += `<tr>
                <td>${k}</td>
                <td>${counter[k]}</td>
            </tr>`;
    });

  html += `</table>`;

  html += `<p><b>Tổng tiền hiện tại (không kể 401,403,404):</b> ${total}</p>`;

  html += `<p><b>Thời điểm:</b> ${now}</p>`;

  resultDiv.innerHTML = html;
}
