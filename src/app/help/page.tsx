import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Тусламж / Түгээмэл асуултууд — aistudio.mn" };

const faqs = [
  {
    q: "AI зураг хэрхэн үүсгэх вэ?",
    a: "Загвараа сонгоод өөрийн зургаа оруулна. Төлбөрөө төлсний дараа AI таны зургийг боловсруулж, хэдэн секундын дотор шинэ зураг бэлэн болно.",
  },
  {
    q: "Зураг үүсгэхэд хэр хугацаа шаардагдах вэ?",
    a: "Ихэвчлэн 1-2 минут. Ачаалал ихтэй үед жаахан удааширч болзошгүй. Үүсгэлтийн явцыг дэлгэц дээр шууд харах боломжтой.",
  },
  {
    q: "Төлбөрөө хэрхэн төлөх вэ?",
    a: "Бүх төлбөр QPay-ээр хийгдэнэ. QR кодыг уншуулах эсвэл банкны апп руугаа шилжиж төлбөрөө баталгаажуулна.",
  },
  {
    q: "Төлбөрөө буцаалт авч болох уу?",
    a: "AI үүсгэлт эхэлсний дараа төлбөр буцаах боломжгүй. Техникийн алдаанаас үүдэн зураг бүтэлгүйтсэн тохиолдолд бидэнтэй холбогдоно уу.",
  },
  {
    q: "Хэвлэмэл захиалга хэрхэн хүргэгдэх вэ?",
    a: "Хэвлэмэл захиалгыг гараар бэлтгэн хүргэдэг. Захиалгынхаа төлөв болон хүргэлтийн мэдээллийг “Миний захиалга” хэсгээс хянах боломжтой.",
  },
  {
    q: "Миний зургийг бусад хэрэглэгч харах уу?",
    a: "Үгүй. Таны зураг анхдагчаар нууц байна. Зөвхөн та “Бусдад харуулах” тохиргоог асааж, тодорхой зургаа тэмдэглэсэн үед л нийтэд харагдана.",
  },
  {
    q: "Бүртгэлээ хэрхэн устгах вэ?",
    a: "Тохиргоо → Нууцлал хэсгээс “Өгөгдөл устгах” товчийг дарна. Энэ үйлдэл таны бүх захиалга, зураг, мэдээллийг бүрмөсөн устгах бөгөөд буцаах боломжгүй.",
  },
  {
    q: "Асуудал гарвал хэнтэй холбогдох вэ?",
    a: "Доорх и-мэйл хаягаар бидэнтэй холбогдоорой. Бид аль болох хурдан хариу өгөхийг хичээнэ.",
  },
];

export default function HelpPage() {
  return (
    <div className="px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-2xl">
        <Button
          render={<Link href="/settings" />}
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 rounded-full gap-1.5"
        >
          <ArrowLeft size={14} /> Буцах
        </Button>

        <h1 className="mb-2 text-2xl font-black tracking-tight">
          Тусламж / Түгээмэл асуултууд
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Хамгийн түгээмэл асуултуудын хариултыг эндээс үзнэ үү.
        </p>

        <div className="flex flex-col gap-4">
          {faqs.map(({ q, a }) => (
            <section
              key={q}
              className="rounded-xl p-4 shadow-(--shadow-card)"
            >
              <h2 className="mb-1.5 text-base font-bold">{q}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {a}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-xl bg-primary/5 p-4 shadow-(--shadow-card)">
          <p className="text-sm font-semibold">Асуултанд хариулт олдсонгүй юу?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Бидэнтэй холбогдоно уу:{" "}
            <a
              href="mailto:support@aistudio.mn"
              className="text-primary hover:underline"
            >
              support@aistudio.mn
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
