import { NextRequest, NextResponse } from "next/server";
import { callArkModel } from "@/lib/volcengine";
import { buildRewritePrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Rewrite API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rewrite resume" },
      { status: 500 }
    );
  }
}