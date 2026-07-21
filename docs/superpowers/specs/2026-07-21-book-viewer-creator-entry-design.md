# Book Viewer Creator Entry Design

## Goal

Make the creator link available on every showcase page without shifting the
artwork, caption, or pagination controls. The last page should strengthen the
invitation to visit the creator while preserving the same layout dimensions.

## Current problem

`BookViewer` currently inserts the creator link below the pagination controls
only on the last page. Because the overlay is a vertical flex layout, inserting
that extra child reduces the space available to the artwork area and moves the
visible content upward.

## Chosen layout

Move the creator link into the header, between the showcase title and the close
button. Its visible copy is `認識創作者 ↗`.

The header has three areas:

1. A flexible title area that may truncate with an ellipsis.
2. A fixed-size creator link.
3. A fixed-size close button.

The creator link is present from the first page onward whenever
`showcase.creatorLink` exists. Changing pages never inserts or removes it, so it
does not change the height available to the artwork or controls. If a showcase
has no creator link, the link is absent for the entire viewing session and the
title may use the available header space.

## Visual states

On ordinary pages, the creator link uses a transparent background with a gold
outline and gold text. On the last page, it changes to a solid gold background
with dark text and a subtle outer glow.

Both states use identical width, height, padding, border width, and grid
position. The last-page emphasis may use a single short fade, but it must not
change geometry, repeat continuously, or distract from the artwork. Reduced
motion preferences disable the transition.

## Responsive behavior

The creator link keeps the full `認識創作者` label on mobile. When horizontal
space is limited, the title shrinks first and truncates with an ellipsis; the
creator link and close control retain their touch-target sizes. The design must
work at a 320-pixel viewport without horizontal scrolling or overlap.

## Interaction and accessibility

The link continues to open `showcase.creatorLink` in a new tab with
`rel="noopener"`. It is a semantic anchor, remains keyboard reachable, and has
a visible focus treatment distinct from the last-page highlight. The accessible
name indicates that it opens the creator page; the arrow is decorative rather
than the only external-link cue.

## Component and data flow

No content-schema or Storyblok mapping changes are required. `BookViewer`
continues to receive the optional `creatorLink` field from `Showcase`. Its
existing `isLast` computed state controls only the visual emphasis class; it no
longer controls whether the link is rendered.

## Validation

Component tests should verify that:

- A configured creator link appears on the first and every subsequent page.
- The last page applies the emphasized state without replacing the link node.
- Returning from the last page restores the ordinary state.
- The link retains its URL, new-tab behavior, and security relationship.
- A showcase without `creatorLink` never renders the creator entry.

A browser-level layout check should confirm that paging to the last page does
not change the header, artwork container, caption, or pagination positions as a
result of the creator entry. Responsive checks cover a 320-pixel viewport and a
desktop viewport.

## Scope

This change is limited to the creator entry in `BookViewer`. It does not change
showcase content, image sizing, captions, paging behavior, CMS fields, or other
overlay components.
