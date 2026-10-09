import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata = {
    title: "Privacy Policy | W-AZAP",
    description: "Privacy Policy for W-AZAP self-hosted WhatsApp Gateway. Zero-tracking architecture, data ownership, and security practices.",
    openGraph: {
        title: "Privacy Policy | W-AZAP",
        description: "Privacy Policy for W-AZAP self-hosted WhatsApp Gateway.",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Privacy Policy | W-AZAP",
        description: "Privacy Policy for W-AZAP self-hosted WhatsApp Gateway.",
    },
};

export default function PrivacyPage() {
    return (
        <LegalPage title="Privacy Policy" updated="2026-10-09">

                        <p className="lead">
                            At W-AZAP, we believe that your data is your property. This Privacy Policy details the strict boundaries regarding how information is handled when using our open-source, self-hosted WhatsApp Gateway.
                        </p>

                        <h2>
                            1. Zero-Tracking Architecture
                        </h2>
                        <p>
                            Because W-AZAP is designed to be <strong>self-hosted</strong>, all core data processing occurs exclusively on the hardware where you deploy the application.
                        </p>
                        <ul>
                            <li><strong>No Centralized Telemetry:</strong> The creators of W-AZAP do not receive telemetry, analytics, or usage reports about your WhatsApp interactions.</li>
                            <li><strong>Absolute Data Ownership:</strong> Your contacts, messages, schedules, and auto-replies remain in your own database. We cannot and will not access it.</li>
                        </ul>

                        <h2>2. Data We Process Locally</h2>
                        <p>
                            When you deploy the gateway, the application running on your server interacts with:
                        </p>
                        <ul>
                            <li><strong>Authentication Credentials:</strong> Passwords you create for the dashboard are securely hashed using bcrypt before being stored in your local database.</li>
                            <li><strong>WhatsApp Sessions:</strong> W-AZAP acts as a bridge to WhatsApp Web. The session tokens (keys) necessary to maintain this connection are stored locally on your server.</li>
                            <li><strong>Communication Logs:</strong> Messages sent and received via the gateway are logged within your local database to provide you with historical data and webhook functionality.</li>
                        </ul>

                        <h2>3. Protecting Your Information</h2>
                        <p>
                            While W-AZAP is built with modern security practices, the ultimate safety of your data depends on your hosting environment. We strongly recommend:
                        </p>
                        <ul>
                            <li>Deploying the application behind a reverse proxy with enforced <strong>SSL/TLS encryption</strong> (HTTPS).</li>
                            <li>Securing the host server with firewalls and SSH key authentication.</li>
                            <li>Keeping the underlying operating system and Node.js environment constantly updated.</li>
                        </ul>

                        <h2>4. Third-Party Integrations</h2>
                        <p>
                            W-AZAP utilizes the <code>@whiskeysockets/baileys</code> library to communicate directly with WhatsApp's servers. By using this gateway, your server will establish a direct web-socket connection to WhatsApp. Please be aware that your use of WhatsApp is still subject to Meta's Privacy Policy.
                        </p>

                        <div className="not-prose mt-12 rounded-xl border bg-card p-6">
                            <p className="font-semibold mb-2">Need Further Details?</p>
                            <p className="text-sm text-muted-foreground mb-0">If you have specific questions about data handling or wish to audit the code, please visit our <Link href="https://github.com/marloon-dev/w-azap" className="font-medium text-primary underline-offset-4 hover:underline">GitHub Repository</Link>.</p>
                        </div>
        </LegalPage>
    );
}
