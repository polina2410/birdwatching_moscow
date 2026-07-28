import {Offer} from "@/components/Offer";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "Оферта | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function OfferPage() {
return <Offer />;
}