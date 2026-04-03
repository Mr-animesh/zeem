// import { useMemo, useState } from 'react'

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL ||
//   import.meta.env.VITE_API_BASE ||
//   'http://localhost:5000'

// const defaultSummary = `{
//   "languages": ["JavaScript", "TypeScript"],
//   "frameworks": ["React", "Node.js"],
//   "highlights": ["Built APIs", "Implemented CI/CD"]
// }`

// function RecruiterApp() {
//   const apiBase = useMemo(() => API_BASE_URL.replace(/\/$/, ''), [])

//   const [registerForm, setRegisterForm] = useState({
//     name: '',
//     email: '',
//     location: '',
//     projectSummaryText: defaultSummary
//   })
//   const [matchForm, setMatchForm] = useState({
//     targetLocation: '',
//     missionDescription: ''
//   })
//   const [registerMessage, setRegisterMessage] = useState('')
//   const [results, setResults] = useState([])
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')

//   const onRegisterChange = (event) => {
//     const { name, value } = event.target
//     setRegisterForm((prev) => ({ ...prev, [name]: value }))
//   }

//   const onMatchChange = (event) => {
//     const { name, value } = event.target
//     setMatchForm((prev) => ({ ...prev, [name]: value }))
//   }

//   const registerUser = async (event) => {
//     event.preventDefault()
//     setError('')
//     setRegisterMessage('')

//     let projectSummary
//     try {
//       projectSummary = JSON.parse(registerForm.projectSummaryText)
//     } catch {
//       setError('projectSummary must be valid JSON.')
//       return
//     }

//     const payload = {
//       name: registerForm.name.trim(),
//       email: registerForm.email.trim(),
//       location: registerForm.location.trim(),
//       projectSummary
//     }

//     const response = await fetch(`${apiBase}/api/users/register`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     })

//     const data = await response.json().catch(() => ({}))

//     if (!response.ok) {
//       setError(data.message || 'Failed to register user.')
//       return
//     }

//     setRegisterMessage(`Registered ${data.user?.name || payload.name} successfully.`)
//     setRegisterForm((prev) => ({ ...prev, name: '', email: '', location: '' }))
//   }

//   const runMatch = async (event) => {
//     event.preventDefault()
//     setLoading(true)
//     setError('')
//     setResults([])

//     try {
//       const response = await fetch(`${apiBase}/api/match`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(matchForm)
//       })
//       const data = await response.json().catch(() => ({}))

//       if (!response.ok) {
//         setError(data.message || 'Matching failed.')
//         return
//       }

//       setResults(data.results || [])
//     } catch {
//       setError('Could not connect to backend.')
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
//       <div className="mx-auto max-w-5xl space-y-6">
//         <header className="flex items-start justify-between gap-4 rounded-xl bg-white p-5 shadow-sm">
//           <div>
//             <h1 className="text-2xl font-bold">AI Recruiter Platform</h1>
//             <p className="mt-1 text-sm text-slate-600">
//               Register developers and run semantic matching against a mission.
//             </p>
//             <p className="mt-1 text-xs text-slate-500">API: {apiBase}</p>
//           </div>
//           <a
//             className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium hover:bg-slate-100"
//             href="#/"
//           >
//             Back
//           </a>
//         </header>

//         {error && (
//           <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
//             {error}
//           </div>
//         )}

