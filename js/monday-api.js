/**
 * Monday.com API連携
 */
const MondayAPI = {
  /**
   * GraphQLクエリを実行
   * @param {string} query
   * @param {Object} variables
   * @returns {Promise<Object|null>}
   */
  async query(query, variables = {}) {
    const token = Config.getApiToken();
    if (!token) {
      throw new Error('APIトークンが設定されていません');
    }

    try {
      const response = await fetch(CONSTANTS.MONDAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ query, variables })
      });

      if (response.status === 401) {
        throw new Error(CONSTANTS.ERROR_MESSAGES.INVALID_TOKEN);
      }

      if (response.status === 429) {
        throw new Error(CONSTANTS.ERROR_MESSAGES.RATE_LIMIT);
      }

      if (!response.ok) {
        throw new Error(CONSTANTS.ERROR_MESSAGES.NETWORK_ERROR);
      }

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors[0].message);
      }

      return data.data;
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error(CONSTANTS.ERROR_MESSAGES.NETWORK_ERROR);
      }
      throw error;
    }
  },

  /**
   * ボード一覧を取得
   * @returns {Promise<Array>}
   */
  async getBoards() {
    const query = `
      query {
        boards(limit: 50) {
          id
          name
        }
      }
    `;
    const data = await this.query(query);
    return data?.boards || [];
  },

  /**
   * ボードのカラム一覧を取得
   * @param {string} boardId
   * @returns {Promise<Array>}
   */
  async getColumns(boardId) {
    const query = `
      query ($boardId: [ID!]!) {
        boards(ids: $boardId) {
          columns {
            id
            title
            type
          }
        }
      }
    `;
    const data = await this.query(query, { boardId: [boardId] });
    return data?.boards?.[0]?.columns || [];
  },

  /**
   * ボードのアイテム（タスク）を取得
   * @param {string} boardId
   * @returns {Promise<Array>}
   */
  async getItems(boardId) {
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
    const data = await this.query(query, { boardId: [boardId] });
    return data?.boards?.[0]?.items_page?.items || [];
  },

  /**
   * APIトークンの有効性を確認
   * @returns {Promise<boolean>}
   */
  async validateToken() {
    try {
      const query = `query { me { id } }`;
      await this.query(query);
      return true;
    } catch {
      return false;
    }
  }
};
