<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Newsletter } from '../content/schema'

const props = defineProps<{ newsletters: Newsletter[] }>()
const emit = defineEmits<{ close: [] }>()

const selectedIndex = ref(0)
const paper = ref<HTMLElement>()
const pickerOpen = ref(true)
let anchorY = 0
const HIDE_THRESHOLD = 28

const selectedIssue = computed(() => props.newsletters[selectedIndex.value])

const years = computed(() => [
  ...new Set(props.newsletters.map((issue) => new Date(issue.sentAt).getFullYear())),
])

const selectedYear = computed(() =>
  selectedIssue.value ? new Date(selectedIssue.value.sentAt).getFullYear() : years.value[0],
)

const visibleIssues = computed(() =>
  props.newsletters
    .map((issue, index) => ({ issue, index }))
    .filter(({ issue }) => new Date(issue.sentAt).getFullYear() === selectedYear.value),
)

/** 期數編號：最舊一封為第 1 封 */
function issueNo(index: number) {
  return props.newsletters.length - index
}

function selectYear(year: number) {
  const first = props.newsletters.findIndex((issue) => new Date(issue.sentAt).getFullYear() === year)
  if (first >= 0) selectIssue(first)
}

function selectIssue(index: number) {
  selectedIndex.value = index
  pickerOpen.value = true
}

/**
 * 往下滑 → 收起信封列，讓信紙滿版；往上滑 → 信封列滑回來，方便翻下一封。
 * 用「離上次判定點的距離」而非逐次 delta 判斷，避免 iOS 慣性捲動 / 橡皮筋回彈
 * 產生的微小反向抖動被誤判成「往上滑」，導致信封列閃爍。
 */
function handleScroll() {
  const el = paper.value
  if (!el) return
  const y = Math.max(0, el.scrollTop)
  if (y <= 24) {
    pickerOpen.value = true
    anchorY = y
    return
  }
  if (y - anchorY > HIDE_THRESHOLD) {
    pickerOpen.value = false
    anchorY = y
  } else if (anchorY - y > HIDE_THRESHOLD) {
    pickerOpen.value = true
    anchorY = y
  }
}

onMounted(() => paper.value?.addEventListener('scroll', handleScroll, { passive: true }))
onBeforeUnmount(() => paper.value?.removeEventListener('scroll', handleScroll))

watch(selectedIndex, () => {
  anchorY = 0
  paper.value?.scrollTo({ top: 0, behavior: 'auto' })
})

function displayTitle(subject: string) {
  const separator = subject.indexOf('～')
  return separator === -1 ? subject : subject.slice(separator + 1).trim() || subject
}

function shortDate(sentAt: string) {
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(new Date(sentAt))
}

function displayDate(sentAt: string) {
  return new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric' }).format(new Date(sentAt))
}

function fullDate(sentAt: string) {
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(sentAt),
  )
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
      <div class="masthead">
        <h2>小村碎碎念</h2>
        <span>寄給村民的信</span>
      </div>
      <button data-testid="close" type="button" aria-label="關閉" @click="emit('close')">✕</button>
    </header>

    <div class="picker" :class="{ 'picker--hidden': !pickerOpen }">
      <nav class="year-nav" aria-label="選擇年份">
        <button
          v-for="year in years"
          :key="year"
          type="button"
          class="year"
          :class="{ 'year--on': year === selectedYear }"
          :aria-pressed="year === selectedYear"
          @click="selectYear(year)"
        >{{ year }} 年</button>
      </nav>

      <nav class="issue-nav" aria-label="選擇電子報期數">
        <button
          v-for="{ issue, index } in visibleIssues"
          :key="issue.sentAt"
          class="envelope"
          :class="{ 'envelope--open': selectedIndex === index }"
          :aria-pressed="selectedIndex === index"
          type="button"
          data-testid="envelope-issue"
          @click="selectIssue(index)"
        >
          <span class="envelope-flap" aria-hidden="true" />
          <span class="envelope-body">
            <span class="envelope-stamp" aria-hidden="true">{{ shortDate(issue.sentAt) }}</span>
            <span class="envelope-no">第 {{ issueNo(index) }} 封</span>
            <span class="envelope-title">{{ displayTitle(issue.subject) }}</span>
          </span>
        </button>
      </nav>
    </div>

    <main ref="paper" data-testid="newsletter-content" tabindex="0">
      <article v-if="selectedIssue" class="letter" :key="selectedIssue.sentAt">
        <div class="letter-head">
          <div>
            <p class="letter-kicker">小村碎碎念</p>
            <h3>{{ displayTitle(selectedIssue.subject) }}</h3>
          </div>
          <div class="postmark" aria-hidden="true">
            <span>
              {{ new Date(selectedIssue.sentAt).getFullYear() }}<br>
              {{ shortDate(selectedIssue.sentAt) }}<br>
              台東·小村
            </span>
          </div>
        </div>

        <template v-for="(block, index) in selectedIssue.blocks" :key="index">
          <p class="paragraph" v-if="block.type === 'paragraph'">{{ block.text }}</p>

          <figure v-else-if="block.type === 'image'" :class="index % 2 === 0 ? 'tilt-l' : 'tilt-r'">
            <div class="photo">
              <img :src="block.image" :alt="block.alt" loading="lazy">
              <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
            </div>
          </figure>

          <div v-else-if="block.type === 'link'" class="link-block">
            <span class="link-label">連結</span>
            <a
              data-testid="newsletter-link"
              :href="block.href"
              target="_blank"
              rel="noopener"
            >{{ block.label }} ↗</a>
          </div>

          <hr v-else>
        </template>

        <footer class="letter-foot">
          <span>第 {{ issueNo(selectedIndex) }} 封 · {{ fullDate(selectedIssue.sentAt) }}</span>
          <span class="sign">小村閱讀</span>
        </footer>
      </article>

      <p v-else class="empty-state">目前沒有可閱讀的電子報。</p>
    </main>
  </section>
