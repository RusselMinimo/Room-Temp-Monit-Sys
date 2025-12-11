"use server";

import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth";
import { clearAuthLogs, deleteAuthLogById } from "@/lib/auth-logs";

export async function deleteAuthLogAction(_state: { error?: string }, formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "Missing log id" };
  }
  const ok = deleteAuthLogById(id);
  if (!ok) {
    return { error: "Log not found" };
  }
  return {};
}

export async function clearAuthLogsAction() {
  await requireAdminSession();
  clearAuthLogs();
  // Don't redirect - let the SSE stream handle the UI update
}


