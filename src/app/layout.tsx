import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BatteryProvider } from "@/context/BatteryContext";
import { OctopusProvider } from "@/context/OctopusContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Battery Dashboard",
  description: "GivEnergy All-in-One V2 battery monitoring and control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <BatteryProvider>
          <OctopusProvider>{children}</OctopusProvider>
        </BatteryProvider>
      </body>
    </html>
  );
}
