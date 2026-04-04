const OpenAI = require("openai");
const User = require("../models/User");
const Project = require("../models/Project");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "no-key",
});

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const parseStringList = (input) => {
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const parseOwnerRepo = (normalizedUrl) => {
  const m = String(normalizedUrl || "").match(
    /github\.com\/([^/]+)\/([^/?#]+)/i,
  );
  if (!m) return { owner: "", repo: "" };
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
};

/** Public GitHub REST API — real languages/topics (no LLM). Optional GITHUB_TOKEN for higher rate limits. */
async function fetchGithubRepoMetadata(owner, repo) {
  if (!owner || !repo) return null;
  try {
    const token = process.env.GITHUB_TOKEN?.trim();
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-recruiter-matcher/1.0",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const base = `https://api.github.com/repos/${owner}/${repo}`;
    const [repoRes, langRes] = await Promise.all([
      fetch(base, { headers }),
      fetch(`${base}/languages`, { headers }),
    ]);
    if (!repoRes.ok) {
      return null;
    }
    const repoJson = await repoRes.json();
    const langJson = langRes.ok ? await langRes.json() : {};
    const languages = Object.entries(langJson)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);

    return {
      repoName: repoJson.name || repo,
      fullName: repoJson.full_name || `${owner}/${repo}`,
      description: repoJson.description || "",
      topics: Array.isArray(repoJson.topics) ? repoJson.topics : [],
      languages,
      htmlUrl: repoJson.html_url,
    };
  } catch {
    return null;
  }
};

const normalizeGithubRepoUrl = (input) => {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("git@github.com:")) {
      const path = raw.replace("git@github.com:", "").replace(/\.git$/i, "");
      return `https://github.com/${path}`;
    }
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!u.hostname.toLowerCase().includes("github.com")) return "";
    let pathname = u.pathname.replace(/\/+$/, "").replace(/\.git$/i, "");
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return "";
    const owner = parts[0];
    const repo = parts[1];
    return `https://github.com/${owner}/${repo}`;
  } catch {
    return "";
  }
};

const normalizeGithubProfileUrl = (input) => {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("git@github.com:")) {
      const path = raw.replace("git@github.com:", "").replace(/\.git$/i, "");
      const parts = path.split("/").filter(Boolean);
      if (!parts.length) return "";
      return `https://github.com/${parts[0]}`;
    }
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!u.hostname.toLowerCase().includes("github.com")) return "";
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (!parts.length) return "";
    // Accept either a profile URL (/owner) or repo URL (/owner/repo) and normalize to profile.
    return `https://github.com/${parts[0]}`;
  } catch {
    return "";
  }
};

const parseGithubUsernameFromProfileUrl = (normalizedProfileUrl) => {
  const m = String(normalizedProfileUrl || "").match(/github\.com\/([^/]+)\/?$/i);
  return m ? m[1] : "";
};

/** Public GitHub REST API profile signals (no repo code analysis). Optional GITHUB_TOKEN for higher rate limits. */
async function fetchGithubProfileStats(username) {
  if (!username) return null;
  try {
    const token = process.env.GITHUB_TOKEN?.trim();
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-recruiter-matcher/1.0",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const userRes = await fetch(`https://api.github.com/users/${username}`, {
      headers,
    });
    if (!userRes.ok) return null;
    const userJson = await userRes.json();

    const perPage = 100;
    const maxPages = 2; // cap to avoid heavy API usage
    const repos = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const repoRes = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`,
        { headers },
      );
      if (!repoRes.ok) break;
      const repoJson = await repoRes.json();
      if (!Array.isArray(repoJson) || !repoJson.length) break;
      repos.push(...repoJson);
      if (repoJson.length < perPage) break;
    }

    let totalStars = 0;
    let totalForks = 0;
    const languageCounts = new Map();
    for (const r of repos) {
      totalStars += Number(r?.stargazers_count) || 0;
      totalForks += Number(r?.forks_count) || 0;
      const lang = String(r?.language || "").trim();
      if (lang) languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
    }

    const topLanguages = [...languageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([language, count]) => ({ language, count }));

    const createdAt = userJson.created_at || null;
    const updatedAt = userJson.updated_at || null;

    return {
      username,
      profileUrl: `https://github.com/${username}`,
      publicRepos: Number(userJson.public_repos) || 0,
      followers: Number(userJson.followers) || 0,
      following: Number(userJson.following) || 0,
      createdAt,
      updatedAt,
      repoSampled: repos.length,
      totalStars,
      totalForks,
      topLanguages,
    };
  } catch {
    return null;
  }
}

const computeProfileScoreFromStats = (stats) => {
  if (!stats) return 0;

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const logNorm = (value, cap) => {
    const v = Math.max(0, Number(value) || 0);
    const c = Math.max(1, Number(cap) || 1);
    return clamp01(Math.log10(v + 1) / Math.log10(c + 1));
  };

  const now = Date.now();
  const createdAtMs = stats.createdAt ? Date.parse(stats.createdAt) : NaN;
  const ageYears = Number.isFinite(createdAtMs)
    ? (now - createdAtMs) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;

  const updatedAtMs = stats.updatedAt ? Date.parse(stats.updatedAt) : NaN;
  const monthsSinceUpdate = Number.isFinite(updatedAtMs)
    ? (now - updatedAtMs) / (30.44 * 24 * 60 * 60 * 1000)
    : 999;

  const reposScore = clamp01((Number(stats.publicRepos) || 0) / 50) * 20;
  const starsScore = logNorm(stats.totalStars, 5000) * 35;
  const followersScore = logNorm(stats.followers, 2000) * 25;
  const ageScore = clamp01(ageYears / 10) * 10;
  const recencyScore = clamp01((24 - monthsSinceUpdate) / 24) * 10;

  const total = reposScore + starsScore + followersScore + ageScore + recencyScore;
  return Math.round(Math.max(0, Math.min(100, total)));
};

