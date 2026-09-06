/*
 * Surge Multi Subscription Info Panel
 * 支持多个机场复用
 *
 * $argument = 机场原始订阅 URL
 * $input.panelName = Panel 名称
 */

const url = String($argument || "").trim();
const name = $input?.panelName || $script?.name || "订阅信息";

function done(content, style = "info", icon = "airplane.circle.fill") {
  $done({
    title: name,
    content,
    style,
    icon
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "未知";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }

  let digits = 1;

  if (index >= 3) digits = 2;
  if (value >= 100) digits = 0;
  else if (value >= 10) digits = 1;

  return `${value.toFixed(digits)} ${units[index]}`;
}

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "长期有效 / 未提供";
  }

  const date = new Date(timestamp * 1000);

  if (Number.isNaN(date.getTime())) {
    return "未知";
  }

  const pad = n => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );
}

function parseSubscriptionInfo(raw) {
  const info = {};

  String(raw || "")
    .split(";")
    .forEach(item => {
      const index = item.indexOf("=");

      if (index === -1) return;

      const key = item.slice(0, index).trim().toLowerCase();
      const value = Number(item.slice(index + 1).trim());

      if (key && Number.isFinite(value)) {
        info[key] = value;
      }
    });

  return info;
}

function progressBar(percent) {
  const length = 10;

  const safePercent = Math.max(
    0,
    Math.min(100, percent)
  );

  const filled = Math.round(
    safePercent / 100 * length
  );

  return (
    "█".repeat(filled) +
    "░".repeat(length - filled)
  );
}

if (!/^https?:\/\//i.test(url)) {
  done(
    "订阅地址未填写或格式错误\n请编辑模块参数",
    "error",
    "exclamationmark.triangle.fill"
  );
} else {
  $httpClient.get(
    {
      url,
      headers: {
        "User-Agent": "Surge",
        "Accept": "*/*",
        "Cache-Control": "no-cache"
      }
    },
    (error, response) => {
      if (error || !response) {
        done(
          `请求失败\n${error || "无响应"}`,
          "error",
          "wifi.exclamationmark"
        );
        return;
      }

      const status =
        Number(response.status || response.statusCode || 0);

      if (status && (status < 200 || status >= 400)) {
        done(
          `订阅服务器返回 HTTP ${status}`,
          "error",
          "exclamationmark.triangle.fill"
        );
        return;
      }

      const headers = response.headers || {};

      const key = Object.keys(headers).find(
        item =>
          item.toLowerCase() === "subscription-userinfo"
      );

      if (!key) {
        done(
          "未获取到流量信息\n机场未返回 subscription-userinfo",
          "alert",
          "exclamationmark.triangle.fill"
        );
        return;
      }

      const info =
        parseSubscriptionInfo(headers[key]);

      const upload =
        Number.isFinite(info.upload) ? info.upload : 0;

      const download =
        Number.isFinite(info.download) ? info.download : 0;

      const total =
        Number.isFinite(info.total) ? info.total : 0;

      const used = upload + download;

      let content = "";
      let style = "info";

      if (total > 0) {
        const remain =
          Math.max(total - used, 0);

        const remainPercent =
          Math.max(
            0,
            Math.min(
              100,
              remain / total * 100
            )
          );

        content =
          `剩余  ${formatBytes(remain)} · ${remainPercent.toFixed(1)}%\n` +
          `${progressBar(remainPercent)}\n` +
          `已用  ${formatBytes(used)} / ${formatBytes(total)}\n` +
          `到期  ${formatDate(info.expire)}`;

        if (remainPercent <= 10) {
          style = "error";
        } else if (remainPercent <= 30) {
          style = "alert";
        } else {
          style = "good";
        }
      } else {
        content =
          `已用  ${formatBytes(used)}\n` +
          `总量  未提供\n` +
          `到期  ${formatDate(info.expire)}`;

        style = "info";
      }

      done(
        content,
        style,
        "airplane.circle.fill"
      );
    }
  );
}
