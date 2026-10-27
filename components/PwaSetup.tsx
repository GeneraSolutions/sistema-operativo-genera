"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "genera.pwa.oculto";
const DISMISS_DAYS = 14;
const SHARE_PREFIXES = ["/propuesta", "/informe", "/dictamen", "/vcard"];

/** Borra del service worker las pantallas cacheadas (llamar al cerrar sesión). */
export async function clearPrivateCache(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  reg?.active?.postMessage({ type: "CLEAR_PRIVATE" });
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function recentlyDismissed(): boolean {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
}

export function PwaSetup() {
  const pathname = usePathname() || "/";
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()));
      return;
    }
    const register = () =>
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => reg.update())
        .catch(() => null);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    setHidden(recentlyDismissed());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setIosTip(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos()) setIosTip(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onSharePage = SHARE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (hidden || onSharePage || (!promptEvent && !iosTip)) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
  }

  return (
    <div
      role="dialog"
      aria-label="Instalar la app"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl bg-[#0f2a1f] p-4 text-white shadow-2xl ring-1 ring-[#1f4636] sm:inset-x-auto sm:right-4 sm:bottom-4"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instala Genera OS</p>
          {promptEvent ? (
            <p className="mt-0.5 text-xs text-[#c9d7cf]">
              Ábrela desde el escritorio o la pantalla de inicio, en su propia ventana.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[#c9d7cf]">
              En Safari toca <span className="font-semibold text-white">Compartir</span>{" "}
              y luego <span className="font-semibold text-white">Agregar a inicio</span>.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {promptEvent ? (
              <button
                type="button"
                onClick={() => void install()}
                className="rounded-lg bg-[#d4b46a] px-3.5 py-1.5 text-sm font-semibold text-[#0f2a1f] hover:bg-[#e8d9a8]"
              >
                Instalar
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-sm text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
