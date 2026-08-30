"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

export type CommandItem = { label: string; href: string; group: string; keywords?: string };

export function CommandPalette({ items, open, onOpenChange }: { items: CommandItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("ar");
  const filtered = useMemo(
    () => items.filter((item) => `${item.label} ${item.group} ${item.keywords ?? ""}`.toLocaleLowerCase("ar").includes(normalized)),
    [items, normalized],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setQuery(""); onOpenChange(nextOpen); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content className="ui-command" dir="rtl">
          <DialogPrimitive.Title className="sr-only">البحث العام</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">ابحث في أقسام المنصة وانتقل إليها</DialogPrimitive.Description>
          <div className="ui-command__search">
            <Search aria-hidden="true" size={20} />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في المنصة" aria-label="ابحث في المنصة" />
            <DialogPrimitive.Close aria-label="إغلاق"><X aria-hidden="true" size={19} /></DialogPrimitive.Close>
          </div>
          <div className="ui-command__results" aria-label="نتائج البحث">
            {filtered.length ? filtered.map((item) => (
              <a href={item.href} key={`${item.group}-${item.label}`} onClick={() => { setQuery(""); onOpenChange(false); }}>
                <span><small>{item.group}</small><strong>{item.label}</strong></span>
                <ArrowLeft aria-hidden="true" size={18} />
              </a>
            )) : <p className="ui-command__empty">لا توجد نتيجة مطابقة.</p>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
