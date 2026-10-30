import App from "@/components/App";
import BurnLoader from "@/components/BurnLoader";
import { DESCRIPTION, NAME, SITE_URL } from "@/lib/site";

const schema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <noscript>{NAME} needs JavaScript, because it processes images in your browser.</noscript>
      <BurnLoader />
      <App />
    </>
  );
}
