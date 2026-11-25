import { redirect } from "next/navigation";
import { captureReferral } from "@/actions/auth";

export default async function InviteRedirectPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  await captureReferral(username);
  redirect(`/login?ref=${encodeURIComponent(username)}&next=/`);
}
