import type { Metadata } from "next";
import Legal from "@/components/Legal";
import { CONTACT_URL, NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `${NAME} processes images on your device. Nothing is uploaded, stored or tracked.`,
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <Legal title="Privacy policy">
      <p>{NAME} turns images into ASCII art inside your browser. Your images stay on your device.</p>
      <h2>What we collect</h2>
      <p>Nothing. {NAME} has no accounts, no login, no cookies, no analytics and no advertising.</p>
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
        The company hosting this site may keep standard server logs, such as IP addresses and page requests, to run and
        protect the service. We do not use those logs to identify you.
      </p>
      <h2>Children</h2>
      <p>{NAME} collects no personal information from anyone, including children.</p>
      <h2>Changes</h2>
      <p>If this policy changes, the new version will appear on this page with a new date.</p>
      <h2>Contact</h2>
      <p>Questions can be sent through <a href={CONTACT_URL}>GitHub</a>.</p>
    </Legal>
  );
}
