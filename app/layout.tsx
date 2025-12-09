import type { Metadata } from "next"
import { JetBrains_Mono, Poppins } from "next/font/google"
import "./globals.css"

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
})

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "600"],
})

export const metadata: Metadata = {
  title: {
    default: "Wael Assaf's Blog",
    template: "%s | Wael Assaf's Blog",
  },
  description: "A minimal dev blog about software engineering, tutorials, and thoughts.",
  openGraph: {
    title: "Wael's Blog",
    description: "A minimal dev blog about software engineering, tutorials, and thoughts.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wael's Blog",
    description: "A minimal dev blog about software engineering, tutorials, and thoughts.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${jetbrainsMono.variable} ${poppins.variable} bg-neutral-100`}
      >
        {children}
      </body>
    </html>
  )
}
