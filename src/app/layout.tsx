import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Min Svampkarta - Personal Mushroom Map',
  description: 'Create your personal mushroom map by marking places where you found mushrooms',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Min Svampkarta'
  },
  formatDetection: {
    telephone: false
  },
  icons: [
    {
      rel: 'apple-touch-icon',
      url: '/icon-192.png'
    }
  ]
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-LZKF4RSRBE"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-LZKF4RSRBE');
            `,
          }}
        />
      </head>
      <body className="overflow-hidden font-sans">{children}</body>
    </html>
  )
}
