"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

export default function InvoiceUpload({ operationId }: { operationId: string }) {
  const supabase = supabaseBrowser();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getUser();
    const userId = sessionData.user?.id;
    if (!userId) {
      setUploading(false);
      setMessage("No hay sesión activa");
      return;
    }

    for (const file of Array.from(files)) {
      const path = `${userId}/${operationId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('invoices').upload(path, file, {
        upsert: false,
      });
      if (uploadError) {
        setMessage(uploadError.message);
        continue;
      }

      // Save metadata in documents
      await supabase.from('documents').insert({
        operation_id: operationId,
        kind: 'invoice_file',
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }

    setUploading(false);
    setMessage("Carga completada");
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Cargar facturas</label>
      <input type="file" multiple onChange={(e) => handleFiles(e.target.files)} />
      <div>
        <Button variant="outline" size="sm" onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()} disabled={uploading}>
          {uploading ? 'Cargando...' : 'Seleccionar archivos'}
        </Button>
      </div>
      {message && <div className="text-sm text-lp-sec-3">{message}</div>}
      <p className="text-xs text-muted-foreground">Se almacenarán de forma privada y solo tú podrás acceder.</p>
    </div>
  );
}

