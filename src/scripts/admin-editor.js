// /admin/ 記事編集画面のロジック（vanilla JS）。
// GitHub Contents API を直接ブラウザから叩いてコミットする。
// サーバーは持たないため、認証はブラウザのlocalStorageに保存したPersonal Access Token頼み。

const OWNER_DEFAULT = 'sin1n24';
const REPO_DEFAULT = 'sin1n24.github.io';
const BLOG_DIR = 'src/content/blog';
// 画像は public/img/blog に置く。Astroは public/ 配下だけを静的配信するため、
// 依頼文中の「img/blog/」ではなく実際にサイトへ公開される public/img/blog/ を採用している
// （公開URL https://sin1.studio/img/blog/xxx.png はこの配置でのみ成立する）。
const IMG_DIR = 'public/img/blog';
const SITE_URL = 'https://sin1.studio';
const DEFAULT_CATEGORIES = ['かわロボ', 'ミニかわロボ', 'ガジェット', '技術'];
const SETTINGS_KEY = 'sin1studio_admin_settings_v1';
const ARTICLE_CACHE_KEY = 'sin1studio_admin_article_cache_v1';
const URL_ONLY_REGEX = /^https?:\/\/\S+$/i;

const state = {
  settings: null,
  mode: 'new',
  editingPath: null,
  editingSha: null,
  articles: [],
  categories: new Set(DEFAULT_CATEGORIES),
  // このセッション中にアップロードした画像（{ path, filename, url, downloadUrl, sha }）。
  // 新規作成⇔編集タブの切り替えやresetFormForNewではクリアしない（気づいた時に未使用画像を消せるように継続表示する）。
  uploadedImages: [],
};

let slugManuallyEdited = false;
let markedLoaded = false;

// ---------- base64 / utf-8 ヘルパー ----------

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  return bytesToBase64(bytes);
}

