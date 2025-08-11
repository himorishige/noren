// Security plugin types

export interface SecurityConfig {
  /** 許可するCookie名のリスト（これらはマスクされない） */
  cookieAllowlist?: string[]
  /** 許可するヘッダー名のリスト（これらはマスクされない） */
  headerAllowlist?: string[]
  /** 厳格モード - より保守的な検出を行う */
  strictMode?: boolean
  /** JWT検出の最小長（デフォルト: 50） */
  jwtMinLength?: number
  /** API Key検出の最小長（デフォルト: 16） */
  apiKeyMinLength?: number
}

/** セキュリティ関連のPII種別 */
export type SecurityPiiType =
  | 'sec_auth_header' // Authorization Bearer/Basic
  | 'sec_api_key' // X-API-Key, X-Auth-Token等
  | 'sec_cookie' // Cookie値（allowlistベース）
  | 'sec_set_cookie' // Set-Cookie値
  | 'sec_url_token' // token, access_token, api_key等
  | 'sec_client_secret' // client_secret, client_id等
  | 'sec_jwt_token' // JWT形式 (xxx.yyy.zzz)
  | 'sec_uuid_token' // UUID形式のトークン
  | 'sec_hex_token' // 長い16進数文字列
  | 'sec_session_id' // セッションID形式

/** Cookie解析結果 */
export interface CookieInfo {
  name: string
  value: string
  isAllowed: boolean
}

/** HTTPヘッダー解析結果 */
export interface HeaderInfo {
  name: string
  value: string
  isAllowed: boolean
}
