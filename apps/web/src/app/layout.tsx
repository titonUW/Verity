import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Verity - AI Content Authenticity',
  description: 'Detect AI-generated content and verify digital provenance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <nav className="border-b bg-card">
            <div className="container mx-auto flex h-16 items-center px-4">
              <a href="/" className="flex items-center space-x-2">
                <svg
                  className="h-8 w-8 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span className="text-xl font-bold">Verity</span>
              </a>
              <div className="ml-auto flex items-center space-x-4">
                <a
                  href="/check"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Check for AI
                </a>
                <a
                  href="/developer"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Developers
                </a>
                <a
                  href="/docs"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  API Docs
                </a>
              </div>
            </div>
          </nav>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
