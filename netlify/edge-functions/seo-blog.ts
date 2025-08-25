// netlify/edge-functions/seo-blog.ts
// Inject OG/Twitter meta into your existing /html/blog-detail.html
// so CSS/JS from your static page still load.

const API_BASE ="https://backend.ashwanthrkumar.in"; // e.g. https://<cloud-run>.a.run.app
const SITE_ORIGIN = "https://ashwanthrkumar.in"; // your live origin (used for canonical)

export default async (request: Request, context: any) => {
  const url = new URL(request.url);

  // 1) Extract slug (supports ?slug=... and /blog/:slug)
  let slug = url.searchParams.get("slug") || "";
  if (!slug && url.pathname.startsWith("/blog/")) {
    slug = decodeURIComponent(url.pathname.replace(/^\/blog\//, "").replace(/\/+$/, ""));
  }
  if (!slug) return context.next(); // let the normal page render

  // 2) Fetch post JSON from your API
  let post: any = null;
  try {
    const api = `${API_BASE}/api/blogs/${encodeURIComponent(slug)}`;
    const r = await fetch(api, { headers: { accept: "application/json" } });
    if (r.ok) {
      const j = await r.json();
      post = j?.post;
    }
  } catch (_) {
    // ignore – we’ll just not inject tags
  }

  // 3) Get the original HTML (your static file with CSS/JS)
  const originalResponse = await context.next(); // continues to your static /html/blog-detail.html

  if (!post) {
    // No post? return original page unchanged
    return originalResponse;
  }

  // 4) Build meta to inject
  const title = post.title || "Blog post";
  const desc  = post.excerpt || "Read this post by Ashwanth R Kumar.";
  const img   = post.imageUrl || `${SITE_ORIGIN}/assets/images/resources/placeholder.jpg`;
  const canonical = `${SITE_ORIGIN}/html/blog-detail.html?slug=${encodeURIComponent(post.slug)}`;
  const published = post.publishedAt || "";

  const metas = [
    `<title>${escapeHtml(title)} — Ashwanth R Kumar</title>`,
    `<meta name="description" content="${escapeHtml(desc)}">`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Ashwanth R Kumar">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(desc)}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:url" content="${canonical}">`,
    published ? `<meta property="article:published_time" content="${published}">` : "",
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(desc)}">`,
    `<meta name="twitter:image" content="${img}">`
  ].filter(Boolean).join("");

  // 5) Inject into <head> without touching your CSS/JS
  const transformed = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(metas, { html: true });
      }
    })
    // Optional: also inject an h1 fallback if your HTML has a placeholder
    .on("[data-post-title]", {
      element(el) { el.setInnerContent(title); }
    })
    .transform(originalResponse);

  return new Response(transformed.body, {
    headers: {
      ...Object.fromEntries(originalResponse.headers),
      "cache-control": "public, max-age=60, s-maxage=300"
    },
    status: originalResponse.status
  });
};

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
