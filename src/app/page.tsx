"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen,
  BrainCircuit, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp,
  Clock3, FileText, Flame, Gauge, LayoutDashboard, LogOut, Menu, MessageCircle,
  Search, Settings2, Sparkles, Target, TrendingUp, UploadCloud, X, Zap,
} from "lucide-react";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "My materials", href: "/materials", icon: FileText },
  { label: "Diagnostic quiz", href: "/quiz", icon: BookOpen },
  { label: "Knowledge gaps", href: "/gap-report", icon: Target },
  { label: "Revision plan", href: "/revision-plan", icon: CalendarDays },
  { label: "AI study assistant", href: "/study-assistant", icon: MessageCircle },
];

const topics = [
  { name: "Database normalization", group: "DBMS", score: 38, state: "Needs focus", tone: "rose" },
  { name: "SQL joins", group: "DBMS", score: 65, state: "In progress", tone: "amber" },
  { name: "Primary & foreign keys", group: "DBMS", score: 72, state: "In progress", tone: "amber" },
  { name: "ACID properties", group: "DBMS", score: 88, state: "Strong", tone: "emerald" },
];

const week = [
  { day: "M", value: 34 }, { day: "T", value: 58 }, { day: "W", value: 44 },
  { day: "T", value: 78 }, { day: "F", value: 62 }, { day: "S", value: 91 }, { day: "S", value: 26 },
];

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [search, setSearch] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" }));
  }, []);

  async function handleLogout() {
    setLoggingOut(true); setLogoutError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login"); router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Logout failed. Please try again.");
      setLoggingOut(false);
    }
  }

  const filteredTopics = topics.filter((topic) => topic.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[#f5f6fb] text-slate-900">
      {menuOpen && <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col bg-[#11142b] px-4 pb-5 pt-6 text-white transition-transform duration-300 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-gradient-to-br from-violet-400 to-indigo-600 shadow-lg shadow-indigo-950/40"><BrainCircuit size={24} /></div>
          <div><div className="text-[17px] font-bold tracking-tight">GapFinder <span className="text-violet-300">AI</span></div><div className="mt-0.5 text-[11px] text-slate-400">Your learning co-pilot</div></div>
          <button className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={label} href={href} onClick={() => setMenuOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition ${active ? "bg-violet-500 text-white shadow-lg shadow-violet-950/30" : "text-slate-400 hover:bg-white/[.07] hover:text-white"}`}><Icon size={17} strokeWidth={1.9} /><span>{label}</span>{active && <ChevronRight size={15} className="ml-auto" />}</Link>;
          })}
        </nav>
        <div className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">Your momentum</div>
        <div className="mx-1 mt-3 rounded-2xl border border-white/10 bg-white/[.055] p-4">
          <div className="flex items-center justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-400/15 text-orange-300"><Flame size={19} /></div><span className="rounded-full bg-orange-400/10 px-2 py-1 text-[10px] font-semibold text-orange-200">Keep it up</span></div>
          <div className="mt-3 text-2xl font-bold">3 day streak</div><p className="mt-1 text-xs leading-5 text-slate-400">Small, consistent sessions build strong recall.</p>
          <div className="mt-4 flex gap-2">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={`${d}-${i}`} className={`flex h-7 flex-1 items-center justify-center rounded-lg text-[10px] font-semibold ${i < 3 ? "bg-violet-500 text-white" : "bg-white/[.07] text-slate-500"}`}>{i < 3 ? <Check size={12} /> : d}</div>)}</div>
        </div>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/10 p-4 ring-1 ring-white/10"><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-violet-300" />Study smarter</div><p className="mt-2 text-xs leading-5 text-slate-400">Let AI help you decide what to study next.</p><Link href="/study-assistant" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-200 hover:text-white">Ask your assistant <ArrowRight size={13} /></Link></div>
        <div className="mt-4 flex items-center gap-2 px-2 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-400" /> AI workspace ready</div>
      </aside>

      <section className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMenuOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Open menu"><Menu size={19} /></button><div className="hidden text-xs text-slate-400 sm:block">Workspace <ChevronRight className="mx-1 inline" size={12} /> <span className="font-semibold text-slate-700">Overview</span></div><div className="sm:hidden text-sm font-semibold">Overview</div></div>
          <div className="flex items-center gap-2 sm:gap-4">
            <label className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 md:flex"><Search size={15} className="text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a topic..." className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400" /></label>
            <button className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500 ring-2 ring-white" /></button>
            <div className="relative"><button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-slate-100"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">GF</div><div className="hidden text-left sm:block"><div className="text-xs font-semibold text-slate-800">My workspace</div><div className="mt-0.5 text-[10px] text-slate-400">Learner account</div></div><ChevronDown size={14} className="hidden text-slate-400 sm:block" /></button>{profileOpen && <div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><button onClick={handleLogout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"><LogOut size={15} />{loggingOut ? "Signing out..." : "Sign out"}</button>{logoutError && <p className="px-2 py-1 text-xs text-rose-600">{logoutError}</p>}</div>}</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-7 sm:px-7 xl:px-10 xl:pt-9">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-violet-700"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Your AI learning space</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[32px]">Let’s make progress<span className="text-violet-600">.</span></h1><p className="mt-2 text-sm text-slate-500">A clearer view of what you know, what needs work, and what’s next.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={15} />{today || "Your learning overview"}</div></div>

          <section className="relative isolate overflow-hidden rounded-[28px] bg-[#191a3d] p-6 text-white shadow-xl shadow-indigo-950/10 sm:p-8 xl:p-10">
            <div className="pointer-events-none absolute -right-12 -top-28 -z-10 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl" /><div className="pointer-events-none absolute bottom-[-150px] right-[22%] -z-10 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
            <div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:items-center"><div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[11px] font-medium text-violet-100"><Sparkles size={13} /> Your next breakthrough starts here</div><h2 className="mt-5 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-[40px]">Turn your learning gaps into your <span className="bg-gradient-to-r from-violet-300 to-cyan-200 bg-clip-text text-transparent">strengths.</span></h2><p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">Upload your study material, test your understanding, and get a focused plan for what to learn next.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/materials" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50"><UploadCloud size={17} /> Open my materials <ArrowRight size={15} /></Link><Link href="/quiz" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[.06] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><Zap size={16} /> Start a diagnostic quiz</Link></div></div>
              <div className="relative mx-auto w-full max-w-[310px]"><div className="rounded-[24px] border border-white/15 bg-white/[.08] p-5 shadow-2xl backdrop-blur-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-slate-300">Learning snapshot</p><p className="mt-1 text-lg font-bold">Your progress hub</p></div><div className="rounded-xl bg-violet-300/15 p-2.5 text-violet-200"><TrendingUp size={20} /></div></div><div className="mt-5 flex items-center gap-4"><div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: "conic-gradient(#a78bfa 0deg 252deg, rgba(255,255,255,.12) 252deg 360deg)" }}><div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#222247] text-center"><span className="text-xl font-bold">70<span className="text-xs text-violet-200">%</span></span></div></div><div><div className="text-sm font-semibold">Keep building</div><p className="mt-1 text-xs leading-5 text-slate-300">Your dashboard preview uses illustrative values until connected to live analytics.</p></div></div><div className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center justify-between text-xs"><span className="text-slate-300">Focus this week</span><span className="font-semibold text-violet-200">One step at a time</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[62%] rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" /></div></div></div><div className="absolute -bottom-4 -left-5 hidden items-center gap-2 rounded-xl border border-white/10 bg-[#27284f] px-3 py-2.5 text-xs shadow-xl sm:flex"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300"><Check size={15} /></span><span><b className="block">Study with purpose</b><span className="text-[10px] text-slate-400">Your next action is ready</span></span></div></div>
            </div>
          </section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[{label:"Study sessions",value:"—",note:"Sessions completed",icon:BookOpen,tone:"violet"},{label:"Topics reviewed",value:"—",note:"Across your materials",icon:BrainCircuit,tone:"blue"},{label:"Knowledge gaps",value:"—",note:"Topics to revisit",icon:Target,tone:"rose"},{label:"Study time",value:"—",note:"Time invested",icon:Clock3,tone:"amber"}].map(({label,value,note,icon:Icon,tone})=><article key={label} className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60"><div className="flex items-start justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === "violet" ? "bg-violet-50 text-violet-600" : tone === "blue" ? "bg-sky-50 text-sky-600" : tone === "rose" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}><Icon size={19} /></div><span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] text-slate-400">Live data</span></div><div className="mt-5 flex items-end justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p></div><span className="mb-1 text-[10px] text-slate-400">{note}</span></div></article>)}
          </div>

          <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Activity size={18} /></div><h3 className="font-bold text-slate-900">Weekly study rhythm</h3></div><p className="mt-2 text-xs text-slate-500">A visual placeholder for your activity trend.</p></div><span className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-500">Last 7 days <ChevronDown size={12} className="ml-1 inline" /></span></div><div className="mt-8 flex h-40 items-end justify-between gap-3 border-b border-slate-100 px-1 sm:gap-5">{week.map((item,i)=><div key={`${item.day}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-3"><div className="flex h-full w-full items-end"><div className={`w-full rounded-t-lg transition-all duration-300 hover:opacity-80 ${i===5 ? "bg-gradient-to-t from-violet-600 to-fuchsia-400" : "bg-gradient-to-t from-indigo-100 to-violet-200"}`} style={{height:`${item.value}%`}} /></div><span className={`pb-3 text-[11px] ${i===5 ? "font-bold text-violet-700" : "text-slate-400"}`}>{item.day}</span></div>)}</div><div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-violet-500" /> Illustrative chart — connect study-session records to show actual activity.</div></section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Target size={18} /></div><h3 className="font-bold text-slate-900">Your next best steps</h3></div><p className="mt-2 text-xs text-slate-500">Pick up where progress matters most.</p></div><Sparkles size={18} className="text-violet-500" /></div><div className="mt-5 space-y-3"><Link href="/materials" className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 transition hover:border-violet-200 hover:bg-violet-50/60"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><UploadCloud size={18} /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Add study material</p><p className="mt-1 text-xs text-slate-500">Give your AI a topic to work with</p></div><ChevronRight size={17} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600" /></Link><Link href="/quiz" className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 transition hover:border-sky-200 hover:bg-sky-50/60"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><BookOpen size={18} /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Check your understanding</p><p className="mt-1 text-xs text-slate-500">Take a diagnostic quiz</p></div><ChevronRight size={17} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-sky-600" /></Link><Link href="/revision-plan" className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/60"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CalendarDays size={18} /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Review your plan</p><p className="mt-1 text-xs text-slate-500">Turn weak spots into a routine</p></div><ChevronRight size={17} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-600" /></Link></div></section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><TrendingUp size={18} /></div><h3 className="font-bold text-slate-900">Topic mastery preview</h3></div><p className="mt-2 text-xs text-slate-500">Example topics to demonstrate how your mastery view will look.</p></div><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:w-64"><Search size={15} className="text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sample topics..." className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400" /></label></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[530px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-[.12em] text-slate-400"><th className="pb-3 font-semibold">Topic</th><th className="pb-3 font-semibold">Subject</th><th className="pb-3 font-semibold">Mastery</th><th className="pb-3 font-semibold">Status</th></tr></thead><tbody>{filteredTopics.map((topic)=><tr key={topic.name} className="border-b border-slate-50 last:border-0"><td className="py-4 pr-4 text-sm font-semibold text-slate-800">{topic.name}</td><td className="py-4 pr-4 text-xs text-slate-500">{topic.group}</td><td className="w-[35%] py-4 pr-5"><div className="flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${topic.tone === "rose" ? "bg-rose-500" : topic.tone === "amber" ? "bg-amber-400" : "bg-emerald-500"}`} style={{width:`${topic.score}%`}} /></div><span className="w-8 text-right text-xs font-semibold text-slate-600">{topic.score}%</span></div></td><td className="py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${topic.tone === "rose" ? "bg-rose-50 text-rose-700" : topic.tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{topic.state}</span></td></tr>)}</tbody></table>{filteredTopics.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No matching sample topics.</p>}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-[11px] text-slate-400">Sample DBMS data only — not your saved quiz results.</p><Link href="/gap-report" className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900">View knowledge gaps <ArrowRight size={14} /></Link></div></section>

          <section className="mt-6 grid gap-4 md:grid-cols-2"><Link href="/study-assistant" className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-lg shadow-violet-900/10 transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><BrainCircuit size={23} /></div><div className="min-w-0 flex-1"><p className="font-bold">Need help understanding a topic?</p><p className="mt-1 text-xs leading-5 text-violet-100">Ask the AI study assistant to break it down.</p></div><ArrowUpRight size={19} className="shrink-0 transition group-hover:translate-x-1 group-hover:-translate-y-1" /></Link><Link href="/revision-plan" className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><CalendarDays size={23} /></div><div className="min-w-0 flex-1"><p className="font-bold text-slate-900">Make your next session count</p><p className="mt-1 text-xs leading-5 text-slate-500">Open your personalized revision plan.</p></div><ArrowDownRight size={19} className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:translate-y-1" /></Link></section>
          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-[11px] text-slate-400 sm:flex-row"><span>© 2026 GapFinder AI</span><span className="flex items-center gap-1.5"><CircleHelp size={13} /> Learn smarter. Improve every day.</span></footer>
        </div>
      </section>
    </main>
  );
}
