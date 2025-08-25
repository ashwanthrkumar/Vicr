export default async (request, context) => {
  const res = await context.next();           // pass through to your static file
  const h = new Headers(res.headers);
  h.set("x-edge-ping", "hit");                 // simple marker header
  return new Response(res.body, { status: res.status, headers: h });
};