//         <section className="grid gap-6 md:grid-cols-2">
//           <form
//             onSubmit={registerUser}
//             className="space-y-3 rounded-xl bg-white p-5 shadow-sm"
//           >
//             <h2 className="text-lg font-semibold">Register Developer</h2>
//             <input
//               className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
//               name="name"
//               value={registerForm.name}
//               onChange={onRegisterChange}
//               placeholder="Name"
//               required
//             />
//             <input
//               className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
//               name="email"
//               type="email"
//               value={registerForm.email}
//               onChange={onRegisterChange}
//               placeholder="Email"
//               required
//             />
//             <input
//               className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
//               name="location"
//               value={registerForm.location}
//               onChange={onRegisterChange}
//               placeholder="Location (e.g. Brooklyn)"
//               required
//             />
//             <textarea
//               className="h-36 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
//               name="projectSummaryText"
//               value={registerForm.projectSummaryText}
//               onChange={onRegisterChange}
//             />
//             <button
//               className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
//               type="submit"
//             >
//               Save User
//             </button>
//             {registerMessage && (
//               <p className="text-sm text-emerald-700">{registerMessage}</p>
//             )}
//           </form>

//           <form
//             onSubmit={runMatch}
//             className="space-y-3 rounded-xl bg-white p-5 shadow-sm"
//           >
//             <h2 className="text-lg font-semibold">Find Best Fit</h2>
//             <input
//               className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
//               name="targetLocation"
//               value={matchForm.targetLocation}
//               onChange={onMatchChange}
//               placeholder="Target location (e.g. Lower Manhattan)"
//               required
//             />
//             <textarea
//               className="h-36 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
//               name="missionDescription"
//               value={matchForm.missionDescription}
//               onChange={onMatchChange}
//               placeholder="Mission description for recruiter/admin query"
//               required
//             />
//             <button
//               className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
//               type="submit"
//               disabled={loading}
//             >
//               {loading ? 'Matching...' : 'Run Match'}
//             </button>
//           </form>
//         </section>

//         <section className="rounded-xl bg-white p-5 shadow-sm">
//           <h2 className="mb-3 text-lg font-semibold">Match Results</h2>
//           {!results.length && (
//             <p className="text-sm text-slate-500">
//               No results yet. Run a match query.
//             </p>
//           )}
//           <div className="space-y-3">
//             {results.map((item) => (
//               <article
//                 key={`${item.userId || item.email}-${item.email}`}
//                 className="rounded-lg border border-slate-200 p-4"
//               >
//                 <div className="flex items-center justify-between gap-3">
//                   <h3 className="font-medium">{item.name}</h3>
//                   <span className="shrink-0 rounded-full bg-slate-900 px-2 py-1 text-xs text-white">
//                     Score: {item.fitScore}
//                   </span>
//                 </div>
//                 <p className="mt-1 text-sm text-slate-600">{item.email}</p>
//                 <p className="text-sm text-slate-600">{item.location}</p>
//                 <p className="mt-2 text-sm text-slate-800">{item.reasoning}</p>
//               </article>
//             ))}
//           </div>
//         </section>
//       </div>
//     </main>
//   )
// }

// export default RecruiterApp


import { useMemo, useState, useEffect } from 'react'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:5000'

const defaultSummary = `{
  "languages": ["JavaScript", "TypeScript"],
  "frameworks": ["React", "Node.js"],
  "highlights": ["Built APIs", "Implemented CI/CD"]
}`

