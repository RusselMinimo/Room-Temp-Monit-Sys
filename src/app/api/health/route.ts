import { NextResponse } from "next/server";

/**
 * Health check endpoint for monitoring and load balancers
 * Returns 200 OK if the service is running
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "room-temp-monitor",
    },
    { status: 200 }
  );
}

