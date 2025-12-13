/**
 * AI Portfolio Analysis Command Handler
 * 
 * Handles /analyze and /aiportfolio commands.
 * Provides AI-powered portfolio insights using Gemini.
 * Supports custom questions about the portfolio.
 * Uses credit-based system stored in database.
 */

const { analyzePortfolio, askPortfolioQuestion } = require('../../ai/portfolioAnalyzer');
const { getGeminiClient } = require('../../ai/geminiClient');
const db = require('../../storage/db');

// Utility: Format currency in INR
const formatCurrency = val => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
};

/**
 * Determine if the input is a custom question vs a mode keyword
 */
function isCustomQuestion(input) {
    if (!input || input.length === 0) return false;
    
    // Standard modes are not questions
    const standardModes = ['brief', 'detailed', 'full', 'help', 'credits'];
    if (standardModes.includes(input.toLowerCase())) return false;
    
    // If it's longer than one word or contains question indicators, treat as question
    return true;
}

/**
 * Format brief analysis for Telegram
 */
function formatBriefAnalysis(result) {
    const { portfolioSummary, analysis } = result;

    let message = '📊 *AI Portfolio Analysis*\n\n';

    // Scores
    message += `📈 Diversification Score: *${analysis.diversification_score} / 10*\n`;
    message += `⚖️ Risk Profile: *${analysis.risk_profile}*\n\n`;

    // Portfolio summary
    message += `💰 Total Value: ${formatCurrency(portfolioSummary.total_value)}\n`;
    message += `📊 P&L: ${portfolioSummary.unrealized_pnl >= 0 ? '🟢' : '🔴'} ${formatCurrency(portfolioSummary.unrealized_pnl)} (${portfolioSummary.unrealized_pnl_percent >= 0 ? '+' : ''}${portfolioSummary.unrealized_pnl_percent}%)\n\n`;

    // Key insights (show first 3)
    if (analysis.key_insights && analysis.key_insights.length > 0) {
        message += '*Key Observations:*\n';
        analysis.key_insights.slice(0, 3).forEach(insight => {
            message += `• ${insight}\n`;
        });
        message += '\n';
    }

    message += `_Type /analyze detailed for full breakdown_\n`;
    message += `_Or ask a question: /analyze what are my risky holdings?_\n\n`;
    message += `⚠️ _${analysis.disclaimer}_`;

    return message;
}

/**
 * Format detailed analysis for Telegram (multiple messages)
 */
function formatDetailedAnalysis(result) {
    const { portfolioSummary, analysis } = result;
    const messages = [];

    // Message 1: Summary + Diversification
    let msg1 = '📊 *AI Portfolio Analysis - Detailed*\n\n';
    msg1 += `📈 Diversification Score: *${analysis.diversification_score} / 10*\n`;
    msg1 += `⚖️ Risk Profile: *${analysis.risk_profile}*\n\n`;
    msg1 += `💰 Total Value: ${formatCurrency(portfolioSummary.total_value)}\n`;
    msg1 += `📊 P&L: ${portfolioSummary.unrealized_pnl >= 0 ? '🟢' : '🔴'} ${formatCurrency(portfolioSummary.unrealized_pnl)} (${portfolioSummary.unrealized_pnl_percent >= 0 ? '+' : ''}${portfolioSummary.unrealized_pnl_percent}%)\n\n`;
    msg1 += '*Portfolio Allocation:*\n';
    msg1 += `• Equity: ${portfolioSummary.equity_allocation_percent}%\n`;
    msg1 += `• Mutual Funds: ${portfolioSummary.mutual_fund_allocation_percent}%\n`;
    msg1 += `• Top holding concentration: ${portfolioSummary.top_holding_concentration_percent}%\n`;
    msg1 += `• Top 3 concentration: ${portfolioSummary.top_3_concentration_percent}%`;
    messages.push(msg1);

    // Message 2: Key Insights
    if (analysis.key_insights && analysis.key_insights.length > 0) {
        let msg2 = '💡 *Key Insights*\n\n';
        analysis.key_insights.forEach((insight, idx) => {
            msg2 += `${idx + 1}. ${insight}\n`;
        });
        messages.push(msg2);
    }

    // Message 3: Risk Analysis
    if (analysis.risk_analysis) {
        let msg3 = '⚠️ *Risk Analysis*\n\n';
        if (analysis.risk_analysis.volatility_risk) {
            msg3 += `📉 Volatility Risk: *${analysis.risk_analysis.volatility_risk}*\n`;
        }
        if (analysis.risk_analysis.sector_risk) {
            msg3 += `🏢 Sector Risk: *${analysis.risk_analysis.sector_risk}*\n`;
        }
        if (analysis.risk_analysis.concentration_risk) {
            msg3 += `🎯 Concentration Risk: *${analysis.risk_analysis.concentration_risk}*\n`;
        }
        messages.push(msg3);
    }

    // Message 4: Allocation Analysis
    if (analysis.allocation_analysis) {
        let msg4 = '📊 *Allocation Analysis*\n\n';
        if (analysis.allocation_analysis.equity) {
            msg4 += `📈 Equity: *${analysis.allocation_analysis.equity}*\n`;
        }
        if (analysis.allocation_analysis.mutual_funds) {
            msg4 += `📁 Mutual Funds: *${analysis.allocation_analysis.mutual_funds}*\n`;
        }
        if (analysis.allocation_analysis.cash) {
            msg4 += `💵 Cash: *${analysis.allocation_analysis.cash}*\n`;
        }
        messages.push(msg4);
    }

    // Message 5: Improvement Suggestions
    if (analysis.improvement_suggestions && analysis.improvement_suggestions.length > 0) {
        let msg5 = '✨ *Improvement Suggestions*\n\n';
        analysis.improvement_suggestions.forEach((suggestion, idx) => {
            msg5 += `${idx + 1}. ${suggestion}\n`;
        });
        msg5 += `\n⚠️ _${analysis.disclaimer}_`;
        messages.push(msg5);
    }

    return messages;
}

