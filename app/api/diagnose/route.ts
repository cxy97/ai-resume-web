import { NextRequest, NextResponse } from "next/server";
import { callArkModel } from "@/lib/volcengine";
import { buildDiagnosePrompt } from "@/lib/prompts";
import {
  enforceDailyLimit,
  buildLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limitResult = await enforceDailyLimit(req, "diagnose");
    if (!limitResult.ok) {
      return buildLimitExceededResponse(
        limitResult.message || "今日诊断次数已用完，请明天再试。"
      );
    }

    const { jdText, resumeText } = await req.json();

    if (!jdText || !resumeText) {
      return NextResponse.json(
        { error: "jdText and resumeText are required" },
        { status: 400 }
      );
    }

    const prompt = buildDiagnosePrompt(jdText, resumeText);
    const content = await callArkModel(prompt);
    const result = JSON.parse(content);

    return NextResponse.json({
      ...result,
      usage: {
        diagnoseRemaining: limitResult.remaining,
      },
    });
  } catch (error) {
    console.error("Diagnose API error:", error);
    return NextResponse.json(
      { error: "Failed to diagnose resume" },
      { status: 500 }
    );
  }
}