// netlify/edge-functions/seo-blog.ts
const API_BASE = "https://backend.ashwanthrkumar.in"; // e.g. https://<your-cloud-run>.a.run.app

export default async (req: Request) => {
  const url = new URL(req.url);

  // slug from ?slug=... or /blog/:slug
  let slug = url.searchParams.get("slug") || "";
  if (!slug && url.pathname.startsWith("/blog/")) {
    slug = decodeURIComponent(url.pathname.replace(/^\/blog\//, "").replace(/\/+$/, ""));
  }
  if (!slug) return new Response("Missing slug", { status: 400 });

  const r = await fetch(`${API_BASE}/api/blogs/${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } });
  if (!r.ok) return new Response("Post not found", { status: 404 });

  const { post } = await r.json();
  const title = post.title || "Blog post";
  const desc  = post.excerpt || "Read this post by Ashwanth R Kumar.";
  const img   = post.imageUrl || "https://ashwanthrkumar.in/assets/images/resources/placeholder.jpg";
  const canonical = `https://ashwanthrkumar.in/html/blog-detail.html?slug=${encodeURIComponent(post.slug)}`;
  const published = post.publishedAt || "";

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Ashwanth R Kumar</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Ashwanth R Kumar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${canonical}">
${published ? `<meta property="article:published_time" content="${published}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${img}">
<link rel="icon" href="/assets/images/logos/favicon.svg">
<link rel="stylesheet" href="/assets/css/bootstrap-reboot.css">
<link rel="stylesheet" href="/assets/css/aos.css">
<style>.object-fit-cover{object-fit:cover}</style>
</head><body class="bg-light">
<section class="bg-light-gray py-4 border-bottom bg-white"><div class="container">
  <nav class="small text-opacity-75">
    <a href="/" class="text-decoration-none">Home</a> /
    <a href="/html/blog.html" class="text-decoration-none">Blog</a> /
    <span>${esc(title)}</span>
  </nav>
  <h1 class="display-5 mt-3 mb-0">${esc(title)}</h1>
</div></section>
<section class="py-4"><div class="container"><div class="ratio ratio-21x9 rounded-4 overflow-hidden">
  <img src="${img}" alt="${esc(title)}" class="w-100 h-100 object-fit-cover" loading="eager">
</div></div></section>
<section class="py-5"><div class="container"><div class="row justify-content-center"><article class="col-lg-9 col-xl-8">
  ${post.contentHtml ?? "<p>Loading…</p>"}
</article></div></div></section>
</body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300"
    }
  });
};

function esc(s: string) {
  return (s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
