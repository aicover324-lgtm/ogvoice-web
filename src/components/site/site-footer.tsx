import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050913] text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            OG Voice
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
            Sesini klonla, yaratimini hizlandir. Karisik ayarlar yerine sade bir uretim deneyimi.
          </p>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-100">Urun</div>
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
            <Link href="/#features" className="transition-colors hover:text-cyan-200">Ozellikler</Link>
            <Link href="/#how-it-works" className="transition-colors hover:text-cyan-200">Nasil Calisir</Link>
            <Link href="/pricing" className="transition-colors hover:text-cyan-200">Pricing</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-100">Yasal</div>
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
            <Link href="/legal/terms" className="transition-colors hover:text-cyan-200">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-cyan-200">Privacy</Link>
            <Link href="/faq" className="transition-colors hover:text-cyan-200">FAQ</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>(c) {new Date().getFullYear()} OG Voice. Tum haklari saklidir.</span>
          <span>Cyan + fuchsia powered experience</span>
        </div>
      </div>
    </footer>
  );
}
