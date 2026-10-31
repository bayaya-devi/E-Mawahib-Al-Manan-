import type { Metadata } from "next";
import { DesignSystemShowcase } from "@/components/design-system/showcase";

export const metadata: Metadata = { title: "نظام التصميم" };
export default function DesignSystemPage() { return <DesignSystemShowcase />; }
