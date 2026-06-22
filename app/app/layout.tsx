import type { Metadata } from "next";
import { Protest_Strike, Radio_Canada_Big } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const protestStrike = Protest_Strike({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-protest-strike",
});

const radioCanada = Radio_Canada_Big({
  subsets: ["latin"],
  variable: "--font-radio-canada",
});

export const metadata: Metadata = {
  title: "Custom CRM",
  description: "Campaign-centric email outreach CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${protestStrike.variable} ${radioCanada.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
