import {Team} from "@/components/team/Team";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "Команда | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function TeamPage() {
  return <Team/>
}