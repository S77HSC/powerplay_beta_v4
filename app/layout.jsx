// app/layout.jsx
import "./globals.css";
import Script from "next/script";
import LayoutClient from "../components/LayoutClient";
import SharedStadiumBG from "../components/SharedStadiumBG"; // ⬅️ add this

export const metadata = {
  title: "PowerPlay Soccer",
  description: "Lobby",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1"
        />
        <Script id="init-ui-scale" strategy="afterInteractive">
          {`
            (function () {
              try {
                var W = 1440, H = 900, margin = 8;
                var apply = function() {
                  var vw = window.innerWidth;
                  var vh = Math.min(
                    window.innerHeight,
                    document.documentElement.clientHeight || Infinity,
                    (window.visualViewport && window.visualViewport.height) || Infinity
                  );
                  var s = Math.min((vw - margin*2) / W, (vh - margin*2) / H, 1);
                  if (!isFinite(s) || s <= 0) s = 1;
                  var root = document.documentElement;
                  root.style.setProperty('--ui-scale', String(s));
                  root.style.setProperty('--vh', String(vh));
                };
                apply();
                window.addEventListener('resize', apply);
                window.addEventListener('orientationchange', apply);
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body className="relative min-h-[100svh] w-full overflow-hidden bg-black text-white">
        {/* Stadium background sits once behind the whole app */}
        <SharedStadiumBG />

        {/* Foreground content */}
        <div className="relative z-10">
          <LayoutClient>{children}</LayoutClient>
        </div>
      </body>
    </html>
  );
}