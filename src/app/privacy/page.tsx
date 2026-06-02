import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Нууцлалын бодлого — aistudio.mn" };

export default function PrivacyPage() {
  return (
    <div className="px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-2xl">
        <Button render={<Link href="/settings" />} variant="ghost" size="sm" className="mb-6 -ml-2 rounded-full gap-1.5">
          <ArrowLeft size={14} /> Буцах
        </Button>

        <h1 className="mb-2 text-2xl font-black tracking-tight">Нууцлалын бодлого</h1>
        <p className="mb-8 text-sm text-muted-foreground">Сүүлд шинэчилсэн: 2026 оны 5-р сар</p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="mb-2 text-base font-bold">1. Бид ямар мэдээлэл цуглуулдаг вэ?</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Бүртгэлийн мэдээлэл:</strong> имэйл хаяг эсвэл утасны дугаар</li>
              <li><strong>Профайлын мэдээлэл:</strong> нэр (заавал биш)</li>
              <li><strong>Оруулсан зургууд:</strong> AI боловсруулалтын зорилгоор хадгалагдана</li>
              <li><strong>Гаралтын зургууд:</strong> таны галлерид хадгалагдана</li>
              <li><strong>Гүйлгээний мэдээлэл:</strong> захиалга, төлбөрийн түүх</li>
              <li><strong>Техникийн мэдээлэл:</strong> IP хаяг, төхөөрөмжийн мэдээлэл, хуурцгийн мэдээлэл</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">2. Мэдээллийг хэрхэн ашигладаг вэ?</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Үйлчилгээ үзүүлэх, AI зураг боловсруулах</li>
              <li>Төлбөрийн баримт гаргах, захиалгын статус мэдэгдэх</li>
              <li>Аюулгүй байдал хангах, луйврын эсрэг хамгаалах</li>
              <li>Үйлчилгээ сайжруулах (нэрлэгдэхгүй статистик)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">3. Мэдээллийг хуваалцдаг уу?</h2>
            <p className="text-muted-foreground">
              Бид таны хувийн мэдээллийг гуравдагч этгээдэд зардаггүй. Зөвхөн дараах тохиолдолд хуваалцна:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Суpabase:</strong> мэдээллийн сан ба баталгаажуулалт</li>
              <li><strong>QPay:</strong> төлбөрийн гүйлгээ боловсруулах</li>
              <li><strong>AI backend:</strong> зургийн боловсруулалт</li>
              <li>Хуулийн шаардлагаар</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">4. Зургийн хадгалалт</h2>
            <p className="text-muted-foreground">
              Оруулсан болон гарсан бүх зурагт таны зөвшөөрөлгүйгээр хэн ч хандах боломжгүй.
              Зургийг хувийн тохиргоотой байлгах эсэхийг та өөрөө сонгоно. Нийтэд харагдах
              тохиргоонд зөвхөн та идэвхжүүлсэн үед бусад хэрэглэгчид харж болно.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">5. Таны эрхүүд</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Харах:</strong> Тохиргоо → Өгөгдөл татах хэсгээс бүх өгөгдлөө JSON форматаар татаж авах</li>
              <li><strong>Устгах:</strong> Тохиргоо → Өгөгдөл устгах хэсгээс бүртгэл болон бүх өгөгдлөө устгах</li>
              <li><strong>Залруулах:</strong> Профайлын нэр, холбоо барих мэдээллийг өөрчлөх</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">6. Хуурцаг (Cookie)</h2>
            <p className="text-muted-foreground">
              Бид зөвхөн нэвтрэлтийн сессийг удирдахад шаардлагатай хуурцаг ашигладаг.
              Гуравдагч этгээдийн хянах хуурцаг ашиглагддаггүй.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-bold">7. Холбоо барих</h2>
            <p className="text-muted-foreground">
              Нууцлалтай холбоотой асуулт, санал гомдол:{" "}
              <a href="mailto:privacy@aistudio.mn" className="text-primary hover:underline">privacy@aistudio.mn</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
