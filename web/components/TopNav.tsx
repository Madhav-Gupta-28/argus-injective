"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EyeMark } from "./EyeMark";
import { ThemeToggle } from "./ThemeToggle";
import { ARGUS, REPO, addressUrl } from "@/lib/chain";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/proof", label: "Live proof" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-argus-line bg-argus-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <EyeMark size={26} />
          <span className="font-display text-xl tracking-tight text-argus-ink">Argus</span>
          <span className="ml-1 hidden font-mono text-[10px] uppercase tracking-label text-argus-inj sm:inline">
            on Injective
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`font-mono text-[11px] uppercase tracking-label transition-colors ${
                  active ? "text-argus-ink" : "text-argus-faint hover:text-argus-dim"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <a
            href={addressUrl(ARGUS)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] uppercase tracking-label text-argus-faint transition-colors hover:text-argus-dim"
          >
            Contract
          </a>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <a href={REPO} target="_blank" rel="noreferrer" className="btn-ghost !px-4 !py-2 !text-[13px]">
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
}
