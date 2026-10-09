"use client";

import { useEffect } from "react";
import Link from "next/link";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

// Access control is enforced by the middleware (dashboard login required) and by /api/docs itself.
// The old client-side username/password check shipped its credentials in the JS bundle.
export default function ApiDocsPage() {
    useEffect(() => {
        // Suppress Swagger UI legacy lifecycle warnings (ModelCollapse)
        const originalWarn = console.warn;
        console.warn = (...args) => {
            if (typeof args[0] === 'string' &&
                args[0].includes('UNSAFE_componentWillReceiveProps') &&
                args[0].includes('ModelCollapse')) {
                return;
            }
            originalWarn(...args);
        };
        return () => {
            console.warn = originalWarn;
        };
    }, []);

    if (process.env.NEXT_PUBLIC_SWAGGER_ENABLED === "false") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-600">
                Swagger UI is disabled.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow-lg">
                <div className="container mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">W-AZAP API Documentation</h1>
                        <p className="text-blue-100 text-sm mt-1">
                            Interactive API documentation
                        </p>
                    </div>
                    <Link
                        href="/dashboard"
                        className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>

            <div className="container mx-auto">
                <SwaggerUI url="/api/docs" />
            </div>
        </div>
    );
}
