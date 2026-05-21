"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { syncPlayersFromWikipedia } from "@/lib/wiki/sync";

export async function runWikiSyncNow(): Promise<void> {
  await requireAdmin();
  await syncPlayersFromWikipedia();
  revalidatePath("/admin/wiki-sync");
  revalidatePath("/admin/players");
  revalidatePath("/players");
}
