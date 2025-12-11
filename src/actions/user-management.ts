"use server";

import { getUserManagementData } from "@/lib/user-management";

export async function getUserManagementAction() {
  try {
    const result = await getUserManagementData();
    return result;
  } catch (error) {
    throw error;
  }
}

