<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Newsletter } from '../content/schema'

const props = defineProps<{ newsletters: Newsletter[] }>()
const emit = defineEmits<{ close: [] }>()

const selectedIndex = ref(0)
const paper = ref<HTMLElement>()
const selectedIssue = computed(() => props.newsletters[selectedIndex.value])

watch(selectedIndex, () => paper.value?.scrollTo({ top: 0, behavior: 'auto' }))

function displayTitle(subject: string) {
  const separator = subject.indexOf('～')
  return separator === -1 ? subject : subject.slice(separator + 1).trim() || subject
}

function displayDate(sentAt: string) {
  return new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric' }).format(new Date(sentAt))
}
</script>

<template>
  <section
    class="archive"
    data-testid="newsletter-archive"
    role="dialog"
    aria-modal="true"
    aria-label="小村碎碎念"
  >
    <header class="archive-header">
      <h2>小村碎碎念</h2>
      <button data-testid="close" type="button" aria-label="關閉" @click="emit('close')">✕</button>
    </header>

    <nav class="issue-nav" aria-label="選擇電子報期數">
      <button
        v-for="(issue, index) in newsletters"
        :key="issue.sentAt"
        class="envelope"
        :class="{ 'envelope--open': selectedIndex === index }"
        :aria-pressed="selectedIndex === index"
        type="button"
        data-testid="envelope-issue"
        @click="selectedIndex = index"
      >
        <span class="envelope-flap" aria-hidden="true" />
        <span class="envelope-body">
          <span class="envelope-stamp" aria-hidden="true" />
          <time :datetime="issue.sentAt">{{ displayDate(issue.sentAt) }}</time>
          <span class="envelope-title">{{ displayTitle(issue.subject) }}</span>
        </span>
      </button>
    </nav>

    <main ref="paper" data-testid="newsletter-content" tabindex="0">
      <template v-if="selectedIssue">
        <h3>{{ displayTitle(selectedIssue.subject) }}</h3>
        <template v-for="(block, index) in selectedIssue.blocks" :key="index">
          <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
          <figure v-else-if="block.type === 'image'">
            <img :src="block.image" :alt="block.alt">
            <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
          </figure>
          <a
            v-else-if="block.type === 'link'"
            data-testid="newsletter-link"
            :href="block.href"
            target="_blank"
            rel="noopener"
          >{{ block.label }}</a>
          <hr v-else>
        </template>
      </template>
      <p v-else class="empty-state">目前沒有可閱讀的電子報。</p>
    </main>
  </section>
</template>

<style scoped>
.archive {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  color: #322718;
  background: #e9dfca;
}

.archive-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px 8px;
  border-bottom: 1px solid rgba(50, 39, 24, 0.2);
}

.archive-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.archive-header button {
  width: 44px;
  height: 44px;
  padding: 0;
  color: inherit;
  font-size: 1.5rem;
  background: transparent;
  border: 0;
}

.issue-nav {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  border-bottom: 1px solid rgba(50, 39, 24, 0.2);
}

.envelope {
  position: relative;
  flex: 0 0 10rem;
  min-height: 74px;
  padding: 0;
  overflow: visible;
  color: #322718;
  text-align: left;
  background: transparent;
  border: 0;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.envelope-body {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  box-sizing: border-box;
  padding: 20px 42px 10px 12px;
  overflow: hidden;
  background: #f8f1e5;
  border: 1px solid #aa8760;
  border-radius: 3px;
  transition: top 180ms ease, box-shadow 180ms ease;
}

.envelope-stamp {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  display: block;
  width: 20px;
  height: 26px;
  background: linear-gradient(135deg, #d7bb8c 0 48%, #c79862 49% 100%);
  border: 1px dashed #7a5220;
  border-radius: 1px;
  box-shadow: inset 0 0 0 2px #f8f1e5;
}

.envelope-flap {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
  border-right: 80px solid transparent;
  border-bottom: 32px solid #f8f1e5;
  border-left: 80px solid transparent;
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
  transition: opacity 180ms ease, transform 180ms ease;
}

.envelope time,
.envelope-title {
  position: relative;
  z-index: 1;
  display: block;
}

.envelope time {
  margin-bottom: 3px;
  font-size: 0.75rem;
}

.envelope-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.envelope--open {
  min-height: 106px;
  transform: translateY(-2px);
}

.envelope--open .envelope-body {
  top: 32px;
  box-shadow: 0 4px 0 #aa8760;
}

.envelope--open .envelope-flap {
  opacity: 1;
  transform: translateX(-50%);
}

.envelope:focus-visible,
.archive-header button:focus-visible,
main:focus-visible {
  outline: 3px solid #7a5220;
  outline-offset: 3px;
}

main {
  min-height: 0;
  padding: 24px max(20px, calc((100% - 42rem) / 2));
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: #f8f1e5;
}

main h3 {
  margin-top: 0;
}

main p,
main figcaption {
  line-height: 1.8;
}

main figure {
  margin: 24px 0;
}

main img {
  display: block;
  max-width: 100%;
  height: auto;
}

main figcaption {
  margin-top: 8px;
  color: #6d5a42;
}

main a {
  display: inline-block;
  padding: 10px 14px;
  color: #fffaf0;
  font-weight: 600;
  text-decoration: none;
  background: #7a5220;
  border-radius: 4px;
}

main hr {
  margin: 28px 0;
  border: 0;
  border-top: 1px solid #c8b89d;
}

.empty-state {
  margin: 0;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .envelope, .envelope-body, .envelope-flap { transition: none; }
}
</style>
