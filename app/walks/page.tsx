import {CityWalks} from "@/components/cityWalks/CityWalks";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "Афиша Москвы | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function MoscowPage() {
  return <CityWalks />;
}