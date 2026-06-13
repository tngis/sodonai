import {
  getCategoriesServer,
  getCategoryCoversServer,
  getFeaturedPresetsServer,
} from "@/lib/catalog-server";
import HomeClient from "./home-client";

export default async function HomePage() {
  const [categories, featured, categoryCovers] = await Promise.all([
    getCategoriesServer(),
    getFeaturedPresetsServer(),
    getCategoryCoversServer(),
  ]);
  return (
    <HomeClient
      initialCategories={categories}
      initialFeatured={featured}
      initialCategoryCovers={categoryCovers}
    />
  );
}
