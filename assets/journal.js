const state = {
  entries: Array.isArray(window.JOURNAL_ENTRIES) ? window.JOURNAL_ENTRIES : [],
  query: "",
  tag: "all",
  selectedSlug: "",
};

const elements = {
  article: document.querySelector("#article"),
  count: document.querySelector("#entry-count"),
  latestDate: document.querySelector("#latest-date"),
  search: document.querySelector("#search"),
  tagList: document.querySelector("#tag-list"),
  entryList: document.querySelector("#entry-list"),
};

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "ogv", "webm"]);
const ICLOUD_SHORTCUT_URL = "https://www.icloud.com/shortcuts/71338c29540343b186e7a4e159b5cfca";

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInline(value = "") {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function parseMediaLine(value = "") {
  const imageMatch = value.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$/);
  if (imageMatch) {
    return {
      alt: imageMatch[1],
      caption: imageMatch[3] || "",
      rawUrl: imageMatch[2],
      requestedType: "auto",
    };
  }

  const videoMatch = value.match(/^\[video(?::\s*([^\]]+))?\]\((\S+?)(?:\s+"([^"]+)")?\)$/i);
  if (videoMatch) {
    return {
      alt: videoMatch[1] || "video",
      caption: videoMatch[3] || "",
      rawUrl: videoMatch[2],
      requestedType: "video",
    };
  }

  return null;
}

function parseSettingsTestLinkLine(value = "") {
  const match = value.match(/^\[settings-test:\s*([^\]]+)\]\((\S+?)(?:\s+"([^"]+)")?\)$/i);
  if (!match) return null;

  return {
    label: match[1],
    rawUrl: match[2],
    note: match[3] || "",
  };
}

