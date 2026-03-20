"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PdfExportButton = dynamic(
  () => import("../components/PdfExportButton"),
  { ssr: false }
);

/**
 * 诊断结果类型
 */
type DiagnosisResult = {
  summary: string;
  matchLevel: "high" | "medium" | "low";
  jobRequirements: {
    jobResponsibilities: string[];
    coreCompetencies: string[];
    hardRequirements: string[];
    keywords: string[];
  };
  matchedItems: string[];
  weakItems: string[];
  suggestions: string[];
  usage?: {
    diagnoseRemaining?: number;
  };
};

/**
 * 重构结果类型
 */
type RewriteResult = {
  rewrittenResume: {
    personalInfo: {
      name: string;
      phone: string;
      email: string;
    };
    summary: string;
    experience: {
      title: string;
      company: string;
      duration: string;
      bullets: string[];
    }[];
    projects: {
      name: string;
      duration: string;
      bullets: string[];
    }[];
    education: {
      school: string;
      degree: string;
      major: string;
      duration: string;
    }[];
    skills: string[];
  };
  changeNotes: {
    section: string;
    reason: string;
    type: string;
  }[];
  warnings: string[];
  usage?: {
    rewriteRemaining?: number;
  };
};

/**
 * 错误中文化
 */
function getFriendlyErrorMessage(message: string) {
  if (message.includes("今日诊断次数已用完")) {
    return "今日诊断次数已用完，请明天再试。";
  }
  if (message.includes("今日重构次数已用完")) {
    return "今日重构次数已用完，请明天再试。";
  }
  if (message.includes("今日简历解析次数已用完")) {
    return "今日简历解析次数已用完，请明天再试。";
  }
  if (message.includes("DAILY_LIMIT_EXCEEDED")) {
    return "今日调用次数已达上限，请明天再试。";
  }
  if (message.includes("Missing ARK environment variables")) {
    return "系统环境变量未配置完整，请检查本地配置。";
  }
  if (message.includes("Ark API error: 401") || message.includes("Ark API error: 403")) {
    return "模型服务鉴权失败，请检查 API Key 或模型权限。";
  }
  if (message.includes("Ark API error: 404")) {
    return "模型或接口地址不存在，请检查模型 ID 配置。";
  }
  if (message.includes("No content returned")) {
    return "模型没有返回有效内容，请稍后重试。";
  }
  if (message.includes("Failed to diagnose resume")) {
    return "简历诊断失败，请稍后重试。";
  }
  if (message.includes("Failed to rewrite resume")) {
    return "简历重构失败，请稍后重试。";
  }
  return "系统开小差了，请稍后再试。";
}

