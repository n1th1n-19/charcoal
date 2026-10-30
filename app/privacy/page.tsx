import type { Metadata } from "next";
import Legal from "@/components/Legal";
import { CONTACT_URL, NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `${NAME} processes images on your device. Your images are never uploaded or stored.`,
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <Legal title="Privacy policy">
      <p>{NAME} turns images into ASCII art inside your browser. Your images stay on your device.</p>
      <h2>Summary</h2>
      <ul>
        <li>Your images and drawings never leave your device.</li>
        <li>There are no accounts, no login, no cookies and no advertising.</li>
        <li>The site counts visits and measures speed anonymously, using Vercel.</li>
        <li>Background removal downloads a model from Hugging Face, only if you turn it on.</li>
      </ul>
      <h2>Visit and speed measurement</h2>
      <p>
        {NAME} uses Vercel Web Analytics to count visits. It records anonymous page views, such as the page visited, the
        referring site, and your country, browser, operating system and device type. It uses no cookies and does not
        identify you or track you across sites. <a href="https://vercel.com/docs/analytics/privacy-policy">Read how it works</a>.
      </p>
      <p>
        {NAME} also uses Vercel Speed Insights, which measures how fast pages load and respond, along with the page and
        your device type and connection. It uses no cookies. <a href="https://vercel.com/docs/speed-insights/privacy-policy">Read how it works</a>.
      </p>
      <h2>Your images</h2>
      <ul>
        <li>Images are processed by code running in your browser. They are never sent to us or to anyone else.</li>
        <li>{NAME} does not save your image, your settings or your drawing. Closing the tab clears them.</li>
        <li>Files are created only when you press a download or copy button, and go where your browser puts them.</li>
      </ul>
      <h2>Background removal</h2>
      <p>
        If you turn this on, your browser downloads a 176 MB model file once from Hugging Face, which may log your IP
        address like any website. The model then runs on your device. Your image is not sent anywhere. Your browser may
        keep the model in its normal cache.
      </p>
      <h2>Hosting</h2>
      <p>
        The site is hosted by Vercel, which keeps standard server logs, such as IP addresses and page requests, to run and
        protect the service. We do not use those logs to identify you.
      </p>
      <h2>Links to other sites</h2>
      <p>Links to GitHub and other sites lead outside {NAME}. Those sites have their own privacy policies.</p>
      <h2>Your choices</h2>
      <p>
        Nothing you make is stored, so there is nothing for us to delete. Visit counts are anonymous and cannot be traced
        back to you. A content or ad blocker will usually stop them from being sent at all.
      </p>
      <h2>Children</h2>
      <p>{NAME} does not knowingly collect personal information from anyone, including children.</p>
      <h2>Changes</h2>
      <p>If this policy changes, the new version will appear on this page with a new date.</p>
      <h2>Contact</h2>
      <p>Questions can be sent through <a href={CONTACT_URL}>GitHub</a>.</p>
    </Legal>
  );
}
