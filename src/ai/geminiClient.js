/**
 * Gemini AI Client
 * 
 * Wrapper for Google Generative AI SDK.
 * Handles portfolio analysis requests to Gemini.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

// System prompt for SEBI-compliant analysis
const SYSTEM_PROMPT = `You are a SEBI-compliant financial portfolio analysis assistant.
You do NOT give buy or sell recommendations.
You provide educational, risk-based, and diversification insights only.
You must avoid stock-specific price targets.
Your goal is to analyze portfolio structure, risk, diversification, and allocation.
Always respond in valid JSON format matching the specified schema.`;

// Expected response schema
const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        diversification_score: { type: "number", description: "Score from 1-10" },
        risk_profile: { type: "string", enum: ["Conservative", "Moderate", "Aggressive"] },
        key_insights: { type: "array", items: { type: "string" } },
        allocation_analysis: {
            type: "object",
            properties: {
                equity: { type: "string" },
                mutual_funds: { type: "string" },
                cash: { type: "string" }
            }
        },
        risk_analysis: {
            type: "object",
            properties: {
                volatility_risk: { type: "string" },
                sector_risk: { type: "string" },
                concentration_risk: { type: "string" }
            }
        },
        improvement_suggestions: { type: "array", items: { type: "string" } },
        disclaimer: { type: "string" }
    },
    required: ["diversification_score", "risk_profile", "key_insights", "improvement_suggestions", "disclaimer"]
};

class GeminiClient {
    constructor() {
        if (!config.geminiApiKey) {
            this.enabled = false;
            console.warn('⚠️ Gemini API key not configured. AI analysis disabled.');
            return;
        }

        this.enabled = true;
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        
        // Model for structured analysis (JSON response)
        this.analysisModel = this.genAI.getGenerativeModel({
            model: config.geminiModel || 'gemini-2.0-flash',
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA
            }
        });

        // Model for free-form Q&A (text response)
        this.qaModel = this.genAI.getGenerativeModel({
            model: config.geminiModel || 'gemini-2.0-flash',
            systemInstruction: `You are a SEBI-compliant financial portfolio analysis assistant.
You do NOT give buy or sell recommendations.
You provide educational, risk-based, and diversification insights only.
You must avoid stock-specific price targets.

FORMATTING RULES (CRITICAL):
- Use PLAIN TEXT only, no markdown syntax
- Use emojis for visual structure (📊 📈 📉 ⚠️ ✅ 🔴 🟢 💰)
- Use simple bullet points with "•" character
- Use line breaks for sections
- Keep responses concise (under 300 words)
- Do NOT use asterisks (*), underscores (_), or backticks (\`)
- For emphasis, use CAPS or emojis instead of bold/italic

Always end with a brief disclaimer line.`
        });
    }

    /**
     * Check if Gemini is available
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Analyze portfolio using Gemini (structured JSON response)
     * @param {Object} portfolioData - Aggregated portfolio data
     * @returns {Object} AI analysis response
     */
    async analyzePortfolio(portfolioData) {
        if (!this.enabled) {
            throw new Error('Gemini API is not configured. Please add GEMINI_API_KEY to your environment.');
        }

        try {
            const prompt = `Analyze this portfolio and provide insights:

${JSON.stringify(portfolioData, null, 2)}

Provide a comprehensive analysis covering:
1. Diversification quality (score 1-10)
2. Risk profile assessment
3. Key insights about the portfolio structure
4. Allocation analysis (equity vs mutual funds)
5. Risk analysis (volatility, sector concentration, leverage)
6. Specific improvement suggestions

Important: Be educational and risk-focused. Do not provide buy/sell recommendations.`;

            const result = await this.analysisModel.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // Parse JSON response
            const analysis = JSON.parse(text);

            // Ensure disclaimer is present
            if (!analysis.disclaimer) {
                analysis.disclaimer = 'This is an educational analysis, not investment advice.';
            }

            return analysis;
        } catch (error) {
            console.error('Gemini API error:', error.message);
            
            if (error.message.includes('API key')) {
                throw new Error('Invalid Gemini API key. Please check your configuration.');
            }
            
            if (error.message.includes('quota') || error.message.includes('rate')) {
                throw new Error('Gemini API rate limit reached. Please try again later.');
            }

            throw new Error(`AI analysis failed: ${error.message}`);
        }
    }

    /**
     * Ask a custom question about the portfolio (free-form text response)
     * @param {Object} portfolioData - Aggregated portfolio data
     * @param {string} question - User's question
     * @returns {string} AI text response
     */
    async askQuestion(portfolioData, question) {
        if (!this.enabled) {
            throw new Error('Gemini API is not configured. Please add GEMINI_API_KEY to your environment.');
        }

        try {
            const prompt = `Here is the user's portfolio data:

${JSON.stringify(portfolioData, null, 2)}

User Question: ${question}

Answer the question based on the portfolio data above. Be specific and reference actual holdings/values from the data when relevant. Keep your response concise (under 500 words). Do not provide buy/sell recommendations or price targets.`;

            const result = await this.qaModel.generateContent(prompt);
            const response = result.response;
            let text = response.text();

            // Ensure disclaimer is present
            if (!text.includes('disclaimer') && !text.includes('Disclaimer') && !text.includes('not investment advice')) {
                text += '\n\n⚠️ _Disclaimer: This is educational analysis, not investment advice._';
            }

            return text;
        } catch (error) {
            console.error('Gemini Q&A error:', error.message);
            
            if (error.message.includes('API key')) {
                throw new Error('Invalid Gemini API key. Please check your configuration.');
            }
            
            if (error.message.includes('quota') || error.message.includes('rate')) {
                throw new Error('Gemini API rate limit reached. Please try again later.');
            }

            throw new Error(`AI query failed: ${error.message}`);
        }
    }
}

// Singleton instance
let instance = null;

function getGeminiClient() {
    if (!instance) {
        instance = new GeminiClient();
    }
    return instance;
}

module.exports = {
    GeminiClient,
    getGeminiClient
};
