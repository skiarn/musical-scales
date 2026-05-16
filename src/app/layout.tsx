"use client";

// import type { Metadata } from "next";
import "./globals.css";

// export const metadata: Metadata = {
//   title: "Musical Scales App",
//   description: "A Next App project for musical scales",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
