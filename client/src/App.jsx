import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const defaultProjectSummaryJson = `{
  "languages": ["JavaScript", "TypeScript"],
  "frameworks": ["React", "Node.js"],
  "highlights": ["Built APIs", "Implemented CI/CD"]
}`;

function mailtoHref(email, subject = "Connect via AI Recruiter") {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
}

function App() {
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    location: "",
    githubRepoUrl: "https://github.com/facebook/react",
    skills: "API design, CI/CD",
    languages: "JavaScript, TypeScript",
    projectNotes: "",
    projectSummaryJson: defaultProjectSummaryJson,
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [matchForm, setMatchForm] = useState({
    targetLocation: "",
    missionDescription: "",
    keyword: "",
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectHits, setProjectHits] = useState([]);
  const [registerMessage, setRegisterMessage] = useState("");
  const [contextMeta, setContextMeta] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [extraSubmit, setExtraSubmit] = useState({
    email: "",
    githubRepoUrl: "",
  });
  const [extraLoading, setExtraLoading] = useState(false);
  const [collabForm, setCollabForm] = useState({
    creatorEmail: "",
    title: "",
    description: "",
    keywords: "",
  });
  const [collabLoading, setCollabLoading] = useState(false);
  const [helperEmail, setHelperEmail] = useState("");

  const loadLeaderboard = () => {
    fetch(`${apiBase}/api/leaderboard?limit=15`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const onRegisterChange = (event) => {
    const { name, value } = event.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  const onMatchChange = (event) => {
    const { name, value } = event.target;
    setMatchForm((prev) => ({ ...prev, [name]: value }));
  };

  const registerUser = async (event) => {
    event.preventDefault();
    setError("");
    setRegisterMessage("");
    setContextMeta(null);
    setRegisterLoading(true);

    let projectSummary;
    const rawJson = registerForm.projectSummaryJson.trim();
    if (rawJson) {
      try {
        projectSummary = JSON.parse(rawJson);
      } catch {
        setError("Optional projectSummary JSON must be valid JSON (README-style block).");
        setRegisterLoading(false);
        return;
      }
    }

    const payload = {
      name: registerForm.name.trim(),
      email: registerForm.email.trim().toLowerCase(),
      location: registerForm.location.trim(),
      githubRepoUrl: registerForm.githubRepoUrl.trim(),
      skills: registerForm.skills.trim(),
      languages: registerForm.languages.trim(),
      projectNotes: registerForm.projectNotes.trim(),
      ...(projectSummary ? { projectSummary } : {}),
    };

    try {
      const response = await fetch(`${apiBase}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to register user.");
        return;
      }

      setRegisterMessage(`Registered ${data.user.name} successfully.`);
      setContextMeta(data.contextGeneration || null);
      setRegisterForm((prev) => ({
        ...prev,
        name: "",
        email: "",
        location: "",
      }));
      loadLeaderboard();
    } catch (e) {
      setError("Could not connect to backend.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const submitAnotherRepo = async (event) => {
    event.preventDefault();
    setError("");
    setExtraLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/projects/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: extraSubmit.email.trim().toLowerCase(),
          githubRepoUrl: extraSubmit.githubRepoUrl.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Submit failed.");
        return;
      }
      setRegisterMessage(`Project added for ${data.user?.name || extraSubmit.email.trim()}.`);
      loadLeaderboard();
    } catch (e) {
      setError("Could not connect to backend.");
    } finally {
      setExtraLoading(false);
    }
  };

  const runMatch = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const payload = {
        targetLocation: matchForm.targetLocation,
        missionDescription: matchForm.missionDescription,
        ...(matchForm.keyword.trim() ? { keyword: matchForm.keyword.trim() } : {}),
      };
      const response = await fetch(`${apiBase}/api/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Matching failed.");
        return;
      }

      setResults(data.results || []);
    } catch (e) {
      setError("Could not connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  const searchProjects = async (event) => {
    event.preventDefault();
    setError("");
    setProjectHits([]);
    const q = projectSearch.trim();
    if (!q) return;
    try {
      const response = await fetch(`${apiBase}/api/projects/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Project search failed.");
        return;
      }
      setProjectHits(data.projects || []);
    } catch (e) {
      setError("Could not connect to backend.");
    }
  };

  const createCollabProject = async (event) => {
    event.preventDefault();
    setError("");
    setCollabLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/collab-projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorEmail: collabForm.creatorEmail.trim().toLowerCase(),
          title: collabForm.title.trim(),
          description: collabForm.description.trim(),
          keywords: collabForm.keywords.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Could not create project.");
        return;
      }
      setRegisterMessage(`Collaboration project “${data.project?.name || "created"}” posted.`);
      setCollabForm((p) => ({ ...p, title: "", description: "", keywords: "" }));
    } catch (e) {
      setError("Could not connect to backend.");
    } finally {
      setCollabLoading(false);
    }
  };

  const offerHelp = async (projectId) => {
    setError("");
    const em = helperEmail.trim().toLowerCase();
    if (!em) {
      setError("Enter your registered email below to offer help.");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/collab-projects/${projectId}/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helperEmail: em }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Could not join as helper.");
        return;
      }
      setRegisterMessage("You are now listed as a helper on that project.");
      setProjectHits((hits) =>
        hits.map((h) =>
          String(h._id) === String(data.project?._id) ? data.project : h,
        ),
      );
    } catch (e) {
      setError("Could not connect to backend.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">AI Recruiter Platform</h1>
          <p className="mt-1 text-sm text-slate-600">
            Leaderboard ranks by total difficulty (sum of each project’s AI/context difficulty). Post collaboration projects for others to join; search lists those only (not GitHub repos). Use email links to reach people.
          </p>
        </header>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {registerMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {registerMessage}
          </div>
        )}

        <section className="grid gap-6 md:grid-cols-2">
          <form onSubmit={registerUser} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Register Developer</h2>
            <input className="w-full rounded-md border px-3 py-2 text-sm" name="name" value={registerForm.name} onChange={onRegisterChange} placeholder="Name" required />
            <input className="w-full rounded-md border px-3 py-2 text-sm" name="email" type="email" value={registerForm.email} onChange={onRegisterChange} placeholder="Email" required />
            <input className="w-full rounded-md border px-3 py-2 text-sm" name="location" value={registerForm.location} onChange={onRegisterChange} placeholder="Location (e.g. Brooklyn)" required />
            <input className="w-full rounded-md border px-3 py-2 font-mono text-xs" name="githubRepoUrl" value={registerForm.githubRepoUrl} onChange={onRegisterChange} placeholder="https://github.com/owner/repo" required />
            <input className="w-full rounded-md border px-3 py-2 text-sm" name="skills" value={registerForm.skills} onChange={onRegisterChange} placeholder="Skills (comma-separated)" />
            <input className="w-full rounded-md border px-3 py-2 text-sm" name="languages" value={registerForm.languages} onChange={onRegisterChange} placeholder="Languages you use (comma-separated)" />
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" name="projectNotes" rows={2} value={registerForm.projectNotes} onChange={onRegisterChange} placeholder="Short project / experience notes (optional)" />
            <label className="block text-xs font-medium text-slate-700">Optional README-style JSON (merged with GitHub + AI context)</label>
            <textarea className="h-32 w-full rounded-md border px-3 py-2 font-mono text-xs" name="projectSummaryJson" value={registerForm.projectSummaryJson} onChange={onRegisterChange} />
            <p className="text-xs text-slate-500">
              Backend calls GitHub REST API for real languages/topics. Add <code className="rounded bg-slate-100 px-1">GITHUB_TOKEN</code> in server <code className="rounded bg-slate-100 px-1">.env</code> if rate-limited.
            </p>
            <button
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              type="submit"
              disabled={registerLoading}
            >
              {registerLoading ? "Building context…" : "Save User"}
            </button>
            {contextMeta && (
              <p className="text-xs text-slate-600">
                Context: {contextMeta.usedAi ? "AI-enriched" : "GitHub API / fallback"} ({contextMeta.reason})
              </p>
            )}
          </form>

          <div className="space-y-6">
            <form onSubmit={runMatch} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Find Best Fit</h2>
              <input className="w-full rounded-md border px-3 py-2 text-sm" name="targetLocation" value={matchForm.targetLocation} onChange={onMatchChange} placeholder="Target location (e.g. Lower Manhattan)" required />
              <textarea className="h-28 w-full rounded-md border px-3 py-2 text-sm" name="missionDescription" value={matchForm.missionDescription} onChange={onMatchChange} placeholder="Short mission (e.g. 2d game, VS Code extension, multiplayer)" required />
              <input className="w-full rounded-md border px-3 py-2 text-sm" name="keyword" value={matchForm.keyword} onChange={onMatchChange} placeholder="Optional: filter matches by collaboration project keyword (non-AI)" />
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500" type="submit" disabled={loading}>
                {loading ? "Matching..." : "Run Match"}
              </button>
            </form>

            <form onSubmit={submitAnotherRepo} className="space-y-3 rounded-xl border border-dashed border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Add another repo</h2>
              <p className="text-xs text-slate-500">Registered email + another public GitHub URL.</p>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="email"
                placeholder="Registered email"
                value={extraSubmit.email}
                onChange={(e) => setExtraSubmit((p) => ({ ...p, email: e.target.value }))}
                required
              />
              <input
                className="w-full rounded-md border px-3 py-2 font-mono text-xs"
                placeholder="https://github.com/owner/other-repo"
                value={extraSubmit.githubRepoUrl}
                onChange={(e) => setExtraSubmit((p) => ({ ...p, githubRepoUrl: e.target.value }))}
                required
              />
              <button
                type="submit"
                disabled={extraLoading}
                className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
              >
                {extraLoading ? "Submitting…" : "Submit repo"}
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create collaboration project</h2>
          <p className="mb-3 text-xs text-slate-500">
            Post a project others can help with (separate from GitHub repo registration). Use your registered email as creator.
          </p>
          <form onSubmit={createCollabProject} className="grid gap-3 md:grid-cols-2">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm md:col-span-2"
              type="email"
              placeholder="Creator email (registered)"
              value={collabForm.creatorEmail}
              onChange={(e) => setCollabForm((p) => ({ ...p, creatorEmail: e.target.value }))}
              required
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm md:col-span-2"
              placeholder="Project title"
              value={collabForm.title}
              onChange={(e) => setCollabForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
            <textarea
              className="min-h-[88px] w-full rounded-md border px-3 py-2 text-sm md:col-span-2"
              placeholder="What you need help with"
              value={collabForm.description}
              onChange={(e) => setCollabForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm md:col-span-2"
              placeholder="Keywords (comma-separated, for search)"
              value={collabForm.keywords}
              onChange={(e) => setCollabForm((p) => ({ ...p, keywords: e.target.value }))}
            />
            <button
              type="submit"
              disabled={collabLoading}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60 md:col-span-2"
            >
              {collabLoading ? "Posting…" : "Post project"}
            </button>
          </form>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Leaderboard</h2>
            <p className="mb-3 text-xs text-slate-500">
              Rank is a whole number (1 = highest). <strong>Total difficulty</strong> sums per-repo scores (1–10 each) from context.
            </p>
            {!leaderboard.length && <p className="text-sm text-slate-500">No users yet.</p>}
            <ol className="space-y-3 text-sm">
              {leaderboard.map((row) => (
                <li key={`${row.email}-${row.rank}`} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <span className="flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md bg-slate-900 text-base font-bold text-white">
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-slate-900">{row.name}</span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Total: {Number(row.totalDifficulty ?? 0)}
                      </span>
                      {row.projectCount != null && row.projectCount > 0 && (
                        <span className="text-xs text-slate-500">({row.projectCount} project{row.projectCount === 1 ? "" : "s"})</span>
                      )}
                    </div>
                    <span className="block text-xs text-slate-500">{row.location}</span>
                    {row.email && (
                      <a href={mailtoHref(row.email)} className="mt-1 inline-block text-xs font-medium text-blue-600 underline">
                        Email
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <form onSubmit={searchProjects} className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Search collaboration projects</h2>
            <p className="mt-1 text-xs text-slate-500">Finds user-posted projects only (not GitHub repos).</p>
            <input
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Search title, description, keywords"
            />
            <label className="mt-2 block text-xs text-slate-600">Your email to offer help</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="email"
              value={helperEmail}
              onChange={(e) => setHelperEmail(e.target.value)}
              placeholder="Registered email (used when you click Offer help)"
            />
            <button className="mt-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50" type="submit">
              Search
            </button>
            {!!projectHits.length && (
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                {projectHits.map((p) => (
                  <li key={p._id} className="rounded border border-slate-200 p-3">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <p className="mt-1 text-xs text-slate-600">{p.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{(p.keywords || []).join(", ") || "—"}</p>
                    {p.userId?.name && (
                      <div className="mt-2 text-xs text-slate-600">
                        <span>By {p.userId.name}</span>
                        {p.userId.totalDifficulty != null && (
                          <span className="ml-2 font-medium text-amber-800">Total: {Number(p.userId.totalDifficulty)}</span>
                        )}
                        {p.userId.email && (
                          <a href={mailtoHref(p.userId.email)} className="ml-2 font-medium text-blue-600 underline">
                            Email creator
                          </a>
                        )}
                      </div>
                    )}
                    {!!(p.helpers && p.helpers.length) && (
                      <p className="mt-1 text-xs text-slate-500">
                        Helpers:{" "}
                        {p.helpers
                          .map((h) => h.userId?.name || h.userId?.email || "?")
                          .join(", ")}
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-emerald-700 underline"
                      onClick={() => offerHelp(p._id)}
                    >
                      Offer help
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Match Results</h2>
          {!results.length && <p className="text-sm text-slate-500">No results yet. Run a match query.</p>}
          <div className="space-y-3">
            {results.map((item) => (
              <article key={`${item.userId}-${item.email}`} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-slate-900">{item.name}</h3>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-xs text-white">Score: {item.fitScore}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.email}</p>
                {item.totalDifficulty != null && (
                  <p className="text-xs font-medium text-amber-900">Total difficulty: {Number(item.totalDifficulty)}</p>
                )}
                {item.email && (
                  <a href={mailtoHref(item.email)} className="text-xs font-medium text-blue-600 underline">
                    Email
                  </a>
                )}
                <p className="text-sm text-slate-600">{item.location}</p>
                <p className="mt-2 text-sm text-slate-800">{item.reasoning}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
