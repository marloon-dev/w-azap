import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { DocsClient } from './docs-client';
import { ThemeToggle } from '@/components/theme-toggle';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { getTranslations } from '@/lib/i18n/server';

export const metadata = {
    title: 'API Documentation - W-AZAP',
    description: 'Complete API reference for W-AZAP WhatsApp Gateway. Includes endpoints for messaging, groups, contacts, media, and webhooks.',
    openGraph: {
        title: 'API Documentation - W-AZAP',
        description: 'Complete API reference for W-AZAP WhatsApp Gateway.',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'API Documentation - W-AZAP',
        description: 'Complete API reference for W-AZAP WhatsApp Gateway.',
    },
};

// Interface for Nested TOC
export interface TocItem {
    text: string;
    id: string;
}

export interface TocSection {
    title: string;
    id: string;
    items: TocItem[];
}

export default async function PublicDocsPage() {
    const { t } = await getTranslations();
    const filePath = path.join(process.cwd(), 'docs', 'API_DOCUMENTATION.md');
    const packagePath = path.join(process.cwd(), 'package.json');
    let content = '';
    let version = 'v1.0.0';

    try {
        content = fs.readFileSync(filePath, 'utf8');
        // Strip extraneous backslash escapes used for markdown brackets
        content = content.replace(/\\(\[)/g, '$1').replace(/\\(])/g, '$1');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        version = `v${packageJson.version}`;
    } catch (err) {
        content = '# Error\n\nCould not load documentation file.';
        console.error("Error loading docs:", err);
    }

    // Nested TOC Generation
    const toc: TocSection[] = [];
    let currentSection: TocSection | null = null;

    content.split('\n').forEach(line => {
        if (line.startsWith('## ')) {
            // H2 - New Section
            const text = line.replace(/^## /, '').trim();
            const id = text.toLowerCase().replace(/[^\w]+/g, '-');

            // If we have a current section, push it to toc
            if (currentSection) {
                toc.push(currentSection);
            }

            currentSection = {
                title: text,
                id: id,
                items: []
            };
        } else if (line.startsWith('### ') && currentSection) {
            // H3 - Item in current section
            const text = line.replace(/^### /, '').trim();
            const id = text.toLowerCase().replace(/[^\w]+/g, '-');
            currentSection.items.push({ text, id });
        }
    });

    // Push the last section if exists
    if (currentSection) {
        toc.push(currentSection);
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link href="/" className="flex items-center gap-2.5 rounded-md">
                        <BrandMark className="size-8" />
                        <span className="text-[15px] font-semibold tracking-tight text-foreground">W-AZAP</span>
                        <span className="text-sm text-muted-foreground" data-numeric>{version}</span>
                    </Link>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <ThemeToggle />
                        <Link href="/swagger" className="hidden rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
                            Swagger UI
                        </Link>
                        <Button asChild size="sm" className="ml-1">
                            <Link href="/dashboard">{t("common.dashboard")}</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <DocsClient content={content} toc={toc} />
        </div>
    );
}
