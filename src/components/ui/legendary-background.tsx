export default function LegendaryBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* ── Left Atmosphere: Leo Messi ── */}
      <div className="fixed -bottom-4 left-0 sm:left-1 md:left-2 lg:left-4 xl:left-6 w-56 sm:w-72 md:w-88 lg:w-[420px] xl:w-[500px] 2xl:w-[560px] opacity-75 sm:opacity-80 md:opacity-85 lg:opacity-90 xl:opacity-95 transition-opacity duration-500">
        <div className="relative w-full">
          {/* Subtle violet stadium aura */}
          <div className="absolute -inset-10 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-700/25 via-transparent to-transparent blur-3xl" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/leo_messi_home_page_util.png"
            alt=""
            className="w-full h-auto object-contain object-bottom filter drop-shadow-[0_0_30px_rgba(98,18,152,0.5)] dark:drop-shadow-[0_0_40px_rgba(168,85,247,0.45)]"
          />

          {/* Smooth bottom fade into body */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        </div>
      </div>

      {/* ── Right Atmosphere: Cristiano Ronaldo (CR7) ── */}
      <div className="fixed -bottom-4 right-0 sm:right-1 md:right-2 lg:right-4 xl:right-6 w-52 sm:w-64 md:w-80 lg:w-[380px] xl:w-[450px] 2xl:w-[510px] opacity-75 sm:opacity-80 md:opacity-85 lg:opacity-90 xl:opacity-95 transition-opacity duration-500">
        <div className="relative w-full">
          {/* Subtle violet stadium aura */}
          <div className="absolute -inset-10 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-700/25 via-transparent to-transparent blur-3xl" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cr7_home_page_util.png"
            alt=""
            className="w-full h-auto object-contain object-bottom filter drop-shadow-[0_0_30px_rgba(98,18,152,0.5)] dark:drop-shadow-[0_0_40px_rgba(168,85,247,0.45)]"
          />

          {/* Smooth bottom fade into body */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        </div>
      </div>
    </div>
  )
}
