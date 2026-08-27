import {Private} from "@/components/private/Private";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "Частные события | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function PrivatePage() {
  return <Private />
}