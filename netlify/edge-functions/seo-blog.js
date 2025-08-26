// netlify/edge-functions/seo-blog.js
// Inject OG/Twitter meta by string replacement (no HTMLRewriter required)
// Strips old <title>, description, and previous og:/twitter: tags to avoid duplicates.

const API_BASE = "https://backend.ashwanthrkumar.in";
const SITE_ORIGIN = "https://ashwanthrkumar.in";

// Optional: set your Twitter handle (or leave empty)
const TWITTER_SITE = ""; // e.g. "@ashwanthrkumar"

export default async (request, context) => {
  const url = new URL(request.url);
  console.log("[seo-blog] req:", url.pathname, url.search);

  const isBlog =
    url.pathname === "/html/blog-detail.html" ||
    url.pathname.startsWith("/blog/");

  // Always get the original response first (keeps CSS/JS)
  const original = await context.next();

  if (!isBlog) {
    return withHeader(original, "x-edge-seo-blog", "skip");
  }

  // Resolve slug from ?slug= or /blog/:slug
  let slug = url.searchParams.get("slug") || "";
  if (!slug && url.pathname.startsWith("/blog/")) {
    slug = decodeURIComponent(url.pathname.replace(/^\/blog\//, "").replace(/\/+$/, ""));
  }
  console.log("[seo-blog] slug:", slug || "<none>");
  if (!slug) return withHeader(original, "x-edge-seo-blog", "no-slug");

  // Fetch post JSON (defensive)
  let post = null;
  try {
    const apiUrl = `${API_BASE}/api/blogs/${encodeURIComponent(slug)}`;
    console.log("[seo-blog] fetch:", apiUrl);
    const r = await fetch(apiUrl, { headers: { accept: "application/json" } });
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    console.log("[seo-blog] status:", r.status, "ct:", ct);
    if (r.ok && ct.includes("application/json")) {
      const j = await r.json();
      console.log("[seo-blog] json keys:", Object.keys(j));
      post = j?.post ?? j; // supports {post,...} or raw object
    }
  } catch (e) {
    console.log("[seo-blog] fetch error:", e);
  }

  if (!post) {
    return withHeader(original, "x-edge-seo-blog", "hit-no-post");
  }

  // Build metas
  const title = post.title || "Blog post";
  const desc  = post.excerpt || "Read this post by Ashwanth R Kumar.";
  const img   = post.imageUrl || `${SITE_ORIGIN}/assets/images/resources/placeholder.jpg`;
  const canonical = `${SITE_ORIGIN}/html/blog-detail.html?slug=${encodeURIComponent(post.slug || slug)}`;
  const published = post.publishedAt || "";

  const metaParts = [
    `<title>${esc(title)} — Ashwanth R Kumar</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Ashwanth R Kumar">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:url" content="${canonical}">`,
    published ? `<meta property="article:published_time" content="${published}">` : "",
    // Optional image dimensions (helps some scrapers)
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    // Twitter
    `<meta name="twitter:card" content="summary_large_image">`,
    TWITTER_SITE ? `<meta name="twitter:site" content="${TWITTER_SITE}">` : "",
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${img}">`,
    // Marker so we can grep it
    `<meta name="nf-edge" content="seo-blog">`
  ].filter(Boolean);

  const metas = metaParts.join("");

  // Read and sanitize original HTML, then inject our metas before </head>
  let html;
  try {
    const src = await original.text();

    // Strip existing <title>, <meta name="description">, and any og:/twitter: tags
    const cleaned = src
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+name=["']description["'][^>]*>\s*/ig, "")
      .replace(/<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/ig, "");

    const closeHead = /<\/head>/i;
    html = closeHead.test(cleaned)
      ? cleaned.replace(closeHead, metas + "</head>")
      : metas + cleaned; // fallback: prepend if no </head>

  } catch (e) {
    console.log("[seo-blog] could not read original HTML:", e);
    return withHeader(original, "x-edge-seo-blog", "read-error");
  }

  const headers = new Headers(original.headers);
  headers.set("content-type", "text/html; charset=UTF-8");
  headers.set("cache-control", "public, max-age=60, s-maxage=300");
  headers.set("x-edge-seo-blog", "hit");
  console.log("[seo-blog] meta injected OK for:", title);

  return new Response(html, { status: original.status, headers });
};

// helpers
function withHeader(res, key, val) {
  const h = new Headers(res.headers);
  h.set(key, val);
  return new Response(res.body, { status: res.status, headers: h });
}

function esc(s) {
  return (s || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
