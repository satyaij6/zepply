import Image from "next/image";
import { Heart, Mail, MapPin } from "lucide-react";

const CONTACT_EMAIL = "contact@buybloc.com";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Tools", href: "/#tools" },
      { label: "Use cases", href: "/#use-cases" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact Us", href: `mailto:${CONTACT_EMAIL}` },
      { label: "Join the waitlist", href: "/#waitlist" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Data Deletion", href: "/data-deletion" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="overflow-hidden border-t border-night-line bg-night px-4 pt-16 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[1424px]">
        <div className="grid gap-12 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.6fr))]">
          {/* Brand + contact */}
          <div className="sm:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <Image src="/icons/sidebar/zepply-logo.png" alt="" width={20} height={28} />
              <span className="text-[22px] text-white" style={{ fontFamily: "'Glitz', 'Poppins', sans-serif" }}>
                Zepply
              </span>
            </div>
            <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-zinc-400">
              Create. Reply. Multiply. Your content engine for Instagram, YouTube, TikTok, Facebook and WhatsApp.
            </p>

            <address className="mt-7 space-y-3 text-sm not-italic leading-relaxed text-zinc-400">
              <p className="flex max-w-[380px] gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                HNO:3-14-124/CP/504, THEDLAPUR CHAITANYA PLAZA, Mansoorabad, K.V.Rangareddy, Hayathnagar, Telangana, India, 500068
              </p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex w-fit items-center gap-2.5 transition hover:text-white">
                <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
                {CONTACT_EMAIL}
              </a>
            </address>
            <p className="mt-6 text-xs text-zinc-500">Zepply is a product of BuyBloc Private Limited.</p>
          </div>

          {COLUMNS.map(({ title, links }) => (
            <nav key={title} aria-label={title}>
              <p className="font-display text-base font-bold text-white">{title}</p>
              <ul className="mt-5 space-y-3.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-[15px] text-zinc-400 transition hover:text-white">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-night-line pt-6 text-sm text-zinc-500">
          <p>© 2026 BuyBloc Private Limited. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Made with <Heart className="h-4 w-4 fill-[#F43F5E] text-[#F43F5E]" aria-label="love" /> in India
          </p>
        </div>

        <Wordmark />
      </div>
    </footer>
  );
}

/**
 * Giant faded "Zepply" sinking into the bottom edge (the descenders are cut off),
 * set in the Zepply logo face (Glitz); picks up a faint blue tint on hover.
 * At 335px, Glitz's "Zepply" is ~996 units wide, so it fills the 1000-wide box unstretched.
 */
function Wordmark() {
  return (
    <div aria-hidden className="group relative mt-12 select-none sm:mt-16">
      <svg viewBox="0 0 1000 280" className="block w-full" style={{ fontFamily: "'Glitz', 'Poppins', sans-serif" }}>
        <defs>
          <linearGradient id="wordmark-dim" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0.1" stopColor="#FFFFFF" stopOpacity="0.17" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="wordmark-tint" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0.1" stopColor="#3D7EFF" stopOpacity="0.45" />
            <stop offset="1" stopColor="#3D7EFF" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[
          { fill: "url(#wordmark-dim)", className: undefined },
          { fill: "url(#wordmark-tint)", className: "opacity-0 transition duration-700 group-hover:opacity-100" },
        ].map(({ fill, className }) => (
          <text key={fill} x="2" y="242" fontSize="335" fill={fill} className={className}>
            Zepply
          </text>
        ))}
      </svg>
    </div>
  );
}
