import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "NFT Airdrop Platform",
  description: "Claim and manage NFT airdrop campaigns",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
