
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { Session } from "next-auth";

/**
 * Context passed to the API handler
 */
export type AuthContext<TBody = any> = {
    session: Session;
    userId: string;
    organizationId: string;
    params: any;
    body: TBody;
};

/**
 * Options for the API wrapper
 */
interface ApiOptions<TBody> {
    schema?: z.ZodType<TBody, any, any>;
    roles?: string[];
}

/**
 * Higher-order function to wrap API routes with authentication and validation
 */
export function withAuth<TBody = any>(
    handler: (req: NextRequest, context: AuthContext<TBody>) => Promise<NextResponse>,
    options: ApiOptions<TBody> = {}
) {
    return async (req: NextRequest, context: { params: Promise<any> } | any) => {
        try {
            // 1. Authentication
            const session = await getServerSession(authOptions);

            if (!session?.user?.organizationId) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }

            // 2. Role Check
            if (options.roles && !options.roles.includes(session.user.role)) {
                return NextResponse.json(
                    { error: "Forbidden: Insufficient permissions" },
                    { status: 403 }
                );
            }

            // 3. Body Validation (for POST/PUT/PATCH)
            let body: TBody = {} as TBody;
            if (options.schema) {
                try {
                    const json = await req.json();
                    body = options.schema.parse(json);
                } catch (error) {
                    if (error instanceof z.ZodError) {
                        return NextResponse.json(
                            { error: "Validation Error", details: error.errors },
                            { status: 400 }
                        );
                    }
                    return NextResponse.json(
                        { error: "Invalid JSON body" },
                        { status: 400 }
                    );
                }
            }

            // 4. Resolve params if they are a promise (Next.js 15+ behavior)
            const params = context?.params ? await context.params : {};

            // 5. Call Handler
            return await handler(req, {
                session,
                userId: session.user.id,
                organizationId: session.user.organizationId,
                params,
                body, // Typed body from validation
            });

        } catch (error) {
            console.error("API Error:", error);
            return NextResponse.json(
                { error: "Internal Server Error" },
                { status: 500 }
            );
        }
    };
}
