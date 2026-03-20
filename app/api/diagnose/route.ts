import { NextRequest, NextResponse } from "next/server";
import { callArkModel } from "@/lib/volcengine";
import { buildDiagnosePrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Diagnose API error:", error);
    return NextResponse.json(
      { error: "Failed to diagnose resume" },
      { status: 500 }
    );
  }
}