# Dynamic Showcase Slots Design

## Goal

The top bookcase has ten fixed showcase slots.  CMS content determines which
slots are active: the first configured showcase uses the rightmost slot and
later entries proceed left.  An empty CMS showcase list leaves every slot
empty.

## Slot layout

The slot marker height remains `163`, matching the current showcase markers.
Their horizontal centres, ordered from right to left, are:

`1057, 981, 905, 828, 746, 668, 590, 512, 434, 356`.

Each active item receives a 72×64 interaction zone directly below its marker.
The marker and zone use the showcase item’s CMS id, so the order of the CMS
array selects the physical slot without requiring ids such as `showcase-1`.

## Data and runtime flow

`ContentBundleSchema` accepts zero through ten showcases and rejects eleven or
more.  A scene-layout factory combines the active showcase zones with the
always-present shelf and store-information zones.  It creates only as many
showcase zones as CMS entries.

After content loads, `App` builds the labels and interaction zones, then passes
both to `createGame`.  `StoreScene` receives those runtime zones and creates
markers only for them.  Therefore an empty showcase list produces neither
exclamation markers nor invisible showcase interaction areas.

## Validation and testing

Content validation uses the runtime-built zones, preserving one-to-one checks
between active CMS items and active scene zones.  Tests cover zero, three, and
ten configured showcases; right-to-left slot ordering; ten-centre alignment;
and rejection of an eleventh showcase.  Existing shelf and information zones
remain unchanged.

## Scope

No CMS migration, artwork change, or new marker design is required.  The
existing interaction marker styling and active-label behaviour remain intact.
