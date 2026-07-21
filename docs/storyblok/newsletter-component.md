# Newsletter component

The `newsletter` Storyblok component defines one public newsletter issue.

| Field | Type |
| --- | --- |
| `sent_at` | Date/Time |
| `subject` | Text |
| `blocks` | Blocks |

`blocks` may contain these components:

| Component | Fields |
| --- | --- |
| `newsletter_paragraph` | `text`: Textarea |
| `newsletter_image` | `image`: Asset; `alt`: Text; `caption`: Textarea (optional) |
| `newsletter_link` | `label`: Text; `href`: Link |
| `newsletter_divider` | No fields |

Gmail Message-ID is service-only metadata. It is stored by the Firestore sync service and must never be stored in Storyblok or frontend JSON.
