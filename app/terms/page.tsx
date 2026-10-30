import type { Metadata } from "next";
import Legal from "@/components/Legal";
import { CONTACT_URL, NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: `The terms for using ${NAME}, a free in-browser image-to-ASCII tool.`,
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <Legal title="Terms and conditions">
      <p>By using {NAME}, you agree to these terms. If you do not agree, please do not use it.</p>
      <h2>The service</h2>
      <p>{NAME} is a free tool that runs in your browser. It may change or stop at any time.</p>
      <h2>Your content</h2>
      <ul>
        <li>You keep all rights to the images you use and the art you make. We claim none.</li>
        <li>Only use images you own or have permission to use.</li>
        <li>You are responsible for what you make and how you use it.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>
        Do not use {NAME} for anything unlawful, or to harm others, including art that harasses a person or infringes
        their rights. Do not attempt to disrupt the site.
      </p>
      <h2>No warranty</h2>
      <p>{NAME} is provided as is, without warranties of any kind. Results, including background removal, may be imperfect.</p>
      <h2>Limitation of liability</h2>
      <p>To the extent the law allows, we are not liable for any loss arising from your use of {NAME}.</p>
      <h2>Open source components</h2>
      <ul>
        <li>U-2-Net model, Apache-2.0</li>
        <li>ONNX Runtime Web, MIT</li>
        <li>anime.js, MIT</li>
        <li>Next.js and React, MIT</li>
        <li>Recursive typeface, SIL Open Font License</li>
      </ul>
      <h2>Changes</h2>
      <p>If these terms change, the new version will appear on this page with a new date.</p>
      <h2>Contact</h2>
      <p>Questions can be sent through <a href={CONTACT_URL}>GitHub</a>.</p>
    </Legal>
  );
}