function isAllowedSettingsTestUrl(rawUrl = "") {
  return /^(prefs|app-prefs):/i.test(rawUrl) && !/[\s"'<>]/.test(rawUrl);
}

function renderSettingsTestLink(link) {
  if (!isAllowedSettingsTestUrl(link.rawUrl)) return "";

  const note = link.note ? `<span class="settings-test-note">${renderInline(link.note)}</span>` : "";

  return `
    <p class="settings-test-row">
      <a class="settings-test-link" href="${escapeHtml(link.rawUrl)}">${renderInline(link.label)}</a>
      ${note}
    </p>
  `;
}

function isDeviceModelCheckLine(value = "") {
  return /^\[device-model-check\]$/i.test(value);
}

function renderDeviceModelCheck() {
  return `
    <section class="device-model-check" data-device-model-check>
      <p class="device-model-check-lead" data-device-model-message>端末情報を確認しています。</p>
      <div class="device-model-check-result" data-device-model-result></div>
    </section>
  `;
}

function getExtension(url = "") {
  const pathname = url.split(/[?#]/)[0];
  const extension = pathname.split(".").pop();
  return extension ? extension.toLowerCase() : "";
}

function resolveMediaUrl(rawUrl = "", entry) {
  if (/^(javascript|vbscript):/i.test(rawUrl)) return "";
  if (/^(https?:|data:|blob:|\/|#)/i.test(rawUrl)) return rawUrl;

  const pageBase = new URL("./", window.location.href);
  const entryUrl = new URL(entry.path, pageBase);
  return new URL(rawUrl, entryUrl).toString();
}

function getMediaKind(rawUrl = "", requestedType = "auto") {
  const extension = getExtension(rawUrl);
  if (requestedType === "video" || VIDEO_EXTENSIONS.has(extension)) return "video";
  if (IMAGE_EXTENSIONS.has(extension) || requestedType === "auto") return "image";
  return "file";
}

function getVideoMimeType(rawUrl = "") {
  const extension = getExtension(rawUrl);
  const mimeTypes = {
    m4v: "video/mp4",
    mov: "video/quicktime",
    mp4: "video/mp4",
    ogv: "video/ogg",
    webm: "video/webm",
  };
  return mimeTypes[extension] || "";
}

function renderMedia(media, entry) {
  const url = resolveMediaUrl(media.rawUrl, entry);
  if (!url) return "";

  const kind = getMediaKind(media.rawUrl, media.requestedType);
  const caption = media.caption ? `<figcaption>${renderInline(media.caption)}</figcaption>` : "";
  const safeUrl = escapeHtml(url);
  const safeAlt = escapeHtml(media.alt);

  if (kind === "video") {
    const mimeType = getVideoMimeType(media.rawUrl);
    const typeAttr = mimeType ? ` type="${escapeHtml(mimeType)}"` : "";
    return `
      <figure class="media-frame media-frame-video">
        <video controls preload="metadata" playsinline aria-label="${safeAlt}">
          <source src="${safeUrl}"${typeAttr}>
          <a href="${safeUrl}">動画を開く</a>
        </video>
        ${caption}
      </figure>
    `;
  }

  if (kind === "file") {
    return `
      <figure class="media-frame">
        <a class="media-file-link" href="${safeUrl}">${safeAlt || escapeHtml(media.rawUrl)}</a>
        ${caption}
      </figure>
    `;
  }

  return `
    <figure class="media-frame">
      <img src="${safeUrl}" alt="${safeAlt}" loading="lazy" decoding="async">
      ${caption}
    </figure>
  `;
}

function renderMarkdown(markdown = "", entry = {}) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let listType = null;

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const media = parseMediaLine(trimmed);
    if (media) {
      closeList();
      html.push(renderMedia(media, entry));
      continue;
    }

    const settingsTestLink = parseSettingsTestLinkLine(trimmed);
    if (settingsTestLink) {
      closeList();
      html.push(renderSettingsTestLink(settingsTestLink));
      continue;
    }

    if (isDeviceModelCheckLine(trimmed)) {
      closeList();
      html.push(renderDeviceModelCheck());
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }

  closeList();
  return html.join("");
}

function getFilteredEntries() {
  const query = state.query.trim().toLowerCase();

  return state.entries.filter((entry) => {
    const matchesTag = state.tag === "all" || entry.tags.includes(state.tag);
    const haystack = [entry.title, entry.date, entry.excerpt, entry.content, entry.tags.join(" ")]
      .join(" ")
      .toLowerCase();
    return matchesTag && (!query || haystack.includes(query));
  });
}

function updateHash(slug) {
  if (slug && location.hash.slice(1) !== slug) {
    history.replaceState(null, "", `#${slug}`);
  }
}

function selectEntry(slug, shouldUpdateHash = true) {
  const entry = state.entries.find((item) => item.slug === slug) || state.entries[0];
  if (!entry) {
    elements.article.innerHTML = '<p class="empty">公開できるジャーナルがまだありません。</p>';
    return;
  }

  state.selectedSlug = entry.slug;
  if (shouldUpdateHash) updateHash(entry.slug);

  elements.article.innerHTML = `
    <header class="article-header">
      <p class="article-date">${escapeHtml(entry.date)}</p>
      <h2>${escapeHtml(entry.title)}</h2>
      <div class="article-tags">
        ${entry.tags.map((tag) => `<span class="article-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </header>
    <div class="article-body">${renderMarkdown(entry.content, entry)}</div>
    <a class="source-link" href="./${escapeHtml(entry.path)}">Markdown source</a>
  `;

  hydrateDeviceModelChecks();
  renderEntryList();
}

function getCurrentArticleUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = state.selectedSlug ? `#${state.selectedSlug}` : url.hash;
  return url.toString();
}

function getPlatformInfo() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return {
    isAndroid: /Android/i.test(ua),
    isIOS: /iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1),
    ua,
  };
}

function parseAndroidModelFromUserAgent(ua = "") {
  const match = ua.match(/Android\s+[^;)]*;\s*([^;)]+?)(?:\s+Build\/|;|\))/i);
  if (!match) return "";

  const model = match[1].trim();
  if (!model || /^K$/i.test(model)) return "";
  return model;
}

