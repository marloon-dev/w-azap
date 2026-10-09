import { NextRequest, NextResponse } from "next/server";
import { getApiDocs } from "@/lib/swagger";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  // The spec maps every endpoint; only logged-in users or API key holders may read it
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.NEXT_PUBLIC_SWAGGER_ENABLED === "false") {
    return NextResponse.json({ status: false, message: "Not found", error: "Not found" }, { status: 404 });
  }
  const spec = getApiDocs();
  return NextResponse.json(spec);
}
