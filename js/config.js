/**
 * 設定管理
 */
const Config = {
  /**
   * APIトークンを保存
   * @param {string} token
   */
  saveApiToken(token) {
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.API_TOKEN, token);
  },

  /**
   * APIトークンを取得
   * @returns {string|null}
   */
  getApiToken() {
    return localStorage.getItem(CONSTANTS.STORAGE_KEYS.API_TOKEN);
  },

  /**
   * ボードIDを保存
   * @param {string} boardId
   */
  saveBoardId(boardId) {
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.BOARD_ID, boardId);
  },

  /**
   * ボードIDを取得
   * @returns {string|null}
   */
  getBoardId() {
    return localStorage.getItem(CONSTANTS.STORAGE_KEYS.BOARD_ID);
  },

  /**
   * 優先度カラムIDを保存
   * @param {string} columnId
   */
  savePriorityColumn(columnId) {
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.PRIORITY_COLUMN, columnId);
  },

  /**
   * 優先度カラムIDを取得
   * @returns {string|null}
   */
  getPriorityColumn() {
    return localStorage.getItem(CONSTANTS.STORAGE_KEYS.PRIORITY_COLUMN);
  },

  /**
   * 期限カラムIDを保存
   * @param {string} columnId
   */
  saveDateColumn(columnId) {
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.DATE_COLUMN, columnId);
  },

  /**
   * 期限カラムIDを取得
   * @returns {string|null}
   */
  getDateColumn() {
    return localStorage.getItem(CONSTANTS.STORAGE_KEYS.DATE_COLUMN);
  },

  /**
   * ステータスカラムIDを保存
   * @param {string} columnId
   */
  saveStatusColumn(columnId) {
    localStorage.setItem(CONSTANTS.STORAGE_KEYS.STATUS_COLUMN, columnId);
  },

  /**
   * ステータスカラムIDを取得
   * @returns {string|null}
   */
  getStatusColumn() {
    return localStorage.getItem(CONSTANTS.STORAGE_KEYS.STATUS_COLUMN);
  },

  /**
   * 全設定を保存
   * @param {Object} settings
   */
  saveAll(settings) {
    if (settings.apiToken) this.saveApiToken(settings.apiToken);
    if (settings.boardId) this.saveBoardId(settings.boardId);
    if (settings.priorityColumn) this.savePriorityColumn(settings.priorityColumn);
    if (settings.dateColumn) this.saveDateColumn(settings.dateColumn);
    if (settings.statusColumn) this.saveStatusColumn(settings.statusColumn);
  },

  /**
   * 全設定を取得
   * @returns {Object}
   */
  getAll() {
    return {
      apiToken: this.getApiToken(),
      boardId: this.getBoardId(),
      priorityColumn: this.getPriorityColumn(),
      dateColumn: this.getDateColumn(),
      statusColumn: this.getStatusColumn()
    };
  },

  /**
   * 設定が完了しているか確認
   * @returns {boolean}
   */
  isConfigured() {
    const settings = this.getAll();
    return !!(
      settings.apiToken &&
      settings.boardId &&
      settings.priorityColumn &&
      settings.dateColumn &&
      settings.statusColumn
    );
  }
};
