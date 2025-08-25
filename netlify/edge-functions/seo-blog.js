// netlify/edge-functions/seo-blog.js
const API_BASE = "https://backend.ashwanthrkumar.in";
const SITE_ORIGIN = "https://ashwanthrkumar.in";

/* global HTMLRewriter */ // provided by Netlify Edge

export default async (request, context) => {
  try {
    const url = new URL(request.url);

    if (!(url.pathname === "/html/blog-detail.html" || url.pathname.startsWith("/blog/"))) {
      return context.next();
    }

    let slug = url.searchParams.get("slug") || "";
    if (!slug && url.pathname.startsWith("/blog/")) {
      slug = decodeURIComponent(url.pathname.replace(/^\/blog\//, "").replace(/\/+$/, ""));
    }
    if (!slug) return context.next();

    let post = null;
    try {
      const r = await fetch(`${API_BASE}/api/blogs/${encodeURIComponent(slug)}`, {
        headers: { accept: "application/json" }
      });
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (r.ok && ct.includes("application/json")) {
        const j = await r.json();
        post = j?.post ?? j;
      }
    } catch {}

    const original = await context.next();
    // If no post, still return original but add a header so you know edge ran
    if (!post) {
      const h = new Headers(original.headers);
      h.set("x-edge-seo-blog", "hit-no-post");
      return new Response(original.body, { status: original.status, headers: h });
    }

    const title = post.title || "Blog post";
    const desc  = post.excerpt || "Read this post by Ashwanth R Kumar.";
    const img   = post.imageUrl || `${SITE_ORIGIN}/assets/images/resources/placeholder.jpg`;
    const canonical = `${SITE_ORIGIN}/html/blog-detail.html?slug=${encodeURIComponent(post.slug || slug)}`;
    const published = post.publishedAt || "";

    const metas = [
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
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(desc)}">`,
      `<meta name="twitter:image" content="${img}">`,
      // marker so you can see it in View Source
      `<meta name="nf-edge" content="seo-blog">`
    ].filter(Boolean).join("");

    const rewritten = new HTMLRewriter()
      .on("head", { element(el) { el.append(metas, { html: true }); } })
      .transform(original);

    const headers = new Headers(rewritten.headers);
    headers.set("cache-control", "public, max-age=60, s-maxage=300");
    headers.set("x-edge-seo-blog", "hit");
    return new Response(rewritten.body, { status: rewritten.status, headers });
  } catch {
    return context.next();
  }
};

function esc(s) {
  return (s || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
