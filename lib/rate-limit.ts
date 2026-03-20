type LimitAction = "diagnose" | "rewrite" | "parseResume";

type LimitResult = {
  ok: boolean;
  limit: number;
  used: number;
  remaining: number;
  message?: string;
};

const ACTION_LIMIT_MAP: Record<LimitAction, number> = {
  diagnose: 3,
  rewrite: 3,
  parseResume: 5,
};

function getActionLabel(action: LimitAction) {
  if (action === "diagnose") return "诊断";
  if (action === "rewrite") return "重构";
  return "简历解析";
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

async function redisFetch(path: string, init?: RequestInit) {
  const baseUrl = process.env.RATE_LIMIT_REDIS_URL;
  const token = process.env.RATE_LIMIT_REDIS_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Missing rate limit Redis env variables");
  }

  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rate limit Redis error: ${res.status} ${text}`);
  }

  return res.json();
}

function buildKey(action: LimitAction, req: Request) {
  const ip = getClientIp(req);
  const date = getTodayString();
  return `ai-resume-web:${action}:${date}:${ip}`;
}

export async function getDailyLimitStatus(
  req: Request,
  action: LimitAction
): Promise<LimitResult> {
  const limit = ACTION_LIMIT_MAP[action];
  const key = buildKey(action, req);

  const result = await redisFetch(`/get/${encodeURIComponent(key)}`, {
    method: "GET",
  });

  const used = Number(result?.result || 0);
  const remaining = Math.max(limit - used, 0);

  return {
    ok: used < limit,
    limit,
    used,
    remaining,
    message: used >= limit ? `今日${getActionLabel(action)}次数已用完，请明天再试。` : undefined,
  };
}

export async function enforceDailyLimit(
  req: Request,
  action: LimitAction
): Promise<LimitResult> {
  const limit = ACTION_LIMIT_MAP[action];
  const key = buildKey(action, req);

  const result = await redisFetch("/pipeline", {
    method: "POST",
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, 172800],
    ]),
  });

  const used = Number(result?.[0]?.result || 0);
  const remaining = Math.max(limit - used, 0);

  if (used > limit) {
    return {
      ok: false,
      limit,
      used,
      remaining: 0,
      message: `今日${getActionLabel(action)}次数已用完，请明天再试。`,
    };
  }

  return {
    ok: true,
    limit,
    used,
    remaining,
  };
}

export function buildLimitExceededResponse(message: string) {
  return Response.json(
    {
      error: "DAILY_LIMIT_EXCEEDED",
      message,
    },
    { status: 429 }
  );
}