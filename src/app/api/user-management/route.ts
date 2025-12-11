import { NextResponse } from "next/server";
import { getSession, isAdminEmail } from "@/lib/auth";
import { getUserManagementData } from "@/lib/user-management";

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  if (!isAdminEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await getUserManagementData();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching user management data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

