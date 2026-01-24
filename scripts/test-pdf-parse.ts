/**
 * Manual Test Script for PDF Extraction
 * 
 * Usage: npx tsx scripts/test-pdf-parse.ts <path-to-pdf>
 */

import { extractTextFromPDF } from "../src/lib/pdf-extract";
import path from "path";

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Please provide a path to a PDF file");
        process.exit(1);
    }

    const filePath = args[0];
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

    console.log(`Testing PDF extraction for: ${absolutePath}`);

    try {
        const result = await extractTextFromPDF(absolutePath);

        console.log("-----------------------------------------");
        console.log("Extraction Result:", result.success ? "SUCCESS" : "FAILED");
        console.log("Page Count:", result.pageCount);
        console.log("Text Length:", result.text.length);
        console.log("Error:", result.error || "None");
        console.log("-----------------------------------------");

        if (result.success) {
            console.log("Preview (first 500 chars):");
            console.log(result.text.substring(0, 500));
        }

    } catch (error) {
        console.error("Test script error:", error);
    }
}

main();
