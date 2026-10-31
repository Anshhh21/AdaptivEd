import React from "react";
import "./globals.css";

export const metadata = {
  title: "AdaptivEd (NeuroLearn) | AI-Integrated Adaptive Learning Platform",
  description:
    "Enterprise-grade adaptive learning platform personalizing content delivery via real-time behavioral comprehension scoring and verified skills.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

