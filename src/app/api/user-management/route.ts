import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/auth";
import { getUserManagementData } from "@/lib/user-management";

export async function GET() {
  const session = requireSession();
  
  if (!isAdminEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = getUserManagementData();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching user management data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

