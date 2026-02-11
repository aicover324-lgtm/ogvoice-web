import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Mic2,
  Music4,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "OG Voice | Sesini klonla, yeni vokaller uret",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const steps = [
    {
      title: "Sesini yukle",
      body: "Kisa bir kayit yukle. Sistem ses rengini ve tarzini anlamaya baslar.",
      icon: Upload,
    },
    {
      title: "Klonu baslat",
      body: "Clone Voice tusuna bas. Klonlama basladiginda karttan anlik takip edersin.",
      icon: Mic2,
    },
    {
      title: "Vokal uret",
      body: "Hazir olan sesinle yeni denemeler yap, sarkina en uygun yorumu bul.",
      icon: Music4,
    },
  ];

  const highlights = [
    {
      title: "Temiz sonuc",
      body: "Karisik ekranlar olmadan, ne yapacagini hemen anlarsin.",
      icon: Sparkles,
    },
    {
      title: "Guvenli saklama",
      body: "Kayitlarin ve profilin sana ozel alanlarda tutulur.",
      icon: ShieldCheck,
    },
    {
      title: "Hizli akis",
      body: "Yukleme, klonlama ve deneme adimlari tek bir duzende ilerler.",
      icon: Zap,
    },
    {
      title: "Kolay kontrol",
      body: "Ses profillerini duzenle, kapak gorselini degistir, her seyi sade yonet.",
      icon: WandSparkles,
    },
  ];

  const faqs = [
    {
      q: "Klonlama ne kadar suruyor?",
      a: "Ses kaydinin uzunluguna ve yogunluga gore degisir. Islem basladiginda kart uzerinden durumunu gorebilirsin.",
    },
    {
      q: "Ses verilerim guvende mi?",
      a: "Evet. Dosyalarin hesabina bagli tutulur ve sadece senin akisinda kullanilir.",
    },
    {
      q: "Baslamak icin teknik bilgi gerekiyor mu?",
      a: "Hayir. Mantik basit: kayit yukle, klonla, sonra yeni vokal denemelerini olustur.",
    },
  ];

  return (
    <main className="bg-[#070b18] text-white">
      <section className="relative overflow-hidden border-b border-white/10 pt-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.24),transparent_60%)]" />
          <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-[100px]" />
          <div className="absolute -right-12 top-16 h-80 w-80 rounded-full bg-fuchsia-500/18 blur-[110px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Yeni nesil clone voice deneyimi
            </div>

            <h1
              className="mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-6xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Sesini klonla,
              <span className="block bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                sarkilarina yeni bir yorum kat.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              OG Voice ile kaydini yuklersin, klonunu baslatirsin ve hazir oldugunda yeni vokal denemelerini kolayca
              uretirsin. Her sey sade, hizli ve anlasilir bir akista.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="h-11 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-6 text-sm font-semibold text-white shadow-[0_10px_36px_rgba(6,182,212,0.35)] hover:from-cyan-500 hover:to-fuchsia-500"
              >
                <Link href="/register">Ucretsiz basla</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl border-white/20 bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10"
              >
                <Link href="#how-it-works">Nasil calisir</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-4xl rounded-3xl border border-white/15 bg-white/[0.03] p-2 shadow-[0_26px_80px_rgba(2,8,23,0.45)] backdrop-blur">
            <div className="rounded-2xl border border-white/10 bg-[#0d1328] p-5 md:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Clone Voice paneli</div>
                  <div className="text-xs text-slate-400">Ses kaydi yukle - Klonla - Uret</div>
                </div>
                <div className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200">
                  Canli akis
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  { t: "Voice profile", d: "Isim, dil ve notlar" },
                  { t: "Singing voice", d: "Kaydini tek alandan yukle" },
                  { t: "Clone durumu", d: "Kart cevresinde anlik animasyon" },
                  { t: "Model hazir", d: "Bittiginde hemen kullanmaya basla" },
                ].map((item, i) => (
                  <div key={item.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs text-cyan-200">Adim {i + 1}</div>
                    <div className="mt-1 text-sm font-semibold">{item.t}</div>
                    <p className="mt-1 text-xs text-slate-400">{item.d}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {["Kolay kurulum", "Temiz arayuz", "Hizli sonuc"].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-white/10 bg-[#050913] py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Surec</div>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
              Nasil calisir?
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.title}
                  className="border-white/10 bg-[#0a1021]/80 p-6 text-white shadow-[0_10px_40px_rgba(2,8,23,0.28)] transition-colors hover:border-cyan-400/35"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/18 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                    {index + 1}. {step.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-white/10 bg-[#070d1d] py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
              Profesyonel degil,
              <span className="block bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                kullanici dostu bir deneyim.
              </span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Amacimiz teknik detaylari sana yuklemek degil. Sesini yukleyip sonucunu alabilecegin sade bir yol sunuyoruz.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "Kafa karistirmayan adimlar",
                "Clone ve uretim akisinda net durum gostergeleri",
                "Ses profilini tek yerden kolay yonetim",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="border-white/10 bg-white/[0.04] p-5 text-white shadow-[0_10px_34px_rgba(2,8,23,0.25)]"
                >
                  <Icon className="h-5 w-5 text-fuchsia-300" />
                  <div className="mt-3 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-b border-white/10 bg-[#050913] py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-semibold md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
              Basit planlar, net secimler
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
              Istersen ucretsiz basla, islerin buyudukce planini yukselt.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            <Card className="border-white/12 bg-[#0a1021]/80 p-6 text-white">
              <div className="text-sm text-slate-300">Starter</div>
              <div className="mt-2 text-4xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                $0
              </div>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                <li>1 ses profili olusturma</li>
                <li>Temel yukleme ve clone akisina erisim</li>
                <li>Deneme icin ideal baslangic</li>
              </ul>
              <Button asChild variant="outline" className="mt-6 w-full border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link href="/register">Ucretsiz basla</Link>
              </Button>
            </Card>

            <Card className="relative border-cyan-300/55 bg-[#0a1021]/95 p-6 text-white shadow-[0_0_0_1px_rgba(217,70,239,0.25)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/60 bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                En cok secilen
              </div>
              <div className="text-sm text-slate-300">Pro</div>
              <div className="mt-2 text-4xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                $19
              </div>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                <li>Daha yuksek kullanim limiti</li>
                <li>Oncelikli is akisi</li>
                <li>Buyuyen projeler icin rahat alan</li>
              </ul>
              <Button
                asChild
                className="mt-6 w-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white hover:from-cyan-500 hover:to-fuchsia-500"
              >
                <Link href="/pricing">Planlari gor</Link>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#070d1d] py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-semibold md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
            Sik sorulan sorular
          </h2>

          <div className="mt-10 space-y-3">
            {faqs.map((item) => (
              <Card key={item.q} className="border-white/12 bg-[#0a1021]/85 p-5 text-white">
                <div className="text-sm font-semibold md:text-base">{item.q}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.a}</p>
              </Card>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-white/12 bg-white/[0.03] p-6 text-center">
            <div className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              Sesini bir sonraki seviyeye tasimaya hazir misin?
            </div>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
              Hesabini olustur, ilk ses profilini ac ve Clone Voice akisina hemen basla.
            </p>
            <Button
              asChild
              className="mt-5 h-11 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-6 text-white hover:from-cyan-500 hover:to-fuchsia-500"
            >
              <Link href="/register">Hemen basla</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
