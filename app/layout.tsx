import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue AI — Your AI Coding Agent",
  description: "Blue is an AI coding agent that helps you build ambitious software. Accelerate development by handing off tasks to Blue while you focus on architecture and decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="min-h-screen text-gray-100 flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
