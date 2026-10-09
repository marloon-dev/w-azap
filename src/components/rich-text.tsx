import { Fragment } from "react";

/**
 * Renders a translated string with lightweight inline markup:
 * `**bold**` -> <strong>, and backtick-wrapped text -> <code>.
 * Lets translations keep emphasis without splitting sentences into fragments.
 */
export function RichText({ text, codeClassName = "bg-muted px-1 rounded" }: { text: string; codeClassName?: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
                if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className={codeClassName}>{part.slice(1, -1)}</code>;
                return <Fragment key={i}>{part}</Fragment>;
            })}
        </>
    );
}
