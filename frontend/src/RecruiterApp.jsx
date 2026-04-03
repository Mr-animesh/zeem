import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:5000'
const REGISTERED_PROFILE_KEY = 'buildmate_recruiter_profile_registered'
const PROFILE_DATA_KEY = 'buildmate_recruiter_profile_data'

function RecruiterApp() {
  const apiBase = useMemo(() => API_BASE_URL.replace(/\/$/, ''), [])
  const [recruiterHash, setRecruiterHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash
  )

  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [registerStep, setRegisterStep] = useState(0)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    email: '',
    location: '',
    skillInput: '',
    platformInput: '',
    skills: [],
    platforms: [],
    profilePicUrl: ''
  })

  const [matchForm, setMatchForm] = useState({
    targetLocation: '',
    missionDescription: '',
    keyword: ''
  })

  const [leaderboard, setLeaderboard] = useState([])
  const [projectSearch, setProjectSearch] = useState('')
  const [projectHits, setProjectHits] = useState([])

  const [registerMessage, setRegisterMessage] = useState('')
  const [results, setResults] = useState([])
  const [hasRunMatch, setHasRunMatch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${apiBase}/api/leaderboard?limit=15`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard)
        }
      })
      .catch(() => {})
  }, [apiBase])

  useEffect(() => {
    const hasRegistered = window.localStorage.getItem(REGISTERED_PROFILE_KEY)
    const rawProfile = window.localStorage.getItem(PROFILE_DATA_KEY)
    let parsedProfile = null
    if (rawProfile) {
      try {
        const parsed = JSON.parse(rawProfile)
        if (parsed && typeof parsed === 'object') {
          parsedProfile = parsed
          setCurrentProfile(parsed)
        }
      } catch {
        // Ignore invalid local storage payload.
      }
    }
    if (!parsedProfile && hasRegistered) {
      window.localStorage.removeItem(REGISTERED_PROFILE_KEY)
    }
    if (!hasRegistered || !parsedProfile) {
      setShowRegisterModal(true)
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => setRecruiterHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const onMatchChange = (e) => {
    const { name, value } = e.target
    setMatchForm((prev) => ({ ...prev, [name]: value }))
  }

  const onRegisterFieldChange = (e) => {
    const { name, value } = e.target
    setRegisterForm((prev) => ({ ...prev, [name]: value }))
  }

  const addListItem = (key, inputKey) => {
    setRegisterForm((prev) => {
      const value = prev[inputKey].trim()
      if (!value) return prev
      if (prev[key].some((item) => item.toLowerCase() === value.toLowerCase())) {
        return { ...prev, [inputKey]: '' }
      }
      return {
        ...prev,
        [key]: [...prev[key], value],
        [inputKey]: ''
      }
    })
  }

  const removeListItem = (key, value) => {
    setRegisterForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((item) => item !== value)
    }))
  }

  const resetRegisterForm = () => {
    setRegisterStep(0)
    setRegisterForm({
      name: '',
      username: '',
      email: '',
      location: '',
      skillInput: '',
      platformInput: '',
      skills: [],
      platforms: [],
      profilePicUrl: ''
    })
  }

  const registerUser = async (e) => {
    e.preventDefault()
    setError('')
    setRegisterMessage('')

    if (!registerForm.skills.length) {
      setError('Add at least one skill.')
      return
    }

    const payload = {
      name: registerForm.name.trim(),
      email: registerForm.email.trim(),
      location: registerForm.location.trim(),
      projectSummary: {
        username: registerForm.username.trim(),
        skills: registerForm.skills,
        platforms: registerForm.platforms,
        profilePicture: registerForm.profilePicUrl.trim() || null
      }
    }

    try {
      const response = await fetch(`${apiBase}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.message || 'Failed to save profile.')
        return
      }

      setRegisterMessage(
        `Profile saved for ${data.user?.name || payload.name} successfully.`
      )
      setShowRegisterModal(false)
      setShowProfilePanel(false)
      setRegisterStep(0)
      window.localStorage.setItem(REGISTERED_PROFILE_KEY, 'true')
      const savedProfile = {
        name: payload.name,
        username: payload.projectSummary.username,
        email: payload.email,
        location: payload.location,
        profilePicture: payload.projectSummary.profilePicture || ''
      }
      setCurrentProfile(savedProfile)
      window.localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify(savedProfile))
      resetRegisterForm()

      fetch(`${apiBase}/api/leaderboard?limit=15`)
        .then((r) => r.json())
        .then((lb) => {
          if (lb.success && Array.isArray(lb.leaderboard)) {
            setLeaderboard(lb.leaderboard)
          }
        })
        .catch(() => {})
    } catch {
      setError('Could not connect to backend.')
    }
  }

  const runMatch = async (e) => {
    e.preventDefault()
    setHasRunMatch(true)
    setLoading(true)
    setError('')
    setResults([])

    try {
      const payload = {
        targetLocation: matchForm.targetLocation,
        missionDescription: matchForm.missionDescription,
        ...(matchForm.keyword.trim() && { keyword: matchForm.keyword.trim() })
      }

      const response = await fetch(`${apiBase}/api/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.message || 'Matching failed.')
        return
      }

      setResults(data.results || [])
    } catch {
      setError('Could not connect to backend.')
    } finally {
      setLoading(false)
    }
  }

  const searchProjects = async (e) => {
    e.preventDefault()
    setError('')
    setProjectHits([])

    const q = projectSearch.trim()
    if (!q) return

    try {
      const response = await fetch(
        `${apiBase}/api/projects/search?q=${encodeURIComponent(q)}`
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.message || 'Project search failed.')
        return
      }

      setProjectHits(data.projects || [])
    } catch {
      setError('Could not connect to backend.')
    }
  }

  const isLeaderboardPage = recruiterHash.startsWith('#/recruiter/leaderboard')
  const isCollaboratorPage = recruiterHash.startsWith('#/recruiter/collaborator')
  const totalRegisterSteps = 7
  const navItemClass =
    'rounded-md border px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors'

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email.trim())

  const getRegisterStepError = () => {
    if (registerStep === 0 && !registerForm.name.trim()) return 'Name is required.'
    if (registerStep === 1 && !registerForm.username.trim()) return 'Username is required.'
    if (registerStep === 2 && !emailIsValid) return 'Enter a valid email.'
    if (registerStep === 3 && !registerForm.location.trim()) return 'Location is required.'
    if (registerStep === 4 && !registerForm.skills.length) return 'Add at least one skill.'
    if (registerStep === 5 && !registerForm.platforms.length) return 'Add at least one platform.'
    return ''
  }

  const nextRegisterStep = () => {
    const stepError = getRegisterStepError()
    if (stepError) {
      setError(stepError)
      return
    }
    setError('')
    setRegisterStep((prev) => Math.min(totalRegisterSteps - 1, prev + 1))
  }

  const signOutProfile = () => {
    window.localStorage.removeItem(REGISTERED_PROFILE_KEY)
    window.localStorage.removeItem(PROFILE_DATA_KEY)
    setCurrentProfile(null)
    setShowProfilePanel(false)
    setRegisterMessage('')
    setError('')
    resetRegisterForm()
    setShowRegisterModal(true)
  }

  return (
    <main className="min-h-screen bg-[#131313] text-white dot-grid">
      <nav className="sticky top-0 z-40 border-b border-outline-variant/20 bg-[#131313]/90 backdrop-blur">
        <div className="relative flex w-full items-center px-8 py-4">
          <a
            className="text-3xl font-black text-[#A3E635] tracking-tight font-headline italic"
            href="/"
          >
            BUILDMATE
          </a>
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3">
            <a
              href="#/recruiter"
              className={`${navItemClass} ${
                !isLeaderboardPage && !isCollaboratorPage
                  ? 'border-primary-container/60 bg-transparent text-primary-container'
                  : 'border-outline-variant/40 bg-transparent text-white hover:border-primary-container hover:text-primary-container'
              }`}
            >
              Find Bestmate
            </a>
            <a
              href="#/recruiter/leaderboard"
              className={`${navItemClass} ${
                isLeaderboardPage
                  ? 'border-primary-container/60 bg-transparent text-primary-container'
                  : 'border-outline-variant/40 bg-transparent text-white hover:border-primary-container hover:text-primary-container'
              }`}
            >
              Leaderboard
            </a>
            <a
              href="#/recruiter/collaborator"
              className={`${navItemClass} ${
                isCollaboratorPage
                  ? 'border-primary-container/60 bg-transparent text-primary-container'
                  : 'border-outline-variant/40 bg-transparent text-white hover:border-primary-container hover:text-primary-container'
              }`}
            >
              Collaborator
            </a>
            <a
              href="#/"
              className={`${navItemClass} border-outline-variant/40 bg-transparent text-white hover:border-primary-container hover:text-primary-container`}
            >
              Back
            </a>
          </div>
          <div className="relative ml-auto">
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-left"
              onClick={() => setShowProfilePanel((prev) => !prev)}
            >
              {currentProfile?.profilePicture ? (
                <img
                  src={currentProfile.profilePicture}
                  alt={currentProfile.name || 'Profile'}
                  className="h-10 w-10 rounded-full object-cover border border-outline-variant/40"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold">
                  {(currentProfile?.name || 'U').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="leading-tight">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Profile</p>
                <p className="text-sm font-bold text-white">
                  {currentProfile?.name || 'Not set'}
                </p>
                <p className="text-xs text-primary-container">
                  {currentProfile?.username ? `@${currentProfile.username}` : 'Register to add profile'}
                </p>
              </div>
            </button>

            {showProfilePanel && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-outline-variant/30 bg-surface-container p-4 shadow-xl">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Profile Details</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/80">Name</span>
                    <span className="text-right text-primary-container">{currentProfile?.name || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/80">Username</span>
                    <span className="text-right text-primary-container">
                      {currentProfile?.username ? `@${currentProfile.username}` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/80">Email</span>
                    <span className="text-right text-primary-container">{currentProfile?.email || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/80">Location</span>
                    <span className="text-right text-primary-container">{currentProfile?.location || '-'}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-outline-variant/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:border-primary-container"
                    onClick={() => {
                      setShowProfilePanel(false)
                      setShowRegisterModal(true)
                    }}
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-500/50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-300 hover:bg-red-950/30"
                    onClick={signOutProfile}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {registerMessage && (
          <section className="rounded-xl border border-primary-container/30 bg-surface-container p-5 shadow-sm">
            <p className="text-sm text-primary-container">{registerMessage}</p>
          </section>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {isLeaderboardPage ? (
          <section id="leaderboard" className="rounded-xl border border-outline-variant/20 bg-surface-container p-5 shadow-sm">
            <h2 className="text-lg font-headline font-black uppercase tracking-wide text-primary-container">
              Leaderboard
            </h2>
            {!leaderboard.length && <p className="text-sm text-white/60">No users yet.</p>}
            {leaderboard.map((u, i) => (
              <div
                key={`${u.email}-${i}`}
                className="mt-3 flex items-center justify-between rounded-lg border border-outline-variant/20 bg-background/40 px-4 py-3"
              >
                <span className="text-white">{u.name}</span>
                <span className="font-bold text-primary-container">
                  {Number.isFinite(Number(u.difficultyScore)) ? u.difficultyScore : '-'}
                </span>
              </div>
            ))}
          </section>
        ) : isCollaboratorPage ? (
          <form
            onSubmit={searchProjects}
            className="rounded-xl border border-outline-variant/20 bg-surface-container p-5 shadow-sm"
          >
            <h2 className="text-lg font-headline font-black uppercase tracking-wide text-primary-container">
              Collaborator
            </h2>

            <input
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="mt-3 w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-white placeholder:text-white/40"
              placeholder="Search collaborators by project keywords"
            />

            <div className="mt-3 flex flex-wrap gap-3">
              <button className="rounded bg-primary-container px-4 py-2 font-headline font-bold uppercase tracking-wide text-on-primary hover:bg-primary">
                Search
              </button>
              <button
                type="button"
                className="rounded border border-outline-variant/40 bg-surface-container px-4 py-2 font-headline font-bold uppercase tracking-wide text-white hover:border-primary-container hover:text-primary-container"
                onClick={() => {
                  window.location.href = '/collaboration.html'
                }}
              >
                Create Project
              </button>
            </div>

            {projectHits.map((p) => (
              <div key={p._id} className="mt-3 rounded-lg border border-outline-variant/20 bg-background/40 px-4 py-3">
                {p.name} ({(p.keywords || []).join(', ')})
              </div>
            ))}
          </form>
        ) : (
          <>
            <section className="grid gap-6 md:grid-cols-1">
              <form
                id="find-bestmate"
                onSubmit={runMatch}
                className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-container p-5 shadow-sm"
              >
                <h2 className="text-lg font-headline font-black uppercase tracking-wide text-primary-container">
                  Find Bestmate
                </h2>

                <input
                  name="targetLocation"
                  value={matchForm.targetLocation}
                  onChange={onMatchChange}
                  placeholder="Target location"
                  className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                  required
                />

                <textarea
                  name="missionDescription"
                  value={matchForm.missionDescription}
                  onChange={onMatchChange}
                  placeholder="Mission description"
                  className="h-24 w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                  required
                />

                <input
                  name="keyword"
                  value={matchForm.keyword}
                  onChange={onMatchChange}
                  placeholder="Optional keyword"
                  className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                />

                <button
                  className="rounded bg-primary-container px-4 py-2 font-headline font-bold uppercase tracking-wide text-on-primary hover:bg-primary disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Matching...' : 'Run Match'}
                </button>

                {loading && (
                  <p className="text-sm text-white/70">
                    Fetching bestmate matches...
                  </p>
                )}

                {!loading && hasRunMatch && !results.length && !error && (
                  <p className="text-sm text-white/60">
                    No matches found for this query.
                  </p>
                )}

                {!loading && results.length > 0 && (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-primary-container">
                      {results.length} match{results.length > 1 ? 'es' : ''} found
                    </p>
                    {results.map((item) => (
                      <article
                        key={`${item.userId || item.email}-${item.email}`}
                        className="rounded-lg border border-outline-variant/20 bg-background/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{item.name || 'Unknown'}</p>
                          <span className="rounded-full border border-primary-container/40 px-2 py-1 text-xs font-bold text-primary-container">
                            {Number.isFinite(Number(item.fitScore))
                              ? `Score ${Number(item.fitScore)}`
                              : 'Score -'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/60">{item.email}</p>
                        <p className="text-xs text-white/60">{item.location}</p>
                        <p className="mt-2 text-sm text-white/80">
                          {item.reasoning || 'No reasoning provided.'}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </form>
            </section>

          </>
        )}
      </div>

      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-xl border border-outline-variant/30 bg-surface-container p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-headline font-black uppercase tracking-wide text-primary-container">
                Complete Your Profile
              </h3>
              <button
                type="button"
                className="rounded border border-outline-variant/40 px-3 py-1 text-sm text-white hover:border-primary-container"
                onClick={() => {
                  setShowRegisterModal(false)
                  setRegisterStep(0)
                }}
              >
                Close
              </button>
            </div>

            <form
              onSubmit={(e) => {
                if (registerStep < totalRegisterSteps - 1) {
                  e.preventDefault()
                  nextRegisterStep()
                  return
                }
                registerUser(e)
              }}
              className="space-y-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                Step {registerStep + 1} of {totalRegisterSteps}
              </p>

              {registerStep === 0 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-white/90">Name</label>
                  <input
                    name="name"
                    value={registerForm.name}
                    onChange={onRegisterFieldChange}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                    placeholder="Enter full name"
                    required
                  />
                </div>
              )}

              {registerStep === 1 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-white/90">Username</label>
                  <input
                    name="username"
                    value={registerForm.username}
                    onChange={onRegisterFieldChange}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                    placeholder="Enter username"
                    required
                  />
                </div>
              )}

              {registerStep === 2 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-white/90">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={registerForm.email}
                    onChange={onRegisterFieldChange}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                    placeholder="Enter email"
                    required
                  />
                </div>
              )}

              {registerStep === 3 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-white/90">Location</label>
                  <input
                    name="location"
                    value={registerForm.location}
                    onChange={onRegisterFieldChange}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                    placeholder="Enter location"
                    required
                  />
                </div>
              )}

              {registerStep === 4 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-white/90">Skills (multiple)</label>
                  <div className="flex gap-2">
                    <input
                      name="skillInput"
                      value={registerForm.skillInput}
                      onChange={onRegisterFieldChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addListItem('skills', 'skillInput')
                        }
                      }}
                      className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                      placeholder="Add skill and press Enter"
                    />
                    <button
                      type="button"
                      className="rounded bg-primary-container px-3 py-2 font-bold text-on-primary"
                      onClick={() => addListItem('skills', 'skillInput')}
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {registerForm.skills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        className="rounded-full bg-primary-container/20 px-3 py-1 text-xs text-primary-container"
                        onClick={() => removeListItem('skills', skill)}
                        title="Remove"
                      >
                        {skill} x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {registerStep === 5 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-white/90">Platforms (multiple)</label>
                  <div className="flex gap-2">
                    <input
                      name="platformInput"
                      value={registerForm.platformInput}
                      onChange={onRegisterFieldChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addListItem('platforms', 'platformInput')
                        }
                      }}
                      className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                      placeholder="Add platform and press Enter"
                    />
                    <button
                      type="button"
                      className="rounded bg-primary-container px-3 py-2 font-bold text-on-primary"
                      onClick={() => addListItem('platforms', 'platformInput')}
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {registerForm.platforms.map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        className="rounded-full bg-primary-container/20 px-3 py-1 text-xs text-primary-container"
                        onClick={() => removeListItem('platforms', platform)}
                        title="Remove"
                      >
                        {platform} x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {registerStep === 6 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <label className="mb-2 block text-sm font-medium text-white/90">
                    Profile Picture URL (optional)
                  </label>
                  <input
                    name="profilePicUrl"
                    type="url"
                    value={registerForm.profilePicUrl}
                    onChange={onRegisterFieldChange}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div>
                  {registerStep > 0 && (
                    <button
                      type="button"
                      className="rounded border border-outline-variant/40 px-4 py-2 text-sm text-white hover:border-primary-container"
                      onClick={() => {
                        setError('')
                        setRegisterStep((prev) => Math.max(0, prev - 1))
                      }}
                    >
                      Back
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-outline-variant/40 px-4 py-2 text-sm text-white hover:border-primary-container"
                    onClick={() => {
                      setShowRegisterModal(false)
                      setRegisterStep(0)
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-primary-container px-4 py-2 text-sm font-headline font-bold uppercase tracking-wide text-on-primary hover:bg-primary"
                  >
                    {registerStep === totalRegisterSteps - 1 ? 'Save Profile' : 'Next'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default RecruiterApp
