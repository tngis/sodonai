import {
  Users, User, Image as ImageIcon, Camera, Palette, Sparkles, Wand2,
  Paintbrush, Scissors, Sun, Moon, Star, Heart, Frame, Crop, Aperture,
  Mountain, Baby, Smile, Shapes, type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/catalog";

// Category visuals are Lucide icons, chosen by name in the admin (the `icon`
// column stores a name like "users", not an emoji). Unknown/legacy values fall
// back to a generic glyph so nothing renders raw emoji.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  users: Users,
  user: User,
  image: ImageIcon,
  camera: Camera,
  palette: Palette,
  sparkles: Sparkles,
  wand: Wand2,
  brush: Paintbrush,
  scissors: Scissors,
  sun: Sun,
  moon: Moon,
  star: Star,
  heart: Heart,
  frame: Frame,
  crop: Crop,
  aperture: Aperture,
  mountain: Mountain,
  baby: Baby,
  smile: Smile,
  shapes: Shapes,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

const FALLBACK_ICON: LucideIcon = Shapes;

// Resolve a category's stored icon name to a Lucide component (always non-null).
export function resolveCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name.toLowerCase()]) || FALLBACK_ICON;
}

// Just the icon glyph — used as the image fallback throughout the catalog UI.
// `category` may instead be an icon name, for previewing options in the admin.
export function CategoryGlyph({
  category,
  className,
}: {
  category: Pick<Category, "icon"> | { icon: string };
  className?: string;
}) {
  // Member access (not a call) keeps the rules-of-react lint happy about
  // "components created during render".
  const Icon = CATEGORY_ICONS[(category.icon ?? "").toLowerCase()] ?? FALLBACK_ICON;
  return <Icon className={className} />;
}

// Renders a category's visual: an uploaded image when set, otherwise its icon.
// `imgClassName` styles the <img>; `className` styles the icon glyph.
export function CategoryIcon({
  category,
  imgClassName = "h-full w-full object-cover",
  className = "size-7",
}: {
  category: Pick<Category, "icon" | "image_url" | "name_mn">;
  imgClassName?: string;
  className?: string;
}) {
  if (category.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={category.image_url} alt={category.name_mn} className={imgClassName} />
    );
  }
  return <CategoryGlyph category={category} className={className} />;
}
