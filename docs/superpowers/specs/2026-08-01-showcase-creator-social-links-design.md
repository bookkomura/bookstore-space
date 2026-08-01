# Showcase Creator Social Links Design

## Goal

Replace the single `認識創作者` text link in the showcase viewer with a row of
optional platform icons. Editors can independently configure Facebook,
Instagram, Threads, and personal website links in Storyblok. The viewer renders
only the configured platforms.

## Current state

A Storyblok showcase has one optional `creator_link` Link field. The content
mapper exposes it as `Showcase.creatorLink`, and `BookViewer` renders one text
anchor in its header. The anchor appears on every page and receives a special
visual state on the final page.

## CMS fields and compatibility

Add four optional Link fields to the Storyblok `showcase` component:

- `facebook`
- `instagram`
- `threads`
- `website`

Keep the existing `creator_link` field temporarily for compatibility with
already-published showcases. Mapping uses the following rules:

1. Map each non-empty new field to its matching platform.
2. If `website` is empty and `creator_link` is non-empty, map `creator_link` as
   the personal website.
3. If both `website` and `creator_link` are present, use `website` and do not
   render a duplicate legacy link.
4. If none of the four resolved links exists, omit the creator-links value.

The compatibility rule lives in the Storyblok mapper. Downstream UI receives
one normalized representation and does not need to know whether a website URL
came from the new or legacy field.

## Content model

Introduce a `CreatorLinksSchema` with four optional URL fields: `facebook`,
`instagram`, `threads`, and `website`. `ShowcaseSchema` exposes this normalized
object as optional `creatorLinks` and removes the old single `creatorLink` from
the application-facing model.

The schema validates URL syntax but does not restrict social links to particular
domains. This keeps custom profile URLs and future domain changes from breaking
content builds. Empty Storyblok links are omitted by the mapper rather than
passed to the schema as empty strings.

## UI architecture

Create a focused `CreatorLinks` component that accepts the normalized optional
links object. It owns platform order, accessible labels, SVG icons, link
security attributes, and responsive styling. `BookViewer` only passes
`showcase.creatorLinks` into this component.

The component renders links in this fixed order:

1. Facebook
2. Instagram
3. Threads
4. Personal website

Each missing field removes only its matching anchor. When every field is
missing, the component renders nothing and leaves no empty header space.

## Visual design

Each link is a gold, thin-outline rounded square on the viewer's dark header:

- Default size: `36 × 36px`
- Narrow-screen size: `34 × 34px`
- Corner radius: `8px`
- Icon canvas: one consistent square size for all four platforms
- Alignment: the SVG canvas is horizontally and vertically centered with grid
  alignment inside its anchor

Use recognizable Facebook, Instagram, Threads, and globe SVG icons. The globe
represents a personal website. The icon row stays present and geometrically
stable on every showcase page. It does not receive the old final-page emphasis,
because the four independent destinations are peers rather than one primary
call to action.

At narrow viewport widths, the showcase title shrinks and truncates before the
icon buttons or close control overlap. The layout must accommodate all four
configured links at a 320-pixel viewport without horizontal scrolling.

## Interaction and accessibility

Every platform is a semantic anchor that:

- Opens in a new tab.
- Uses a safe `rel` value containing `noopener`.
- Has an accessible label containing the platform name and new-tab behavior.
- Has a visible keyboard focus treatment.
- Keeps the icon decorative to assistive technology so it does not duplicate
  the anchor's accessible name.

The icon row remains in the header on every page. Page navigation never inserts,
removes, or reorders configured creator links.

## Error handling

Malformed URLs fail content validation during the existing fetch/build flow.
The application does not render a disabled or broken icon for invalid content.
Empty optional Link fields are treated as absent. No runtime network check is
performed against creator destinations.

## Testing

Schema tests verify that:

- Any subset of the four optional links is accepted.
- A showcase with no creator links is accepted.
- Invalid URLs are rejected.

Storyblok mapping tests verify that:

- Each new field maps to its matching normalized property.
- Empty fields are omitted.
- `creator_link` becomes `website` only when the new `website` field is empty.
- A new `website` value takes precedence over `creator_link`.

Component tests verify that:

- Only configured platform anchors render.
- Anchors render in the fixed platform order.
- URLs, new-tab behavior, safe relationship attributes, and accessible labels
  are correct.
- The component renders no wrapper when all links are absent.

`BookViewer` integration tests verify that the icon row stays present across
page changes and that the old text link and final-page emphasis are removed.
A browser-level responsive check covers all four links at desktop and 320-pixel
viewport widths, including icon centering, title truncation, and absence of
horizontal overflow.

## Documentation

Update the Storyblok setup instructions in `README.md` to list the four new
optional Link fields and identify `creator_link` as a temporary legacy fallback
for `website`.

## Scope

This change covers the showcase creator-link data model, Storyblok mapping,
viewer header UI, relevant content documentation, and tests. It does not add
social links to shelves, store information, newsletters, or other overlays. It
does not automatically migrate or delete existing Storyblok `creator_link`
values.
