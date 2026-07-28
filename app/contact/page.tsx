import {Contact} from "@/components/contact/Contact";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "Контакты | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function ContactPage() {
  return <Contact />;
}