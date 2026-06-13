import { getCategoryServer } from "@/lib/catalog-server";
import CategoryClient from "./category-client";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getCategoryServer(id);
  return <CategoryClient initialCategory={category} />;
}
