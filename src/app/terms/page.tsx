import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Үйлчилгээний нөхцөл — aistudio.mn" };

export default function TermsPage() {
  return (
    <div className="px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-2xl">
        <Button render={<Link href="/settings" />} variant="ghost" size="sm" className="mb-6 -ml-2 rounded-full gap-1.5">
          <ArrowLeft size={14} /> Буцах
        </Button>

        <h1 className="mb-2 text-2xl font-black tracking-tight">Үйлчилгээний нөхцөл</h1>
        <p className="mb-8 text-sm text-muted-foreground">Сүүлд шинэчилсэн: 2026 оны 5-р сар</p>

        <div className="prose prose-sm max-w-none dark:prose-invert space-y-6 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="mb-2 text-base font-bold">1. Үйлчилгээний тухай</h2>
            <p className="text-muted-foreground">
              aistudio.mn нь Монгол хэрэглэгчдэд зориулсан AI зургийн үйлчилгээ юм. Та манай платформыг ашигласнаар
              доорх нөхцлийг зөвшөөрч байгаагаа илэрхийлж байна.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">2. Бүртгэл ба хэрэглэгч</h2>
            <p className="text-muted-foreground">
              Та үйлчилгээ ашиглахын тулд бүртгэлтэй байх шаардлагатай. Бүртгэлийнхээ мэдээллийн нууцлалыг хамгаалах
              хариуцлага та өөрт хамаарна. Бусдын бүртгэлийг ашиглахыг хориглоно.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">3. Контент ба оюуны өмч</h2>
            <p className="text-muted-foreground">
              Та оруулах зургуудаа эрхтэй болохоо баталгаажуулж байна. AI-ийн гаргасан зургийг хувийн зорилгоор
              ашиглах эрхийг та авна. Гуравдагч этгээдийн оюуны өмчийн эрхийг зөрчсөн контент оруулахыг хориглоно.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">4. Төлбөр ба буцаалт</h2>
            <p className="text-muted-foreground">
              Бүх төлбөр QPay болон банкны апп-аар хийгдэнэ. <strong>AI үүсгэлт эхэлсний дараа төлбөр буцаах
              боломжгүй.</strong> Техникийн алдаанаас үүссэн тохиолдолд холбогдоно уу.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">5. Зөвшөөрөгдөхгүй үйлдлүүд</h2>
            <p className="text-muted-foreground">
              Доорх зүйлийг хатуу хориглоно:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Бусдын зөвшөөрөлгүйгээр тэдний дүр төрхийг ашиглах</li>
              <li>Насанд хүрэгчдэд зориулсан контент үүсгэх</li>
              <li>Хуурамч, төөрөгдүүлэх контент тараах</li>
              <li>Платформыг автоматаар ашиглах (bot, scraping)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">6. Үйлчилгээний хариуцлага</h2>
            <p className="text-muted-foreground">
              AI-ийн гаргасан үр дүн 100% нарийвчлалтай байх баталгаа өгөхгүй. Манай үйлчилгээ «байгаагаараа»
              нийлүүлэгдэнэ. Бид дамжуулсан контентийн үр дагаварт хариуцлага хүлээхгүй.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">7. Нөхцөл өөрчлөх</h2>
            <p className="text-muted-foreground">
              Бид нөхцлийг урьдчилан мэдэгдэлгүйгээр өөрчлөх эрхтэй. Өөрчлөлт хийсний дараа үйлчилгээг
              үргэлжлүүлэн ашиглах нь шинэ нөхцлийг зөвшөөрсөн гэж тооцогдоно.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">8. Холбоо барих</h2>
            <p className="text-muted-foreground">
              Асуулт байвал: <a href="mailto:support@aistudio.mn" className="text-primary hover:underline">support@aistudio.mn</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
