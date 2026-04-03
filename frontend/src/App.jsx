import { useEffect, useState } from 'react'
import './App.css'
import RecruiterApp from './RecruiterApp.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

function App() {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  )

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (hash.startsWith('#/recruiter')) {
    return <RecruiterApp />
  }

  return <LandingApp />
}

function LandingApp() {
  const [heroEmail, setHeroEmail] = useState('')
  const [footerEmail, setFooterEmail] = useState('')
  const [status, setStatus] = useState({ place: null, state: 'idle', message: '' })
  const [showSignIn, setShowSignIn] = useState(false)
  const [showSignUp, setShowSignUp] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authStatus, setAuthStatus] = useState({ state: 'idle', message: '' })
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupStatus, setSignupStatus] = useState({ state: 'idle', message: '' })
  const [signupSkills, setSignupSkills] = useState('')
  const [signupLocation, setSignupLocation] = useState('')
  const [signupGoal, setSignupGoal] = useState('')
  const [signupSocial, setSignupSocial] = useState('')
  const [signupAvailability, setSignupAvailability] = useState('')
  const [signupOpen, setSignupOpen] = useState(true)

  const submitEmail = async (email, place) => {
    setStatus({ place, state: 'loading', message: 'Sending…' })
    try {
      const res = await fetch(`${API_BASE}/api/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.message || 'Something went wrong'
        setStatus({ place, state: 'error', message: msg })
        return
      }
      setStatus({ place, state: 'success', message: 'You are on the list!' })
      if (place === 'hero') setHeroEmail('')
      if (place === 'footer') setFooterEmail('')
    } catch {
      setStatus({ place, state: 'error', message: 'Network error. Try again.' })
    }
  }

  const onHeroSubmit = (e) => {
    e.preventDefault()
    if (!heroEmail.trim()) {
      setStatus({ place: 'hero', state: 'error', message: 'Enter an email' })
      return
    }
    submitEmail(heroEmail.trim(), 'hero')
  }

  const onFooterSubmit = (e) => {
    e.preventDefault()
    if (!footerEmail.trim()) {
      setStatus({ place: 'footer', state: 'error', message: 'Enter an email' })
      return
    }
    submitEmail(footerEmail.trim(), 'footer')
  }

  return (
    <>
      {/* SECTION 1: TOP NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-[#131313]/80 backdrop-blur-md flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-6">
          <a
            className="text-2xl font-black text-[#A3E635] tracking-tight font-headline italic"
            href="/"
          >
            BUILDMATE
          </a>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <button
            className="text-white/70 font-medium hover:text-white transition-all"
            onClick={() => setShowSignIn(true)}
            type="button"
          >
            Sign in
          </button>
          <button
            className="text-white/70 font-medium hover:text-white transition-all"
            type="button"
            onClick={() => {
              window.location.hash = '#/recruiter'
            }}
          >
            Recruiter UI
          </button>
          <button
            className="bg-white text-[#131313] px-6 py-2.5 rounded font-headline font-bold uppercase tracking-wide hover:opacity-90 transition-all active:scale-95"
            type="button"
            onClick={() => {
              window.location.href = '/discover.html'
            }}
          >
            Launch app
          </button>
        </div>
      </nav>

      {/* SECTION 2: HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-4 dot-grid overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-10">
          <FloatingCard
            position="top-[20%] left-[10%]"
            rotate="-rotate-6"
            initials="AK"
            name="Arjun K."
            city="Noida"
            skills={['React', 'UI/UX']}
          />
          <FloatingCard
            position="bottom-[25%] left-[15%]"
            rotate="rotate-3"
            initials="SP"
            name="Sanya P."
            city="Mumbai"
            color="tertiary"
            skills={['Node.js', 'Solidity']}
          />
          <FloatingCard
            position="top-[25%] right-[12%]"
            rotate="rotate-12"
            initials="RV"
            name="Rohan V."
            city="Delhi"
            color="secondary"
            skills={['Python', 'ML']}
          />
          <FloatingCard
            position="bottom-[30%] right-[10%]"
            rotate="-rotate-2"
            initials="MD"
            name="Meera D."
            city="Pune"
            color="lime"
            skills={['Flutter', 'Product']}
          />
        </div>

        <div className="relative z-20 text-center max-w-7xl mx-auto px-4">
          <h1 className="text-huge font-black font-headline tracking-tighter mb-8 uppercase text-white">
            Build together.
            <br />
            <span className="text-primary-container">Stay local.</span>
          </h1>
          <p className="text-xl md:text-2xl text-on-surface-variant max-w-2xl mx-auto mb-12 font-medium">
            Swap skills, find collaborators, and ship real projects — with
            builders in your city.
          </p>
          <form
            onSubmit={onHeroSubmit}
            className="flex flex-col md:flex-row items-center justify-center gap-0 max-w-md mx-auto w-full"
          >
            <input
              className="w-full bg-surface-container border-none focus:ring-2 focus:ring-primary-container px-6 py-5 text-white rounded-l-xl md:rounded-r-none outline-none"
              placeholder="Enter your university email"
              type="email"
              value={heroEmail}
              onChange={(e) => setHeroEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full md:w-auto bg-primary-container text-on-primary font-headline font-bold px-8 py-5 rounded-r-xl md:rounded-l-none uppercase tracking-tighter whitespace-nowrap hover:bg-primary transition-all disabled:opacity-60"
              disabled={status.state === 'loading' && status.place === 'hero'}
            >
              {status.state === 'loading' && status.place === 'hero'
                ? 'Sending…'
                : 'Notify me'}
            </button>
          </form>
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 mt-4">
            <button
              type="button"
              className="px-4 py-2 rounded border border-outline-variant/40 text-sm font-bold text-white/80 hover:bg-primary-container hover:text-on-primary transition-all"
              onClick={() => setShowSignUp(true)}
            >
              Create account
            </button>
            <a
              className="text-sm text-primary-container hover:underline"
              href="/discover.html"
            >
              Go to app →
            </a>
          </div>
          {status.place === 'hero' && status.state !== 'idle' && (
            <p
              className={`mt-3 text-sm ${
                status.state === 'success'
                  ? 'text-primary-container'
                  : 'text-red-400'
              }`}
            >
              {status.message}
            </p>
          )}
        </div>
      </section>

      {/* SECTION 3: SOCIAL PROOF TICKER */}
      <div className="py-12 bg-surface-container-lowest border-y border-outline-variant/10 overflow-hidden">
        <div className="marquee font-headline text-3xl font-black uppercase tracking-widest text-on-surface-variant/30">
          <div className="marquee-content gap-12">
            {[
              '2,400+ Builders',
              '/',
              '18 Cities',
              '/',
              '340 Projects Shipped',
              '/',
              '2,400+ Builders',
              '/',
              '18 Cities',
              '/',
              '340 Projects Shipped'
            ].map((item, idx) => (
              <span
                key={`${item}-${idx}`}
                className={item === '/' ? 'text-primary-container' : undefined}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: WHO IS BUILDMATE FOR */}
      <section className="py-32 px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant/20">
          {[
            {
              icon: 'swap_horiz',
              title: 'Skill Swappers',
              copy:
                'Trade your UI design hours for backend development. No money, just pure value exchange between student experts.'
            },
            {
              icon: 'architecture',
              title: 'Project Builders',
              copy:
                'Turn your side-hustle into a functional product. Find the missing piece to your dev team right in your neighborhood.'
            },
            {
              icon: 'groups',
              title: 'Hackathon Teams',
              copy:
                'Assemble the ultimate squad for the next big hackathon. Meet in person, code through the night, and win.'
            },
            {
              icon: 'terminal',
              title: 'Open Source',
              copy:
                'Collaborate on community-driven tools. Contribute to projects that matter to your local student ecosystem.'
            }
          ].map(({ icon, title, copy }) => (
            <div
              key={title}
              className="bg-background p-12 group hover:bg-surface-container transition-colors border-l-4 border-transparent hover:border-primary-container"
            >
              <span className="material-symbols-outlined text-primary-container text-4xl mb-6">
                {icon}
              </span>
              <h3 className="text-3xl font-headline font-bold mb-4 uppercase tracking-tight">
                {title}
              </h3>
              <p className="text-on-surface-variant text-lg leading-relaxed">
                {copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4.8: PROJECTS CAROUSEL */}
      <section className="py-24 px-6 md:px-10 bg-gradient-to-b from-[#0f0f0f] via-[#111111] to-[#0f0f0f] border-y border-outline-variant/15">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-primary-container font-headline">
                Projects for you
              </p>
              <h2 className="text-4xl font-headline font-black text-white tracking-tight mt-2">
                Curated matches from your city
              </h2>
              <p className="text-on-surface-variant mt-2">
                Handpicked roles based on your skills and availability.
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="/requests.html"
                className="px-4 py-2 rounded-full border border-outline-variant/30 text-sm font-bold text-white/80 hover:bg-primary-container hover:text-on-primary transition-all"
              >
                All projects
              </a>
              <a
                href="/collaboration.html"
                className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-headline font-bold uppercase tracking-wide hover:bg-primary transition-all"
              >
                Open a room
              </a>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Dubai Mentality',
                blurb:
                  'Mastery courses created by Zenith—business skills, real-world strategies, and execution.',
                role: 'CEO / Operator',
                creator: 'Aziz Azizi',
                date: '02/04/26',
                category: 'Education',
                phase: 'Building MVP',
                accent: 'from-[#1c1c1c] to-[#101010]'
              },
              {
                title: 'Open Agents Hub',
                blurb:
                  'Open-source agent platform with reusable skills. 1000 monthly tokens for builders.',
                role: 'UI/UX Designer',
                creator: 'Paulo Gomes Tavares Neto',
                date: '01/04/26',
                category: 'AI',
                phase: 'Building MVP',
                accent: 'from-[#162718] to-[#0e120f]'
              },
              {
                title: 'Blackforge Interactive',
                blurb:
                  'AAA open-world action game—cinematic storytelling, deep gameplay, player-driven agency.',
                role: 'Animator',
                creator: 'Pratyush Mohapatra',
                date: '31/03/26',
                category: 'Gaming',
                phase: 'Idea',
                accent: 'from-[#1f140f] to-[#0e0b09]'
              }
            ].map(
              (
                { title, blurb, role, creator, date, category, phase, accent },
                idx
              ) => (
                <article
                  key={title}
                  className={`rounded-3xl border border-outline-variant/20 bg-gradient-to-br ${accent} shadow-[0_10px_40px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col h-full`}
                >
                  <div className="h-32 bg-surface-container-high flex items-center justify-center border-b border-outline-variant/10">
                    <span className="text-4xl font-black text-primary-container font-headline">
                      {idx === 0 ? 'DM' : idx === 1 ? 'OA' : 'BI'}
                    </span>
                  </div>
                  <div className="flex-1 p-6 space-y-4">
                    <div>
                      <h3 className="text-2xl font-headline font-black text-white leading-tight">
                        {title}
                      </h3>
                      <p className="text-on-surface-variant mt-2 text-base leading-relaxed">
                        {blurb}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-surface-container-high border border-outline-variant/15 p-4">
                      <p className="text-sm font-headline font-black uppercase tracking-tight text-white mb-3">
                        Recommended for you
                      </p>
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <span className="inline-flex items-center gap-2 bg-primary/15 text-primary px-3 py-2 rounded-full text-sm font-bold uppercase tracking-tight">
                          <span className="material-symbols-outlined text-sm">
                            add
                          </span>
                          Apply for
                        </span>
                        <a
                          href="/requests.html"
                          className="text-lg font-black text-primary-container underline decoration-primary-container/60 decoration-2 underline-offset-4"
                        >
                          {role}
                        </a>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[12px] text-white/70 font-semibold uppercase tracking-tight">
                      <div>
                        <p className="text-white/40">Created</p>
                        <p className="text-white">{creator}</p>
                        <p className="text-white/50">{date}</p>
                      </div>
                      <div>
                        <p className="text-white/40">Category</p>
                        <p className="text-primary-container">{category}</p>
                        <p className="text-white/50">Role-based</p>
                      </div>
                      <div>
                        <p className="text-white/40">Phase</p>
                        <p className="text-white">{phase}</p>
                        <p className="text-white/50">Active</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/10 text-white/60 text-sm">
                    <a
                      href="/collaboration.html"
                      className="flex items-center gap-2 hover:text-primary-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">
                        forum
                      </span>
                      Open collab room
                    </a>
                    <a
                      href="/requests.html"
                      className="flex items-center justify-center w-8 h-8 rounded-full border border-outline-variant/30 hover:border-primary-container hover:text-primary-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        expand_more
                      </span>
                    </a>
                  </div>
                </article>
              )
            )}
          </div>
        </div>
      </section>

      {/* SECTION 5: HOW IT WORKS */}
      <section id="steps" className="py-32 bg-surface-container-low px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-6xl font-headline font-black mb-24 uppercase tracking-tighter text-white">
            The Three Steps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              {
                step: '01',
                title: 'Build your profile',
                copy:
                  'List what you know and what you are dying to learn. Our engine matches you with local complements.'
              },
              {
                step: '02',
                title: 'Discover local builders',
                copy:
                  "Filter by city, university, or tech stack. See who's active and building near you right now."
              },
              {
                step: '03',
                title: 'Match and ship',
                copy:
                  'Connect, meet up at a local cafe, and start shipping. From concept to deployment in record time.'
              }
            ].map(({ step, title, copy }) => (
              <div key={step} className="relative">
                <span className="absolute -top-16 -left-8 text-[120px] font-black text-white/5 font-headline z-0">
                  {step}
                </span>
                <div className="relative z-10">
                  <h4 className="text-2xl font-headline font-bold mb-4 text-primary-container">
                    {title}
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed">
                    {copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-20">
            <a
              className="inline-block text-2xl font-headline font-bold text-primary-container border-b-4 border-primary-container pb-1 hover:text-white hover:border-white transition-all"
              href="/discover.html"
            >
              Find builders near you →
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 6: TESTIMONIALS STRIP */}
      <section className="py-24 overflow-hidden border-y border-outline-variant/10">
        <div className="flex gap-8 px-4 animate-marquee">
          {[
            {
              initials: 'VR',
              name: 'Varun R.',
              school: 'IIT Delhi',
              quote:
                'Found a React developer to help me with my SaaS backend. Shipped in 3 weeks. Incredible community.',
              left: 'Python',
              right: 'React',
              color: 'primary'
            },
            {
              initials: 'AS',
              name: 'Ananya S.',
              school: 'SRCC Mumbai',
              quote:
                'Buildmate is the LinkedIn we actually needed. No fluff, just builders building things together.',
              left: 'Design',
              right: 'Flutter',
              color: 'tertiary'
            },
            {
              initials: 'KM',
              name: 'Kabir M.',
              school: 'BITS Pune',
              quote:
                'The skill swap model is genius. I learned more UI design in a month than in a year of tutorials.',
              left: 'Solidity',
              right: 'UI/UX',
              color: 'secondary'
            }
          ].map(
            ({ initials, name, school, quote, left, right, color }, index) => (
              <div
                key={`${initials}-${index}`}
                className="min-w-[400px] bg-surface-container p-8 rounded-xl border border-outline-variant/10"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`w-12 h-12 rounded flex items-center justify-center text-on-primary font-black ${
                      color === 'primary'
                        ? 'bg-primary-container text-on-primary'
                        : color === 'tertiary'
                          ? 'bg-tertiary-container text-on-tertiary'
                          : 'bg-secondary-container text-secondary'
                    }`}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="font-bold">{name}</p>
                    <p className="text-xs text-primary uppercase tracking-widest">
                      {school}
                    </p>
                  </div>
                </div>
                <p className="italic text-on-surface-variant mb-6">"{quote}"</p>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                  <span>{left}</span>
                  <span className="material-symbols-outlined text-[12px]">
                    swap_horiz
                  </span>
                  <span className="text-primary-container">{right}</span>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* SECTION 7: CITY MAP TEASER */}
      <section id="cities" className="py-32 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-headline font-black mb-12 uppercase tracking-tight">
            Active Hubs
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              'Delhi',
              'Mumbai',
              'Bangalore',
              'Pune',
              'Hyderabad',
              'Chennai',
              'Kolkata',
              'Ahmedabad'
            ].map((city) => (
              <span
                key={city}
                className={`px-6 py-3 rounded-full text-lg font-bold border border-outline-variant/20 transition-all cursor-pointer ${
                  city === 'Bangalore'
                    ? 'bg-primary-container text-on-primary border-transparent'
                    : 'bg-surface-container hover:bg-primary-container hover:text-on-primary'
                }`}
                onClick={() =>
                  (window.location.href = `/discover.html#city-${city.toLowerCase()}`)
                }
              >
                {city}
              </span>
            ))}
          </div>
          <div className="mt-12">
            <p className="text-on-surface-variant mb-4">Do not see your city?</p>
            <a
              className="text-primary-container font-bold hover:underline"
              href="/discover.html"
            >
              Join the waitlist →
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 8: FOOTER CTA & NAV */}
      <footer className="bg-[#0e0e0e] w-full py-16 px-8 border-t border-[#424936]/20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24">
            <h2 className="text-5xl md:text-7xl font-headline font-black text-white uppercase tracking-tighter mb-12">
              The skill-swap network for student builders.
            </h2>
            <form
              onSubmit={onFooterSubmit}
              className="flex flex-col md:flex-row gap-4 max-w-2xl"
            >
              <input
                className="flex-grow bg-surface-container border-none focus:ring-1 focus:ring-primary-container px-6 py-4 text-white rounded"
                placeholder="Enter email"
                type="email"
                value={footerEmail}
                onChange={(e) => setFooterEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="bg-primary-container text-on-primary font-headline font-black px-10 py-4 rounded uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-60"
                disabled={status.state === 'loading' && status.place === 'footer'}
              >
                {status.state === 'loading' && status.place === 'footer'
                  ? 'Sending…'
                  : 'Submit'}
              </button>
            </form>
            {status.place === 'footer' && status.state !== 'idle' && (
              <p
                className={`mt-3 text-sm ${
                  status.state === 'success'
                    ? 'text-primary-container'
                    : 'text-red-400'
                }`}
              >
                {status.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 w-full">
            <div className="space-y-6">
              <div className="text-xl font-black text-white uppercase font-headline">
                BUILDMATE
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                Empowering the next generation of creators through local
                collaboration and skill equity.
              </p>
            </div>
            <FooterColumn
              title="Builders"
              links={['Find a Partner', 'Skill Tags', 'Success Stories']}
            />
            <FooterColumn
              title="Company"
              links={['About', 'Community Guidelines', 'Careers']}
            />
            <FooterColumn
              title="Support"
              links={['Twitter', 'Discord', 'Contact']}
            />
          </div>
          <div className="mt-20 pt-8 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/40 text-sm uppercase tracking-widest">
              © 2024 BUILDMATE. THE BRUTALIST ZINE.
            </p>
            <div className="flex gap-8 text-white/40 text-sm uppercase tracking-widest">
              <a className="hover:text-white transition-colors" href="#">
                Terms
              </a>
              <a className="hover:text-white transition-colors" href="#">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* SIGN-IN OVERLAY */}
      {showSignIn && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="relative w-full max-w-md bg-surface-container-high border border-outline-variant/30 rounded-xl p-8 shadow-2xl">
            <button
              aria-label="Close"
              className="absolute top-3 right-3 text-white/60 hover:text-white"
              onClick={() => {
                setShowSignIn(false)
                setAuthStatus({ state: 'idle', message: '' })
              }}
              type="button"
            >
              ×
            </button>
            <p className="text-sm uppercase tracking-[0.3em] text-primary-container font-headline mb-3">
              Sign in
            </p>
            <h3 className="text-3xl font-headline font-black mb-8 text-white tracking-tight">
              Welcome back, builder
            </h3>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setAuthStatus({ state: 'loading', message: 'Checking…' })
                try {
                  const res = await fetch(`${API_BASE}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: authEmail,
                      password: authPassword
                    })
                  })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) {
                    setAuthStatus({
                      state: 'error',
                      message: data?.message || 'Invalid credentials'
                    })
                    return
                  }
                  setAuthStatus({
                    state: 'success',
                    message: 'Signed in! (demo token issued)'
                  })
                  setAuthPassword('')
                } catch {
                  setAuthStatus({
                    state: 'error',
                    message: 'Network error. Try again.'
                  })
                }
              }}
            >
              <div className="space-y-2">
                <label className="text-sm text-white/70">Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="you@university.edu"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={authStatus.state === 'loading'}
                className="w-full bg-primary-container text-on-primary font-headline font-black px-6 py-3 rounded uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-60"
              >
                {authStatus.state === 'loading' ? 'Signing in…' : 'Continue'}
              </button>
            </form>
            {authStatus.state !== 'idle' && (
              <p
                className={`mt-4 text-sm ${
                  authStatus.state === 'success'
                    ? 'text-primary-container'
                    : 'text-red-400'
                }`}
              >
                {authStatus.message}
              </p>
            )}
            <div className="mt-6 flex items-center justify-between text-sm text-white/50">
              <button
                type="button"
                className="hover:text-primary-container transition-colors"
                onClick={() =>
                  setAuthStatus({
                    state: 'error',
                    message: 'Password reset flow not wired in this demo.'
                  })
                }
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="hover:text-primary-container transition-colors"
                onClick={() => {
                  setShowSignIn(false)
                  setShowSignUp(true)
                }}
              >
                Create account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIGN-UP OVERLAY */}
      {showSignUp && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="relative w-full max-w-md bg-surface-container-high border border-outline-variant/30 rounded-xl p-8 shadow-2xl">
            <button
              aria-label="Close"
              className="absolute top-3 right-3 text-white/60 hover:text-white"
              onClick={() => {
                setShowSignUp(false)
                setSignupStatus({ state: 'idle', message: '' })
              }}
              type="button"
            >
              ×
            </button>
            <p className="text-sm uppercase tracking-[0.3em] text-primary-container font-headline mb-3">
              Create account
            </p>
            <h3 className="text-3xl font-headline font-black mb-8 text-white tracking-tight">
              Start building with locals
            </h3>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setSignupStatus({ state: 'loading', message: 'Creating…' })
                try {
                  const res = await fetch(`${API_BASE}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: signupName,
                      email: signupEmail,
                      password: signupPassword,
                      skills: signupSkills,
                      location: signupLocation,
                      build_goal: signupGoal,
                      open_to_collab: signupOpen,
                      social: signupSocial,
                      availability: signupAvailability
                    })
                  })
                  const data = await res.json().catch(() => ({}))
                  if (!res.ok) {
                    setSignupStatus({
                      state: 'error',
                      message: data?.message || 'Could not create account'
                    })
                    return
                  }
                  setSignupStatus({
                    state: 'success',
                    message: 'Account created! You can sign in now.'
                  })
                  setSignupPassword('')
                } catch {
                  setSignupStatus({
                    state: 'error',
                    message: 'Network error. Try again.'
                  })
                }
              }}
            >
              <div className="space-y-2">
                <label className="text-sm text-white/70">Full name</label>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="Aanya Sharma"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Skills you offer</label>
                <input
                  type="text"
                  value={signupSkills}
                  onChange={(e) => setSignupSkills(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="React, Node, UI/UX"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Location</label>
                <input
                  type="text"
                  value={signupLocation}
                  onChange={(e) => setSignupLocation(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="City, Country"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Email</label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="you@university.edu"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">What you want to build</label>
                <textarea
                  rows={2}
                  value={signupGoal}
                  onChange={(e) => setSignupGoal(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="e.g., AI study buddy, fintech MVP, climate app"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Availability</label>
                <input
                  type="text"
                  value={signupAvailability}
                  onChange={(e) => setSignupAvailability(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="Weeknights, Weekends, 10 hrs/week"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Social / Portfolio</label>
                <input
                  type="url"
                  value={signupSocial}
                  onChange={(e) => setSignupSocial(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="https://www.linkedin.com/in/you"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={signupOpen}
                  onChange={(e) => setSignupOpen(e.target.checked)}
                  className="h-4 w-4 rounded border-outline-variant/50 bg-surface-container text-primary-container focus:ring-primary-container"
                />
                Open to collaborate
              </label>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Password</label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full bg-surface-container text-white border border-outline-variant/40 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-container"
                  placeholder="At least 6 characters"
                />
              </div>
              <button
                type="submit"
                disabled={signupStatus.state === 'loading'}
                className="w-full bg-primary-container text-on-primary font-headline font-black px-6 py-3 rounded uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-60"
              >
                {signupStatus.state === 'loading' ? 'Creating…' : 'Create account'}
              </button>
            </form>
            {signupStatus.state !== 'idle' && (
              <p
                className={`mt-4 text-sm ${
                  signupStatus.state === 'success'
                    ? 'text-primary-container'
                    : 'text-red-400'
                }`}
              >
                {signupStatus.message}
              </p>
            )}
            <div className="mt-6 flex items-center justify-between text-sm text-white/50">
              <button
                type="button"
                className="hover:text-primary-container transition-colors"
                onClick={() => {
                  setShowSignUp(false)
                  setShowSignIn(true)
                }}
              >
                Already have an account?
              </button>
              <a
                className="hover:text-primary-container transition-colors"
                href="/discover.html"
              >
                Go to app →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FloatingCard({
  position,
  rotate,
  initials,
  name,
  city,
  skills,
  color = 'primary'
}) {
  const palette =
    color === 'primary'
      ? 'bg-primary-container text-on-primary'
      : color === 'secondary'
        ? 'bg-secondary-container text-secondary'
        : color === 'tertiary'
          ? 'bg-tertiary-container text-on-tertiary'
          : 'bg-[#ccff80] text-black'

  return (
    <div
      className={`absolute ${position} bg-surface-container p-4 rounded-xl ${rotate} border border-outline-variant/20 hidden md:block`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-full ${palette} flex items-center justify-center font-bold`}
        >
          {initials}
        </div>
        <div>
          <p className="text-sm font-bold">{name}</p>
          <p className="text-[10px] text-white/50 uppercase tracking-widest">
            {city}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className={`text-[10px] px-2 py-0.5 rounded ${
              skill === skills[0]
                ? 'bg-surface-container-highest'
                : 'bg-primary/20 text-primary'
            }`}
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  )
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <h5 className="text-[#A3E635] font-headline font-bold uppercase tracking-widest mb-6">
        {title}
      </h5>
      <ul className="space-y-4 text-white/40">
        {links.map((link) => (
          <li key={link}>
            <a
              className="hover:text-white transition-colors"
              href="/discover.html"
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