async function generateProfileEvaluationFromProfileUrl(githubProfileUrl) {
  const normalizedProfileUrl = normalizeGithubProfileUrl(githubProfileUrl);
  if (!normalizedProfileUrl) {
    throw new Error("Invalid GitHub profile URL.");
  }

  const username = parseGithubUsernameFromProfileUrl(normalizedProfileUrl);
  const stats = await fetchGithubProfileStats(username);
  const languageSignals = Array.isArray(stats?.topLanguages)
    ? stats.topLanguages.map((x) => String(x.language)).filter(Boolean)
    : [];

  if (process.env.MOCK_PROFILE_EVALUATION) {
    const mock = parseJsonObjectFromModel(process.env.MOCK_PROFILE_EVALUATION);
    const score = Math.round(Math.max(0, Math.min(100, Number(mock.profileScore) || 0)));
    return {
      summary: {
        source: "mock-profile",
        profileUrl: normalizedProfileUrl,
        username,
        profileStats: stats,
        profileScore: score,
        languages: languageSignals,
        frameworks: [],
        domains: [],
        ...mock,
      },
      profileStats: stats,
      profileScore: score,
      usedAi: false,
      reason: "mock-profile",
    };
  }

  const heuristicScore = computeProfileScoreFromStats(stats);

  if (!hasUsableOpenAIKey()) {
    return {
      summary: {
        source: "github-profile-api",
        profileUrl: normalizedProfileUrl,
        username,
        profileStats: stats,
        profileScore: heuristicScore,
        languages: languageSignals,
        frameworks: [],
        domains: [],
        keywords: languageSignals,
        confidence: stats ? "medium" : "low",
        highlights: stats
          ? [
            `Public repos: ${stats.publicRepos}`,
            `Followers: ${stats.followers}`,
            `Stars across sampled repos: ${stats.totalStars}`,
            stats.topLanguages?.length
              ? `Top languages: ${stats.topLanguages
                .map((x) => x.language)
                .join(", ")}`
              : null,
          ].filter(Boolean)
          : [
            "GitHub profile stats unavailable (rate limit, network, or invalid username).",
          ],
        difficulty: clampDifficulty(heuristicScore ? heuristicScore / 10 : 5),
      },
      profileStats: stats,
      profileScore: heuristicScore,
      usedAi: false,
      reason: stats ? "github-api" : "github-api-unavailable",
    };
  }

  const systemPrompt = `You evaluate a developer using ONLY GitHub profile statistics.\n\nRules:\n- Do NOT analyze repo code or readme content.\n- Use only the numeric/profile signals provided.\n- Output MUST be a single JSON object only (no markdown, no code fences, no commentary).\n\nReturn this JSON shape:\n{\n  \"profileScore\": 0,\n  \"confidence\": \"high|medium|low\",\n  \"reasoning\": \"string\",\n  \"difficulty\": 5,\n  \"keywords\": [\"string\"],\n  \"highlights\": [\"string\"]\n}\n\nScoring guidance:\n- profileScore is 0-100.\n- difficulty is 1-10 and should correlate loosely with profileScore (higher score -> higher difficulty).\n- If stats are missing/sparse, lower confidence and score conservatively.`;

  const userPrompt = JSON.stringify(
    {
      githubProfileUrl: normalizedProfileUrl,
      username,
      githubProfileStats: stats || {
        note: "GitHub API returned no data (rate limit, network, or invalid username).",
      },
      heuristicScore,
    },
    null,
    2,
  );

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const content = completion.choices?.[0]?.message?.content || "";
    const obj = parseJsonObjectFromModel(content);
    const score = Math.round(Math.max(0, Math.min(100, Number(obj.profileScore) || heuristicScore)));
    const difficulty = clampDifficulty(obj.difficulty ?? (score ? score / 10 : 5));
    const keywords = Array.isArray(obj.keywords) ? obj.keywords.map((x) => String(x)) : [];
    const highlights = Array.isArray(obj.highlights) ? obj.highlights.map((x) => String(x)) : [];

    return {
      summary: {
        source: "llm-profile",
        profileUrl: normalizedProfileUrl,
        username,
        profileStats: stats,
        profileScore: score,
        languages: languageSignals,
        frameworks: [],
        domains: [],
        confidence: String(obj.confidence || "medium"),
        reasoning: String(obj.reasoning || ""),
        keywords,
        highlights,
        difficulty,
      },
      profileStats: stats,
      profileScore: score,
      usedAi: true,
      reason: "llm-profile",
    };
  } catch {
    return {
      summary: {
        source: "github-profile-api",
        profileUrl: normalizedProfileUrl,
        username,
        profileStats: stats,
        profileScore: heuristicScore,
        languages: languageSignals,
        frameworks: [],
        domains: [],
        keywords: languageSignals,
        confidence: stats ? "medium" : "low",
        reasoning:
          "Profile scored from public GitHub statistics; AI evaluation unavailable.",
        difficulty: clampDifficulty(heuristicScore ? heuristicScore / 10 : 5),
      },
      profileStats: stats,
      profileScore: heuristicScore,
      usedAi: false,
      reason: "llm-profile-error",
    };
  }
}