function RecruiterApp() {
  const apiBase = useMemo(() => API_BASE_URL.replace(/\/$/, ''), [])

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    location: '',
    projectSummaryText: defaultSummary
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ Leaderboard
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

  const onRegisterChange = (e) => {
    const { name, value } = e.target
    setRegisterForm((prev) => ({ ...prev, [name]: value }))
  }

  const onMatchChange = (e) => {
    const { name, value } = e.target
    setMatchForm((prev) => ({ ...prev, [name]: value }))
  }

  // ✅ REGISTER
  const registerUser = async (e) => {
    e.preventDefault()
    setError('')
    setRegisterMessage('')

    let projectSummary
    try {
      projectSummary = JSON.parse(registerForm.projectSummaryText)
    } catch {
      setError('projectSummary must be valid JSON.')
      return
    }

    const payload = {
      name: registerForm.name.trim(),
      email: registerForm.email.trim(),
      location: registerForm.location.trim(),
      projectSummary
    }

    try {
      const response = await fetch(`${apiBase}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.message || 'Failed to register user.')
        return
      }

      setRegisterMessage(`Registered ${data.user?.name || payload.name} successfully.`)
      setRegisterForm((prev) => ({
        ...prev,
        name: '',
        email: '',
        location: ''
      }))
    } catch {
      setError('Could not connect to backend.')
    }
  }

  // ✅ MATCH
  const runMatch = async (e) => {
    e.preventDefault()
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

  // ✅ PROJECT SEARCH
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

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* HEADER */}
        <header className="flex items-start justify-between gap-4 rounded-xl bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold">AI Recruiter Platform</h1>
            <p className="text-sm text-slate-600">
              Register developers and run semantic matching.
            </p>
            <p className="text-xs text-slate-500">API: {apiBase}</p>
          </div>
          <a href="#/" className="px-3 py-2 border rounded-md text-sm">
            Back
          </a>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* REGISTER + MATCH */}
        <section className="grid gap-6 md:grid-cols-2">

          {/* REGISTER */}
          <form onSubmit={registerUser} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Register Developer</h2>

            <input name="name" value={registerForm.name} onChange={onRegisterChange}
              placeholder="Name"
              className="w-full border rounded px-3 py-2 text-sm" required />

            <input name="email" type="email" value={registerForm.email} onChange={onRegisterChange}
              placeholder="Email"
              className="w-full border rounded px-3 py-2 text-sm" required />

            <input name="location" value={registerForm.location} onChange={onRegisterChange}
              placeholder="Location"
              className="w-full border rounded px-3 py-2 text-sm" required />

            <textarea
              name="projectSummaryText"
              value={registerForm.projectSummaryText}
              onChange={onRegisterChange}
              className="w-full h-36 border rounded px-3 py-2 font-mono text-xs"
            />

            <button className="bg-slate-900 text-white px-4 py-2 rounded">
              Save User
            </button>

            {registerMessage && <p className="text-green-600">{registerMessage}</p>}
          </form>

          {/* MATCH */}
          <form onSubmit={runMatch} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Find Best Fit</h2>

            <input name="targetLocation" value={matchForm.targetLocation} onChange={onMatchChange}
              placeholder="Target location"
              className="w-full border rounded px-3 py-2 text-sm" required />

            <textarea name="missionDescription" value={matchForm.missionDescription} onChange={onMatchChange}
              placeholder="Mission description"
              className="w-full border rounded px-3 py-2 text-sm" required />

            <input name="keyword" value={matchForm.keyword} onChange={onMatchChange}
              placeholder="Optional keyword"
              className="w-full border rounded px-3 py-2 text-sm" />

            <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
              {loading ? 'Matching...' : 'Run Match'}
            </button>
          </form>
        </section>

        {/* LEADERBOARD */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          {!leaderboard.length && <p>No users yet.</p>}
          {leaderboard.map((u, i) => (
            <div key={i}>{u.name} — {u.difficultyScore}/10</div>
          ))}
        </section>

        {/* PROJECT SEARCH */}
        <form onSubmit={searchProjects} className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Search Projects</h2>

          <input
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            className="w-full border rounded px-3 py-2 mt-2"
            placeholder="react, node, ai"
          />

          <button className="mt-2 bg-slate-800 text-white px-3 py-2 rounded">
            Search
          </button>

          {projectHits.map((p) => (
            <div key={p._id}>
              {p.name} ({(p.keywords || []).join(', ')})
            </div>
          ))}
        </form>

        {/* RESULTS */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Match Results</h2>

          {!results.length && <p>No results yet.</p>}

          {results.map((item) => (
            <div key={item.email} className="border p-3 rounded mb-2">
              <p className="font-medium">{item.name} ({item.fitScore})</p>
              <p className="text-sm">{item.reasoning}</p>
            </div>
          ))}
        </section>

      </div>
    </main>
  )
}

export default RecruiterApp