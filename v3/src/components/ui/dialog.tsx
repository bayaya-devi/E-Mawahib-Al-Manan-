"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export function Dialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content className="ui-dialog" dir="rtl">
          <DialogPrimitive.Title className="ui-dialog__title">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="ui-dialog__description">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <div className="ui-dialog__body">{children}</div>
          <DialogPrimitive.Close className="ui-dialog__close" aria-label="إغلاق">
            <X aria-hidden="true" size={20} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content className={cn("ui-dialog", "ui-drawer")} dir="rtl">
          <DialogPrimitive.Title className="ui-dialog__title">{title}</DialogPrimitive.Title>
          <div className="ui-dialog__body">{children}</div>
          <DialogPrimitive.Close className="ui-dialog__close" aria-label="إغلاق">
            <X aria-hidden="true" size={20} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
