import { NextRequest, NextResponse } from "next/server";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstream = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3001";
  const url = `${upstream}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of ["cookie", "content-type", "origin", "x-forwarded-for"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(url, { method: request.method, headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(), cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000) });
    const result = new NextResponse(await response.arrayBuffer(), { status: response.status });
    result.headers.set("Content-Type", response.headers.get("content-type") || "application/json");
    result.headers.set("Cache-Control", "no-store");
    for (const cookie of response.headers.getSetCookie()) result.headers.append("Set-Cookie", cookie);
    return result;
  } catch {
    return NextResponse.json({ error: "O servidor não respondeu. Tente novamente." }, { status: 503 });
  }
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE, forward as PUT };