export default function HomePage() {
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");

  const [loading, setLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);

  const [rewriteMode, setRewriteMode] = useState<"conservative" | "enhanced">("conservative");

  const [editableResume, setEditableResume] =
    useState<RewriteResult["rewrittenResume"] | null>(null);

  const [error, setError] = useState("");
  const [rewriteError, setRewriteError] = useState("");
  const [uploadError, setUploadError] = useState("");

  const [copied, setCopied] = useState(false);
  const [diagnoseRemaining, setDiagnoseRemaining] = useState<number | null>(null);
  const [rewriteRemaining, setRewriteRemaining] = useState<number | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/usage", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json();
        setDiagnoseRemaining(data?.diagnose?.remaining ?? null);
        setRewriteRemaining(data?.rewrite?.remaining ?? null);
      } catch {
        // 静默处理，不影响主流程
      }
    };

    fetchUsage();
  }, []);

  const handleResetAll = () => {
    setJdText("");
    setResumeText("");
    setResult(null);
    setRewriteResult(null);
    setEditableResume(null);
    setError("");
    setRewriteError("");
    setUploadError("");
    setCopied(false);
    setRewriteMode("conservative");
  };

  /**
   * 上传并解析 DOCX 简历
   */
  const handleResumeUpload = async (file: File) => {
    try {
      setUploading(true);
      setUploadError("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "简历解析失败");
      }

      setResumeText(data.text || "");
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? getFriendlyErrorMessage(err.message)
          : "简历上传失败，请稍后重试"
      );
    } finally {
      setUploading(false);
    }
  };

  /**
   * 开始诊断
   */
  const handleDiagnose = async () => {
    setError("");
    setRewriteError("");
    setResult(null);
    setRewriteResult(null);
    setEditableResume(null);
    setCopied(false);

    if (!jdText.trim() || !resumeText.trim()) {
      setError("请先填写 JD 和简历内容");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jdText,
          resumeText,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to diagnose resume");
      }

      setResult(data);

      if (typeof data?.usage?.diagnoseRemaining === "number") {
        setDiagnoseRemaining(data.usage.diagnoseRemaining);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? getFriendlyErrorMessage(err.message)
          : "简历诊断失败，请稍后重试。"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * 开始重构
   */
  const handleRewrite = async () => {
    if (!result) return;

    setRewriteError("");
    setRewriteResult(null);
    setEditableResume(null);
    setCopied(false);

    try {
      setRewriteLoading(true);

      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jdText,
          resumeText,
          diagnosisResult: result,
          rewriteMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to rewrite resume");
      }

      setRewriteResult(data);
      setEditableResume(data.rewrittenResume);

      if (typeof data?.usage?.rewriteRemaining === "number") {
        setRewriteRemaining(data.usage.rewriteRemaining);
      }
    } catch (err) {
      setRewriteError(
        err instanceof Error
          ? getFriendlyErrorMessage(err.message)
          : "简历重构失败，请稍后重试。"
      );
    } finally {
      setRewriteLoading(false);
    }
  };

  const updateSummary = (value: string) => {
    setEditableResume((prev) => (prev ? { ...prev, summary: value } : prev));
  };

  const updateExperienceTitle = (index: number, value: string) => {
    setEditableResume((prev) => {
      if (!prev) return prev;
      const next = [...prev.experience];
      next[index] = { ...next[index], title: value };
      return { ...prev, experience: next };
    });
  };

  const updateExperienceBullet = (expIndex: number, bulletIndex: number, value: string) => {
    setEditableResume((prev) => {
      if (!prev) return prev;
      const next = [...prev.experience];
      const nextBullets = [...next[expIndex].bullets];
      nextBullets[bulletIndex] = value;
      next[expIndex] = { ...next[expIndex], bullets: nextBullets };
      return { ...prev, experience: next };
    });
  };

  const updateProjectName = (index: number, value: string) => {
    setEditableResume((prev) => {
      if (!prev) return prev;
      const next = [...prev.projects];
      next[index] = { ...next[index], name: value };
      return { ...prev, projects: next };
    });
  };

  const updateProjectBullet = (projectIndex: number, bulletIndex: number, value: string) => {
    setEditableResume((prev) => {
      if (!prev) return prev;
      const next = [...prev.projects];
      const nextBullets = [...next[projectIndex].bullets];
      nextBullets[bulletIndex] = value;
      next[projectIndex] = { ...next[projectIndex], bullets: nextBullets };
      return { ...prev, projects: next };
    });
  };

  const updateSkills = (value: string) => {
    setEditableResume((prev) =>
      prev
        ? {
            ...prev,
            skills: value
              .split(/[，,]/)
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : prev
    );
  };

  /**
   * 拼接成纯文本简历
   */
  const buildResumeText = () => {
    if (!editableResume) return "";

    const lines: string[] = [];

    const infoParts = [
      editableResume.personalInfo.name,
      editableResume.personalInfo.phone,
      editableResume.personalInfo.email,
    ].filter(Boolean);

    if (infoParts.length > 0) {
      lines.push(infoParts.join(" | "));
      lines.push("");
    }

    if (editableResume.summary) {
      lines.push("个人总结");
      lines.push(editableResume.summary);
      lines.push("");
    }

    if (editableResume.experience.length > 0) {
      lines.push("实习经历");
      editableResume.experience.forEach((item) => {
        const titleLine = [item.title, item.company, item.duration].filter(Boolean).join(" · ");
        if (titleLine) lines.push(titleLine);
        item.bullets.forEach((bullet) => {
          lines.push(`- ${bullet}`);
        });
        lines.push("");
      });
    }

    if (editableResume.projects.length > 0) {
      lines.push("项目经历");
      editableResume.projects.forEach((item) => {
        const titleLine = [item.name, item.duration].filter(Boolean).join(" · ");
        if (titleLine) lines.push(titleLine);
        item.bullets.forEach((bullet) => {
          lines.push(`- ${bullet}`);
        });
        lines.push("");
      });
    }

    if (editableResume.education.length > 0) {
      lines.push("教育背景");
      editableResume.education.forEach((item) => {
        const eduLine = [item.school, item.degree, item.major, item.duration]
          .filter(Boolean)
          .join(" · ");
        if (eduLine) lines.push(eduLine);
      });
      lines.push("");
    }

    if (editableResume.skills.length > 0) {
      lines.push("技能关键词");
      lines.push(editableResume.skills.join("，"));
      lines.push("");
    }

    return lines.join("\n").trim();
  };

  /**
   * 复制简历
   */
  const handleCopyResume = async () => {
    try {
      const text = buildResumeText();
      if (!text) return;

      await navigator.clipboard.writeText(text);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setRewriteError("复制失败，请手动复制内容。");
    }
  };

  /**
   * 导出 txt
   */
  const handleDownloadTxt = () => {
    const text = buildResumeText();
    if (!text) return;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "resume_rewrite.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">AI 简历重构助手</h1>
          <p className="mt-2 text-slate-600">
            先粘贴目标岗位 JD 和简历文本，生成岗位匹配诊断结果，并进一步完成简历重构。
          </p>

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
              今日剩余诊断次数：{diagnoseRemaining ?? "-"}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
              今日剩余重构次数：{rewriteRemaining ?? "-"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
              1 输入 JD 与简历
            </span>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
              2 生成诊断
            </span>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
              3 重构并编辑
            </span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">目标岗位 JD</h2>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="请粘贴岗位职责、任职要求、加分项等内容"
              className="min-h-[320px] w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-slate-400"
            />
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">简历文本</h2>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
                {uploading ? "解析中..." : "上传 DOCX"}
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleResumeUpload(file);
                  }}
                />
              </label>

              <span className="text-xs text-slate-500">
                上传后将自动提取 DOCX 文本并填入下方输入框
              </span>
            </div>

            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="请先粘贴简历纯文本内容，当前上传仅支持 DOCX"
              className="min-h-[320px] w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-slate-400"
            />

            {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            onClick={handleDiagnose}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "诊断中..." : "开始诊断"}
          </button>

          <button
            onClick={handleResetAll}
            className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
          >
            清空重新开始
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {result && (
          <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">诊断结果</h2>
              <p className="mt-1 text-sm text-slate-500">
                先看匹配基础和待补强点，再决定是否进入重构。
              </p>
              <p className="mt-3 text-slate-700">{result.summary}</p>
              <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                匹配程度：{result.matchLevel}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold text-slate-900">岗位要求提炼</h3>
                <div className="space-y-3 text-sm text-slate-700">
                  <div>
                    <p className="font-medium">岗位职责</p>
                    <ul className="mt-1 list-disc pl-5">
                      {result.jobRequirements.jobResponsibilities.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium">核心能力</p>
                    <ul className="mt-1 list-disc pl-5">
                      {result.jobRequirements.coreCompetencies.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium">硬性要求</p>
                    <ul className="mt-1 list-disc pl-5">
                      {result.jobRequirements.hardRequirements.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">关键词</h3>
                <div className="flex flex-wrap gap-2">
                  {result.jobRequirements.keywords.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="mb-2 font-semibold text-slate-900">已匹配内容</h3>
                  <ul className="list-disc pl-5 text-sm text-slate-700">
                    {result.matchedItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  <h3 className="mb-2 font-semibold text-slate-900">待补强点</h3>
                  <ul className="list-disc pl-5 text-sm text-slate-700">
                    {result.weakItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-2 font-semibold text-slate-900">优化建议</h3>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {result.suggestions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm text-slate-600">改写模式</span>

                <button
                  type="button"
                  onClick={() => setRewriteMode("conservative")}
                  className={`rounded-full px-4 py-2 text-sm ${
                    rewriteMode === "conservative"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  保守改写
                </button>

                <button
                  type="button"
                  onClick={() => setRewriteMode("enhanced")}
                  className={`rounded-full px-4 py-2 text-sm ${
                    rewriteMode === "enhanced"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  增强改写
                </button>
              </div>

              <p className="mb-4 text-sm text-slate-500">
                保守改写更克制，增强改写会更强调岗位贴合表达，但仍基于原始经历。
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleRewrite}
                  disabled={rewriteLoading}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rewriteLoading ? "重构中..." : "开始简历重构"}
                </button>

                {rewriteError && <p className="text-sm text-red-600">{rewriteError}</p>}
              </div>
            </div>
          </section>
        )}

        {rewriteResult && editableResume && (
          <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">重构结果</h2>
              <p className="mt-1 text-sm text-slate-500">
                左侧查看改写原因，右侧可继续手动修改简历内容。
              </p>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-4">
              <button
                onClick={handleCopyResume}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                复制重构简历
              </button>

              <button
                onClick={handleDownloadTxt}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
              >
                导出为 txt
              </button>

              <PdfExportButton
                text={buildResumeText()}
                onError={(message: string) => setRewriteError(message)}
              />

              {copied && <span className="text-sm text-emerald-600">已复制到剪贴板</span>}
            </div>

            <div className="grid gap-6 md:grid-cols-[320px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-3 font-semibold text-slate-900">修改说明</h3>

                <div className="space-y-4">
                  {rewriteResult.changeNotes.map((item, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-1 text-sm font-medium text-slate-900">{item.section}</div>
                      <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                        {item.type}
                      </div>
                      <p className="text-sm text-slate-700">{item.reason}</p>
                    </div>
                  ))}
                </div>

                {rewriteResult.warnings.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-2 font-semibold text-slate-900">提醒</h3>
                    <ul className="list-disc pl-5 text-sm text-slate-700">
                      {rewriteResult.warnings.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="space-y-8">
                  <section>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">个人总结</h3>
                    <textarea
                      value={editableResume.summary || ""}
                      onChange={(e) => updateSummary(e.target.value)}
                      className="min-h-[120px] w-full rounded-xl border border-slate-200 p-4 text-sm leading-7 text-slate-700 outline-none focus:border-slate-400"
                    />
                  </section>

                  <section>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">实习经历</h3>
                    <div className="space-y-5">
                      {editableResume.experience.map((item, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 p-4">
                          <input
                            value={item.title}
                            onChange={(e) => updateExperienceTitle(i, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                          />

                          <div className="mt-3 space-y-2">
                            {item.bullets.map((bullet, idx) => (
                              <textarea
                                key={idx}
                                value={bullet}
                                onChange={(e) =>
                                  updateExperienceBullet(i, idx, e.target.value)
                                }
                                className="min-h-[72px] w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">项目经历</h3>
                    <div className="space-y-5">
                      {editableResume.projects.map((item, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 p-4">
                          <input
                            value={item.name}
                            onChange={(e) => updateProjectName(i, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                          />

                          <div className="mt-3 space-y-2">
                            {item.bullets.map((bullet, idx) => (
                              <textarea
                                key={idx}
                                value={bullet}
                                onChange={(e) =>
                                  updateProjectBullet(i, idx, e.target.value)
                                }
                                className="min-h-[72px] w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">教育背景</h3>
                    <div className="space-y-4 text-sm text-slate-700">
                      {editableResume.education.map((item, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 p-4">
                          <div className="font-medium text-slate-900">
                            {item.school} · {item.degree} · {item.major}
                          </div>
                          {item.duration && (
                            <div className="mt-1 text-xs text-slate-500">{item.duration}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">技能关键词</h3>
                    <textarea
                      value={(editableResume.skills || []).join("，")}
                      onChange={(e) => updateSkills(e.target.value)}
                      className="min-h-[90px] w-full rounded-xl border border-slate-200 p-4 text-sm text-slate-700 outline-none focus:border-slate-400"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      可用中文逗号或英文逗号分隔多个技能词。
                    </p>
                  </section>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}