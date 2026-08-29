import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TripView } from "@/components/TripView";
import type { ItineraryItem, Message, RouteLeg } from "@/lib/types";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tripRes, messagesRes, itemsRes, legsRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase
      .from("messages")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    supabase
      .from("itinerary_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    supabase
      .from("route_legs")
      .select("*")
      .eq("trip_id", tripId)
      .order("order_index", { ascending: true }),
  ]);

  if (!tripRes.data) notFound();

  return (
    <TripView
      tripId={tripId}
      tripName={tripRes.data.name}
      userEmail={user?.email ?? ""}
      initialMessages={(messagesRes.data ?? []) as Message[]}
      initialItems={(itemsRes.data ?? []) as ItineraryItem[]}
      initialLegs={(legsRes.data ?? []) as RouteLeg[]}
    />
  );
}