async function getAndroidModelName() {
  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const values = await navigator.userAgentData.getHighEntropyValues(["model"]);
      if (values.model) return values.model;
    } catch (error) {
      // Fall through to User-Agent parsing.
    }
  }

  return parseAndroidModelFromUserAgent(navigator.userAgent || "");
}

async function hydrateDeviceModelChecks() {
  const widgets = elements.article.querySelectorAll("[data-device-model-check]");
  if (!widgets.length) return;

  const platform = getPlatformInfo();
  const articleUrl = getCurrentArticleUrl();

  widgets.forEach(async (widget) => {
    const message = widget.querySelector("[data-device-model-message]");
    const result = widget.querySelector("[data-device-model-result]");

    if (platform.isAndroid) {
      const modelName = await getAndroidModelName();
      message.textContent = "Android端末として判定しました。";
      result.innerHTML = `
        <div class="device-model-result-card">
          <span class="device-model-label">機種名</span>
          <strong>${escapeHtml(modelName || "Android端末")}</strong>
          <p>${modelName ? "ブラウザから取得できた機種名をそのまま表示しています。" : "このブラウザでは詳細な機種名を取得できませんでした。"}</p>
        </div>
      `;
      return;
    }

    if (platform.isIOS) {
      message.textContent = "";
      result.innerHTML = `
        <div class="device-model-ios-actions">
          <a class="device-model-action primary" href="${escapeHtml(ICLOUD_SHORTCUT_URL)}">機種判定を開く</a>
        </div>
      `;
      return;
    }

    message.textContent = "PCまたは判定対象外の端末として表示しています。";
    result.innerHTML = `
      <div class="device-model-result-card">
        <span class="device-model-label">判定結果</span>
        <strong>iPhone/Androidではありません</strong>
        <p>Androidでは機種名を表示し、iPhoneでは機種判定ボタンを表示します。</p>
      </div>
    `;
  });
}

function renderTags() {
  const tags = [...new Set(state.entries.flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b, "ja"));
  const allButton = `<button class="tag-button ${state.tag === "all" ? "active" : ""}" data-tag="all">すべて</button>`;
  const tagButtons = tags
    .map((tag) => `<button class="tag-button ${state.tag === tag ? "active" : ""}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`)
    .join("");

  elements.tagList.innerHTML = allButton + tagButtons;
}

function renderEntryList() {
  const entries = getFilteredEntries();
  elements.count.textContent = `${state.entries.length} entries`;
  elements.latestDate.textContent = state.entries[0] ? `Latest: ${state.entries[0].date}` : "";

  if (!entries.length) {
    elements.entryList.innerHTML = '<p class="empty">該当するジャーナルはありません。</p>';
    return;
  }

  elements.entryList.innerHTML = entries
    .map((entry) => `
      <button class="entry-button ${entry.slug === state.selectedSlug ? "active" : ""}" data-slug="${escapeHtml(entry.slug)}">
        <span class="entry-date">${escapeHtml(entry.date)}</span>
        <span class="entry-title">${escapeHtml(entry.title)}</span>
        <span class="entry-excerpt">${escapeHtml(entry.excerpt)}</span>
      </button>
    `)
    .join("");
}

function render() {
  renderTags();
  renderEntryList();
}

function renderFilteredState() {
  const entries = getFilteredEntries();
  const selectedIsVisible = entries.some((entry) => entry.slug === state.selectedSlug);

  if (entries.length && !selectedIsVisible) {
    selectEntry(entries[0].slug);
    return;
  }

  renderEntryList();
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderFilteredState();
});

elements.tagList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;
  state.tag = button.dataset.tag;
  renderTags();
  renderFilteredState();
});

elements.entryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-slug]");
  if (!button) return;
  selectEntry(button.dataset.slug);
});

window.addEventListener("hashchange", () => {
  selectEntry(location.hash.slice(1), false);
});

state.entries.sort((a, b) => b.date.localeCompare(a.date));
render();
selectEntry(location.hash.slice(1) || state.entries[0]?.slug);