</template>

<style scoped>
/*
 * 頁首與信封列是 .archive 的獨立 grid 列（不在 <main> 捲動區內）。
 * 兩者若放進 <main>，收合信封列會抽掉捲動內容高度 → 瀏覽器重新夾制 scrollTop
 * → 再觸發一次 scroll → 與使用者的手指互相打架（往下滑會頓住／彈回）。
 */
.archive {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  color: #322718;
  background: #e3d7bf;
  font-family: "Noto Serif TC", serif;
}

main {
  min-height: 0;
  padding: 0 16px 60px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
}

main:focus-visible,
.archive-header button:focus-visible,
.envelope:focus-visible,
.year:focus-visible {
  outline: 3px solid #7a5220;
  outline-offset: 3px;
}

/* ---------- 頁首（永遠可見的細長列） ---------- */

.archive-header {
  z-index: 6;
  display: flex;
  box-sizing: border-box;
  height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 20px;
  background: #e3d7bf;
  box-shadow: 0 1px 0 rgba(50, 39, 24, 0.18);
}

.masthead {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.masthead h2 {
  margin: 0;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: 1.5rem;
  letter-spacing: 0.04em;
}

.masthead span {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: #6d5a42;
}

.archive-header button {
  width: 44px;
  height: 44px;
  padding: 0;
  color: #6d5a42;
  font-size: 1.35rem;
  background: transparent;
  border: 0;
  cursor: pointer;
}

/* ---------- 信封列：往下讀時收起，往上滑時回來 ---------- */

/*
 * 收合用 max-height 動畫；grid-template-rows fr↔fr 雖然是較新寫法，
 * 但在部分瀏覽器上動畫不會內插（沒 transition 直接跳可以，一加 transition 就卡住），
 * 所以改用相容性最好的 max-height。上限只需大於實際高度（年份列 + 單排信封，
 * 水平捲動，不隨期數增加而變高）。
 */
.picker {
  z-index: 5;
  overflow: hidden;
  max-height: 200px;
  background: #e3d7bf;
  box-shadow: 0 8px 18px rgba(50, 39, 24, 0.12);
  transition: max-height 300ms cubic-bezier(0.22, 0.8, 0.28, 1), opacity 220ms ease,
    box-shadow 300ms ease;
}

.picker--hidden {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
  box-shadow: none;
}

.year-nav {
  display: flex;
  gap: 4px;
  padding: 0 20px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(50, 39, 24, 0.18);
}

.year {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 14px;
  font: inherit;
  font-size: 0.92rem;
  letter-spacing: 0.06em;
  color: #8a7355;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.year--on {
  color: #7a5220;
  font-weight: 700;
  border-bottom-color: #7a5220;
}

.issue-nav {
  display: flex;
  gap: 12px;
  padding: 10px 20px 14px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  border-bottom: 1px solid rgba(50, 39, 24, 0.18);
}

.envelope {
  position: relative;
  flex: 0 0 12.5rem;
  min-height: 76px;
  padding: 0;
  overflow: visible;
  font: inherit;
  color: #322718;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: min-height 240ms ease, transform 240ms ease;
}

.envelope-body {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  box-sizing: border-box;
  padding: 12px 14px;
  overflow: hidden;
  background: #f4ead6;
  border: 1px solid #c4a87f;
  border-radius: 3px;
  box-shadow: 0 2px 6px rgba(50, 39, 24, 0.08);
  transition: top 240ms ease, box-shadow 240ms ease, background 240ms ease;
}

.envelope-stamp {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  font-size: 0.6rem;
  color: #8a6a40;
  border: 1px dashed #a8845c;
  border-radius: 50%;
  transform: rotate(-8deg);
}

.envelope-flap {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  width: 100%;
  height: 28px;
  pointer-events: none;
  background: #f0e3ca;
  clip-path: polygon(0 100%, 50% 0, 100% 100%);
  filter: drop-shadow(0 -1px 0 #c4a87f);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 240ms ease, transform 240ms ease;
}

.envelope-no,
.envelope-title,
.envelope-date {
  position: relative;
  z-index: 1;
  display: block;
}

.envelope-no {
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: #8a7355;
}

.envelope-title {
  margin-top: 4px;
  padding-right: 40px;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: 0.95rem;
  line-height: 1.35;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.envelope-date {
  margin-top: 2px;
  font-size: 0.7rem;
  color: #9a8365;
}

.envelope--open {
  min-height: 104px;
  transform: translateY(-3px);
}

.envelope--open .envelope-body {
  top: 28px;
  background: #fdf7ea;
  border-color: #a8845c;
  box-shadow: 0 6px 0 -1px #b9986e, 0 10px 18px rgba(50, 39, 24, 0.18);
}

.envelope--open .envelope-flap {
  opacity: 1;
  transform: none;
}

/* ---------- 信紙 ---------- */

.letter {
  box-sizing: border-box;
  width: 100%;
  max-width: 42rem;
  min-height: 100%;
  margin: 0 auto;
  padding: 30px clamp(20px, 5vw, 46px) 40px;
  background: #fdf9f0;
  border: 1px solid #e2d5bc;
  border-radius: 2px;
  box-shadow: 0 14px 34px rgba(50, 39, 24, 0.14);
  animation: letter-in 400ms cubic-bezier(0.22, 0.8, 0.28, 1) both;
}

@keyframes letter-in {
  from { opacity: 0; transform: translateY(-22px); }
  to { opacity: 1; transform: none; }
}

.letter-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px dashed #cdb996;
}

.letter-kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  color: #8a7355;
}

.letter h3 {
  margin: 8px 0 0;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: 1.55rem;
  line-height: 1.35;
  text-wrap: pretty;
}

.postmark {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  color: #8a6a40;
  text-align: center;
  border: 2px dashed #a8845c;
  border-radius: 50%;
  transform: rotate(-7deg);
}

.postmark span {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  line-height: 1.5;
}

.paragraph {
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  color: #4a3b25;
}

.letter p {
  margin: 18px 0 0;
  font-size: 1.02rem;
  line-height: 2;
  letter-spacing: 0.02em;
  text-wrap: pretty;
}

/* 貼在信紙上的照片 */
.letter figure {
  margin: 30px 0;
}

.tilt-l { transform: rotate(-1.2deg); }
.tilt-r { transform: rotate(1.1deg); }

.photo {
  padding: 10px;
  background: #fffdf8;
  border: 1px solid #e0d3bb;
  box-shadow: 0 6px 16px rgba(50, 39, 24, 0.16);
}

.photo img {
  display: block;
  width: 100%;
  height: auto;
}

.photo figcaption {
  padding: 10px 2px 2px;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: 0.9rem;
  line-height: 1.7;
  color: #6d5a42;
}

/* 連結：獨立成段，不與內文黏在一起 */
.link-block {
  margin: 34px 0;
  padding-left: 16px;
  border-left: 2px solid #d3bd98;
}

.link-label {
  display: block;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: #9a8365;
}

.link-block a {
  display: inline-block;
  margin-top: 6px;
  font-size: 1.02rem;
  font-weight: 500;
  line-height: 1.7;
  color: #7a5220;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-decoration-color: #b9986e;
  text-underline-offset: 5px;
}

.link-block a:hover {
  color: #573814;
  text-decoration-color: #7a5220;
}

.letter hr {
  margin: 36px 0;
  border: 0;
  border-top: 1px dashed #c8b89d;
}

.letter-foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-top: 40px;
  padding-top: 22px;
  border-top: 1px dashed #cdb996;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  color: #9a8365;
}

.sign {
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: 1.15rem;
  letter-spacing: normal;
  color: #4a3b25;
}

.empty-state {
  margin: 120px 0 0;
  text-align: center;
}

@media (max-width: 640px) {
  .envelope { flex: 0 0 11rem; min-height: 66px; }
  .envelope--open { min-height: 92px; }
  .envelope--open .envelope-body { top: 26px; }
  .envelope-flap { height: 26px; }
}

@media (prefers-reduced-motion: reduce) {
  .envelope,
  .envelope-body,
  .envelope-flap,
  .picker { transition: none; }
  .letter { animation: none; }
}
</style>
