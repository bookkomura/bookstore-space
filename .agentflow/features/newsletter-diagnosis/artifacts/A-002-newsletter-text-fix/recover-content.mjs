import fs from 'node:fs'
import cp from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

// One-off recovery. Inputs and backups stay in a private temporary directory.
const privateRoot = '/private/tmp/newsletter-recovery-private'
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const normalizedParsed = block => block.type === 'image' ? { type: 'image', caption: block.caption ?? '' } : block
const normalizedStored = block => {
  switch (block.component) {
    case 'newsletter_paragraph': return { type: 'paragraph', text: block.text }
    case 'newsletter_link': return { type: 'link', label: block.label, href: block.href?.url }
    case 'newsletter_image': return { type: 'image', caption: block.caption ?? '' }
    case 'newsletter_divider': return { type: 'divider' }
    default: return null
  }
}
const dryRun = JSON.parse(fs.readFileSync(privateRoot + '/dry-run.json', 'utf8')).map(item => {
  if (item.ready) return item
  // Preserve an exact, independently verified deletion of an unchanged leading paragraph.
  const leadingDeletion = item.oldBlocks[0]?.type === 'paragraph' && hash(item.oldBlocks[0]) === hash(item.newBlocks[0]) &&
    hash(item.story.content.blocks.map(normalizedStored)) === hash(item.oldBlocks.slice(1).map(normalizedParsed))
  if (item.entry.eligible && item.entry.parserChanged && leadingDeletion) {
    return { ...item, ready: true, preservedLeadingDeletion: true, oldBlocks: item.oldBlocks.slice(1), newBlocks: item.newBlocks.slice(1) }
  }
  return item
})
const candidates = dryRun.filter(item => item.ready)
const applying = process.argv.includes('--apply')
const plans = applying ? JSON.parse(fs.readFileSync(privateRoot + '/planned-updates.json', 'utf8')) : candidates.map(item => {
  const { story, oldBlocks, newBlocks } = item
  const originalImages = oldBlocks.flatMap((block, index) => block.type === 'image'
    ? [{ cid: block.cid, content: story.content.blocks[index] }] : [])
  const imageCids = originalImages.map(image => image.cid)
  const newImageCids = newBlocks.filter(block => block.type === 'image').map(block => block.cid)
  if (JSON.stringify(imageCids) !== JSON.stringify(newImageCids)) throw new Error('Image order mismatch')
  const used = new Set()
  const blocks = newBlocks.map(block => {
    if (block.type === 'image') {
      const image = originalImages.find(image => image.cid === block.cid)?.content
      if (!image?.image?.filename) throw new Error('Missing existing image asset')
      const { caption: previousCaption, ...base } = image
      return { ...base, alt: block.caption || '小村碎碎念圖片', ...(block.caption ? { caption: block.caption } : {}) }
    }
    const index = oldBlocks.findIndex((old, index) => !used.has(index) && hash(old) === hash(block))
    if (index >= 0) {
      used.add(index)
      return story.content.blocks[index]
    }
    switch (block.type) {
      case 'paragraph': return { _uid: randomUUID(), component: 'newsletter_paragraph', text: block.text }
      case 'link': return { _uid: randomUUID(), component: 'newsletter_link', label: block.label, href: { url: block.href } }
      case 'divider': return { _uid: randomUUID(), component: 'newsletter_divider' }
      default: throw new Error('Unexpected block')
    }
  })
  return {
    id: story.id,
    beforeHash: hash(story.content),
    beforeUpdatedAt: story.updated_at,
    beforePublishedAt: story.published_at,
    content: { ...story.content, blocks },
    publicIdentity: { id: story.id, name: story.name, slug: story.slug, parent_id: story.parent_id },
  }
})

if (!applying) fs.writeFileSync(privateRoot + '/planned-updates.json', JSON.stringify(plans, null, 2), { mode: 0o600 })
const summary = {
  mode: applying ? 'apply' : 'dry-run',
  count: plans.length,
  storyIds: plans.map(plan => plan.id),
  existingAssetsRetained: true,
  metadataRetained: true,
  preservedLeadingDeletion: candidates.filter(item => item.preservedLeadingDeletion).map(item => item.story.id),
  originalContentBackup: privateRoot + '/dry-run.json',
  plannedContentSha256: hash(plans),
}

if (!applying) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  const token = cp.execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=newsletter-sync-storyblok-management-token', '--project=bookstore-space-5sdr'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const api = 'https://mapi.storyblok.com/v1/spaces/294002703577146/stories/'
  async function request(id, init = {}) {
    const response = await fetch(api + id, {
      ...init,
      headers: { Authorization: token, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error('Storyblok status ' + response.status)
    return (await response.json()).story
  }
  const restored = (current, plan) => current.published === true && current.unpublished_changes !== true &&
    isDeepStrictEqual(current.content, plan.content) && current.name === plan.publicIdentity.name &&
    current.slug === plan.publicIdentity.slug && current.parent_id === plan.publicIdentity.parent_id
  // Validate all candidates again before the first write; refuse drafts or concurrent changes.
  for (const plan of plans) {
    const current = await request(plan.id)
    if (restored(current, plan)) continue
    if (current.published !== true || current.unpublished_changes === true || hash(current.content) !== plan.beforeHash || current.updated_at !== plan.beforeUpdatedAt || current.published_at !== plan.beforePublishedAt) {
      throw new Error('Story changed since dry run: ' + plan.id)
    }
  }
  const updated = []
  for (const plan of plans) {
    const current = await request(plan.id)
    if (restored(current, plan)) {
      updated.push(plan.id)
      fs.writeFileSync(privateRoot + '/updated-stories.json', JSON.stringify(updated), { mode: 0o600 })
      console.log(JSON.stringify({ alreadyRestored: plan.id, verified: true }))
      continue
    }
    if (current.unpublished_changes === true || hash(current.content) !== plan.beforeHash || current.updated_at !== plan.beforeUpdatedAt || current.published_at !== plan.beforePublishedAt) {
      throw new Error('Concurrent edit: ' + plan.id)
    }
    await request(plan.id, { method: 'PUT', body: JSON.stringify({ publish: true, story: { id: plan.id, name: current.name, slug: current.slug, content: plan.content } }) })
    const verified = await request(plan.id)
    if (!restored(verified, plan)) {
      throw new Error('Read-back mismatch: ' + plan.id)
    }
    updated.push(plan.id)
    fs.writeFileSync(privateRoot + '/updated-stories.json', JSON.stringify(updated), { mode: 0o600 })
    console.log(JSON.stringify({ updated: plan.id, verified: true }))
  }
  fs.writeFileSync(privateRoot + '/apply-result.json', JSON.stringify({ ...summary, updated, verified: true }, null, 2), { mode: 0o600 })
}
