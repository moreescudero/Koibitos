import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback del magic link. Supabase puede mandar:
 *  - ?code=...            (flujo PKCE, por defecto en @supabase/ssr)
 *  - ?token_hash=...&type=magiclink   (flujo OTP clásico)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const fallback = `/trip/${process.env.NEXT_PUBLIC_TRIP_ID ?? ""}`;
  const next = searchParams.get("next") ?? fallback;

  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalido`);
}
