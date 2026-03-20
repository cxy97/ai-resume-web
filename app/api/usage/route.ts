import { getDailyLimitStatus } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const diagnoseStatus = await getDailyLimitStatus(req, "diagnose");
    const rewriteStatus = await getDailyLimitStatus(req, "rewrite");

    return Response.json({
      diagnose: {
        limit: diagnoseStatus.limit,
        used: diagnoseStatus.used,
        remaining: diagnoseStatus.remaining,
      },
      rewrite: {
        limit: rewriteStatus.limit,
        used: rewriteStatus.used,
        remaining: rewriteStatus.remaining,
      },
    });
  } catch (error) {
    console.error("Failed to get usage status:", error);

    return Response.json(
      {
        error: "Failed to get usage status",
      },
      { status: 500 }
    );
  }
}