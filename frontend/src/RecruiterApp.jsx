import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:5000'
const REGISTERED_PROFILE_KEY = 'buildmate_recruiter_profile_registered'
const PROFILE_DATA_KEY = 'buildmate_recruiter_profile_data'
const PROJECTS_KEY = 'buildmate_recruiter_projects'

function RecruiterApp() {
  const apiBase = useMemo(() => API_BASE_URL.replace(/\/$/, ''), [])
  const [recruiterHash, setRecruiterHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash
  )

  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [showFindMemberModal, setShowFindMemberModal] = useState(false)
  const [registerStep, setRegisterStep] = useState(0)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [profileForm, setProfileForm] = useState({
    name: '',
    username: '',
    email: '',
    location: '',
    githubProfileUrl: '',
    profilePicture: '',
    minTokensToHire: 10
  })

  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    email: '',
    location: '',
    githubProfileUrl: '',
    skillInput: '',
    skills: [],
    profilePicUrl: '',
    minTokensToHire: 10
  })

  const [matchForm, setMatchForm] = useState({
    targetLocation: '',
    missionDescription: '',
    keyword: '',
    neededSkills: '',
    tokensOffered: ''
  })

  const [leaderboard, setLeaderboard] = useState([])
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectStep, setProjectStep] = useState(0)
  const [projectForm, setProjectForm] = useState({
    projectName: '',
    projectNiche: '',
    projectDescription: '',
    techStackInput: '',
    techStack: [],
    githubRepo: '',
    bannerImage: '',
    phase: 'idea',
    memberRole: '',
    memberSkills: '',
    memberCount: '1',
    memberNotes: '',
    requirements: []
  })
  const [createdProjects, setCreatedProjects] = useState([])
  const [collaboratorSearch, setCollaboratorSearch] = useState('')
  const [registerMessage, setRegisterMessage] = useState('')
  const [results, setResults] = useState([])
  const [hasRunMatch, setHasRunMatch] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmounts, setPayAmounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [payingInProgress, setPayingInProgress] = useState(null)
  const [payTokenAmount, setPayTokenAmount] = useState(10)

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
    const raw = window.localStorage.getItem(PROJECTS_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setCreatedProjects(parsed)
      }
    } catch {
      // Ignore invalid local storage payload.
    }
  }, [])

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

  useEffect(() => {
    setProfileForm({
      name: currentProfile?.name || '',
      username: currentProfile?.username || '',
      email: currentProfile?.email || '',
      location: currentProfile?.location || '',
      profilePicture: currentProfile?.profilePicture || '',
      minTokensToHire: currentProfile?.minTokensToHire ?? 10
    })
  }, [currentProfile])

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
      githubProfileUrl: '',
      skillInput: '',
      skills: [],
      profilePicUrl: '',
      minTokensToHire: 10
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
      githubProfileUrl: registerForm.githubProfileUrl.trim(),
      projectSummary: {
        username: registerForm.username.trim(),
        skills: registerForm.skills,
        profilePicture: registerForm.profilePicUrl.trim() || null
      },
      minTokensToHire: Number.isFinite(Number(registerForm.minTokensToHire)) ? Math.max(0, Number(registerForm.minTokensToHire)) : 10
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
        githubProfileUrl: payload.githubProfileUrl,
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
      const composedMission = [
        matchForm.missionDescription,
        matchForm.neededSkills && `Required skills / tech stack: ${matchForm.neededSkills}`,
        matchForm.tokensOffered && `Tokens offered for this collaboration: ${matchForm.tokensOffered}`
      ]
        .filter(Boolean)
        .join(' ')
      const payload = {
        targetLocation: matchForm.targetLocation,
        missionDescription: composedMission,
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

  const isLeaderboardPage = recruiterHash.startsWith('#/recruiter/leaderboard')
  const isCollaboratorPage = recruiterHash.startsWith('#/recruiter/collaborator')
  const isProfilePage = recruiterHash.startsWith('#/recruiter/profile')
  const totalRegisterSteps = 7
  const navItemClass =
    'rounded-md border px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors'

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email.trim())

  const getRegisterStepError = () => {
    if (registerStep === 0 && !registerForm.name.trim()) return 'Name is required.'
    if (registerStep === 1 && !registerForm.username.trim()) return 'Username is required.'
    if (registerStep === 1 && !registerForm.githubProfileUrl.trim())
      return 'GitHub profile URL is required.'
    if (
      registerStep === 1 &&
      registerForm.githubProfileUrl.trim() &&
      !/^https?:\/\/(www\.)?github\.com\/[^/\s]+\/?$/.test(
        registerForm.githubProfileUrl.trim()
      )
    )
      return 'Enter a valid GitHub profile URL.'
    if (registerStep === 2 && !emailIsValid) return 'Enter a valid email.'
    if (registerStep === 3 && !registerForm.location.trim()) return 'Location is required.'
    if (registerStep === 4 && !registerForm.skills.length) return 'Add at least one skill.'
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

  const handlePayTokens = async (recipientEmail) => {
    setError('')
    if (!currentProfile) {
      setError('You must be registered to send tokens.')
      return
    }
    setPayingInProgress(recipientEmail)
    try {
      const response = await fetch(`${apiBase}/api/users/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: currentProfile.email,
          recipientEmail,
          amount: payAmounts[recipientEmail] || 10
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Payment failed.');
      } else {
        fetch(`${apiBase}/api/leaderboard?limit=15`)
          .then((r) => r.json())
          .then((lb) => {
            if (lb.success && Array.isArray(lb.leaderboard)) {
              setLeaderboard(lb.leaderboard)
            }
          })
          .catch(() => {})
      }
    } catch {
      setError('Could not connect to backend.')
    } finally {
      setPayingInProgress('')
    }
  }

  const filteredProjects = createdProjects.filter((project) => {
    const haystack = `${project.projectName} ${project.projectNiche} ${project.projectDescription} ${(project.techStack || []).join(' ')}`.toLowerCase()
    return haystack.includes(collaboratorSearch.trim().toLowerCase())
  })

  const onProjectFieldChange = (e) => {
    const { name, value } = e.target
    setProjectForm((prev) => ({ ...prev, [name]: value }))
  }

  const addTechStackItem = () => {
    const value = projectForm.techStackInput.trim()
    if (!value) return
    if (projectForm.techStack.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setProjectForm((prev) => ({ ...prev, techStackInput: '' }))
      return
    }
    setProjectForm((prev) => ({
      ...prev,
      techStack: [...prev.techStack, value],
      techStackInput: ''
    }))
  }

  const removeTechStackItem = (item) => {
    setProjectForm((prev) => ({
      ...prev,
      techStack: prev.techStack.filter((t) => t !== item)
    }))
  }

  const addRequirementItem = () => {
    if (!projectForm.memberRole.trim()) {
      setError('Member role is required.')
      return
    }
    const requirement = {
      role: projectForm.memberRole.trim(),
      skills: projectForm.memberSkills.trim(),
      count: Number(projectForm.memberCount) > 0 ? Number(projectForm.memberCount) : 1,
      notes: projectForm.memberNotes.trim()
    }
    setProjectForm((prev) => ({
      ...prev,
      requirements: [...prev.requirements, requirement],
      memberRole: '',
      memberSkills: '',
      memberCount: '1',
      memberNotes: ''
    }))
    setError('')
  }

  const removeRequirementItem = (index) => {
    setProjectForm((prev) => ({
      ...prev,
      requirements: prev.requirements.filter((_, idx) => idx !== index)
    }))
  }

  const onProjectBannerChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setProjectForm((prev) => ({ ...prev, bannerImage: dataUrl }))
      setError('')
    } catch {
      setError('Could not read selected banner image.')
    }
  }

  const saveProject = (e) => {
    if (e?.preventDefault) e.preventDefault()
    setError('')
    if (!projectForm.projectName.trim()) {
      setError('Project name is required.')
      return
    }
    if (!projectForm.projectNiche.trim()) {
      setError('Project niche is required.')
      return
    }
    if (!projectForm.projectDescription.trim()) {
      setError('Project description is required.')
      return
    }
    if (!projectForm.techStack.length) {
      setError('Add at least one tech stack item.')
      return
    }
    const newProject = {
      id: `${Date.now()}`,
      projectName: projectForm.projectName.trim(),
      projectNiche: projectForm.projectNiche.trim(),
      projectDescription: projectForm.projectDescription.trim(),
      techStack: projectForm.techStack,
      githubRepo: projectForm.githubRepo.trim(),
      bannerImage: projectForm.bannerImage,
      phase: projectForm.phase,
      requirements: projectForm.requirements
    }

    setCreatedProjects((prev) => {
      const updated = [newProject, ...prev]
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated))
      return updated
    })
    setRegisterMessage('Project created successfully.')
    setShowProjectModal(false)
    setProjectStep(0)
    setProjectForm({
      projectName: '',
      projectNiche: '',
      projectDescription: '',
      techStackInput: '',
      techStack: [],
      githubRepo: '',
      bannerImage: '',
      phase: 'idea',
      memberRole: '',
      memberSkills: '',
      memberCount: '1',
      memberNotes: '',
      requirements: []
    })
  }

  const totalProjectSteps = 8

  const nextProjectStep = () => {
    if (projectStep === 1 && !projectForm.projectName.trim()) {
      setError('Project name is required.')
      return
    }
    if (projectStep === 2 && !projectForm.projectNiche.trim()) {
      setError('Project niche is required.')
      return
    }
    if (projectStep === 3 && !projectForm.projectDescription.trim()) {
      setError('Project description is required.')
      return
    }
    if (projectStep === 4 && !projectForm.techStack.length) {
      setError('Add at least one tech stack item.')
      return
    }
    setError('')
    setProjectStep((prev) => Math.min(totalProjectSteps - 1, prev + 1))
  }

  const useProjectForMatching = (project) => {
    const neededRoles = (project.requirements || [])
      .map((r) => `${r.role}${r.skills ? ` (${r.skills})` : ''}`)
      .join(', ')

    const techStack = (project.techStack || []).join(', ')

    setResults([])
    setHasRunMatch(false)
    setError('')

    setMatchForm((prev) => ({
      ...prev,
      targetLocation: currentProfile?.location || prev.targetLocation || '',
      missionDescription:
        `${project.projectName}: ${project.projectDescription}.` +
        (neededRoles ? ` Need members for: ${neededRoles}.` : ''),
      keyword: project.projectNiche || prev.keyword || '',
      neededSkills: techStack || prev.neededSkills || '',
      tokensOffered: prev.tokensOffered || ''
    }))

    setShowFindMemberModal(true)
  }

  const onProfileFieldChange = (e) => {
    const { name, value } = e.target
    setProfileForm((prev) => ({ ...prev, [name]: value }))
  }

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Could not read selected file.'))
      reader.readAsDataURL(file)
    })

  const onRegisterProfileImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setRegisterForm((prev) => ({ ...prev, profilePicUrl: dataUrl }))
      setError('')
    } catch {
      setError('Could not read selected image.')
    }
  }

  const onProfileImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setProfileForm((prev) => ({ ...prev, profilePicture: dataUrl }))
      setError('')
    } catch {
      setError('Could not read selected image.')
    }
  }

  const saveProfileEdits = async (e) => {
    e.preventDefault()
    if (!profileForm.name.trim()) {
      setError('Name is required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) {
      setError('Enter a valid email.')
      return
    }

    const updatedProfile = {
      name: profileForm.name.trim(),
      username: profileForm.username.trim(),
      email: profileForm.email.trim(),
      location: profileForm.location.trim(),
      profilePicture: profileForm.profilePicture.trim(),
      minTokensToHire: Number.isFinite(Number(profileForm.minTokensToHire)) ? Math.max(0, Number(profileForm.minTokensToHire)) : 10
    }

    try {
      const resp = await fetch(`${apiBase}/api/users/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.message || 'Failed to update profile via API.');
        return;
      }
    } catch {
      // Allow fallback if backend unreachable
    }

    // Merge backend token/rank updates if they exist (though minTokensToHire is what we just updated)
    setCurrentProfile(prev => ({ ...prev, ...updatedProfile }))
    window.localStorage.setItem(REGISTERED_PROFILE_KEY, 'true')
    window.localStorage.setItem(PROFILE_DATA_KEY, JSON.stringify({ ...currentProfile, ...updatedProfile }))
    
    setRegisterMessage('Profile updated successfully.')
    setError('')
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
                !isLeaderboardPage && !isCollaboratorPage && !isProfilePage
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
              href="#/recruiter/profile"
              className={`${navItemClass} ${
                isProfilePage
                  ? 'border-primary-container/60 bg-transparent text-primary-container'
                  : 'border-outline-variant/40 bg-transparent text-white hover:border-primary-container hover:text-primary-container'
              }`}
            >
              Profile
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
                      window.location.hash = '#/recruiter/profile'
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

        {isProfilePage ? (
          <form
            onSubmit={saveProfileEdits}
            className="rounded-xl border border-outline-variant/20 bg-surface-container p-5 shadow-sm"
          >
            <h2 className="text-lg font-headline font-black uppercase tracking-wide text-primary-container">
              Profile
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Edit your details here. Profile picture is optional.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                name="name"
                value={profileForm.name}
                onChange={onProfileFieldChange}
                className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Name"
                required
              />
              <input
                name="username"
                value={profileForm.username}
                onChange={onProfileFieldChange}
                className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Username"
                required
              />
              <input
                name="email"
                type="email"
                value={profileForm.email}
                onChange={onProfileFieldChange}
                className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Email"
                required
              />
              <input
                name="location"
                value={profileForm.location}
                onChange={onProfileFieldChange}
                className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Location"
                required
              />
              <div className="flex flex-col">
                <input
                  type="number"
                  name="minTokensToHire"
                  min="0"
                  value={profileForm.minTokensToHire}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, minTokensToHire: Math.max(0, Number(e.target.value)) }))}
                  className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="Min Tokens to Hire"
                />
                <span className="text-[10px] text-white/50 px-1 mt-1 uppercase">Minimum tokens needed to hire you</span>
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={onProfileImageChange}
              className="mt-3 w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1 file:font-bold file:text-on-primary"
            />
            {profileForm.profilePicture && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={profileForm.profilePicture}
                  alt="Profile preview"
                  className="h-14 w-14 rounded-full border border-outline-variant/40 object-cover"
                />
                <button
                  type="button"
                  className="rounded border border-outline-variant/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:border-primary-container"
                  onClick={() =>
                    setProfileForm((prev) => ({ ...prev, profilePicture: '' }))
                  }
                >
                  Remove Image
                </button>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button className="rounded bg-primary-container px-4 py-2 font-headline font-bold uppercase tracking-wide text-on-primary hover:bg-primary">
                Save Profile
              </button>
              <button
                type="button"
                className="rounded border border-outline-variant/40 bg-transparent px-4 py-2 font-headline font-bold uppercase tracking-wide text-white hover:border-primary-container hover:text-primary-container"
                onClick={() => {
                  window.location.hash = '#/recruiter'
                }}
              >
                Done
              </button>
            </div>
          </form>
        ) : isLeaderboardPage ? (
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
                <div className="flex flex-col">
                  <span className="text-white font-bold">{u.name}</span>
                  {u.location && (
                    <span className="text-xs text-white/60">{u.location}</span>
                  )}
                  <span className="mt-1 text-xs text-primary-container font-black">{u.tokens || 0} Tokens Vault</span>
                </div>
                <div className="text-right">
                  <span className="block text-xs uppercase tracking-wide text-white/60">
                    Score
                  </span>
                  <span className="font-bold text-primary-container">
                    {Number.isFinite(Number(u.profileScore)) ? Number(u.profileScore) : '-'}
                  </span>
                </div>
              </div>
            ))}
          </section>
        ) : isCollaboratorPage ? (
          <div className="space-y-6">
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-5 shadow-sm min-h-[260px]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-4xl leading-none font-headline font-black uppercase tracking-wide text-primary-container">
                    Your Projects
                  </h3>
                  <p className="mt-3 text-sm text-white/60">
                    Projects matching filter: {filteredProjects.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 md:justify-end">
                  <button
                    type="button"
                    className="rounded-lg bg-primary-container px-4 py-3 text-base font-headline font-bold uppercase tracking-wide text-on-primary hover:bg-primary"
                    onClick={() => {
                      setError('')
                      setProjectStep(0)
                      setShowProjectModal(true)
                    }}
                  >
                    Create Project
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-outline-variant/40 bg-transparent px-4 py-3 text-base font-headline font-bold uppercase tracking-wide text-white hover:border-primary-container hover:text-primary-container"
                    onClick={() => {
                      setResults([])
                      setHasRunMatch(false)
                      setError('')
                      setMatchForm((prev) => ({
                        targetLocation: currentProfile?.location || prev.targetLocation || '',
                        missionDescription: prev.missionDescription || '',
                        keyword: prev.keyword || '',
                        neededSkills: prev.neededSkills || '',
                        tokensOffered: prev.tokensOffered || ''
                      }))
                      setShowFindMemberModal(true)
                    }}
                  >
                    Find Team Member
                  </button>
                </div>
              </div>

              <div className="mt-4 w-full">
                <input
                  value={collaboratorSearch}
                  onChange={(e) => setCollaboratorSearch(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant/30 bg-background px-4 py-3 text-base text-white placeholder:text-white/40"
                  placeholder="Search projects by keyword..."
                />
              </div>

              {!filteredProjects.length && (
                <p className="mt-5 text-base text-white/60">No project created yet.</p>
              )}
              <div className="mt-3 grid gap-4 xl:grid-cols-2">
                {filteredProjects.map((project) => (
                  <article
                    key={project.id}
                    className="rounded-xl border border-outline-variant/20 bg-background/40 p-4"
                  >
                    {project.bannerImage && (
                      <img
                        src={project.bannerImage}
                        alt={project.projectName}
                        className="mb-3 h-32 w-full rounded-lg border border-outline-variant/30 object-cover"
                      />
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-white font-bold">{project.projectName}</h4>
                      <span className="rounded-full border border-primary-container/40 px-2 py-1 text-xs text-primary-container uppercase">
                        {project.phase}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/70">{project.projectNiche}</p>
                    <p className="mt-2 text-sm text-white/80">{project.projectDescription}</p>
                    {project.githubRepo && (
                      <p className="mt-2 text-xs text-primary-container">{project.githubRepo}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {project.techStack.map((tech) => (
                        <span
                          key={`${project.id}-${tech}`}
                          className="rounded-full bg-primary-container/20 px-2 py-1 text-xs text-primary-container"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      {project.requirements.map((req, idx) => (
                        <div
                          key={`${project.id}-req-${idx}`}
                          className="rounded border border-outline-variant/20 bg-background px-3 py-2 text-sm"
                        >
                          <p className="text-white">{req.role} x{req.count}</p>
                          <p className="text-white/60">{req.skills || 'No skills listed'}</p>
                          <p className="text-primary-container">{req.notes || 'No notes'}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-3 rounded border border-outline-variant/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:border-primary-container hover:text-primary-container"
                      onClick={() => useProjectForMatching(project)}
                    >
                      Find Members For This Project
                    </button>
                  </article>
                ))}
              </div>
            </section>

            {showProjectModal && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
                <div className="relative w-full max-w-4xl rounded-[2rem] border border-outline-variant/30 bg-gradient-to-br from-[#070707] via-[#12070b] to-[#22140a] p-8 shadow-2xl">
                  <button
                    type="button"
                    className="absolute right-5 top-5 h-12 w-12 rounded-full border border-outline-variant/40 text-2xl text-white/80 hover:border-primary-container hover:text-primary-container"
                    onClick={() => {
                      setShowProjectModal(false)
                      setProjectStep(0)
                    }}
                  >
                    x
                  </button>

                  {projectStep === 0 && (
                    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                      <h3 className="text-5xl font-light text-white">
                        Let's Setup your Project Page
                      </h3>
                      <button
                        type="button"
                        className="mt-10 rounded-3xl border border-outline-variant/40 bg-surface-container px-10 py-5 text-2xl text-white hover:border-primary-container hover:text-primary-container"
                        onClick={nextProjectStep}
                      >
                        Continue →
                      </button>
                    </div>
                  )}

                  {projectStep > 0 && (
                    <form
                      onSubmit={(e) => {
                        if (projectStep < totalProjectSteps - 1) {
                          e.preventDefault()
                          nextProjectStep()
                          return
                        }
                        saveProject(e)
                      }}
                      className="space-y-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Step {projectStep} of {totalProjectSteps - 1}
                      </p>

                      {projectStep === 1 && (
                        <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                          <label className="mb-2 block text-sm font-medium text-white/90">Project Name</label>
                          <input
                            name="projectName"
                            value={projectForm.projectName}
                            onChange={onProjectFieldChange}
                            className="w-full rounded border border-outline-variant/30 bg-background px-3 py-3 text-sm text-white placeholder:text-white/40"
                            placeholder="Enter project name"
                            required
                          />
                        </div>
                      )}

                      {projectStep === 2 && (
                        <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                          <label className="mb-2 block text-sm font-medium text-white/90">Project Niche</label>
                          <input
                            name="projectNiche"
                            value={projectForm.projectNiche}
                            onChange={onProjectFieldChange}
                            className="w-full rounded border border-outline-variant/30 bg-background px-3 py-3 text-sm text-white placeholder:text-white/40"
                            placeholder="AI, SaaS, Fintech, Gaming..."
                            required
                          />
                        </div>
                      )}

                      {projectStep === 3 && (
                        <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                          <label className="mb-2 block text-sm font-medium text-white/90">Project Description</label>
                          <textarea
                            name="projectDescription"
                            value={projectForm.projectDescription}
                            onChange={onProjectFieldChange}
                            className="h-36 w-full rounded border border-outline-variant/30 bg-background px-3 py-3 text-sm text-white placeholder:text-white/40"
                            placeholder="What are you building and why?"
                            required
                          />
                        </div>
                      )}

                      {projectStep === 4 && (
                        <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                          <label className="mb-2 block text-sm font-medium text-white/90">Tech Stack</label>
                          <div className="flex gap-2">
                            <input
                              name="techStackInput"
                              value={projectForm.techStackInput}
                              onChange={onProjectFieldChange}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  addTechStackItem()
                                }
                              }}
                              className="w-full rounded border border-outline-variant/30 bg-background px-3 py-3 text-sm text-white placeholder:text-white/40"
                              placeholder="Add tech and press Enter"
                            />
                            <button
                              type="button"
                              className="rounded bg-primary-container px-4 py-3 font-bold text-on-primary"
                              onClick={addTechStackItem}
                            >
                              Add
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {projectForm.techStack.map((item) => (
                              <button
                                key={item}
                                type="button"
                                className="rounded-full bg-primary-container/20 px-3 py-1 text-xs text-primary-container"
                                onClick={() => removeTechStackItem(item)}
                              >
                                {item} x
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {projectStep === 5 && (
                        <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                          <label className="mb-2 block text-sm font-medium text-white/90">GitHub Repo (optional)</label>
                          <input
                            name="githubRepo"
                            value={projectForm.githubRepo}
                            onChange={onProjectFieldChange}
                            className="w-full rounded border border-outline-variant/30 bg-background px-3 py-3 text-sm text-white placeholder:text-white/40"
                            placeholder="https://github.com/..."
                          />
                        </div>
                      )}

                      {projectStep === 6 && (
                        <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                          <label className="mb-2 block text-sm font-medium text-white/90">Project Banner (optional)</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={onProjectBannerChange}
                            className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1 file:font-bold file:text-on-primary"
                          />
                          {projectForm.bannerImage && (
                            <img
                              src={projectForm.bannerImage}
                              alt="Project banner preview"
                              className="mt-3 h-32 w-full rounded border border-outline-variant/30 object-cover"
                            />
                          )}
                        </div>
                      )}

                      {projectStep === 7 && (
                        <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                          <label className="mb-2 block text-sm font-medium text-white/90">Project Phase</label>
                          <select
                            name="phase"
                            value={projectForm.phase}
                            onChange={onProjectFieldChange}
                            className="w-full rounded border border-outline-variant/30 bg-background px-3 py-3 text-sm text-white"
                          >
                            <option value="idea">Idea</option>
                            <option value="developed">Developed</option>
                            <option value="debug">Debug</option>
                            <option value="half-done">Half Done</option>
                          </select>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="rounded border border-outline-variant/40 px-4 py-2 text-sm text-white hover:border-primary-container"
                          onClick={() => setProjectStep((prev) => Math.max(0, prev - 1))}
                          disabled={projectStep === 0}
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          className="rounded bg-primary-container px-5 py-2 text-sm font-headline font-bold uppercase tracking-wide text-on-primary hover:bg-primary"
                        >
                          {projectStep === totalProjectSteps - 1 ? 'Save Project' : 'Next'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <section className="grid gap-6 md:grid-cols-1">
              <form
                id="find-bestmate"
                onSubmit={runMatch}
                className="space-y-3 rounded-xl border border-outline-variant/20 bg-surface-container p-5 shadow-sm"
              >
                <h2 className="text-lg font-headline font-black uppercase tracking-wide text-primary-container">
                  Find Team Member
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
                  placeholder="What are you building and what help do you need?"
                  className="h-24 w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                  required
                />

                <input
                  name="neededSkills"
                  value={matchForm.neededSkills}
                  onChange={onMatchChange}
                  placeholder="Required tech stack / skills (e.g. React, Node, UI/UX)"
                  className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                />

                <input
                  name="tokensOffered"
                  value={matchForm.tokensOffered}
                  onChange={onMatchChange}
                  placeholder="Tokens you will pay (optional)"
                  className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
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
                        {currentProfile?.email !== item.email && (
                          <div className="mt-4 flex items-center gap-2 border-t border-outline-variant/20 pt-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase text-white/50 mb-1">
                                Min Cost: {item.minTokensToHire || 10} Tokens
                              </span>
                              <input
                                type="number"
                                min={item.minTokensToHire || 10}
                                value={payAmounts[item.email] ?? (item.minTokensToHire || 10)}
                                onChange={(e) => setPayAmounts(prev => ({ ...prev, [item.email]: Number(e.target.value) || 0 }))}
                                className="w-20 rounded border border-outline-variant/30 bg-background px-2 py-1 text-sm text-white"
                              />
                            </div>
                            <button
                              type="button"
                              className="mt-4 rounded bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-primary hover:bg-primary disabled:opacity-50"
                              onClick={() => handlePayTokens(item.email)}
                              disabled={payingInProgress === item.email || (payAmounts[item.email] ?? (item.minTokensToHire || 10)) < (item.minTokensToHire || 10)}
                            >
                              {payingInProgress === item.email ? "Paying..." : "Hire & Pay Tokens"}
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </form>
            </section>

          </>
        )}
      </div>

      {showFindMemberModal && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-headline font-black uppercase tracking-wide text-primary-container">
                Find Team Member
              </h3>
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-outline-variant/40 text-sm text-white hover:border-primary-container hover:text-primary-container"
                onClick={() => {
                  setShowFindMemberModal(false)
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={runMatch}
              className="mt-4 space-y-3"
            >
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
                placeholder="What are you building and what help do you need?"
                className="h-24 w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                required
              />

              <input
                name="neededSkills"
                value={matchForm.neededSkills}
                onChange={onMatchChange}
                placeholder="Required tech stack / skills (e.g. React, Node, UI/UX)"
                className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
              />

              <input
                name="tokensOffered"
                value={matchForm.tokensOffered}
                onChange={onMatchChange}
                placeholder="Tokens you will pay (optional)"
                className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
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
                <p className="text-sm text-white/70">Fetching bestmate matches...</p>
              )}

              {!loading && hasRunMatch && !results.length && !error && (
                <p className="text-sm text-white/60">No matches found for this query.</p>
              )}

              {!loading && results.length > 0 && (
                <div className="mt-2 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
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
                      {currentProfile?.email !== item.email && (
                        <div className="mt-4 flex items-center gap-2 border-t border-outline-variant/20 pt-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-white/50 mb-1">
                              Min Cost: {item.minTokensToHire || 10} Tokens
                            </span>
                            <input
                              type="number"
                              min={item.minTokensToHire || 10}
                              value={payAmounts[item.email] ?? (item.minTokensToHire || 10)}
                              onChange={(e) => setPayAmounts(prev => ({ ...prev, [item.email]: Number(e.target.value) || 0 }))}
                              className="w-20 rounded border border-outline-variant/30 bg-background px-2 py-1 text-sm text-white"
                            />
                          </div>
                          <button
                            type="button"
                            className="mt-4 rounded bg-primary-container px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-primary hover:bg-primary disabled:opacity-50"
                            onClick={() => handlePayTokens(item.email)}
                            disabled={payingInProgress === item.email || (payAmounts[item.email] ?? (item.minTokensToHire || 10)) < (item.minTokensToHire || 10)}
                          >
                            {payingInProgress === item.email ? "Paying..." : "Hire & Pay Tokens"}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

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
                  <label className="mb-2 mt-4 block text-sm font-medium text-white/90">
                    GitHub profile URL
                  </label>
                  <input
                    name="githubProfileUrl"
                    value={registerForm.githubProfileUrl}
                    onChange={onRegisterFieldChange}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                    placeholder="https://github.com/your-username"
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
                  <label className="mb-2 block text-sm font-medium text-white/90">
                    Profile Picture (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onRegisterProfileImageChange}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-primary-container file:px-3 file:py-1 file:font-bold file:text-on-primary"
                  />
                  {registerForm.profilePicUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <img
                        src={registerForm.profilePicUrl}
                        alt="Profile preview"
                        className="h-14 w-14 rounded-full border border-outline-variant/40 object-cover"
                      />
                      <button
                        type="button"
                        className="rounded border border-outline-variant/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:border-primary-container"
                        onClick={() =>
                          setRegisterForm((prev) => ({ ...prev, profilePicUrl: '' }))
                        }
                      >
                        Remove Image
                      </button>
                    </div>
                  )}
                </div>
              )}

              {registerStep === 6 && (
                <div className="rounded-xl border border-outline-variant/20 bg-background/40 p-4">
                  <h4 className="mb-2 font-headline font-bold uppercase tracking-wide text-primary-container">
                    Hiring Terms
                  </h4>
                  <label className="mb-2 block text-sm font-medium text-white/90">
                    Minimum Tokens required for recruiters to hire you:
                  </label>
                  <p className="text-xs text-white/70 mb-3">
                    If someone finds you via a match and wants to collaborate, they will be required to send at least this many tokens directly to your wallet to establish contact.
                  </p>
                  <input
                    type="number"
                    name="minTokensToHire"
                    min="0"
                    placeholder="e.g. 10"
                    value={registerForm.minTokensToHire}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, minTokensToHire: Math.max(0, Number(e.target.value)) }))}
                    className="w-full rounded border border-outline-variant/30 bg-background px-3 py-2 text-sm text-white placeholder:text-white/40"
                  />
                  <p className="mt-2 text-xs text-primary-container font-black uppercase">
                    Your threshold: {registerForm.minTokensToHire} Tokens
                  </p>
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
