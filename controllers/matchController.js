const OpenAI = require("openai");
const User = require("../models/User");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "no-key",
});

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const localFallbackMatch = (users, targetLocation, missionDescription) => {
  const targetTokens = new Set(tokenize(targetLocation));
  const missionTokens = new Set(tokenize(missionDescription));

  const ranked = users
    .map((user) => {
      const locationTokens = new Set(tokenize(user.location));
      const summaryText = JSON.stringify(
        user.projectSummary || {},
      ).toLowerCase();

      const locationOverlap = [...locationTokens].filter((t) =>
        targetTokens.has(t),
      ).length;
      const missionOverlap = [...missionTokens].filter((t) =>
        summaryText.includes(t),
      ).length;

      const locationScore = Math.min(30, locationOverlap * 10);
      const missionScore = Math.min(70, missionOverlap * 5);
      const fitScore = Math.max(0, Math.min(100, locationScore + missionScore));

      return {
        userId: String(user.userId),
        name: String(user.name || ""),
        email: String(user.email || ""),
        location: String(user.location || ""),
        fitScore,
        reasoning:
          fitScore > 0
            ? `Location and project-summary keywords overlap with the mission requirements (${missionOverlap} mission matches, ${locationOverlap} location matches).`
            : "Limited semantic overlap found for location and mission context.",
      };
    })
    .filter((item) => item.fitScore > 0)
    .sort((a, b) => b.fitScore - a.fitScore);

  return ranked;
};

const hasUsableOpenAIKey = () => {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) return false;
  if (key === "your_openai_api_key_here") return false;
  if (key === "no-key") return false;
  return true;
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
    const { name, email, location, projectSummary } = req.body;

    if (!name || !email || !location || typeof projectSummary === "undefined") {
      return res.status(400).json({
        success: false,
        message: "name, email, location, and projectSummary are required.",
      });
    }

    const user = await User.create({
      name,
      email,
      location,
      projectSummary,
    });

    return res.status(201).json({
      success: true,
      user,
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
    const { targetLocation, missionDescription } = req.body;

    if (!targetLocation || !missionDescription) {
      return res.status(400).json({
        success: false,
        message: "targetLocation and missionDescription are required.",
      });
    }

    const users = await User.find({}).lean();

    if (!users.length) {
      return res.status(200).json({
        success: true,
        targetLocation,
        missionDescription,
        results: [],
        totalUsersScanned: 0,
      });
    }

    const compactUsers = users.map((u) => ({
      userId: String(u._id),
      name: u.name,
      email: u.email,
      location: u.location,
      projectSummary: u.projectSummary,
    }));

    const systemPrompt = `
You are an AI recruiter ranking engine.

Your task:
1) Evaluate semantic geographic similarity between each candidate's free-text location and the target location.
2) Evaluate project fit by comparing each candidate's projectSummary JSON against the mission description.
3) Return a ranked list of best-fit candidates.

Rules:
- Use semantic location reasoning only (no coordinates). Treat borough/city/metro/region relationships as relevant (e.g., Brooklyn ~ New York City, Lower Manhattan ~ NYC).
- Prioritize mission/technical fit first, then location affinity as a tie-breaker.
- Project context analysis should consider technologies, depth, complexity, domains, and evidence from projectSummary JSON.
- Assign fitScore from 0 to 100, where 100 is best fit.
- Include only candidates with meaningful fit.
- Sort descending by fitScore.
- For each candidate, include a short recruiter-friendly reasoning string (1-2 sentences).

Output format constraints:
- Return STRICT JSON ONLY.
- Return a JSON array and nothing else.
- No markdown, no code fences, no prose.
- Each element must follow this exact shape:
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
      // Demo reliability: if remote LLM fails, continue with local semantic fallback.
      results = localFallbackMatch(
        compactUsers,
        targetLocation,
        missionDescription,
      );
      usedFallback = true;
    }

    return res.status(200).json({
      success: true,
      targetLocation,
      missionDescription,
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
const leaderboard = await User.find({})
.sort({ difficultyScore: -1, updatedAt: -1 })
.limit(limit)
.select("name email location githubRepoUrl difficultyScore createdAt")
.lean();
return res.status(200).json({
success: true,
leaderboard,
});
} catch (error) {
return next(error);
}
};


module.exports = {
  registerUser,
  matchUsers,
  getLeaderboard
};

