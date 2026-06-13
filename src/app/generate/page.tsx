import { getCategoriesServer } from "@/lib/catalog-server";
import GenerateClient from "./generate-client";

export default async function GenerateIndexPage() {
  const categories = await getCategoriesServer();
  return <GenerateClient initialCategories={categories} />;
}