const localFallbackSummaryFromUrl = (githubRepoUrl) => {
  const normalized = normalizeGithubRepoUrl(githubRepoUrl) || String(githubRepoUrl || "").trim();
  const pathMatch = normalized.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  const owner = pathMatch ? pathMatch[1] : "unknown";
  const repo = pathMatch ? pathMatch[2] : "repo";
  return {
    source: "local-fallback",
    repoUrl: normalized,
    repoName: repo,
    languages: [],
    frameworks: [],
    highlights: [`Public GitHub repository: ${owner}/${repo}`],
    difficulty: 5,
    inferredNote:
      "Summary generated without AI: only URL path was used. Set OPENAI_API_KEY or GITHUB_TOKEN and ensure GitHub API is reachable.",
  };
};

/** Prefer GitHub REST data when LLM fails or is disabled — fills languages/topics from the real repo. */
const buildSummaryFromGithubApi = (normalizedUrl, ghMeta) => {
  if (!ghMeta) {
    return localFallbackSummaryFromUrl(normalizedUrl);
  }
  const { owner, repo } = parseOwnerRepo(normalizedUrl);
  const highlights = [
    ghMeta.description,
    ghMeta.topics?.length ? `Topics: ${ghMeta.topics.join(", ")}` : null,
    `Repository: ${ghMeta.fullName || `${owner}/${repo}`}`,
  ].filter(Boolean);

  return {
    source: "github-api",
    repoUrl: normalizedUrl,
    repoName: ghMeta.repoName || repo,
    summary:
      ghMeta.description ||
      `Public repository ${ghMeta.fullName || `${owner}/${repo}`}`,
    languages: ghMeta.languages?.length ? ghMeta.languages : [],
    frameworks: ghMeta.topics?.length ? ghMeta.topics.slice(0, 12) : [],
    domains: [],
    highlights,
    difficulty: 5,
    inferredNote:
      "Structured from GitHub REST API (languages, topics, description). LLM not used or failed.",
  };
};

const mergeGithubIntoSummary = (summary, ghMeta) => {
  if (!ghMeta || !summary || typeof summary !== "object") return;
  if (!Array.isArray(summary.languages) || !summary.languages.length) {
    if (ghMeta.languages?.length) summary.languages = [...ghMeta.languages];
  }
  if (!Array.isArray(summary.frameworks) || !summary.frameworks.length) {
    if (ghMeta.topics?.length) summary.frameworks = ghMeta.topics.slice(0, 12);
  }
  if (!summary.summary && ghMeta.description) {
    summary.summary = ghMeta.description;
  }
  summary.githubPublicMetadata = {
    topics: ghMeta.topics,
    languagesTop: ghMeta.languages?.slice(0, 8),
    fullName: ghMeta.fullName,
  };
};

const mergeUserRegistrationIntoSummary = (
  projectSummary,
  { userSkills, userLanguages, projectNotes, extraFromClient },
) => {
  if (!projectSummary || typeof projectSummary !== "object") return;
  projectSummary.registration = {
    skills: userSkills,
    languages: userLanguages,
    projectNotes,
  };
  if (userLanguages.length) {
    projectSummary.languages = [
      ...new Set([...userLanguages, ...(projectSummary.languages || [])]),
    ];
  }
  if (userSkills.length) {
    projectSummary.frameworks = [
      ...new Set([...(projectSummary.frameworks || []), ...userSkills]),
    ];
  }
  if (projectNotes) {
    projectSummary.highlights = [
      ...(projectSummary.highlights || []),
      `Candidate notes: ${projectNotes}`,
    ];
  }
  if (extraFromClient && typeof extraFromClient === "object") {
    if (Array.isArray(extraFromClient.languages)) {
      projectSummary.languages = [
        ...new Set([
          ...(projectSummary.languages || []),
          ...extraFromClient.languages.map(String),
        ]),
      ];
    }
    if (Array.isArray(extraFromClient.frameworks)) {
      projectSummary.frameworks = [
        ...new Set([
          ...(projectSummary.frameworks || []),
          ...extraFromClient.frameworks.map(String),
        ]),
      ];
    }
    if (Array.isArray(extraFromClient.highlights)) {
      projectSummary.highlights = [
        ...(projectSummary.highlights || []),
        ...extraFromClient.highlights.map(String),
      ];
    }
    if (Array.isArray(extraFromClient.domains)) {
      projectSummary.domains = [
        ...new Set([
          ...(projectSummary.domains || []),
          ...extraFromClient.domains.map(String),
        ]),
      ];
    }
  }
};

/** Single-project difficulty from AI / heuristics; allow one decimal (float) 1–10. */
const clampDifficulty = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  const rounded = Math.round(n * 10) / 10;
  return Math.min(10, Math.max(1, rounded));
};

const isGithubProject = (p) => !p.source || p.source === "github";

