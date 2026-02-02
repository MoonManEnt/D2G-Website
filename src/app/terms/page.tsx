"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Scale, FileText, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TermsPage() {
    const router = useRouter();

    const sections = [
        {
            title: "1. Acceptance of Terms",
            icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
            content: "By accessing and using Dispute2Go, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services."
        },
        {
            title: "2. Description of Service",
            icon: <FileText className="w-5 h-5 text-primary" />,
            content: "Dispute2Go provides an AI-powered platform to help users identify and dispute inaccuracies on their credit reports. We are not a credit repair organization as defined by the Credit Repair Organizations Act (CROA). We provide tools for self-help."
        },
        {
            title: "3. User Responsibilities",
            icon: <Scale className="w-5 h-5 text-amber-400" />,
            content: "You are responsible for the accuracy of the information you provide. You agree not to use the service for any fraudulent purposes or to misrepresent your identity."
        },
        {
            title: "4. Privacy & Data Security",
            icon: <Lock className="w-5 h-5 text-emerald-400" />,
            content: "Your privacy is important to us. Please review our Privacy Policy, which is incorporated into these Terms by reference, to understand how we collect and use your data."
        },
        {
            title: "5. Limitation of Liability",
            icon: <ShieldCheck className="w-5 h-5 text-red-400" />,
            content: "Dispute2Go is provided 'as is'. We do not guarantee specific results (e.g., credit score increases). We are not liable for any damages arising from your use of the platform."
        },
        {
            title: "6. Contact Us",
            icon: <Mail className="w-5 h-5 text-muted-foreground" />,
            content: "If you have any questions about these Terms, please contact us at support@dispute2go.com."
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="mb-8 hover:bg-background text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>

                <header className="mb-12 text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-extrabold tracking-tight text-foreground mb-4"
                    >
                        Terms of Service
                    </motion.h1>
                    <p className="text-muted-foreground">Last updated: January 22, 2026</p>
                </header>

                <div className="space-y-6">
                    {sections.map((section, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="bg-background border-border backdrop-blur-sm">
                                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                    {section.icon}
                                    <CardTitle className="text-lg font-semibold text-foreground">
                                        {section.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {section.content}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <footer className="mt-16 pt-8 border-t border-border text-center text-muted-foreground text-sm">
                    &copy; 2026 Dispute2Go. All rights reserved.
                </footer>
            </div>
        </div>
    );
}