/**
 * Show help message for analyze command
 */
function getHelpMessage() {
    return `🤖 *AI Portfolio Analysis*

*Commands:*
• \`/analyze\` - Quick portfolio summary
• \`/analyze detailed\` - Full breakdown
• \`/analyze credits\` - Check your AI credits

*Ask Questions:*
• \`/analyze what are my risky holdings?\`
• \`/analyze how is my portfolio diversified?\`
• \`/analyze list my top investments\`
• \`/analyze which sector am I overexposed to?\`

⚠️ _Analysis is educational only, not investment advice._`;
}

/**
 * Format credits message
 */
function formatCreditsMessage(creditInfo) {
    return `🎫 *Your AI Credits*

💳 Available: *${creditInfo.credits}* credits
📊 Total Used: ${creditInfo.totalUsed} analyses

Each AI query uses 1 credit.
New users receive ${db.DEFAULT_AI_CREDITS} free credits.`;
}

/**
 * Main command handler for /analyze and /aiportfolio
 */
const analyze = async ctx => {
    const userId = ctx.from.id;

    // Check if Gemini is enabled
    const gemini = getGeminiClient();
    if (!gemini.isEnabled()) {
        return ctx.reply(
            '❌ *AI Analysis Unavailable*\n\n' +
            'The Gemini API key is not configured. ' +
            'Please add `GEMINI_API_KEY` to your environment variables.',
            { parse_mode: 'Markdown' }
        );
    }

    // Parse command arguments
    const commandText = ctx.message.text;
    const firstSpaceIdx = commandText.indexOf(' ');
    const argsText = firstSpaceIdx > 0 ? commandText.slice(firstSpaceIdx + 1).trim() : '';

    // Check for help
    if (argsText.toLowerCase() === 'help') {
        return ctx.reply(getHelpMessage(), { parse_mode: 'Markdown' });
    }

    // Check for credits
    if (argsText.toLowerCase() === 'credits') {
        const creditInfo = db.getAiCredits(userId);
        return ctx.reply(formatCreditsMessage(creditInfo), { parse_mode: 'Markdown' });
    }

    // Check user credits
    const creditInfo = db.getAiCredits(userId);
    if (creditInfo.credits <= 0) {
        return ctx.reply(
            `🎫 *No Credits Remaining*\n\n` +
            `You've used all your AI credits.\n` +
            `Total analyses done: ${creditInfo.totalUsed}`,
            { parse_mode: 'Markdown' }
        );
    }

    try {
        // Determine if this is a standard analysis or a custom question
        if (isCustomQuestion(argsText)) {
            // Custom Q&A mode
            await ctx.reply('🤖 Thinking about your question...');

            const result = await askPortfolioQuestion(ctx.kite, argsText);

            if (result.isEmpty) {
                return ctx.reply(
                    '📭 *No Holdings Found*\n\n' +
                    'Add some investments first to ask questions about your portfolio.',
                    { parse_mode: 'Markdown' }
                );
            }

            // Consume credit only on successful response
            db.consumeAiCredit(userId);
            const remaining = db.getAiCredits(userId);

            // Send the AI's answer (plain text to avoid Markdown parsing issues with AI response)
            await ctx.reply(`💬 Your Question: ${argsText}\n\n${result.answer}`);
            
            // Show remaining credits if low
            if (remaining.credits <= 3) {
                await ctx.reply(`🎫 ${remaining.credits} AI credits remaining`, { parse_mode: 'Markdown' });
            }

        } else {
            // Standard analysis mode
            const isDetailed = argsText.toLowerCase() === 'detailed' || argsText.toLowerCase() === 'full';

            await ctx.reply('🤖 Analyzing your portfolio with AI...');

            const result = await analyzePortfolio(ctx.kite, isDetailed ? 'detailed' : 'brief');

            if (result.isEmpty) {
                return ctx.reply(
                    '📭 *No Holdings Found*\n\n' +
                    'Add some equity or mutual fund investments to get AI-powered analysis.',
                    { parse_mode: 'Markdown' }
                );
            }

            // Consume credit only on successful response
            db.consumeAiCredit(userId);
            const remaining = db.getAiCredits(userId);

            // Format and send response
            if (isDetailed) {
                const messages = formatDetailedAnalysis(result);
                for (const msg of messages) {
                    await ctx.reply(msg, { parse_mode: 'Markdown' });
                }
            } else {
                const message = formatBriefAnalysis(result);
                await ctx.reply(message, { parse_mode: 'Markdown' });
            }

            // Show remaining credits if low
            if (remaining.credits <= 3) {
                await ctx.reply(`🎫 ${remaining.credits} AI credits remaining`, { parse_mode: 'Markdown' });
            }
        }

    } catch (err) {
        // Don't consume credit on failure
        console.error('AI analysis error:', err);
        await ctx.reply(`❌ *Analysis Failed*\n\n${err.message}`, { parse_mode: 'Markdown' });
    }
};

module.exports = {
    analyze
};
