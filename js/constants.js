/**
 * 定数定義
 */
const CONSTANTS = {
  // Monday.com API（本番はプロキシ経由でCORS回避）
  MONDAY_API_URL: window.location.hostname === 'tp.polar-ai.app'
    ? '/api/monday'
    : 'https://api.monday.com/v2',

  // リマインド間隔（ミリ秒）
  DEFAULT_INTERVAL_MS: 15 * 60 * 1000, // 15分

  // 固定カラムID（全ボード共通 - API調査結果より）
  COLUMN_IDS: {
    PERSON: 'person',
    STATUS: 'status',
    DATE: ['date4', 'date0', 'date_mkybm0xa'],
    PRIORITY: ['priority', 'priority2', 'color_mkybqdk7', 'color_mkybqv1q', 'color_mkybb6cr', 'color_mkybag09', 'color_mkyb17nw']
  },

  // サブアイテムボード除外パターン
  EXCLUDED_BOARD_PATTERNS: ['サブアイテム'],

  // 優先度の値（大文字小文字両方対応）
  PRIORITY_VALUES: {
    CRITICAL: ['緊急', 'critical', 'Critical', 'CRITICAL', '最優先'],
    HIGH: ['高', 'high', 'High', 'HIGH', '重要']
  },

  // 完了ステータスの値
  COMPLETED_VALUES: ['完了', 'done', 'Done', 'DONE', 'Completed', 'completed', '済'],

  // 音声フレーズ（優しめ）
  REMINDER_PHRASES: [
    'タスクが残っています。{taskName}',
    '確認してください。{taskName}',
    '今日が期限です。{taskName}'
  ],

  // localStorage キー
  STORAGE_KEYS: {
    API_TOKEN: 'taskpurge_api_token',
    BOARD_ID: 'taskpurge_board_id',
    PRIORITY_COLUMN: 'taskpurge_priority_column',
    DATE_COLUMN: 'taskpurge_date_column',
    STATUS_COLUMN: 'taskpurge_status_column'
  },

  // エラーメッセージ
  ERROR_MESSAGES: {
    INVALID_TOKEN: 'APIトークンが無効です。再入力してください。',
    RATE_LIMIT: 'APIレート制限に達しました。しばらく待ってから再試行してください。',
    NETWORK_ERROR: 'ネットワークエラーが発生しました。',
    NO_SPEECH: '音声合成がサポートされていません。'
  }
};

// 変更防止
Object.freeze(CONSTANTS);
Object.freeze(CONSTANTS.COLUMN_IDS);
Object.freeze(CONSTANTS.PRIORITY_VALUES);
Object.freeze(CONSTANTS.STORAGE_KEYS);
Object.freeze(CONSTANTS.ERROR_MESSAGES);
