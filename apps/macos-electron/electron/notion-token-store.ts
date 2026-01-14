/**
 * Keytar-backed token store for Notion OAuth tokens.
 */
import keytar from 'keytar';
import type { NotionTokenStore } from '../../../servers/reasoning/src/notion-api.js';

const SERVICE = 'flwst-notion';
const ACCOUNT = 'oauth-token';

export class KeytarTokenStore implements NotionTokenStore {
  async loadToken(): Promise<string | null> {
    return await keytar.getPassword(SERVICE, ACCOUNT);
  }

  async saveToken(token: string): Promise<void> {
    await keytar.setPassword(SERVICE, ACCOUNT, token);
  }

  async clearToken(): Promise<void> {
    await keytar.deletePassword(SERVICE, ACCOUNT);
  }
}
