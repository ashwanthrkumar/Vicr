// minimal proof the function runs on the route
export default async (request, context) => {
  const url = new URL(request.url);
  // pass through to your static file so CSS/JS still render
  const res = await context.next();

  // add super-obvious debug headers
  const h = new Headers(res.headers);
  h.set("x-edge-seo-blog", "hello");
  h.set("x-edge-url", url.pathname + url.search);

  // log into Netlify deploy logs too
  console.log("seo-blog hit:", url.pathname, url.search);

  return new Response(res.body, { status: res.status, headers: h });
};
