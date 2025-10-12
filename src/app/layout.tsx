import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "../components/AppHeader";

export const metadata: Metadata = {
  title: "Crisp",
  description: "Practice speaking with instant feedback",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}