/** Sum of per-project difficulties (from AI/context at each submit). Collab projects are excluded. */
const recalculateUserTotalDifficulty = async (userId) => {
  const projects = await Project.find({ userId }).select("difficulty source").lean();
  const githubProjects = projects.filter(isGithubProject);
  if (!githubProjects.length) {
    const u = await User.findById(userId).select("difficultyScore").lean();
    const fallback =
      u && Number.isFinite(u.difficultyScore) ? Number(u.difficultyScore) : 0;
    await User.updateOne(
      { _id: userId },
      { $set: { totalDifficulty: fallback, projectCount: 0 } },
    );
    return;
  }
  let sum = 0;
  for (const p of githubProjects) {
    const d = Number.isFinite(p.difficulty) ? Number(p.difficulty) : 5;
    sum += d;
  }
  const total = Math.round(sum * 100) / 100;
  await User.updateOne(
    { _id: userId },
    { $set: { totalDifficulty: total, projectCount: githubProjects.length } },
  );
};

const buildKeywordsFromSummary = (summary) => {
  const s = summary && typeof summary === "object" ? summary : {};
  const reg = s.registration && typeof s.registration === "object" ? s.registration : {};
  const buckets = [
    ...(Array.isArray(s.languages) ? s.languages : []),
    ...(Array.isArray(s.frameworks) ? s.frameworks : []),
    ...(Array.isArray(s.domains) ? s.domains : []),
    ...(Array.isArray(s.keywords) ? s.keywords : []),
    ...(Array.isArray(reg.skills) ? reg.skills : []),
    ...(Array.isArray(reg.languages) ? reg.languages : []),
  ];
  const seen = new Set();
  const out = [];
  for (const raw of buckets) {
    const t = String(raw || "")
      .toLowerCase()
      .trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
};

const parseJsonObjectFromModel = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("LLM returned empty content for JSON object.");
  }
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }
  const parsed = JSON.parse(cleaned);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LLM response is not a JSON object.");
  }
  return parsed;
};

const hasUsableOpenAIKey = () => {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) return false;
  if (key === "your_openai_api_key_here") return false;
  if (key === "no-key") return false;
  return true;
};

async function generateProjectSummaryFromRepoUrl(githubRepoUrl) {
  const normalized = normalizeGithubRepoUrl(githubRepoUrl);
  if (!normalized) {
    throw new Error("Invalid GitHub repository URL.");
  }

  const { owner, repo } = parseOwnerRepo(normalized);
  const ghMeta = await fetchGithubRepoMetadata(owner, repo);

  if (process.env.MOCK_REGISTER_PROJECT_SUMMARY) {
    const mock = parseJsonObjectFromModel(process.env.MOCK_REGISTER_PROJECT_SUMMARY);
    mock.difficulty = clampDifficulty(mock.difficulty);
    mergeGithubIntoSummary(mock, ghMeta);
    return { summary: mock, usedAi: false, reason: "mock-register" };
  }

  if (!hasUsableOpenAIKey()) {
    const fb = buildSummaryFromGithubApi(normalized, ghMeta);
    return {
      summary: { ...fb, difficulty: clampDifficulty(fb.difficulty) },
      usedAi: false,
      reason: "no-api-key",
    };
  }

  const systemPrompt = `You build structured hiring context for a developer's public GitHub repository.

You will receive githubPublicMetadata from the GitHub REST API when available: real language breakdown, topics, and description. Prefer those facts for "languages", "frameworks" (map GitHub topics to framework/library tags), and "summary". If metadata is missing, infer cautiously from owner/repo name only.

Rules:
- Output MUST be a single JSON object only (no markdown, no code fences, no commentary).
- Include the normalized repo URL in "repoUrl".
- Set "difficulty" as integer 1–10 (project complexity to build/maintain).
- Never leave "languages" empty if githubPublicMetadata.languagesTop is non-empty — copy them.

Required JSON shape:
{
  "repoUrl": "string",
  "repoName": "string",
  "summary": "string",
  "languages": ["string"],
  "frameworks": ["string"],
  "domains": ["string"],
  "keywords": ["string"],
  "highlights": ["string"],
  "difficulty": 5,
  "complexity": "low|medium|high|unknown",
  "confidence": "high|medium|low"
}`;

  const userPrompt = JSON.stringify(
    {
      githubRepoUrl: normalized,
      githubPublicMetadata: ghMeta || {
        note: "GitHub API returned no data (private repo, rate limit, or network). Infer from URL only.",
      },
    },
    null,
    2,
  );

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const content = completion.choices?.[0]?.message?.content || "";
    const summary = parseJsonObjectFromModel(content);
    summary.repoUrl = summary.repoUrl || normalized;
    summary.difficulty = clampDifficulty(summary.difficulty);
    mergeGithubIntoSummary(summary, ghMeta);
    return { summary, usedAi: true, reason: "llm" };
  } catch {
    const fb = buildSummaryFromGithubApi(normalized, ghMeta);
    return {
      summary: { ...fb, difficulty: clampDifficulty(fb.difficulty) },
      usedAi: false,
      reason: "llm-error",
    };
  }
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const localFallbackMatch = (users, targetLocation, missionDescription) => {
  const targetTokens = new Set(tokenize(targetLocation));
  const missionTokens = new Set(tokenize(missionDescription));

  const ranked = users
    .map((user) => {
      const locationTokens = new Set(tokenize(user.location));
      const evidenceText = JSON.stringify(
        user.projectSummary || user.profileStats || {},
      ).toLowerCase();
      const urlText = `${user.githubProfileUrl || ""} ${user.githubRepoUrl || ""}`.toLowerCase();

      const locationOverlap = [...locationTokens].filter((t) =>
        targetTokens.has(t),
      ).length;
      const missionOverlap = [...missionTokens].filter(
        (t) => evidenceText.includes(t) || urlText.includes(t),
      ).length;

      const locationScore = Math.min(30, locationOverlap * 10);
      const missionScore = Math.min(70, missionOverlap * 5);
      const fitScore = Math.max(0, Math.min(100, locationScore + missionScore));

      return {
        userId: String(user.userId),
        name: String(user.name || ""),
        email: String(user.email || ""),
        location: String(user.location || ""),
        totalDifficulty: Number(user.totalDifficulty) || 0,
        profileScore: Number(user.profileScore) || 0,
        fitScore,
        reasoning:
          fitScore > 0
            ? `Repo/context and location overlap with the mission (${missionOverlap} skill/context matches, ${locationOverlap} location token matches).`
            : "Limited overlap for location and mission against stored repo context.",
      };
    })
    .filter((item) => item.fitScore > 0)
    .sort((a, b) => b.fitScore - a.fitScore);

  return ranked;
};

