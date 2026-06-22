import { redirect } from "next/navigation";

// Campaigns is the home/landing screen.
export default function Home() {
  redirect("/campaigns");
}
