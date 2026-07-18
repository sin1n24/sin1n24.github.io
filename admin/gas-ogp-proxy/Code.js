/**
 * sin1studio-admin-ogp-proxy
 *
 * /admin/ のURL→Markdownリンク変換機能のためのプロキシ。
 * ブラウザから任意サイトへ直接fetchするとCORSでブロックされるため、
 * Google Apps Script のWebアプリを介して <title> / og:title を取得して返す。
 *
 * 使い方:
 *   GET <デプロイURL>?url=<対象URL>
 *   -> { ok: true, title: "取得したタイトル", url: "<対象URL>" }
 *   -> 失敗時 { ok: false, error: "...", url: "<対象URL>" }
 *
 * 導入手順は README.md を参照。
 */

function doGet(e) {
  const targetUrl = e && e.parameter && e.parameter.url;

  if (!targetUrl) {
    return jsonResponse_({ ok: false, error: 'url パラメータが必要です' });
  }

  if (!isValidUrl_(targetUrl)) {
    return jsonResponse_({ ok: false, error: 'url が不正です（http/httpsのURLを指定してください）', url: targetUrl });
  }

  try {
    const response = UrlFetchApp.fetch(targetUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; sin1studio-admin-ogp-proxy/1.0; +https://sin1.studio/)',
      },
    });

    const status = response.getResponseCode();
    if (status < 200 || status >= 400) {
      return jsonResponse_({
        ok: false,
        error: 'HTTP ' + status + ' で取得に失敗しました',
        url: targetUrl,
      });
    }

    const html = response.getContentText();
    const title = extractTitle_(html);

    if (!title) {
      return jsonResponse_({ ok: false, error: 'タイトルを取得できませんでした', url: targetUrl });
    }

    return jsonResponse_({ ok: true, title: title, url: targetUrl });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err), url: targetUrl });
  }
}

/** http/https の簡易バリデーション（Apps Scriptには標準URLクラスが無いため） */
function isValidUrl_(str) {
  return /^https?:\/\/.+/i.test(str);
}

/** og:title を優先し、無ければ <title> タグから抽出する */
function extractTitle_(html) {
  const ogPatterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["'][^>]*>/i,
  ];
  for (const re of ogPatterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities_(m[1].trim());
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return decodeEntities_(titleMatch[1].trim());
  }

  return '';
}

/** 主要なHTMLエンティティのみをデコードする簡易実装 */
function decodeEntities_(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
