import { ContentBundleSchema, type ContentBundle } from './schema'

export async function loadContent(url = '/content.json'): Promise<ContentBundle> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`無法載入內容：${res.status}`)
  return ContentBundleSchema.parse(await res.json())
}
