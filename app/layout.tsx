import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue AI — Developer Console",
  description: "Manage your keys, wallets, and deployments for Blue AI Coding Assistant.",
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
