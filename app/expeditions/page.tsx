import {Expeditions} from "@/components/expeditions/Expeditions";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "Экспедиции | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function ExpeditionsPage() {
  return <Expeditions />
}