function base64ToUtf8(b64) {
  const binary = atob(String(b64).replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function arrayBufferToBase64(buffer) {
  return bytesToBase64(new Uint8Array(buffer));
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ---------- 設定の保存/読み込み ----------

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveSettingsToStorage(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function clearSettingsStorage() {
  localStorage.removeItem(SETTINGS_KEY);
}

// ---------- GitHub Contents API ----------

function ghHeaders() {
  return {
    Authorization: `Bearer ${state.settings.pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function ghApiBase() {
  return `https://api.github.com/repos/${state.settings.owner}/${state.settings.repo}`;
}

function encodePath(path) {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function branchQuery() {
  return state.settings.branch ? `?ref=${encodeURIComponent(state.settings.branch)}` : '';
}

async function ghError(res) {
  let detail = '';
  try {
    const data = await res.json();
    detail = data.message || '';
  } catch (err) {
    // ignore
  }
  const err = new Error(`GitHub API エラー (${res.status}): ${detail || res.statusText}`);
  err.status = res.status;
  return err;
}

async function ghListDir(path) {
  const res = await fetch(`${ghApiBase()}/contents/${encodePath(path)}${branchQuery()}`, {
    headers: ghHeaders(),
  });
  if (!res.ok) throw await ghError(res);
  return res.json();
}

async function ghGetFile(path) {
  const res = await fetch(`${ghApiBase()}/contents/${encodePath(path)}${branchQuery()}`, {
    headers: ghHeaders(),
  });
  if (!res.ok) throw await ghError(res);
  return res.json();
}

async function ghFileExists(path) {
  try {
    await ghGetFile(path);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function ghPutFile(path, base64Content, message, sha) {
  const body = { message, content: base64Content };
  if (sha) body.sha = sha;
  if (state.settings.branch) body.branch = state.settings.branch;
  const res = await fetch(`${ghApiBase()}/contents/${encodePath(path)}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await ghError(res);
  return res.json();
}

async function ghDeleteFile(path, sha, message) {
  const body = { message, sha };
  if (state.settings.branch) body.branch = state.settings.branch;
  const res = await fetch(`${ghApiBase()}/contents/${encodePath(path)}`, {
    method: 'DELETE',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await ghError(res);
  return res.json();
}

// ---------- frontmatter 組み立て/解析 ----------

function escapeYamlString(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unquoteYaml(str) {
  const s = String(str).trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

function buildFrontmatter({ title, date, categories, hatenaUrl }) {
  const lines = ['---'];
  lines.push(`title: "${escapeYamlString(title)}"`);
  lines.push(`date: ${date}`);
  if (categories && categories.length) {
    lines.push(`categories: [${categories.map((c) => `"${escapeYamlString(c)}"`).join(', ')}]`);
  }
  if (hatenaUrl) {
    lines.push(`hatena_url: "${escapeYamlString(hatenaUrl)}"`);
  }
  lines.push('---');
  return lines.join('\n');
}

function buildMarkdownFile(data) {
  const fm = buildFrontmatter(data);
  const trimmedBody = data.body.replace(/\s+$/, '');
  return `${fm}\n\n${trimmedBody}\n`;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { title: '', date: '', categories: [], hatenaUrl: '', body: raw };
  }
  const fmText = match[1];
  const body = match[2].replace(/^\n+/, '');

  const titleMatch = fmText.match(/^title:\s*(.*)$/m);
  const dateMatch = fmText.match(/^date:\s*(.*)$/m);
  const categoriesMatch = fmText.match(/^categories:\s*\[(.*)\]\s*$/m);
  const hatenaMatch = fmText.match(/^hatena_url:\s*(.*)$/m);

  return {
    title: titleMatch ? unquoteYaml(titleMatch[1]) : '',
    date: dateMatch ? unquoteYaml(dateMatch[1]) : '',
    categories: categoriesMatch
      ? categoriesMatch[1]
          .split(',')
          .map((s) => unquoteYaml(s.trim()))
          .filter(Boolean)
      : [],
    hatenaUrl: hatenaMatch ? unquoteYaml(hatenaMatch[1]) : '',
    body,
  };
}

// ---------- slug ----------

function slugifyTitle(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function randomToken(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function defaultSlug(title, dateStr) {
  const datePart = dateStr || todayStr();
  const slugPart = slugifyTitle(title || '');
  if (slugPart && slugPart.length >= 3) {
    return `${datePart}-${slugPart.slice(0, 40)}`;
  }
  return `${datePart}-${randomToken()}`;
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- ステータス表示 ----------

function setStatus(id, msg, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ` status-${kind}` : '');
}

const setSaveStatus = (msg, kind) => setStatus('save-status', msg, kind);
const setLoadStatus = (msg, kind) => setStatus('load-status', msg, kind);
const setSlugStatus = (msg, kind) => setStatus('slug-status', msg, kind);
const setPasteStatus = (msg, kind) => setStatus('paste-status', msg, kind);
const setConvertStatus = (msg, kind) => setStatus('convert-status', msg, kind);
const setGlobalStatus = (msg, kind) => setStatus('global-status', msg, kind);

function requireAuth(statusSetter) {
  const setter = statusSetter || setSaveStatus;
  if (!state.settings || !state.settings.pat || !state.settings.owner || !state.settings.repo) {
    setter('先に「接続設定」でGitHub Personal Access Tokenを保存してください', 'error');
    return false;
  }
  return true;
}

// ---------- textarea操作ヘルパー ----------

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  const newPos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = newPos;
  textarea.focus();
}

function replaceRange(textarea, start, end, text) {
  const value = textarea.value;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  const newPos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = newPos;
}

// ---------- カテゴリ候補 ----------

function rememberCategories(categories) {
  (categories || []).forEach((c) => state.categories.add(c));
  const datalist = document.getElementById('categories-datalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  Array.from(state.categories)
    .sort()
    .forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      datalist.appendChild(opt);
    });
}

// ---------- 記事一覧の読み込み（編集タブ） ----------

function loadArticleCache() {
  try {
    return JSON.parse(localStorage.getItem(ARTICLE_CACHE_KEY) || '{}');
  } catch (err) {
    return {};
  }
}

function saveArticleCache(cache) {
  try {
    localStorage.setItem(ARTICLE_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    // 容量オーバー等は無視。キャッシュが無くても動作に支障はない
  }
}

async function loadArticles(onProgress) {
  const items = await ghListDir(BLOG_DIR);
  const files = items.filter((i) => i.type === 'file' && i.name.endsWith('.md'));
  const cache = loadArticleCache();
  const results = new Array(files.length);
  let done = 0;
  let idx = 0;
  const concurrency = 8;

  async function worker() {
    while (idx < files.length) {
      const i = idx++;
      const file = files[i];
      const cached = cache[file.path];
      if (cached && cached.sha === file.sha) {
        results[i] = { path: file.path, name: file.name, sha: file.sha, title: cached.title, date: cached.date };
      } else {
        try {
          const data = await ghGetFile(file.path);
          const raw = base64ToUtf8(data.content);
          const fm = parseFrontmatter(raw);
          results[i] = {
            path: file.path,
            name: file.name,
            sha: file.sha,
            title: fm.title || file.name,
            date: fm.date || '',
          };
          cache[file.path] = { sha: file.sha, title: results[i].title, date: results[i].date };
        } catch (err) {
          results[i] = { path: file.path, name: file.name, sha: file.sha, title: file.name, date: '' };
        }
      }
      done++;
      if (onProgress) onProgress(done, files.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  saveArticleCache(cache);
  return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderArticleList(articles) {
  const container = document.getElementById('article-list');
  container.innerHTML = '';
  if (!articles.length) {
    container.innerHTML = '<p class="hint">該当する記事がありません</p>';
    return;
  }
  articles.forEach((a) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'article-item';
    item.textContent = `${a.date || '----------'}  ${a.title}`;
    item.addEventListener('click', () => selectArticleForEdit(a));
    container.appendChild(item);
  });
}

async function selectArticleForEdit(article) {
  setSaveStatus('記事を読み込み中...');
  try {
    const data = await ghGetFile(article.path);
    const raw = base64ToUtf8(data.content);
    const fm = parseFrontmatter(raw);
    state.editingPath = article.path;
    state.editingSha = data.sha;
    document.getElementById('field-title').value = fm.title;
    document.getElementById('field-date').value = fm.date;
    document.getElementById('field-slug').value = article.name.replace(/\.md$/, '');
    document.getElementById('field-categories').value = fm.categories.join(', ');
    document.getElementById('field-hatena').value = fm.hatenaUrl;
    document.getElementById('field-body').value = fm.body;
    document.getElementById('editing-file-label').textContent = article.path;
    setSaveStatus(`読み込みました: ${article.path}`, 'ok');
    rememberCategories(fm.categories);
  } catch (err) {
    setSaveStatus(`記事の読み込みに失敗しました: ${err.message || err}`, 'error');
  }
}

// ---------- URL → Markdownリンク変換 ----------

async function fetchTitleViaProxy(url) {
  if (!state.settings.gasUrl) {
    throw new Error('URL変換プロキシ（GAS Web App URL）が設定されていません');
  }
  const sep = state.settings.gasUrl.includes('?') ? '&' : '?';
  const endpoint = `${state.settings.gasUrl}${sep}url=${encodeURIComponent(url)}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`プロキシがHTTP ${res.status} を返しました`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'タイトル取得に失敗しました');
  return data.title;
}

async function runUrlConversion(textarea, start, end, url) {
  setConvertStatus(`変換中... (${url})`);
  const placeholder = `[取得中...](${url})`;
  replaceRange(textarea, start, end, placeholder);
  try {
    const title = await fetchTitleViaProxy(url);
    const markdown = `[${title}](${url})`;
    replaceRange(textarea, start, start + placeholder.length, markdown);
    setConvertStatus('変換完了', 'ok');
  } catch (err) {
    const fallback = `[${url}](${url})`;
    replaceRange(textarea, start, start + placeholder.length, fallback);
    setConvertStatus(`変換失敗（URLのまま挿入しました）: ${err.message || err}`, 'error');
  }
}

async function convertUrlAtSelection(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end).trim();
  if (!URL_ONLY_REGEX.test(selected)) {
    setConvertStatus('選択範囲がURLではありません（URLのみを選択してください）', 'error');
    return;
  }
  if (!state.settings || !state.settings.gasUrl) {
    setConvertStatus('URL変換プロキシ（GAS Web App URL）が未設定のため変換できません', 'error');
    return;
  }
  await runUrlConversion(textarea, start, end, selected);
}

// ---------- 画像貼り付け → アップロード ----------

let imageUploadCounter = 0;

function currentSlugForAssets() {
  const slug = document.getElementById('field-slug').value.trim();
  if (slug) return slug;
  return `draft-${Date.now()}`;
}

function extFromMime(mime) {
  const raw = (mime.split('/')[1] || 'png').toLowerCase();
  if (raw === 'jpeg') return 'jpg';
  return raw.replace(/[^a-z0-9]/g, '') || 'png';
}

async function handleImageFile(file, textarea) {
  imageUploadCounter++;
  const ext = extFromMime(file.type || 'image/png');
  const slug = currentSlugForAssets();
  const filename = `${slug}-${Date.now()}-${imageUploadCounter}.${ext}`;
  const path = `${IMG_DIR}/${filename}`;

  const placeholderText = `![アップロード中: ${filename}]()`;
  const insertStart = textarea.selectionStart;
  insertAtCursor(textarea, placeholderText);

  setPasteStatus(`画像をアップロード中... (${filename})`);
  try {
    const buffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const result = await ghPutFile(path, base64, `chore(admin): add image ${filename}`);
    const publicUrl = `${SITE_URL}/img/blog/${filename}`;
    const markdown = `![画像](${publicUrl})`;
    replaceRange(textarea, insertStart, insertStart + placeholderText.length, markdown);

    // GitHub Contents APIのPUTレスポンスにはコミット直後からアクセス可能な
    // raw.githubusercontent.com 形式のURL（download_url）が含まれている。
    // 本文へ挿入するMarkdown自体はサイト公開URL（publicUrl）のままにし、
    // download_urlはアップロード直後の確認用サムネイル表示にのみ使う
    // （raw.githubusercontent.comは本番の画像配信元として使わない）。
    const content = result && result.content ? result.content : {};
    const uploaded = { path, filename, url: publicUrl, downloadUrl: content.download_url || '', sha: content.sha || '' };
    state.uploadedImages.push(uploaded);
    renderUploadedImages();
    showPastePreview(uploaded);

    setPasteStatus(
      `アップロード完了: ${filename} ／ サイトへの反映には数十秒〜1分ほどかかります（GitHub Pagesのビルド完了待ち）。` +
        'それまでは本文プレビュー内の画像がリンク切れに見えることがありますが、故障ではありません。',
      'ok'
    );
  } catch (err) {
    replaceRange(textarea, insertStart, insertStart + placeholderText.length, '');
    setPasteStatus(`画像アップロード失敗: ${err.message || err}`, 'error');
  }
}

// ---------- アップロード直後のサムネイルプレビュー ----------

function showPastePreview(uploaded) {
  const el = document.getElementById('paste-preview');
  if (!el) return;
  el.innerHTML = '';
  if (!uploaded || !uploaded.downloadUrl) return;
  const img = document.createElement('img');
  img.src = uploaded.downloadUrl;
  img.alt = uploaded.filename;
  img.className = 'paste-preview-thumb';
  el.appendChild(img);
  const label = document.createElement('span');
  label.className = 'paste-preview-label';
  label.textContent = `アップロード確認用プレビュー: ${uploaded.filename}`;
  el.appendChild(label);
}

// ---------- セッション内アップロード画像の一覧・未使用検出・削除 ----------

function isImageUsedInBody(url) {
  const bodyEl = document.getElementById('field-body');
  if (!bodyEl) return false;
  return bodyEl.value.includes(url);
}

function renderUploadedImages() {
  const panel = document.getElementById('uploaded-images-panel');
  const list = document.getElementById('uploaded-images-list');
  if (!panel || !list) return;

  if (!state.uploadedImages.length) {
    panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  panel.style.display = 'block';
  list.innerHTML = '';

  state.uploadedImages.forEach((img) => {
    const used = isImageUsedInBody(img.url);
    const item = document.createElement('div');
    item.className = 'uploaded-image-item';

    const thumb = document.createElement('img');
    thumb.className = 'uploaded-image-thumb';
    thumb.src = img.downloadUrl || img.url;
    thumb.alt = img.filename;
    item.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'uploaded-image-info';
    const name = document.createElement('span');
    name.className = 'uploaded-image-name';
    name.textContent = img.filename;
    info.appendChild(name);
    if (!used) {
      const badge = document.createElement('span');
      badge.className = 'badge-unused';
      badge.textContent = '未使用';
      info.appendChild(badge);
    }
    item.appendChild(info);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger uploaded-image-delete';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => handleDeleteUploadedImage(img));
    item.appendChild(delBtn);

    list.appendChild(item);
  });
}

async function handleDeleteUploadedImage(img) {
  if (!requireAuth(setPasteStatus)) return;
  const usedNote = isImageUsedInBody(img.url) ? '\n※本文中で使用されています。削除するとリンク切れになります。' : '';
  const confirmed = confirm(`この画像をGitHubリポジトリから削除しますか？\n${img.filename}${usedNote}`);
  if (!confirmed) return;
  setPasteStatus(`画像を削除中... (${img.filename})`);
  try {
    await ghDeleteFile(img.path, img.sha, `chore(admin): remove unused image ${img.filename}`);
    state.uploadedImages = state.uploadedImages.filter((i) => i.path !== img.path);
    renderUploadedImages();
    setPasteStatus(`削除しました: ${img.filename}`, 'ok');
  } catch (err) {
    setPasteStatus(`削除に失敗しました: ${err.message || err}`, 'error');
  }
}

function wireTextareaPaste(textarea) {
  textarea.addEventListener('paste', async (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    let imageFile = null;
    if (items) {
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          imageFile = item.getAsFile();
          break;
        }
      }
    }

    if (imageFile) {
      if (!requireAuth(setPasteStatus)) return;
      e.preventDefault();
      await handleImageFile(imageFile, textarea);
      return;
    }

    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (text && URL_ONLY_REGEX.test(text.trim())) {
      const url = text.trim();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.slice(start, end);

      if (selectedText) {
        // 貼り付け前に選択されていたテキストがあれば、それをそのままリンクラベルにする。
        // GASプロキシへの問い合わせは不要なのでその場で即座に変換する。
        e.preventDefault();
        const markdown = `[${selectedText}](${url})`;
        replaceRange(textarea, start, end, markdown);
        setConvertStatus('選択していたテキストをリンクラベルにしました', 'ok');
        return;
      }

      if (state.settings && state.settings.gasUrl) {
        // 選択範囲が空（カーソルのみ）の場合は従来通りGASプロキシでタイトルを取得する
        e.preventDefault();
        await runUrlConversion(textarea, start, end, url);
        return;
      }
    }
    // それ以外（複数行の通常テキスト等）はデフォルトのペースト処理に任せる
  });

  // クリップボード貼り付けが使えない環境向けのフォールバック（ファイル選択）
  const fileInput = document.getElementById('image-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      if (!requireAuth(setPasteStatus)) return;
      await handleImageFile(file, textarea);
    });
  }
}

// ---------- プレビュー ----------

async function ensureMarked() {
  if (markedLoaded || window.marked) {
    markedLoaded = true;
    return;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('marked.js の読み込みに失敗しました（オフライン環境では利用できません）'));
    document.head.appendChild(script);
  });
  markedLoaded = true;
}

async function togglePreview() {
  const pane = document.getElementById('preview-pane');
  const textarea = document.getElementById('field-body');
  const btn = document.getElementById('btn-preview-toggle');
  const showing = pane.style.display !== 'none' && pane.style.display !== '';
  if (showing) {
    pane.style.display = 'none';
    btn.textContent = 'プレビュー表示';
    return;
  }
  try {
    await ensureMarked();
    pane.innerHTML = window.marked.parse(textarea.value);
    pane.style.display = 'block';
    btn.textContent = 'プレビュー非表示';
  } catch (err) {
    setSaveStatus(`プレビュー表示に失敗しました: ${err.message || err}`, 'error');
  }
}

// ---------- フォーム収集/検証 ----------

function collectFormData() {
  const title = document.getElementById('field-title').value.trim();
  const date = document.getElementById('field-date').value;
  const slug = document.getElementById('field-slug').value.trim();
  const categoriesRaw = document.getElementById('field-categories').value;
  const categories = categoriesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const hatenaUrl = document.getElementById('field-hatena').value.trim();
  const body = document.getElementById('field-body').value;
  return { title, date, slug, categories, hatenaUrl, body };
}

function validateForm(data) {
  const errors = [];
  if (!data.title) errors.push('タイトルは必須です');
  if (!data.date) errors.push('日付は必須です');
  if (!data.slug) errors.push('スラッグは必須です');
  else if (!/^[a-zA-Z0-9._-]+$/.test(data.slug)) errors.push('スラッグは半角英数字と - _ . のみ使用できます');
  if (!data.body.trim()) errors.push('本文が空です');
  return errors;
}

// ---------- 保存処理 ----------

async function handleSaveNew() {
  if (!requireAuth()) return;
  const data = collectFormData();
  const errors = validateForm(data);
  if (errors.length) {
    setSaveStatus(errors.join(' / '), 'error');
    return;
  }
  const path = `${BLOG_DIR}/${data.slug}.md`;
  setSaveStatus('重複を確認中...');
  try {
    const exists = await ghFileExists(path);
    if (exists) {
      setSaveStatus(`同名のファイルが既に存在します: ${path}（スラッグを変更してください）`, 'error');
      return;
    }
  } catch (err) {
    setSaveStatus(`重複チェックに失敗しました: ${err.message || err}`, 'error');
    return;
  }

  const content = buildMarkdownFile(data);
  setSaveStatus('保存中...');
  try {
    const result = await ghPutFile(path, utf8ToBase64(content), `add: ${data.title}`);
    state.editingPath = path;
    state.editingSha = result.content ? result.content.sha : null;
    document.getElementById('editing-file-label').textContent = path;
    setSaveStatus(`保存しました: ${path}`, 'ok');
    rememberCategories(data.categories);
  } catch (err) {
    setSaveStatus(`保存に失敗しました: ${err.message || err}`, 'error');
  }
}

async function handleSaveEdit() {
  if (!requireAuth()) return;
  if (!state.editingPath || !state.editingSha) {
    setSaveStatus('編集対象の記事が選択されていません（編集タブから記事を選んでください）', 'error');
    return;
  }
  const data = collectFormData();
  const errors = validateForm(data);
  if (errors.length) {
    setSaveStatus(errors.join(' / '), 'error');
    return;
  }
  const content = buildMarkdownFile(data);
  setSaveStatus('保存中...');
  try {
    const result = await ghPutFile(state.editingPath, utf8ToBase64(content), `update: ${data.title}`, state.editingSha);
    state.editingSha = result.content ? result.content.sha : state.editingSha;
    setSaveStatus(`更新しました: ${state.editingPath}`, 'ok');
    rememberCategories(data.categories);
  } catch (err) {
    if (err.status === 409) {
      setSaveStatus(
        'コンフリクトが発生しました（他の変更と競合しています）。編集タブから記事を再読み込みしてやり直してください。',
        'error'
      );
    } else {
      setSaveStatus(`更新に失敗しました: ${err.message || err}`, 'error');
    }
  }
}

async function handleCheckSlug() {
  const slug = document.getElementById('field-slug').value.trim();
  if (!slug) {
    setSlugStatus('スラッグを入力してください', 'error');
    return;
  }
  if (!requireAuth(setSlugStatus)) return;
  const path = `${BLOG_DIR}/${slug}.md`;
  setSlugStatus('確認中...');
  try {
    const exists = await ghFileExists(path);
    setSlugStatus(exists ? `既に存在します: ${path}` : `使用可能です: ${path}`, exists ? 'error' : 'ok');
  } catch (err) {
    setSlugStatus(`確認に失敗しました: ${err.message || err}`, 'error');
  }
}

// ---------- タブ / フォームリセット ----------

function resetFormForNew() {
  state.editingPath = null;
  state.editingSha = null;
  slugManuallyEdited = false;
  document.getElementById('field-title').value = '';
  document.getElementById('field-date').value = todayStr();
  document.getElementById('field-slug').value = defaultSlug('', todayStr());
  document.getElementById('field-categories').value = '';
  document.getElementById('field-hatena').value = '';
  document.getElementById('field-body').value = '';
  document.getElementById('editing-file-label').textContent = '(未保存の新規記事)';
  setSaveStatus('');
}

function switchMode(mode) {
  state.mode = mode;
  document.getElementById('tab-new').classList.toggle('active', mode === 'new');
  document.getElementById('tab-edit').classList.toggle('active', mode === 'edit');
  document.getElementById('edit-panel').style.display = mode === 'edit' ? 'block' : 'none';
  document.getElementById('field-slug').readOnly = mode === 'edit';
  document.getElementById('btn-save').textContent = mode === 'edit' ? '更新を保存' : '新規記事を保存';
  if (mode === 'new') {
    resetFormForNew();
  } else {
    setSaveStatus('');
  }
}

// ---------- 初期化 ----------

function populateSettingsForm(s) {
  document.getElementById('pat').value = s.pat || '';
  document.getElementById('owner').value = s.owner || OWNER_DEFAULT;
  document.getElementById('repo').value = s.repo || REPO_DEFAULT;
  document.getElementById('branch').value = s.branch || '';
  document.getElementById('gas-url').value = s.gasUrl || '';
}

function updateSettingsStatus() {
  const hasPat = !!(state.settings && state.settings.pat);
  const hasGas = !!(state.settings && state.settings.gasUrl);
  setStatus(
    'settings-status',
    `GitHub PAT: ${hasPat ? '設定済み' : '未設定'} / URL変換プロキシ: ${hasGas ? '設定済み' : '未設定（URL変換は無効です）'}`,
    hasPat ? 'ok' : 'error'
  );
  const convertBtn = document.getElementById('btn-url-convert');
  if (convertBtn) convertBtn.disabled = !hasGas;
}

function wireSettings() {
  const existing = loadSettings() || { owner: OWNER_DEFAULT, repo: REPO_DEFAULT };
  state.settings = existing;
  populateSettingsForm(existing);
  updateSettingsStatus();

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const s = {
      pat: document.getElementById('pat').value.trim(),
      owner: document.getElementById('owner').value.trim() || OWNER_DEFAULT,
      repo: document.getElementById('repo').value.trim() || REPO_DEFAULT,
      branch: document.getElementById('branch').value.trim(),
      gasUrl: document.getElementById('gas-url').value.trim(),
    };
    state.settings = s;
    saveSettingsToStorage(s);
    updateSettingsStatus();
    setGlobalStatus('設定を保存しました（このブラウザのlocalStorageにのみ保存されています）', 'ok');
  });

  document.getElementById('btn-clear-settings').addEventListener('click', () => {
    clearSettingsStorage();
    state.settings = { owner: OWNER_DEFAULT, repo: REPO_DEFAULT };
    populateSettingsForm(state.settings);
    updateSettingsStatus();
    setGlobalStatus('設定を削除しました', 'ok');
  });
}