const parseJsonArrayFromModel = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("LLM returned empty content.");
  }

  let cleaned = rawText.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("LLM response is not a JSON array.");
  }

  return parsed.map((item) => ({
    userId: String(item.userId || ""),
    name: String(item.name || ""),
    email: String(item.email || ""),
    location: String(item.location || ""),
    fitScore: Number.isFinite(Number(item.fitScore))
      ? Number(item.fitScore)
      : 0,
    reasoning: String(item.reasoning || ""),
  }));
};

const registerUser = async (req, res, next) => {
  try {
    const { name, email, location } = req.body;
    const githubRepoUrl = req.body.githubRepoUrl;
    const githubProfileUrl =
      req.body.githubProfileUrl ?? req.body.githubProfile ?? req.body.githubUrl;
    const userSkills = parseStringList(req.body.skills);
    const userLanguages = parseStringList(
      req.body.userLanguages ?? req.body.languages,
    );
    const projectNotes = String(req.body.projectNotes || "").trim();

    let extraFromClient = null;
    if (req.body.projectSummary != null) {
      if (typeof req.body.projectSummary === "object") {
        extraFromClient = req.body.projectSummary;
      } else if (typeof req.body.projectSummary === "string") {
        const raw = req.body.projectSummary.trim();
        if (raw) {
          try {
            extraFromClient = JSON.parse(raw);
          } catch {
            return res.status(400).json({
              success: false,
              message:
                "projectSummary must be valid JSON when sent as a string.",
            });
          }
        }
      }
    }

    if (!name || !email || !location || (!githubProfileUrl && !githubRepoUrl)) {
      return res.status(400).json({
        success: false,
        message:
          "name, email, location, and githubProfileUrl (or githubRepoUrl) are required.",
      });
    }

    const normalizedProfileUrl = normalizeGithubProfileUrl(
      githubProfileUrl || githubRepoUrl,
    );
    if (!normalizedProfileUrl) {
      return res.status(400).json({
        success: false,
        message:
          "githubProfileUrl must be a valid public GitHub profile URL (https://github.com/<username>).",
      });
    }

    const normalizedRepoUrl = normalizeGithubRepoUrl(githubRepoUrl);

    const {
      summary: projectSummary,
      profileStats,
      profileScore,
      usedAi,
      reason,
    } = await generateProfileEvaluationFromProfileUrl(normalizedProfileUrl);

    mergeUserRegistrationIntoSummary(projectSummary, {
      userSkills,
      userLanguages,
      projectNotes,
      extraFromClient,
    });

    const difficultyScore = clampDifficulty(
      projectSummary.difficulty ?? (profileScore ? profileScore / 10 : 5),
    );

    const minTokensToHire = Number.isFinite(Number(req.body.minTokensToHire)) 
      ? Math.max(0, Number(req.body.minTokensToHire)) 
      : 10;

    let user = await User.findOne({ email: { $regex: new RegExp(`^${email.trim()}$`, "i") } });
    if (user) {
      user.name = name;
      user.location = location;
      user.githubProfileUrl = normalizedProfileUrl;
      user.githubRepoUrl = normalizedRepoUrl || "";
      user.skills = userSkills;
      user.userLanguages = userLanguages;
      user.projectNotes = projectNotes;
      user.projectSummary = projectSummary;
      user.profileStats = profileStats || null;
      user.profileScore = Number.isFinite(Number(profileScore)) ? Number(profileScore) : 0;
      user.difficultyScore = difficultyScore;
      user.minTokensToHire = minTokensToHire;
      await user.save();
    } else {
      user = await User.create({
        name,
        email: email.trim().toLowerCase(),
        location,
        githubProfileUrl: normalizedProfileUrl,
        githubRepoUrl: normalizedRepoUrl || "",
        skills: userSkills,
        userLanguages,
        projectNotes,
        projectSummary,
        profileStats: profileStats || null,
        profileScore: Number.isFinite(Number(profileScore)) ? Number(profileScore) : 0,
        difficultyScore,
        minTokensToHire,
      });
    }

    if (normalizedRepoUrl) {
      const { owner, repo } = parseOwnerRepo(normalizedRepoUrl);
      const ghMeta = await fetchGithubRepoMetadata(owner, repo);
      const repoSummary = buildSummaryFromGithubApi(normalizedRepoUrl, ghMeta);
      const projectName =
        String(repoSummary.repoName || "").trim() ||
        (normalizedRepoUrl.match(/\/([^/]+)\/?$/) || [])[1] ||
        "repository";
      const keywords = buildKeywordsFromSummary(repoSummary);
      await Project.create({
        userId: user._id,
        name: projectName,
        keywords,
        difficulty: clampDifficulty(repoSummary.difficulty),
        githubRepoUrl: normalizedRepoUrl,
      });
    }

    await recalculateUserTotalDifficulty(user._id);

    const userOut = await User.findById(user._id).lean();

    return res.status(201).json({
      success: true,
      contextGeneration: { usedAi, reason },
      user: userOut,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }
    return next(error);
  }
};

const matchUsers = async (req, res, next) => {
  try {
    const { targetLocation, missionDescription, keyword } = req.body;

    if (!targetLocation || !missionDescription) {
      return res.status(400).json({
        success: false,
        message: "targetLocation and missionDescription are required.",
      });
    }

    let users = await User.find({}).lean();

    const kw = String(keyword || "").trim();
    if (kw) {
      const rx = new RegExp(escapeRegex(kw), "i");
      
      const collabs = await Project.find({
        source: "collab",
        $or: [{ name: rx }, { description: rx }, { keywords: rx }],
      })
        .select("userId helpers.userId")
        .lean();
        
      const allowedCollabUserIds = new Set();
      for (const c of collabs) {
        if (c.userId) allowedCollabUserIds.add(String(c.userId));
        for (const h of c.helpers || []) {
          if (h.userId) allowedCollabUserIds.add(String(h.userId));
        }
      }

      users = users.filter((u) => {
        if (allowedCollabUserIds.has(String(u._id))) return true;

        const stringifiedContext = JSON.stringify({
          name: u.name,
          skills: u.skills,
          langs: u.userLanguages,
          notes: u.projectNotes,
          summary: u.projectSummary,
        });

        return rx.test(stringifiedContext);
      });
    }

    if (!users.length) {
      return res.status(200).json({
        success: true,
        targetLocation,
        missionDescription,
        keywordFilter: kw || null,
        results: [],
        totalUsersScanned: 0,
      });
    }

    const compactUsers = users.map((u) => ({
      userId: String(u._id),
      name: u.name,
      email: u.email,
      location: u.location,
      githubProfileUrl: u.githubProfileUrl || normalizeGithubProfileUrl(u.githubRepoUrl),
      githubRepoUrl: u.githubRepoUrl,
      profileScore: Number(u.profileScore) || 0,
      profileStats: u.profileStats || u.projectSummary?.profileStats || null,
      totalDifficulty: Number(u.totalDifficulty) || 0,
      projectSummary: u.projectSummary,
      skills: u.skills || [],
      userLanguages: u.userLanguages || [],
      projectNotes: u.projectNotes || "",
    }));

    const legacySystemPrompt = `
You are an AI recruiter ranking engine.

Context for each candidate:
- githubRepoUrl: public repo URL they registered.
- projectSummary: JSON built from that URL (stack, domains, keywords, highlights, difficulty hints). This is the main technical evidence.
- totalDifficulty: sum of per-repo difficulty scores (1–10 each, from AI/context) across all projects they submitted — higher means more aggregate project challenge — use as a weak tie-breaker when mission is advanced.

Mission interpretation (be concise; map informal phrases to domains):
- Recruiters often describe work in plain language. Map loosely, e.g. "text editor" -> editors/IDE plugins, rich text, WASM, performance; "2d game" -> canvas/WebGL/Unity2D/Godot; "multiplayer rpg" -> networking, sync, persistence, game logic; "VS Code" -> extension API, LSP, TypeScript tooling; "API" -> REST/GraphQL, auth, scaling.
- Prefer overlap between mission themes and projectSummary.keywords, frameworks, domains, highlights over exact wording.

Your task:
1) Semantic geographic match: candidate location vs targetLocation (no coordinates).
2) Mission fit: compare missionDescription to projectSummary + repo URL signals; use totalDifficulty only as a secondary signal.
3) Rank best-fit candidates.

Rules:
- Location: treat city/metro/region/borough relationships (e.g. Brooklyn ~ NYC).
- Prioritize mission/technical fit first, then location, then totalDifficulty for ties.
- If projectSummary.confidence is low or data sparse, say so briefly and score conservatively.
- fitScore 0–100; include only meaningful fits; sort descending.

Output: STRICT JSON array only. No markdown. Each item:
{
  "userId": "string",
  "name": "string",
  "email": "string",
  "location": "string",
  "fitScore": 0,
  "reasoning": "string"
}
`;

    const systemPrompt = `
You are an AI recruiter ranking engine.

Context for each candidate:
- githubProfileUrl: GitHub profile URL they registered.
- profileStats: aggregated GitHub profile statistics (public repos, followers, stars across sampled repos, top languages).
- profileScore: a 0-100 score derived from profileStats (use only as a weak tie-breaker).
- projectSummary: stored structured context for the candidate (may include profile-based keywords/highlights and registration notes).

Mission interpretation (be concise; map informal phrases to domains):
- Recruiters often describe work in plain language. Map loosely, e.g. "text editor" -> editors/IDE plugins, rich text, WASM, performance; "2d game" -> canvas/WebGL/Unity2D/Godot; "multiplayer rpg" -> networking, sync, persistence, game logic; "VS Code" -> extension API, LSP, TypeScript tooling; "API" -> REST/GraphQL, auth, scaling.
- Prefer overlap between mission themes and (projectSummary keywords/highlights) plus profileStats topLanguages over exact wording.

Your task:
1) Semantic geographic match: candidate location vs targetLocation (no coordinates).
2) Mission fit: compare missionDescription to projectSummary + profileStats signals.
3) Rank best-fit candidates.

Rules:
- Location: treat city/metro/region/borough relationships (e.g. Brooklyn ~ NYC).
- Prioritize mission/technical fit first, then location, then profileScore for ties.
- If profileStats are missing or data is sparse, say so briefly and score conservatively.
- fitScore 0-100; include only meaningful fits; sort descending.

Output: STRICT JSON array only. No markdown. Each item:
{
  "userId": "string",
  "name": "string",
  "email": "string",
  "location": "string",
  "fitScore": 0,
  "reasoning": "string"
}
`;

    const userPrompt = JSON.stringify(
      {
        targetLocation,
        missionDescription,
        candidates: compactUsers,
      },
      null,
      2,
    );

    let results;
    let usedFallback = false;
    try {
      let content = "";

      if (process.env.MOCK_LLM_RESPONSE) {
        content = process.env.MOCK_LLM_RESPONSE;
      } else if (!hasUsableOpenAIKey()) {
        results = localFallbackMatch(
          compactUsers,
          targetLocation,
          missionDescription,
        );
        content = JSON.stringify(results);
        usedFallback = true;
      } else {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        content = completion.choices?.[0]?.message?.content || "";
      }

      results = parseJsonArrayFromModel(content);
    } catch (llmError) {
      results = localFallbackMatch(
        compactUsers,
        targetLocation,
        missionDescription,
      );
      usedFallback = true;
    }

    const userById = new Map(users.map((u) => [String(u._id), u]));
    results = results.map((r) => {
      const u = userById.get(String(r.userId));
      return {
        ...r,
        email: u?.email || r.email,
        totalDifficulty: Number(u?.totalDifficulty) || 0,
        profileScore: Number(u?.profileScore) || 0,
        minTokensToHire: u?.minTokensToHire ?? 10,
      };
    });

    return res.status(200).json({
      success: true,
      targetLocation,
      missionDescription,
      keywordFilter: kw || null,
      totalUsersScanned: users.length,
      matchedCount: results.length,
      matchingMode: usedFallback ? "local-fallback" : "llm",
      results,
    });
  } catch (error) {
    return next(error);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const stale = await User.find({
      $or: [
        { totalDifficulty: { $exists: false } },
        { totalDifficulty: null },
        { averageDifficulty: { $exists: true } },
      ],
    })
      .select("_id")
      .lean();
    await Promise.all(stale.map((u) => recalculateUserTotalDifficulty(u._id)));

    const rows = await User.find({})
      .sort({ profileScore: -1, totalDifficulty: -1, updatedAt: -1 })
      .limit(limit)
      .select("name email location profileScore totalDifficulty projectCount tokens highestRankReached")
      .lean();

    const updates = [];

    const leaderboard = rows.map((u, index) => {
      const rank = index + 1;
      let newTokens = 0;
      const prevHighest = u.highestRankReached || 1000000;

      if (rank < prevHighest) {
        if (prevHighest === 1000000) {
          newTokens = Math.max(10, 500 - rank * 10);
        } else {
          newTokens = (prevHighest - rank) * 20;
        }

        updates.push(
          User.updateOne(
            { _id: u._id },
            {
              $inc: { tokens: newTokens },
              $set: { highestRankReached: rank },
            }
          )
        );
      }

      return {
        rank,
        name: u.name,
        email: u.email,
        location: u.location,
        profileScore: Number.isFinite(u.profileScore) ? u.profileScore : 0,
        totalDifficulty: Number.isFinite(u.totalDifficulty) ? u.totalDifficulty : 0,
        projectCount: u.projectCount ?? 0,
        tokens: (u.tokens || 0) + newTokens,
      };
    });

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return res.status(200).json({
      success: true,
      leaderboard,
    });
  } catch (error) {
    return next(error);
  }
};

/** Search user-created collaboration projects only (Project.source=collab; not GitHub repo rows). */
const searchProjects = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Query parameter q is required.",
      });
    }
    const rx = new RegExp(escapeRegex(q), "i");
    const projects = await Project.find({
      source: "collab",
      $or: [{ name: rx }, { description: rx }, { keywords: rx }],
    })
      .sort({ updatedAt: -1 })
      .populate("userId", "name email location totalDifficulty")
      .populate("helpers.userId", "name email")
      .lean();
    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    return next(error);
  }
};

