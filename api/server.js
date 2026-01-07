/**
 * Task Purge - Claude API Proxy Server
 *
 * フロントエンドからのリクエストを受けてClaude APIを呼び出し、
 * タスクリマインドメッセージを生成して返す。
 */
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

// 環境変数チェック
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
if (!CLAUDE_API_KEY) {
  console.error('[ERROR] CLAUDE_API_KEY is not set');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Claude クライアント初期化
const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY
});

// ミドルウェア
app.use(express.json());
app.use(cors({
  origin: [
    'https://tp.polar-ai.app',
    'http://localhost:8080' // 開発用
  ],
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// 定数
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
const MAX_TOKENS = 100;
const TIMEOUT_MS = 5000;

/**
 * POST /api/claude
 * タスク情報からリマインドメッセージを生成
 */
app.post('/api/claude', async (req, res) => {
  const { boardName, taskName, priority, isOverdue } = req.body;

  // バリデーション
  if (!taskName) {
    return res.status(400).json({ error: 'taskName is required' });
  }

  const priorityText = priority === 'critical' ? '緊急' : '高優先度';
  const deadlineText = isOverdue ? '期限切れ（過ぎています！）' : '今日';

  const prompt = `タスクリマインダーです。以下のタスクを緊急感を持って50文字以内で伝えてください。
面白く、でも失礼なく。語尾は「ですよ！」「ください！」など。
${isOverdue ? '【重要】期限切れなので特に急いでいることを強調してください。' : ''}

ボード名（案件）: ${boardName || '不明'}
タスク名: ${taskName}
優先度: ${priorityText}
期限: ${deadlineText}

メッセージのみを出力してください。`;

  try {
    // タイムアウト付きでClaude API呼び出し
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }]
    });

    clearTimeout(timeoutId);

    const message = response?.content?.[0]?.text;
    if (message) {
      return res.json({ message: message.trim() });
    }

    return res.status(500).json({ error: 'Empty response from Claude' });
  } catch (error) {
    console.error('[ERROR] Claude API:', error.message || error);

    // エラー種別に応じたレスポンス
    if (error.status === 401) {
      return res.status(500).json({ error: 'Invalid API key' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }

    return res.status(500).json({ error: 'Claude API error' });
  }
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`[INFO] Task Purge API running on port ${PORT}`);
});
