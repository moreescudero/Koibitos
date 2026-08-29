import { redirect } from "next/navigation";

export default function Home() {
  const tripId = process.env.NEXT_PUBLIC_TRIP_ID;
  redirect(tripId ? `/trip/${tripId}` : "/login");
}
