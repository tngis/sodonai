import { createAdminClient } from "@/lib/supabase/admin";
import { CategoryManager } from "@/components/admin/category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("categories").select("*").order("sort_order");
  return <CategoryManager initialCategories={data ?? []} />;
}
