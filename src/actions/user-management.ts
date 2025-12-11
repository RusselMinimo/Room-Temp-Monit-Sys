"use server";

import { getUserManagementData } from "@/lib/user-management";

export async function getUserManagementAction() {
  return await getUserManagementData();
}

