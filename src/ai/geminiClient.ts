import type { AiAnalysisResult } from '../types/kite';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

const SYSTEM_PROMPT = `You are a SEBI-compliant financial portfolio analysis assistant.
You do NOT give buy or sell recommendations.
You provide educational, risk-based, and diversification insights only.
You must avoid stock-specific price targets.
Your goal is to analyze portfolio structure, risk, diversification, and allocation.
Always respond in valid JSON format matching the specified schema.`;

const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        diversification_score: { type: 'number', description: 'Score from 1-10' },
        risk_profile: { type: 'string', enum: ['Conservative', 'Moderate', 'Aggressive'] },
        key_insights: { type: 'array', items: { type: 'string' } },
        allocation_analysis: {
            type: 'object',
            properties: {
                equity: { type: 'string' },
                mutual_funds: { type: 'string' },
                cash: { type: 'string' },
            },
        },
        risk_analysis: {
            type: 'object',
            properties: {
                volatility_risk: { type: 'string' },
                sector_risk: { type: 'string' },
                concentration_risk: { type: 'string' },
            },
        },
        improvement_suggestions: { type: 'array', items: { type: 'string' } },
        disclaimer: { type: 'string' },
    },
    required: ['diversification_score', 'risk_profile', 'key_insights', 'improvement_suggestions', 'disclaimer'],
};

class GeminiClient {
    private enabled: boolean;
    private genAI?: GoogleGenerativeAI;
    private analysisModel?: any;
    private qaModel?: any;

    constructor() {
        if (!config.geminiApiKey) {
            this.enabled = false;
            console.warn('⚠️ Gemini API key not configured. AI analysis disabled.');
            return;
        }

        this.enabled = true;
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);

        this.analysisModel = this.genAI.getGenerativeModel({
            model: config.geminiModel || 'gemini-2.0-flash',
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: RESPONSE_SCHEMA as any,
            },
        });

        this.qaModel = this.genAI.getGenerativeModel({
            model: config.geminiModel || 'gemini-2.0-flash',
            systemInstruction: `You are a SEBI-compliant financial portfolio analysis assistant.
You do NOT give buy or sell recommendations.
You provide educational, risk-based, and diversification insights only.
You must avoid stock-specific price targets.

FORMATTING RULES (CRITICAL):
- Use PLAIN TEXT only; avoid markdown.
- Use emojis for structure (⚡️, 📊, ✅).
- Keep responses concise (around 300 words or less).
- Avoid asterisks (*), underscores (_), and backticks (\`).
- Favor all caps or emojis for emphasis.

End with a short disclaimer line.`,
        });
    }

    isEnabled() {
        return this.enabled;
    }

    async analyzePortfolio(portfolioData: unknown): Promise<AiAnalysisResult> {
        if (!this.enabled || !this.analysisModel) {
            throw new Error('Gemini API is not configured. Please add GEMINI_API_KEY to your environment.');
        }

        try {
            const prompt = `Analyze this portfolio and provide insights:

${JSON.stringify(portfolioData, null, 2)}

Cover:
1. Diversification quality (score 1-10)
2. Risk profile assessment
3. Key portfolio insights
4. Allocation analysis (equity vs mutual funds)
5. Risk analysis (volatility, sector concentration, leverage)
6. Improvement suggestions

Be educational and risk-focused; do not give buy/sell recommendations.`;

            const result = await this.analysisModel.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            const analysis = JSON.parse(text) as AiAnalysisResult;

            if (!analysis.disclaimer) {
                analysis.disclaimer = 'This is an educational analysis, not investment advice.';
            }

            return analysis;
        } catch (error: any) {
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

    async askQuestion(portfolioData: unknown, question: string) {
        if (!this.enabled || !this.qaModel) {
            throw new Error('Gemini API is not configured. Please add GEMINI_API_KEY to your environment.');
        }

        try {
            const prompt = `Here is the user's portfolio data:

${JSON.stringify(portfolioData, null, 2)}

User Question: ${question}

Answer based on the data. Be specific, cite holdings/values, stay concise (under 500 words), and do not give buy/sell recommendations.`;

            const result = await this.qaModel.generateContent(prompt);
            const response = result.response;
            let text = response.text();

            if (!text.toLowerCase().includes('disclaimer') && !text.toLowerCase().includes('investment advice')) {
                text += '\n\n⚠️ Disclaimer: This is educational analysis, not investment advice.';
            }

            return text;
        } catch (error: any) {
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

let instance: GeminiClient | null = null;

function getGeminiClient() {
    if (!instance) {
        instance = new GeminiClient();
    }

    return instance;
}

export = {
    GeminiClient,
    getGeminiClient,
};
