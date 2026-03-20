import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import {
  enforceDailyLimit,
  buildLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limitResult = await enforceDailyLimit(req, "parseResume");
    if (!limitResult.ok) {
      return buildLimitExceededResponse(
        limitResult.message || "今日简历解析次数已用完，请明天再试。"
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = "";

    if (fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    } else {
      return NextResponse.json(
        { error: "当前版本先仅支持 DOCX 文件，PDF 解析稍后补上" },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "文件解析成功，但未提取到有效文本" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Parse resume error:", error);
    return NextResponse.json(
      { error: "简历解析失败，请更换文件重试" },
      { status: 500 }
    );
  }
}