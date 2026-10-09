import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata = {
    title: "Terms of Service | W-AZAP",
    description: "Terms of Service for W-AZAP self-hosted WhatsApp Gateway. Usage guidelines, security requirements, and acceptable use policy.",
    openGraph: {
        title: "Terms of Service | W-AZAP",
        description: "Terms of Service for W-AZAP self-hosted WhatsApp Gateway.",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Terms of Service | W-AZAP",
        description: "Terms of Service for W-AZAP self-hosted WhatsApp Gateway.",
    },
};

export default function TermsPage() {
    return (
        <LegalPage title="Terms of Service" updated="2026-10-09">

                        <p className="lead">
                            Welcome to W-AZAP. By accessing or using our WhatsApp Gateway platform, you agree to be bound by these Terms. If you do not agree, please do not use the service.
                        </p>

                        <h2>
                            1. Data Security & Responsibility
                        </h2>
                        <p>
                            Security forms the core of our service. As a self-hosted platform, W-AZAP ensures that your data remains strictly within your own infrastructure.
                        </p>
                        <ul>
                            <li><strong>Your Data is Yours:</strong> We do not track, intercept, or sell your WhatsApp messages, contact lists, or session data. Your information is secure and not misused.</li>
                            <li><strong>Safe Usage:</strong> You are responsible for ensuring your hardware and server environments are properly secured.</li>
                            <li><strong>Authentication:</strong> You must safeguard your account credentials. Do not share your login details with unauthorized personnel.</li>
                        </ul>

                        <h2>2. Acceptable Use Policy</h2>
                        <p>
                            When utilizing W-AZAP's API, auto-replies, and broadcasting capabilities, you agree to abide by WhatsApp's official Terms of Service and Anti-Spam policies. You agree not to:
                        </p>
                        <ul>
                            <li>Send unsolicited "spam" messages or bulk promotional campaigns to users who have not explicitly opted-in.</li>
                            <li>Use the platform to distribute malicious software, phishing links, or illegal content.</li>
                            <li>Attempt to reverse-engineer the core API or overload the service with excessive requests.</li>
                        </ul>

                        <h2>3. Account Integrity</h2>
                        <p>
                            W-AZAP provides tools to manage multiple WhatsApp sessions. It is crucial to monitor your active devices. If you suspect unauthorized access to your gateway dashboard, immediately change your password and revoke any connected WhatsApp sessions from your physical device.
                        </p>

                        <h2>4. Disclaimers and Limitations</h2>
                        <p>
                            W-AZAP is provided "as is" and without warranties of any kind. We utilize third-party libraries (such as Baileys) to connect to WhatsApp web protocols. Changes to WhatsApp's internal systems may occasionally disrupt service. We are not liable for any account suspensions or bans imposed by WhatsApp as a result of your usage.
                        </p>

                        <div className="not-prose mt-12 rounded-xl border bg-card p-6">
                            <p className="font-semibold mb-2">Have questions about these terms?</p>
                            <p className="text-sm text-muted-foreground mb-0">Please review our <Link href="/docs" className="font-medium text-primary underline-offset-4 hover:underline">Documentation</Link> or reach out to the project maintainers for further clarification.</p>
                        </div>
        </LegalPage>
    );
}
