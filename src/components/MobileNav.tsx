import { useState } from 'react';

const links: { label: string; href: string; cta?: boolean }[] = [
  { label: 'About',        href: '/#about' },
  { label: 'Projects',     href: '/#projects' },
  { label: 'Blog',         href: '/blog' },
  { label: 'Contact',      href: '/#contact' },
  { label: 'Work with me', href: '/#contact', cta: true },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(prev => !prev);
  const close  = () => setIsOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-near-black">

      {/* Top bar */}
      <div className="px-6 py-3 flex items-center justify-between">
        <a
          href="/"
          className="text-sm font-semibold bg-dark-olive text-warm-white px-3 py-1 rounded hover:bg-dark-olive/80 transition-colors"
        >
          CassWeiers.dev
        </a>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-8 text-sm font-medium">
          {links.map(({ label, href, cta }) => (
            cta ? (
              <a
                key={label}
                href={href}
                className="bg-garnet hover:bg-garnet/85 text-warm-white px-4 py-1.5 rounded-lg transition-colors"
              >
                {label}
              </a>
            ) : (
              <a key={label} href={href} className="text-warm-white/80 hover:text-amber transition-colors">
                {label}
              </a>
            )
          ))}
        </div>

        {/* Hamburger button - mobile only */}
        <button
          onClick={toggle}
          className="sm:hidden text-warm-white p-2 -mr-2 rounded transition-all duration-150 active:scale-90 active:bg-warm-white/10"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          aria-controls="mobile-nav-menu"
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown - outer div is clip/animation shell only */}
      <div
        id="mobile-nav-menu"
        className={[
          'sm:hidden overflow-hidden transition-[max-height,opacity] duration-200 ease-out',
          isOpen
            ? 'max-h-80 opacity-100 pointer-events-auto'
            : 'max-h-0 opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <div className="flex flex-col gap-1 border-t border-warm-white/10 px-6 py-4">
          {links.map(({ label, href, cta }) => (
            <a
              key={label}
              href={href}
              onClick={close}
              className={
                cta
                  ? 'bg-garnet hover:bg-garnet/85 text-warm-white text-sm font-medium py-2 px-4 rounded-lg mt-1 text-center transition-colors'
                  : 'text-warm-white/80 hover:text-amber transition-colors text-sm font-medium py-2 block'
              }
            >
              {label}
            </a>
          ))}
        </div>
      </div>

    </nav>
  );
}
