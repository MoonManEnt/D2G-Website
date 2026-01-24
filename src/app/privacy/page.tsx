"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Eye, Database, Share2, Bell, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
    const router = useRouter();

    const sections = [
        {
            title: "1. Information We Collect",
            icon: <Database className="w-5 h-5 text-blue-400" />,
            content: "We collect information you provide directly to us, including your name, contact information, and credit report data when you upload files to our platform."
        },
        {
            title: "2. How We Use Your Information",
            icon: <Eye className="w-5 h-5 text-emerald-400" />,
            content: "We use your information to provide our services, including analyzing credit reports for inaccuracies, generating dispute letters, and facilitating communication with credit bureaus."
        },
        {
            title: "3. Information Sharing",
            icon: <Share2 className="w-5 h-5 text-purple-400" />,
            content: "We do not sell your personal information. We may share data with service providers (e.g., Stripe, Resend) solely to fulfill our business obligations to you."
        },
        {
            title: "4. Data Security",
            icon: <Shield className="w-5 h-5 text-emerald-400" />,
            content: "We implement industry-standard security measures to protect your personal information and credit data from unauthorized access, disclosure, or destruction."
        },
        {
            title: "5. Your Privacy Rights",
            icon: <Bell className="w-5 h-5 text-amber-400" />,
            content: "You have the right to access, correct, or delete your personal information. You can manage your data settings through your account dashboard or by contacting us."
        },
        {
            title: "6. Changes to this Policy",
            icon: <Mail className="w-5 h-5 text-slate-400" />,
            content: "We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page."
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="mb-8 hover:bg-slate-900 text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>

                <header className="mb-12 text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-extrabold tracking-tight text-white mb-4"
                    >
                        Privacy Policy
                    </motion.h1>
                    <p className="text-slate-400">Last updated: January 22, 2026</p>
                </header>

                <div className="space-y-6">
                    {sections.map((section, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                    {section.icon}
                                    <CardTitle className="text-lg font-semibold text-white">
                                        {section.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-400 leading-relaxed">
                                        {section.content}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <footer className="mt-16 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
                    &copy; 2026 Dispute2Go. Your privacy is our priority.
                </footer>
            </div>
        </div>
    );
}
