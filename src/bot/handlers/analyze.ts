import type { AiAnalysisResult, PortfolioSummary } from '../../types/kite';

import db from '../../storage/db';
import geminiClient from '../../ai/geminiClient';
import portfolioAnalyzer from '../../ai/portfolioAnalyzer';

const { analyzePortfolio, askPortfolioQuestion } = portfolioAnalyzer;
const { getGeminiClient } = geminiClient;

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};

function isCustomQuestion(input: string) {
    if (!input || input.length === 0) return false;
    const standardModes = ['brief', 'detailed', 'full', 'help', 'credits'];
    if (standardModes.includes(input.toLowerCase())) return false;
    return true;
}

function formatBriefAnalysis(result: { portfolioSummary: PortfolioSummary; analysis: AiAnalysisResult }) {
    const { portfolioSummary, analysis } = result;
    let message = '*AI Portfolio Analysis*\n\n';
    message += `Diversification Score: *${analysis.diversification_score} / 10*\n`;
    message += `Risk Profile: *${analysis.risk_profile}*\n\n`;
    message += `Total Value: ${formatCurrency(portfolioSummary.total_value)}\n`;
    message += `P&L: ${portfolioSummary.unrealized_pnl >= 0 ? 'Profit' : 'Loss'} ${formatCurrency(portfolioSummary.unrealized_pnl)} (${portfolioSummary.unrealized_pnl_percent >= 0 ? '+' : ''}${portfolioSummary.unrealized_pnl_percent}%)\n\n`;

    if (analysis.key_insights && analysis.key_insights.length > 0) {
        message += '*Key Observations:*\n';
        analysis.key_insights.slice(0, 3).forEach(insight => {
            message += `- ${insight}\n`;
        });
        message += '\n';
    }

    message += '_Type /analyze detailed for full breakdown_\n';
    message += '_Or ask a question: /analyze what are my risky holdings?_\n\n';
    message += `_${analysis.disclaimer}_`;

    return message;
}

function formatDetailedAnalysis(result: { portfolioSummary: PortfolioSummary; analysis: AiAnalysisResult }) {
    const { portfolioSummary, analysis } = result;
    const messages: string[] = [];

    let msg1 = '*AI Portfolio Analysis - Detailed*\n\n';
    msg1 += `Diversification Score: *${analysis.diversification_score} / 10*\n`;
    msg1 += `Risk Profile: *${analysis.risk_profile}*\n\n`;
    msg1 += `Total Value: ${formatCurrency(portfolioSummary.total_value)}\n`;
    msg1 += `P&L: ${portfolioSummary.unrealized_pnl >= 0 ? 'Profit' : 'Loss'} ${formatCurrency(portfolioSummary.unrealized_pnl)} (${portfolioSummary.unrealized_pnl_percent >= 0 ? '+' : ''}${portfolioSummary.unrealized_pnl_percent}%)\n\n`;
    msg1 += '*Portfolio Allocation:*\n';
    msg1 += `- Equity: ${portfolioSummary.equity_allocation_percent}%\n`;
    msg1 += `- Mutual Funds: ${portfolioSummary.mutual_fund_allocation_percent}%\n`;
    msg1 += `- Top holding concentration: ${portfolioSummary.top_holding_concentration_percent}%\n`;
    msg1 += `- Top 3 concentration: ${portfolioSummary.top_3_concentration_percent}%`;
    messages.push(msg1);

    if (analysis.key_insights && analysis.key_insights.length > 0) {
        let msg2 = '*Key Insights*\n\n';
        analysis.key_insights.forEach((insight, index) => {
            msg2 += `${index + 1}. ${insight}\n`;
        });
        messages.push(msg2);
    }

    if (analysis.risk_analysis) {
        let msg3 = '*Risk Analysis*\n\n';
        if (analysis.risk_analysis.volatility_risk) msg3 += `Volatility Risk: *${analysis.risk_analysis.volatility_risk}*\n`;
        if (analysis.risk_analysis.sector_risk) msg3 += `Sector Risk: *${analysis.risk_analysis.sector_risk}*\n`;
        if (analysis.risk_analysis.concentration_risk) msg3 += `Concentration Risk: *${analysis.risk_analysis.concentration_risk}*\n`;
        messages.push(msg3);
    }

    if (analysis.allocation_analysis) {
        let msg4 = '*Allocation Analysis*\n\n';
        if (analysis.allocation_analysis.equity) msg4 += `Equity: *${analysis.allocation_analysis.equity}*\n`;
        if (analysis.allocation_analysis.mutual_funds) msg4 += `Mutual Funds: *${analysis.allocation_analysis.mutual_funds}*\n`;
        if (analysis.allocation_analysis.cash) msg4 += `Cash: *${analysis.allocation_analysis.cash}*\n`;
        messages.push(msg4);
    }

    if (analysis.improvement_suggestions && analysis.improvement_suggestions.length > 0) {
        let msg5 = '*Improvement Suggestions*\n\n';
        analysis.improvement_suggestions.forEach((suggestion, index) => {
            msg5 += `${index + 1}. ${suggestion}\n`;
        });
        msg5 += `\n_${analysis.disclaimer}_`;
        messages.push(msg5);
    }

    return messages;
}

