import { auth } from "@/lib/auth";
import { getEventRegistrations } from "@/lib/db/registration";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const eventIds = searchParams.get("eventIds");
    if (!eventIds) {
      return new NextResponse(
        JSON.stringify({ error: "Event IDs required" }),
        { status: 400 }
      );
    }

    const eventIdArray = eventIds.split(",");
    const registrationCounts: Record<string, number> = {};

    await Promise.all(
      eventIdArray.map(async (eventId) => {
        const registrations = await getEventRegistrations(eventId);
        registrationCounts[eventId] = registrations.length;
      })
    );

    return NextResponse.json({ registrationCounts });
  } catch (error) {
    console.error("Error fetching registration counts:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch registration counts" }),
      { status: 500 }
    );
  }
}