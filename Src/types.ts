export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  [key: string]: any // для расширяемости
}

export type AuthResult = TelegramUser & {
  // дополнительные поля, если нужно
}
