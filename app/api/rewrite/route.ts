import { NextRequest, NextResponse } from "next/server";
import { callArkModel } from "@/lib/volcengine";
import { buildRewritePrompt } from "@/lib/prompts";
import {
  enforceDailyLimit,
  buildLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limitResult = await enforceDailyLimit(req, "rewrite");
    if (!limitResult.ok) {
      return buildLimitExceededResponse(
        limitResult.message || "今日重构次数已用完，请明天再试。"
      );
    }

    const { jdText, resumeText, diagnosisResult, rewriteMode } = await req.json();

    if (!jdText || !resumeText || !diagnosisResult) {
      return NextResponse.json(
        { error: "jdText, resumeText, and diagnosisResult are required" },
        { status: 400 }
      );
    }

    const prompt = buildRewritePrompt(
      jdText,
      resumeText,
      diagnosisResult,
      rewriteMode || "conservative"
    );

    const content = await callArkModel(prompt);
    const result = JSON.parse(content);

    return NextResponse.json({
      ...result,
      usage: {
        rewriteRemaining: limitResult.remaining,
      },
    });
  } catch (error) {
    console.error("Rewrite API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rewrite resume" },
      { status: 500 }
    );
  }
}