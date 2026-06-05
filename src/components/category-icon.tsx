import type { Category } from "@/lib/catalog";

// Renders a category's visual: an uploaded image when set, otherwise the emoji icon.
// `imgClassName` styles the <img>; `emojiClassName` styles the emoji <span>.
export function CategoryIcon({
  category,
  imgClassName = "h-full w-full object-cover",
  emojiClassName,
}: {
  category: Pick<Category, "icon" | "image_url" | "name_mn">;
  imgClassName?: string;
  emojiClassName?: string;
}) {
  if (category.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={category.image_url} alt={category.name_mn} className={imgClassName} />
    );
  }
  return <span className={emojiClassName}>{category.icon}</span>;
}