function getHelpMessage() {
    return `*AI Portfolio Analysis*

*Commands:*
- \`/analyze\` - Quick portfolio summary
- \`/analyze detailed\` - Full breakdown
- \`/analyze credits\` - Check your AI credits

*Ask Questions:*
- \`/analyze what are my risky holdings?\`
- \`/analyze how is my portfolio diversified?\`
- \`/analyze list my top investments\`
- \`/analyze which sector am I overexposed to?\`

_Analysis is educational only, not investment advice._`;
}

function formatCreditsMessage(creditInfo: { credits: number; totalUsed: number }) {
    return `*Your AI Credits*

Available: *${creditInfo.credits}* credits
Total Used: ${creditInfo.totalUsed} analyses

Each AI query uses 1 credit.
New users receive ${db.DEFAULT_AI_CREDITS} free credits.`;
}

const analyze = async (ctx: any) => {
    const userId = ctx.from.id;
    const gemini = getGeminiClient();

    if (!gemini.isEnabled()) {
        return ctx.reply('*AI Analysis Unavailable*\n\nThe Gemini API key is not configured. Please add `GEMINI_API_KEY` to your environment variables.', { parse_mode: 'Markdown' });
    }

    const commandText = ctx.message.text;
    const firstSpaceIdx = commandText.indexOf(' ');
    const argsText = firstSpaceIdx > 0 ? commandText.slice(firstSpaceIdx + 1).trim() : '';

    if (argsText.toLowerCase() === 'help') {
        return ctx.reply(getHelpMessage(), { parse_mode: 'Markdown' });
    }

    if (argsText.toLowerCase() === 'credits') {
        const creditInfo = db.getAiCredits(userId);
        return ctx.reply(formatCreditsMessage(creditInfo), { parse_mode: 'Markdown' });
    }

    const creditInfo = db.getAiCredits(userId);
    if (creditInfo.credits <= 0) {
        return ctx.reply(`*No Credits Remaining*\n\nYou've used all your AI credits.\nTotal analyses done: ${creditInfo.totalUsed}`, { parse_mode: 'Markdown' });
    }

    try {
        if (isCustomQuestion(argsText)) {
            await ctx.reply('Thinking about your question...');
            const result = await askPortfolioQuestion(ctx.kite, argsText);

            if (result.isEmpty) {
                return ctx.reply('*No Holdings Found*\n\nAdd some investments first to ask questions about your portfolio.', { parse_mode: 'Markdown' });
            }

            db.consumeAiCredit(userId);
            const remaining = db.getAiCredits(userId);

            await ctx.reply(`Your Question: ${argsText}\n\n${result.answer}`);
            if (remaining.credits <= 3) {
                await ctx.reply(`${remaining.credits} AI credits remaining`, { parse_mode: 'Markdown' });
            }
        } else {
            const isDetailed = argsText.toLowerCase() === 'detailed' || argsText.toLowerCase() === 'full';

            await ctx.reply('Analyzing your portfolio with AI...');
            const result = await analyzePortfolio(ctx.kite, isDetailed ? 'detailed' : 'brief');

            if (result.isEmpty) {
                return ctx.reply('*No Holdings Found*\n\nAdd some equity or mutual fund investments to get AI-powered analysis.', { parse_mode: 'Markdown' });
            }

            db.consumeAiCredit(userId);
            const remaining = db.getAiCredits(userId);

            if (isDetailed) {
                const messages = formatDetailedAnalysis(result as { portfolioSummary: PortfolioSummary; analysis: AiAnalysisResult });
                for (const message of messages) {
                    await ctx.reply(message, { parse_mode: 'Markdown' });
                }
            } else {
                await ctx.reply(formatBriefAnalysis(result as { portfolioSummary: PortfolioSummary; analysis: AiAnalysisResult }), { parse_mode: 'Markdown' });
            }

            if (remaining.credits <= 3) {
                await ctx.reply(`${remaining.credits} AI credits remaining`, { parse_mode: 'Markdown' });
            }
        }
    } catch (err: any) {
        console.error('AI analysis error:', err);
        await ctx.reply(`*Analysis Failed*\n\n${err.message}`, { parse_mode: 'Markdown' });
    }
};

export = {
    analyze,
};
