import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { isUuid } from "@/lib/queries";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse(null, { status: 404 });

  const claim = await queryOne<{ photo: Buffer; photo_type: string; user_id: string; status: string }>(
    "select photo, photo_type, user_id, status from pb_claims where id = $1 and photo is not null",
    [id],
  );
  if (!claim) return new NextResponse(null, { status: 404 });

  if (claim.status !== "accepted") {
    const profile = await getCurrentProfile();
    if (!profile || (!profile.is_admin && profile.id !== claim.user_id)) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return new NextResponse(new Uint8Array(claim.photo), {
    headers: {
      "content-type": claim.photo_type,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
