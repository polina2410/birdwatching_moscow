import {FAQ} from "@/components/faq/FAQ";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "FAQ | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function FAQPage() {
  return <FAQ/>;
}