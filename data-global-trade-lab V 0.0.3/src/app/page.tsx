export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">
            Global Trade Lab
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Backend base listo para Supabase y TwelveData
          </h1>
          <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
            Este proyecto ya queda preparado para autenticacion con Supabase y
            consulta segura de mercado a traves de un endpoint backend en Next.js.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-medium text-white">Supabase</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Usa `createSupabaseClient()` en cliente y servidor. El middleware
              ya refresca la sesion automaticamente.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-medium text-white">TwelveData</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Tu API key se consume solo en backend desde
              `src/app/api/market/quote/route.ts`.
            </p>
          </section>
        </div>

        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-6">
          <h2 className="text-lg font-medium text-cyan-100">Prueba rápida</h2>
          <p className="mt-3 text-sm leading-6 text-cyan-50">
            Cuando agregues `TWELVEDATA_API_KEY` a tu `.env.local`, puedes probar:
            <span className="block font-mono text-cyan-200">
              /api/market/quote?symbol=AAPL
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}
