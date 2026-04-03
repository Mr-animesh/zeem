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
      const summaryText = JSON.stringify(
        user.projectSummary || {},
      ).toLowerCase();
      const repoText = String(user.githubRepoUrl || "").toLowerCase();

      const locationOverlap = [...locationTokens].filter((t) =>
        targetTokens.has(t),
      ).length;
      const missionOverlap = [...missionTokens].filter(
        (t) => summaryText.includes(t) || repoText.includes(t),
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
    const { name, email, location, githubRepoUrl } = req.body;
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

    if (!name || !email || !location || !githubRepoUrl) {
      return res.status(400).json({
        success: false,
        message: "name, email, location, and githubRepoUrl are required.",
      });
    }

    const normalizedUrl = normalizeGithubRepoUrl(githubRepoUrl);
    if (!normalizedUrl) {
      return res.status(400).json({
        success: false,
        message: "githubRepoUrl must be a valid public GitHub repository URL.",
      });
    }

    const { summary: projectSummary, usedAi, reason } =
      await generateProjectSummaryFromRepoUrl(githubRepoUrl);

    mergeUserRegistrationIntoSummary(projectSummary, {
      userSkills,
      userLanguages,
      projectNotes,
      extraFromClient,
    });

    const difficultyScore = clampDifficulty(projectSummary.difficulty);

    const user = await User.create({
      name,
      email,
      location,
      githubRepoUrl: normalizedUrl,
      skills: userSkills,
      userLanguages,
      projectNotes,
      projectSummary,
      difficultyScore,
    });

    const projectName =
      String(projectSummary.repoName || "").trim() ||
      (normalizedUrl.match(/\/([^/]+)\/?$/) || [])[1] ||
      "repository";
    const keywords = buildKeywordsFromSummary(projectSummary);
    await Project.create({
      userId: user._id,
      name: projectName,
      keywords,
      difficulty: difficultyScore,
      githubRepoUrl: normalizedUrl,
    });

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
      const allowed = new Set();
      for (const c of collabs) {
        if (c.userId) allowed.add(String(c.userId));
        for (const h of c.helpers || []) {
          if (h.userId) allowed.add(String(h.userId));
        }
      }
      users = users.filter((u) => allowed.has(String(u._id)));
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
      githubRepoUrl: u.githubRepoUrl,
      totalDifficulty: Number(u.totalDifficulty) || 0,
      projectSummary: u.projectSummary,
    }));

    const systemPrompt = `
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
      .sort({ totalDifficulty: -1, updatedAt: -1 })
      .limit(limit)
      .select("name email location totalDifficulty projectCount")
      .lean();

    const leaderboard = rows.map((u, index) => ({
      rank: index + 1,
      name: u.name,
      email: u.email,
      location: u.location,
      totalDifficulty: Number.isFinite(u.totalDifficulty) ? u.totalDifficulty : 0,
      projectCount: u.projectCount ?? 0,
    }));

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

    const { summary: projectSummary, usedAi, reason } =
      await generateProjectSummaryFromRepoUrl(githubRepoUrl);

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

module.exports = {
  registerUser,
  matchUsers,
  getLeaderboard,
  searchProjects,
  submitProject,
  createCollabProject,
  offerHelpOnCollabProject,
};
