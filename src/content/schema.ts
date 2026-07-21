import { z } from 'zod'
import { MAX_SHOWCASE_SLOTS } from '../game/sceneLayout'

export const PageSchema = z.object({
  image: z.string().url(),
  caption: z.string(),
})

export const ShowcaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  pages: z.array(PageSchema).min(1),
  creatorLink: z.string().url().optional(),
})

export const ShelfBookSchema = z.object({
  cover: z.string().url(),
  title: z.string().min(1),
  note: z.string(),
})

export const ShelfSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  books: z.array(ShelfBookSchema).min(1),
})

export const StoreInfoSchema = z.object({
  address: z.string().min(1),
  hours: z.string().min(1),
  instagram: z.string().url(),
  mapLink: z.string().url(),
})

const HttpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', '必須使用 HTTPS')

export const NewsletterBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal('image'), image: HttpsUrl, alt: z.string().min(1), caption: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal('link'), label: z.string().min(1), href: HttpsUrl }).strict(),
  z.object({ type: z.literal('divider') }).strict(),
])

export const NewsletterSchema = z.object({
  sentAt: z.string().datetime(),
  subject: z.string().min(1),
  blocks: z.array(NewsletterBlockSchema).min(1),
}).strict()

export const ContentBundleSchema = z.object({
  showcases: z.array(ShowcaseSchema).max(MAX_SHOWCASE_SLOTS),
  shelves: z.array(ShelfSchema),
  storeInfo: StoreInfoSchema,
  newsletters: z.array(NewsletterSchema),
})

export type Page = z.infer<typeof PageSchema>
export type Showcase = z.infer<typeof ShowcaseSchema>
export type ShelfBook = z.infer<typeof ShelfBookSchema>
export type Shelf = z.infer<typeof ShelfSchema>
export type StoreInfo = z.infer<typeof StoreInfoSchema>
export type NewsletterBlock = z.infer<typeof NewsletterBlockSchema>
export type Newsletter = z.infer<typeof NewsletterSchema>
export type ContentBundle = z.infer<typeof ContentBundleSchema>