const createCollabProject = async (req, res, next) => {
  try {
    const { creatorEmail, title, description, keywords } = req.body;
    if (!creatorEmail || !title || !description) {
      return res.status(400).json({
        success: false,
        message: "creatorEmail, title, and description are required.",
      });
    }

    const creator = await User.findOne({
      email: String(creatorEmail).toLowerCase().trim(),
    });
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "No user found with that email. Register first.",
      });
    }

    const kwList = parseStringList(keywords);

    const doc = await Project.create({
      userId: creator._id,
      source: "collab",
      name: String(title).trim(),
      description: String(description).trim(),
      keywords: kwList.map((k) => k.toLowerCase()),
      githubRepoUrl: "",
      difficulty: 1,
      helpers: [],
    });

    await recalculateUserTotalDifficulty(creator._id);

    const out = await Project.findById(doc._id)
      .populate("userId", "name email location totalDifficulty")
      .populate("helpers.userId", "name email")
      .lean();

    return res.status(201).json({
      success: true,
      project: out,
    });
  } catch (error) {
    return next(error);
  }
};

const offerHelpOnCollabProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { helperEmail } = req.body;

    if (!helperEmail) {
      return res.status(400).json({
        success: false,
        message: "helperEmail is required.",
      });
    }

    const project = await Project.findById(id);
    if (!project || project.source !== "collab") {
      return res.status(404).json({
        success: false,
        message: "Collaboration project not found.",
      });
    }

    const helper = await User.findOne({
      email: String(helperEmail).toLowerCase().trim(),
    });
    if (!helper) {
      return res.status(404).json({
        success: false,
        message: "Helper must be a registered user email.",
      });
    }

    if (String(helper._id) === String(project.userId)) {
      return res.status(400).json({
        success: false,
        message: "Creator cannot join as helper on their own project.",
      });
    }

    const already = project.helpers.some(
      (h) => String(h.userId) === String(helper._id),
    );
    if (already) {
      return res.status(409).json({
        success: false,
        message: "You are already listed as a helper.",
      });
    }

    project.helpers.push({ userId: helper._id });
    await project.save();

    const out = await Project.findById(project._id)
      .populate("userId", "name email location totalDifficulty")
      .populate("helpers.userId", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      project: out,
    });
  } catch (error) {
    return next(error);
  }
};

