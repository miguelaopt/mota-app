import type { Metadata } from "next";
import { ExternalLinkIcon } from "@/components/icons";
import { PhotoUpload } from "@/components/PhotoUpload";
import { buttonClass } from "@/components/ui/Button";
import { Card, Section } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { getActiveMotorcycle } from "@/lib/data/motorcycles";
import { signPhotoUrls } from "@/lib/data/photos";
import { MotorcycleForm } from "./MotorcycleForm";

export const metadata: Metadata = { title: "A mota" };

export default async function MotorcyclePage() {
  const { supabase, userId } = await requireSession();
  const motorcycle = await getActiveMotorcycle(supabase);
  const photos = await signPhotoUrls(supabase, [motorcycle?.photoPath]);

  return (
    <>
      <PageHeader
        title={motorcycle ? "A mota" : "Escolhe a mota"}
        subtitle={motorcycle ? undefined : "Começa por dizer que mota queres e quanto custa."}
        back={{ href: "/", label: "Início" }}
      />

      {motorcycle && (
        <PhotoUpload
          userId={userId}
          target="motorcycles"
          targetId={motorcycle.id}
          url={motorcycle.photoPath ? (photos[motorcycle.photoPath] ?? null) : null}
          alt={motorcycle.model}
          className="mb-4"
        />
      )}

      <Card>
        <MotorcycleForm key={motorcycle?.id ?? "nova"} motorcycle={motorcycle} />
      </Card>

      {motorcycle?.listingUrl && (
        <Section>
          <a href={motorcycle.listingUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md", "w-full")}>
            Abrir anúncio <ExternalLinkIcon size={18} />
          </a>
        </Section>
      )}

      {!motorcycle && <p className="mt-4 px-1 text-sm text-muted">Depois de guardares podes acrescentar uma foto.</p>}
    </>
  );
}
