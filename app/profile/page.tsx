import { Profile } from "@/components/profile/Profile";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Профиль | Birdwatching Moscow",
  description: "Бердвотчинг в Москве, экспедиции по России и за границей",
};

export default function ProfilePage() {
  return <Profile />;
}
