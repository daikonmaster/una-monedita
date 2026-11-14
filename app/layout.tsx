import type { Metadata, Viewport } from "next";
import { Anton, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Anton: solo titulares y cifras grandes (.display). JetBrains Mono: toda la UI.
const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const jetbrains = JetBrains_Mono({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-jb" });

export const metadata: Metadata = {
  title: "UnaMonedita · Finanzas personales",
  description: "Tu app personal de finanzas conectada a Notion",
  robots: "noindex, nofollow",
  appleWebApp: {
    capable: true,
    title: "UnaMonedita",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

// Resuelve tema y acento antes del primer paint (evita el destello claro).
// um.theme: "system" | "light" | "dark" (default system); um.accent: verde | teal | grafito (cualquier otro valor, p. ej. el viejo "bosque", cae en verde).
const THEME_BOOTSTRAP = `(function(){try{var d=document.documentElement,t=localStorage.getItem("um.theme")||"system",a=localStorage.getItem("um.accent")||"verde";if(a!=="verde"&&a!=="teal"&&a!=="grafito")a="verde";if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t;d.dataset.accent=a;}catch(e){document.documentElement.dataset.theme="light"}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${anton.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
