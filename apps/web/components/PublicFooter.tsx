import Link from "next/link";
import { Logo } from "./Logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950 text-navy-200">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo variant="light" />
          <p className="max-w-xs text-sm text-navy-300">
            Verified legal help for Pakistan — AI guidance, document analysis, and secure consultations
            with Bar Council–certified lawyers.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Platform</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/user/find-lawyer" className="hover:text-white">Find a Lawyer</Link></li>
            <li><Link href="/#how-it-works" className="hover:text-white">How It Works</Link></li>
            <li><Link href="/register" className="hover:text-white">Register</Link></li>
            <li><Link href="/login" className="hover:text-white">Log In</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/about" className="hover:text-white">About</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li>support@lawyerly.pk</li>
            <li>Lahore, Pakistan</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-800/80">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-navy-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Lawyerly. All rights reserved.</p>
          <p>A Final Year Project · University of Management and Technology (UMT)</p>
        </div>
      </div>
    </footer>
  );
}
