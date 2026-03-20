"use client";

import { useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    jspdf?: {
      jsPDF: new (options?: { unit?: string; format?: string | string[] }) => any;
    };
  }
}

function arrayBufferToBinaryString(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return binary;
}

async function registerChineseFont(doc: any) {
  const response = await fetch("/fonts/NotoSansSC-Regular.ttf");
  if (!response.ok) {
    throw new Error("字体文件加载失败");
  }

  const arrayBuffer = await response.arrayBuffer();
  const fontBinary = arrayBufferToBinaryString(arrayBuffer);

  doc.addFileToVFS("NotoSansSC-Regular.ttf", fontBinary);
  doc.addFont("NotoSansSC-Regular.ttf", "NotoSansSC", "normal");
  doc.setFont("NotoSansSC");
}

type PdfExportButtonProps = {
  text: string;
  onError?: (message: string) => void;
};

export default function PdfExportButton({
  text,
  onError,
}: PdfExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      if (!text.trim()) {
        onError?.("没有可导出的内容。");
        return;
      }

      setLoading(true);

      const jsPDFCtor = window.jspdf?.jsPDF;
      if (!jsPDFCtor) {
        onError?.("PDF 组件尚未加载完成，请稍后再试。");
        return;
      }

      const doc = new jsPDFCtor({
        unit: "pt",
        format: "a4",
      });

      await registerChineseFont(doc);
      doc.setFont("NotoSansSC");
      doc.setFontSize(12);

      const marginLeft = 40;
      const marginTop = 50;
      const maxWidth = 515;

      const lines = doc.splitTextToSize(text, maxWidth);
      let y = marginTop;

      lines.forEach((line: string) => {
        if (y > 780) {
          doc.addPage();
          doc.setFont("NotoSansSC");
          doc.setFontSize(12);
          y = marginTop;
        }
        doc.text(line, marginLeft, y);
        y += 22;
      });

      doc.save("resume_rewrite.pdf");
    } catch (err) {
      console.error(err);
      onError?.("PDF 导出失败，请检查字体与脚本是否已正确加载。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        strategy="afterInteractive"
      />

      <button
        onClick={handleDownloadPdf}
        disabled={loading}
        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "导出中..." : "导出为 PDF"}
      </button>
    </>
  );
}