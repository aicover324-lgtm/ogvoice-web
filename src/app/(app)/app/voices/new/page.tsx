import { redirect } from "next/navigation";

export default function LegacyNewVoiceRedirect() {
  redirect("/app/create/new");
}
