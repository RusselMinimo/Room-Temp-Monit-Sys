import { NextRequest, NextResponse } from "next/server";

import { getSession, isAdminEmail } from "@/lib/auth";
import { listAssignments, setAssignment } from "@/lib/assignments";

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  if (!isAdminEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ assignments: listAssignments() });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  if (!isAdminEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { email?: string; deviceId?: string | null };
    if (!body?.email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    setAssignment(body.email, body.deviceId ?? null);
    return NextResponse.json({ assignments: listAssignments() });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}