/** Submit another GitHub repo for an existing user; recomputes totalDifficulty. */
const submitProject = async (req, res, next) => {
  try {
    const { email, githubRepoUrl } = req.body;
    if (!email || !githubRepoUrl) {
      return res.status(400).json({
        success: false,
        message: "email and githubRepoUrl are required.",
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with that email. Register first.",
      });
    }

    const normalizedUrl = normalizeGithubRepoUrl(githubRepoUrl);
    if (!normalizedUrl) {
      return res.status(400).json({
        success: false,
        message: "githubRepoUrl must be a valid public GitHub repository URL.",
      });
    }

    const { owner, repo } = parseOwnerRepo(normalizedUrl);
    const ghMeta = await fetchGithubRepoMetadata(owner, repo);
    const projectSummary = buildSummaryFromGithubApi(normalizedUrl, ghMeta);
    const usedAi = false;
    const reason = ghMeta ? "github-api" : "github-api-unavailable";

    const diff = clampDifficulty(projectSummary.difficulty);

    const projectName =
      String(projectSummary.repoName || "").trim() ||
      (normalizedUrl.match(/\/([^/]+)\/?$/) || [])[1] ||
      "repository";
    const keywords = buildKeywordsFromSummary(projectSummary);

    await Project.create({
      userId: user._id,
      name: projectName,
      keywords,
      difficulty: diff,
      githubRepoUrl: normalizedUrl,
    });

    await User.updateOne({ _id: user._id }, { $set: { difficultyScore: diff } });
    await recalculateUserTotalDifficulty(user._id);

    const userOut = await User.findById(user._id).lean();

    return res.status(200).json({
      success: true,
      contextGeneration: { usedAi, reason },
      user: userOut,
    });
  } catch (error) {
    return next(error);
  }
};
const payTokensToUser = async (req, res, next) => {
  try {
    const { senderEmail, recipientEmail, amount } = req.body;

    if (!senderEmail || !recipientEmail || amount === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const payAmount = Math.floor(Number(amount));
    if (payAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive integer." });
    }

    const sender = await User.findOne({ email: { $regex: new RegExp(`^${String(senderEmail).trim()}$`, "i") } });
    if (!sender) {
      return res.status(404).json({ success: false, message: "Your sender profile was not found in the database. Please click Profile and re-register." });
    }

    const recipient = await User.findOne({ email: { $regex: new RegExp(`^${String(recipientEmail).trim()}$`, "i") } });
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient user could not be found in the system." });
    }

    if (String(sender._id) === String(recipient._id)) {
      return res.status(400).json({ success: false, message: "Cannot pay yourself." });
    }

    const minRequired = recipient.minTokensToHire ?? 10;
    if (payAmount < minRequired) {
      return res.status(400).json({ success: false, message: `The recipient requires a minimum of ${minRequired} tokens to be hired.` });
    }

    if ((sender.tokens || 0) < payAmount) {
      return res.status(400).json({ success: false, message: "Insufficient tokens." });
    }

    await User.updateOne({ _id: sender._id }, { $inc: { tokens: -payAmount } });
    await User.updateOne({ _id: recipient._id }, { $inc: { tokens: payAmount } });

    return res.status(200).json({
      success: true,
      message: `Successfully paid ${payAmount} tokens.`,
      senderTokens: sender.tokens - payAmount
    });
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { email, name, location, username, profilePicture, minTokensToHire } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (name) user.name = name;
    if (location) user.location = location;
    
    if (username !== undefined) {
      user.projectSummary = user.projectSummary || {};
      user.projectSummary.username = username;
      user.markModified("projectSummary");
    }
    
    if (profilePicture !== undefined) {
      user.projectSummary = user.projectSummary || {};
      user.projectSummary.profilePicture = profilePicture || null;
      user.markModified("projectSummary");
    }
    
    if (Number.isFinite(Number(minTokensToHire))) {
      user.minTokensToHire = Math.max(0, Number(minTokensToHire));
    }

    await user.save();
    res.json({ success: true, message: "Profile updated.", user });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerUser,
  matchUsers,
  getLeaderboard,
  searchProjects,
  submitProject,
  createCollabProject,
  offerHelpOnCollabProject,
  payTokensToUser,
  updateProfile,
};
