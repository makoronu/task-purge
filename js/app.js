/**
 * メインアプリケーション（全ボード監視版）
 */
const App = {
  /** @type {number|null} */
  _intervalId: null,

  /** @type {number|null} */
  _countdownId: null,

  /** @type {boolean} */
  _isChecking: false,

  /** @type {Date|null} */
  _nextCheckTime: null,

  /** @type {Object} */
  _settings: null,

  /** @type {number} */
  _intervalMs: null,

  /** @type {Object} */
  _elements: {},

  /**
   * アプリケーション初期化
   */
  async init() {
    this._cacheElements();
    this._bindEvents();
    await this._loadSettings();
    await Speech.init();
  },

  /**
   * DOM要素をキャッシュ
   */
  _cacheElements() {
    this._elements = {
      startBtn: document.getElementById('start-btn'),
      stopBtn: document.getElementById('stop-btn'),
      statusBadge: document.getElementById('status-badge'),
      countdown: document.getElementById('countdown'),
      taskList: document.getElementById('task-list'),
      errorMessage: document.getElementById('error-message')
    };
  },

  /**
   * イベントをバインド
   */
  _bindEvents() {
    this._elements.startBtn.addEventListener('click', () => this._startMonitoring());
    this._elements.stopBtn.addEventListener('click', () => this._stopMonitoring());
  },

  /**
   * 設定を読み込み（Firestoreから）
   */
  async _loadSettings() {
    try {
      const user = Auth.getCurrentUser();
      if (!user) return;

      const db = firebase.firestore();
      const doc = await db.collection('settings').doc(user.uid).get();

      if (doc.exists) {
        this._settings = doc.data();
        // リマインド間隔を設定（デフォルト15分）
        const minutes = this._settings.intervalMinutes || 15;
        this._intervalMs = minutes * 60 * 1000;
        // Claude APIキーをSpeechモジュールに設定
        Speech.setClaudeApiKey(this._settings.claudeApiKey);
        this._hideError();
      } else {
        this._showError('設定が未完了です。右上の歯車アイコンから設定してください。');
        this._elements.startBtn.disabled = true;
      }
    } catch (error) {
      this._showError('設定の読み込みに失敗しました: ' + error.message);
    }
  },

  /**
   * 設定が完了しているか確認（簡素化版）
   * @returns {boolean}
   */
  _isConfigured() {
    return !!(
      this._settings &&
      this._settings.apiToken &&
      this._settings.userId
    );
  },

  /**
   * 監視開始
   */
  async _startMonitoring() {
    if (!this._isConfigured()) {
      this._showError('設定が完了していません。管理画面でAPIトークンと監視対象ユーザーを設定してください。');
      return;
    }

    this._elements.startBtn.disabled = true;
    this._elements.stopBtn.disabled = false;
    this._elements.statusBadge.textContent = '監視中';
    this._elements.statusBadge.classList.remove('badge-stopped');
    this._elements.statusBadge.classList.add('badge-running');

    // 初回チェック
    await this._checkTasks();

    // 定期チェック開始
    this._intervalId = setInterval(() => this._checkTasks(), this._intervalMs);

    // カウントダウン開始
    this._startCountdown();
  },

  /**
   * 監視停止
   */
  _stopMonitoring() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._countdownId) {
      clearInterval(this._countdownId);
      this._countdownId = null;
    }

    this._elements.startBtn.disabled = false;
    this._elements.stopBtn.disabled = true;
    this._elements.statusBadge.textContent = '停止中';
    this._elements.statusBadge.classList.remove('badge-running');
    this._elements.statusBadge.classList.add('badge-stopped');
    this._elements.countdown.textContent = '--:--';
  },

  /**
   * タスクチェック
   */
  async _checkTasks() {
    // 二重実行防止
    if (this._isChecking) return;
    this._isChecking = true;

    try {
      // 全ボードからタスク取得
      const allItems = await this._fetchAllBoardsItems();
      const urgentTasks = this._filterUrgentTasks(allItems);

      this._renderTasks(urgentTasks);

      if (urgentTasks.length > 0) {
        await Speech.remindTasks(urgentTasks);
      }

      // 次回チェック時間を更新
      this._nextCheckTime = new Date(Date.now() + this._intervalMs);
    } catch (error) {
      this._showError(error.message);
    } finally {
      this._isChecking = false;
    }
  },

  /**
   * 全ボードからアイテム取得
   * @returns {Promise<Array>}
   */
  async _fetchAllBoardsItems() {
    // 1. 全ボード取得
    const boardsQuery = `query { boards(limit: 100) { id name } }`;
    const boardsData = await this._fetchMonday(boardsQuery);
    const allBoards = boardsData?.boards || [];

    // サブアイテムボードを除外
    const targetBoards = allBoards.filter(board => {
      return !CONSTANTS.EXCLUDED_BOARD_PATTERNS.some(pattern =>
        board.name.includes(pattern)
      );
    });

    // 2. 各ボードからアイテム取得（並列実行）
    const itemPromises = targetBoards.map(board => this._fetchBoardItems(board.id, board.name));
    const itemArrays = await Promise.all(itemPromises);

    // 3. 全アイテムを結合
    return itemArrays.flat();
  },

  /**
   * 単一ボードからアイテム取得
   * @param {string} boardId
   * @param {string} boardName
   * @returns {Promise<Array>}
   */
  async _fetchBoardItems(boardId, boardName) {
    const query = `
      query ($boardId: [ID!]!) {
        boards(ids: $boardId) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this._fetchMonday(query, { boardId: [boardId] });
      const items = data?.boards?.[0]?.items_page?.items || [];

      // ボード名を各アイテムに付与
      return items.map(item => ({ ...item, boardName }));
    } catch {
      // 個別ボードのエラーは無視して続行
      return [];
    }
  },

  /**
   * Monday API呼び出し
   * @param {string} query
   * @param {Object} variables
   * @returns {Promise<Object>}
   */
  async _fetchMonday(query, variables = {}) {
    const response = await fetch(CONSTANTS.MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this._settings.apiToken
      },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 401) {
      throw new Error('APIトークンが無効です。管理画面で再設定してください。');
    }

    if (response.status === 429) {
      throw new Error('APIレート制限に達しました。しばらく待ってください。');
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0].message);
    }

    return data.data;
  },

  /**
   * 緊急・高優先度 + 当日期限 + 担当者フィルタ（固定カラムID版）
   * @param {Array} items
   * @returns {Array}
   */
  _filterUrgentTasks(items) {
    const { userId } = this._settings;

    return items.filter(item => {
      // 固定カラムIDでカラムを探索
      const priorityCol = this._findColumn(item.column_values, CONSTANTS.COLUMN_IDS.PRIORITY);
      const dateCol = this._findColumn(item.column_values, CONSTANTS.COLUMN_IDS.DATE);
      const statusCol = this._findColumnById(item.column_values, CONSTANTS.COLUMN_IDS.STATUS);
      const personCol = this._findColumnById(item.column_values, CONSTANTS.COLUMN_IDS.PERSON);

      const priorityValue = priorityCol?.text || '';
      const dateValue = dateCol?.text || '';
      const statusValue = statusCol?.text || '';

      const isHighPriority = this._isHighPriority(priorityValue);
      const isTodayOrPast = this._isTodayOrPast(dateValue);
      const isCompleted = this._isCompleted(statusValue);
      const isAssignedToMe = this._isAssignedToUser(personCol, userId);

      return isHighPriority && isTodayOrPast && !isCompleted && isAssignedToMe;
    }).map(item => {
      const priorityCol = this._findColumn(item.column_values, CONSTANTS.COLUMN_IDS.PRIORITY);
      const dateCol = this._findColumn(item.column_values, CONSTANTS.COLUMN_IDS.DATE);
      const priorityValue = priorityCol?.text || '';
      const dateValue = dateCol?.text || '';
      return {
        id: item.id,
        name: item.name,
        boardName: item.boardName,
        priority: this._getPriorityLevel(priorityValue),
        isOverdue: this._isOverdue(dateValue)
      };
    });
  },

  /**
   * 複数候補からカラムを探索
   * @param {Array} columns
   * @param {Array} idCandidates
   * @returns {Object|null}
   */
  _findColumn(columns, idCandidates) {
    for (const id of idCandidates) {
      const col = columns.find(c => c.id === id);
      if (col) return col;
    }
    return null;
  },

  /**
   * 単一IDでカラムを探索
   * @param {Array} columns
   * @param {string} id
   * @returns {Object|null}
   */
  _findColumnById(columns, id) {
    return columns.find(c => c.id === id) || null;
  },

  /**
   * 担当者が指定ユーザーか判定
   * @param {Object} personCol
   * @param {string} userId
   * @returns {boolean}
   */
  _isAssignedToUser(personCol, userId) {
    if (!personCol?.value) return false;

    try {
      const parsed = JSON.parse(personCol.value);
      const personIds = parsed?.personsAndTeams?.map(p => String(p.id)) || [];
      return personIds.includes(String(userId));
    } catch {
      return false;
    }
  },

  /**
   * 優先度が緊急または高かどうか判定
   * @param {string} value
   * @returns {boolean}
   */
  _isHighPriority(value) {
    const normalized = value.toLowerCase().trim();
    const criticalValues = CONSTANTS.PRIORITY_VALUES.CRITICAL.map(v => v.toLowerCase());
    const highValues = CONSTANTS.PRIORITY_VALUES.HIGH.map(v => v.toLowerCase());
    return criticalValues.includes(normalized) || highValues.includes(normalized);
  },

  /**
   * 優先度レベルを取得
   * @param {string} value
   * @returns {'critical'|'high'|'normal'}
   */
  _getPriorityLevel(value) {
    const normalized = value.toLowerCase().trim();
    const criticalValues = CONSTANTS.PRIORITY_VALUES.CRITICAL.map(v => v.toLowerCase());
    if (criticalValues.includes(normalized)) return 'critical';
    return 'high';
  },

  /**
   * 当日または期限切れかどうか判定（JST）
   * @param {string} dateStr
   * @returns {boolean}
   */
  _isTodayOrPast(dateStr) {
    if (!dateStr) return false;

    try {
      const now = new Date();
      const todayStart = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }));
      const target = new Date(dateStr);
      // 期限日が今日以前（当日含む）
      return target <= new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    } catch {
      return false;
    }
  },

  /**
   * 期限切れかどうか判定（JST）
   * @param {string} dateStr
   * @returns {boolean}
   */
  _isOverdue(dateStr) {
    if (!dateStr) return false;

    try {
      const now = new Date();
      const todayStart = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }));
      const target = new Date(dateStr);
      // 期限日が今日より前
      return target < todayStart;
    } catch {
      return false;
    }
  },

  /**
   * 完了かどうか判定
   * @param {string} value
   * @returns {boolean}
   */
  _isCompleted(value) {
    const normalized = value.toLowerCase().trim();
    return CONSTANTS.COMPLETED_VALUES.map(v => v.toLowerCase()).includes(normalized);
  },

  /**
   * タスク一覧を描画
   * @param {Array} tasks
   */
  _renderTasks(tasks) {
    const list = this._elements.taskList;

    if (tasks.length === 0) {
      list.innerHTML = '<li class="empty">未完了の緊急・高優先度タスクはありません</li>';
      return;
    }

    list.innerHTML = tasks.map(task => `
      <li class="priority-${task.priority}${task.isOverdue ? ' overdue' : ''}">
        <div class="task-name">${this._escapeHtml(task.name)}</div>
        <div class="task-meta">
          <span class="task-priority ${task.priority}">
            ${task.priority === 'critical' ? '緊急' : '高'}
          </span>
          <span class="task-deadline${task.isOverdue ? ' overdue' : ''}">
            ${task.isOverdue ? '期限切れ' : '期限: 今日'}
          </span>
        </div>
      </li>
    `).join('');
  },

  /**
   * カウントダウン開始
   */
  _startCountdown() {
    this._nextCheckTime = new Date(Date.now() + this._intervalMs);

    this._countdownId = setInterval(() => {
      if (!this._nextCheckTime) return;

      const remaining = this._nextCheckTime - Date.now();
      if (remaining <= 0) {
        this._elements.countdown.textContent = '確認中...';
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      this._elements.countdown.textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
  },

  /**
   * エラー表示
   * @param {string} message
   */
  _showError(message) {
    this._elements.errorMessage.textContent = message;
    this._elements.errorMessage.style.display = 'block';
  },

  /**
   * エラー非表示
   */
  _hideError() {
    this._elements.errorMessage.style.display = 'none';
  },

  /**
   * HTMLエスケープ
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
