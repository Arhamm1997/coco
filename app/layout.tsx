// Minimal root layout — this Next.js app is API-routes only.
// No UI is served from this backend.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