function wireSlugAuto() {
  const slugEl = document.getElementById('field-slug');
  const titleEl = document.getElementById('field-title');
  const dateEl = document.getElementById('field-date');

  slugEl.addEventListener('input', () => {
    slugManuallyEdited = true;
  });

  const refresh = () => {
    if (state.mode === 'new' && !slugManuallyEdited) {
      slugEl.value = defaultSlug(titleEl.value, dateEl.value || todayStr());
    }
  };
  titleEl.addEventListener('input', refresh);
  dateEl.addEventListener('input', refresh);
}

function wireArticleList() {
  document.getElementById('btn-load-articles').addEventListener('click', async () => {
    if (!requireAuth(setLoadStatus)) return;
    const btn = document.getElementById('btn-load-articles');
    btn.disabled = true;
    setLoadStatus('記事一覧を取得中...');
    try {
      const articles = await loadArticles((done, total) => {
        setLoadStatus(`読み込み中... (${done}/${total})`);
      });
      state.articles = articles;
      renderArticleList(articles);
      setLoadStatus(`${articles.length}件読み込みました`, 'ok');
    } catch (err) {
      setLoadStatus(`読み込みに失敗しました: ${err.message || err}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('article-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? state.articles.filter(
          (a) => (a.title || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q)
        )
      : state.articles;
    renderArticleList(filtered);
  });
}

function init() {
  wireSettings();
  rememberCategories([]);
  switchMode('new');

  document.getElementById('tab-new').addEventListener('click', () => switchMode('new'));
  document.getElementById('tab-edit').addEventListener('click', () => switchMode('edit'));
  document.getElementById('btn-new-post').addEventListener('click', () => switchMode('new'));

  document.getElementById('btn-check-slug').addEventListener('click', handleCheckSlug);
  document.getElementById('btn-save').addEventListener('click', () => {
    if (state.mode === 'edit') handleSaveEdit();
    else handleSaveNew();
  });

  document.getElementById('btn-preview-toggle').addEventListener('click', togglePreview);
  document.getElementById('btn-url-convert').addEventListener('click', () => {
    convertUrlAtSelection(document.getElementById('field-body'));
  });

  wireSlugAuto();
  wireArticleList();
  wireTextareaPaste(document.getElementById('field-body'));

  // 本文の内容が変わるたびに「未使用」判定を再描画する（軽量なincludes判定のみ）
  document.getElementById('field-body').addEventListener('input', renderUploadedImages);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
