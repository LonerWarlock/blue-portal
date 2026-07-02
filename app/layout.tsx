import type { Metadata } from "next";
import "./globals.css";
import LoadingOverlay from "./components/LoadingOverlay";

export const metadata: Metadata = {
  title: "Blue AI — Let AI code for you while you think",
  description: "Blue's Autonomous Agents build entire features, run tests, and fix bugs by themselves. Accelerate development by handing off tasks to Blue while you focus on architecture.",
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
      <body className="min-h-screen text-gray-100 flex flex-col antialiased relative">
        <LoadingOverlay />
        {children}
      </body>
    </html>
  );
}
