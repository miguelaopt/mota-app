"use client";

import { useState, useTransition } from "react";
import { CameraIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/Button";
import { FormError } from "@/components/ui/fields";
import { setPhotoAction, type PhotoTarget } from "@/lib/actions/photos";
import { cn } from "@/lib/cn";
import { resizeImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

/**
 * Foto de uma mota ou item. O ficheiro é redimensionado no browser e enviado
 * diretamente para o Supabase Storage (bucket privado, pasta do utilizador).
 */
export function PhotoUpload({
  userId,
  target,
  targetId,
  url,
  alt,
  className,
}: {
  userId: string;
  target: PhotoTarget;
  targetId: string;
  url: string | null;
  alt: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [removing, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? url;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeImage(file);
      setPreview(URL.createObjectURL(blob));
      const path = `${userId}/${target}/${targetId}-${Date.now()}.jpg`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("photos").upload(path, blob, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;
      const result = await setPhotoAction(target, targetId, path);
      if (!result?.ok) throw new Error(result?.error);
    } catch (e) {
      console.error(e);
      setPreview(null);
      setError("Não foi possível carregar a foto. Tenta outra vez.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!confirm("Remover a foto?")) return;
    startRemove(async () => {
      const result = await setPhotoAction(target, targetId, null);
      if (result?.ok) setPreview(null);
      else setError(result?.error ?? "Não foi possível remover a foto.");
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-card-2">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted">
            <CameraIcon size={32} />
            <span className="text-sm">Sem foto</span>
          </div>
        )}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">A carregar…</div>}
      </div>
      <div className="flex gap-2">
        <label className={buttonClass("secondary", "md", cn("flex-1 cursor-pointer", busy && "pointer-events-none opacity-50"))}>
          <CameraIcon size={18} />
          {shown ? "Alterar foto" : "Adicionar foto"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {shown && !busy && (
          <button type="button" onClick={remove} disabled={removing} className={buttonClass("danger", "md")}>
            {removing ? "…" : "Remover"}
          </button>
        )}
      </div>
      <FormError error={error} />
    </div>
  );
}
