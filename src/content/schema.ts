import { z } from 'zod'

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

export const ContentBundleSchema = z.object({
  showcases: z.array(ShowcaseSchema),
  shelves: z.array(ShelfSchema),
  storeInfo: StoreInfoSchema,
})

export type Page = z.infer<typeof PageSchema>
export type Showcase = z.infer<typeof ShowcaseSchema>
export type ShelfBook = z.infer<typeof ShelfBookSchema>
export type Shelf = z.infer<typeof ShelfSchema>
export type StoreInfo = z.infer<typeof StoreInfoSchema>
export type ContentBundle = z.infer<typeof ContentBundleSchema>
